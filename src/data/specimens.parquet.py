import csv, io, os, sys, time, zipfile
from pathlib import Path
import pandas as pd
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

API = "https://api.gbif.org/v1/occurrence/download"
DATASETS = {
    "54cd9f35-2864-4c7b-93f5-dc7a62f84373": "Lichens",
    "20e2ba7f-c339-42e9-bc3c-0ca587b78311": "Fungi",
    "78267f17-2c1f-46ba-8d83-3e57cfb2c4e8": "Algae",
}
CACHE = ROOT / ".gbif-cache"
GBIF_ZIP = CACHE / "nysm-herbarium.zip"
CNH_ZIP = ROOT / "data-sources" / "cnh-nys-vascular.zip"
MAX_AGE_DAYS = 30

COLUMNS = [
    "catalogNumber", "scientificName", "family", "genus", "species",
    "taxonRank", "recordedBy", "eventDate", "year", "stateProvince",
    "county", "locality", "decimalLatitude", "decimalLongitude",
    "coordinateUncertaintyInMeters", "typeStatus",
]

def log(*args):
    print(*args, file=sys.stderr)

# ---------- GBIF: lichens, fungi, algae ----------
def fetch_gbif():
    CACHE.mkdir(exist_ok=True)
    if GBIF_ZIP.exists() and time.time() - GBIF_ZIP.stat().st_mtime < MAX_AGE_DAYS * 86400:
        log("Using cached GBIF download")
        return
    user, pwd = os.environ["GBIF_USER"], os.environ["GBIF_PWD"]
    request = {
        "creator": user,
        "notificationAddresses": [os.environ["GBIF_EMAIL"]],
        "format": "DWCA",
        "predicate": {"type": "in", "key": "DATASET_KEY", "values": list(DATASETS)},
    }
    r = requests.post(f"{API}/request", json=request, auth=(user, pwd))
    r.raise_for_status()
    key = r.text.strip()
    log("Requested GBIF download", key, "- this usually takes a few minutes")
    while True:
        info = requests.get(f"{API}/{key}").json()
        log("Status:", info["status"])
        if info["status"] == "SUCCEEDED":
            break
        if info["status"] in ("FAILED", "KILLED", "CANCELLED"):
            sys.exit(f"GBIF download {info['status']}")
        time.sleep(30)
    with requests.get(info["downloadLink"], stream=True) as dl:
        dl.raise_for_status()
        with open(GBIF_ZIP, "wb") as f:
            for chunk in dl.iter_content(1 << 20):
                f.write(chunk)

def load_gbif():
    fetch_gbif()
    with zipfile.ZipFile(GBIF_ZIP) as z, z.open("occurrence.txt") as f:
        df = pd.read_csv(
            f, sep="\t", dtype=str, quoting=csv.QUOTE_NONE,
            usecols=lambda c: c in COLUMNS + ["gbifID", "datasetKey"],
            on_bad_lines="warn",
        )
    df["collection"] = df["datasetKey"].map(DATASETS)
    df["recordURL"] = "https://www.gbif.org/occurrence/" + df["gbifID"]
    df["source"] = "GBIF"
    return df.drop(columns=["gbifID", "datasetKey"])

# ---------- CNH: vascular plants (manual download) ----------
def load_cnh():
    if not CNH_ZIP.exists():
        log("No CNH file in data-sources/, skipping vascular plants")
        return None
    with zipfile.ZipFile(CNH_ZIP) as z:
        name = next(n for n in z.namelist()
                    if n.lower().startswith("occurrence") and n.endswith(".csv"))
        raw = z.read(name)
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        log("CNH file isn't UTF-8, reading it as Latin-1")
        text = raw.decode("latin-1")
    df = pd.read_csv(io.StringIO(text), dtype=str, low_memory=False)
    if "species" not in df and {"genus", "specificEpithet"} <= set(df.columns):
        df["species"] = (df["genus"] + " " + df["specificEpithet"]).where(
            df["specificEpithet"].notna())
    out = df[[c for c in COLUMNS if c in df.columns]].copy()
    out["collection"] = "Vascular plants"
    out["recordURL"] = df["references"] if "references" in df else None
    out["source"] = "CNH"
    return out

# ---------- combine and clean ----------
NY_LAT, NY_LON = (40.4, 45.1), (-79.8, -71.8)  # rough box around New York

def clean(df):
    notes = {}

    # Tidy text
    for c in df.select_dtypes("object").columns:
        df[c] = (df[c].str.strip()
                      .str.replace(r"\s+", " ", regex=True)
                      .replace("", pd.NA))

    # Years: use eventDate when year is missing, drop impossible values
    year_from_date = pd.to_numeric(
        df["eventDate"].str.extract(r"(\d{4})")[0], errors="coerce")
    df["year"] = (pd.to_numeric(df["year"], errors="coerce")
                    .fillna(year_from_date).astype("Int64"))
    bad_year = ((df["year"] < 1750) |
                (df["year"] > pd.Timestamp.now().year)).fillna(False)
    notes["implausible years removed"] = int(bad_year.sum())
    df.loc[bad_year, "year"] = pd.NA
    df["decade"] = (df["year"] // 10) * 10

    # Coordinates
    for col in ["decimalLatitude", "decimalLongitude", "coordinateUncertaintyInMeters"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    lat, lon = df["decimalLatitude"], df["decimalLongitude"]
    has = lat.notna() & lon.notna()
    invalid = has & (((lat == 0) & (lon == 0)) |
                     ~lat.between(-90, 90) | ~lon.between(-180, 180))
    notes["invalid coordinates removed"] = int(invalid.sum())
    df.loc[invalid, ["decimalLatitude", "decimalLongitude"]] = float("nan")

    # Place names
    df["stateProvince"] = df["stateProvince"].replace(
        {"NY": "New York", "N.Y.": "New York", "New York State": "New York"})
    df["county"] = (df["county"]
                      .str.replace(r"\s+(County|Co\.?)$", "", regex=True, case=False)
                      .str.title())

    # Coordinate status: ok / suspect / none
    lat, lon = df["decimalLatitude"], df["decimalLongitude"]
    in_ny_box = lat.between(*NY_LAT) & lon.between(*NY_LON)
    labeled_ny = df["stateProvince"].eq("New York").fillna(False)
    df["coordStatus"] = "none"
    df.loc[lat.notna(), "coordStatus"] = "ok"
    df.loc[lat.notna() & labeled_ny & ~in_ny_box, "coordStatus"] = "suspect"

    # Taxonomy
    df["family"] = df["family"].str.capitalize()
    df["genus"] = df["genus"].fillna(df["scientificName"].str.split().str[0])

    # Collectors: first name listed
    df["primaryCollector"] = df["recordedBy"].str.split(
        r"\s*(?:;|\||&| and | with )\s*", regex=True).str[0]

    # Duplicates
    before = len(df)
    df = df.drop_duplicates()
    notes["exact duplicate rows removed"] = before - len(df)

    for k, v in notes.items():
        log(f"Cleaning: {v:,} {k}")
    log("Coordinate status:", df["coordStatus"].value_counts().to_dict())
    return df

frames = [load_gbif(), load_cnh()]
df = clean(pd.concat([f for f in frames if f is not None], ignore_index=True))

for name, group in df.groupby("collection"):
    log(f"{name}: {len(group):,} records, "
        f"{(group['coordStatus'] == 'ok').sum():,} with usable coordinates")

buf = io.BytesIO()
df.to_parquet(buf, index=False)
sys.stdout.buffer.write(buf.getvalue())