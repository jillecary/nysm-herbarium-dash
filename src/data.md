---
title: Data & digitization
toc: false
---

[← Overview](./)

# Data & digitization

```js
import {
  loadSpecimens, collectionsIn, tabs, yearFormat, completenessChart,
  COMPLETENESS_FIELDS, NY_COUNTIES,
  COLORS
} from "./components/specimens.js";

const specimens = await loadSpecimens();
const collectionNames = collectionsIn(specimens);
```

```js
const summary = collectionNames.map((c) => {
  const v = specimens.filter((d) => d.collection === c);
  const ys = v.map((d) => d.year).filter((y) => y != null);
  return {
    "Collection": c,
    "Records": v.length,
    "Usable coordinates": v.filter((d) => d.coordStatus === "ok").length,
    "Suspect coordinates": v.filter((d) => d.coordStatus === "suspect").length,
    "No year": v.filter((d) => d.year == null).length,
    "No family": v.filter((d) => !d.family).length,
    "Earliest": d3.min(ys),
    "Latest": d3.max(ys)
  };
});
display(Inputs.table(summary, {
  layout: "auto",
  
  format: {"Earliest": yearFormat, "Latest": yearFormat}
}));
```

```js
const tab = view(tabs(["Completeness", "Georeferencing backlog", "Suspect coordinates"]));
```

```js
// ---------- Completeness ----------
const completenessGrid = collectionNames.flatMap((c) => {
  const v = specimens.filter((d) => d.collection === c);
  return COMPLETENESS_FIELDS.map(([field, test]) => ({
    collection: c, field, pct: d3.mean(v, (d) => (test(d) ? 1 : 0))
  }));
});

function completenessGridChart(width) {
  return Plot.plot({
    width,
    height: COMPLETENESS_FIELDS.length * 34 + 60,
    marginLeft: 150,
    x: {label: null, axis: "top", domain: collectionNames},
    y: {label: null, domain: COMPLETENESS_FIELDS.map(([f]) => f)},
    color: {type: "linear", domain: [0, 1], scheme: "blues"},
    marks: [
      Plot.cell(completenessGrid, {x: "collection", y: "field", fill: "pct", inset: 1}),
      Plot.text(completenessGrid, {
        x: "collection", y: "field",
        text: (d) => d3.format(".0%")(d.pct),
        fill: (d) => (d.pct > 0.55 ? "white" : "black")
      })
    ]
  });
}
```

```js
// ---------- Georeferencing backlog ----------
const STATUS = ["Has locality description", "County only", "No location recorded"];
const STATUS_COLORS = ["#2a9d8f", "#e9c46a", "#bbbbbb"];

const backlog = specimens
  .filter((d) => d.coordStatus === "none")
  .map((d) => ({
    ...d,
    backlogStatus: d.locality ? STATUS[0] : d.county ? STATUS[1] : STATUS[2]
  }));
const ready = backlog.filter((d) => d.backlogStatus === STATUS[0]);
const countyOnly = backlog.filter((d) => d.backlogStatus === STATUS[1]).length;
const readyTypes = ready.filter((d) => d.typeCat).length;

function backlogChart(width) {
  return Plot.plot({
    width,
    marginLeft: 110,
    height: collectionNames.length * 40 + 60,
    x: {label: "Specimens without coordinates", grid: true},
    y: {label: null, domain: collectionNames},
    color: {domain: STATUS, range: STATUS_COLORS, legend: true},
    marks: [
      Plot.barX(backlog, Plot.groupY({x: "count"}, {y: "collection", fill: "backlogStatus", tip: true})),
      Plot.ruleX([0])
    ]
  });
}

function readyByCountyChart(width) {
  return Plot.plot({
    width,
    marginLeft: 100,
    x: {label: "Specimens ready to georeference", grid: true},
    y: {label: null},
    marks: [
      Plot.barX(ready.filter((d) => d.nyCounty),
        Plot.groupY({x: "count"}, {y: "nyCounty", fill: STATUS_COLORS[0], sort: {y: "-x", limit: 15}, tip: true})),
      Plot.ruleX([0])
    ]
  });
}


// Filters for the backlog list (shown only on that tab)
const blCollectionInput = Inputs.select(["All collections", ...collectionNames], {label: "Collection"});
const blCollection = Generators.input(blCollectionInput);
const blCountyInput = Inputs.select(["All counties", ...NY_COUNTIES], {label: "NY county"});
const blCounty = Generators.input(blCountyInput);
const blStatusInput = Inputs.select(["All", ...STATUS], {label: "Status", value: STATUS[0]});
const blStatus = Generators.input(blStatusInput);
```
```js
// ---------- Coordinates by decade: is it because of GPS? ----------
const GPS_YEAR = 2000;
const hasCoords = (d) => d.coordStatus === "ok";
const dated = specimens.filter((d) => d.year != null);
const shareOf = (rows) => d3.mean(rows, (d) => (hasCoords(d) ? 1 : 0));
const pctFmt = d3.format(".0%");

const early = dated.filter((d) => d.year < 1950);
const recent = dated.filter((d) => d.year >= GPS_YEAR);
const recentMissing = recent.filter((d) => !hasCoords(d)).length;

// Pre-1950 georeferencing rate by collection (only collections with enough old specimens)
const earlyByCollection = collectionNames
  .map((c) => ({c, rows: early.filter((d) => d.collection === c)}))
  .filter((x) => x.rows.length >= 50)
  .map((x) => ({c: x.c, share: shareOf(x.rows)}))
  .sort((a, b) => b.share - a.share);
const best = earlyByCollection[0];
const worst = earlyByCollection[earlyByCollection.length - 1];

// Share with coordinates for each collection and decade (decades with 20+ specimens)
const decadeStats = d3.flatRollup(dated,
    (v) => ({n: v.length, withCoords: v.filter(hasCoords).length}),
    (d) => d.collection, (d) => Math.floor(d.year / 10) * 10)
  .map(([collection, decade, s]) => ({collection, decade, ...s, share: s.withCoords / s.n}))
  .filter((d) => d.n >= 20)
  .sort((a, b) => a.decade - b.decade);

function shareByDecadeChart(width) {
  return Plot.plot({
    width,
    height: 340,
    x: {label: "Decade collected", tickFormat: "d"},
    y: {label: "Share with coordinates", domain: [0, 1], tickFormat: "%", grid: true},
    color: {domain: Object.keys(COLORS), range: Object.values(COLORS), legend: true},
    marks: [
      Plot.ruleX([GPS_YEAR], {stroke: "#999", strokeDasharray: "4,3"}),
      Plot.text([GPS_YEAR], {
        x: (d) => d, frameAnchor: "top", textAnchor: "end", dx: -4, dy: 4,
        text: () => "GPS opened to civilians (2000)", fill: "#777", fontSize: 11
      }),
      Plot.lineY(decadeStats, {
        x: "decade", y: "share", stroke: "collection", marker: "circle",
        channels: {Specimens: "n"},
        tip: {format: {x: "d", y: ".0%", Specimens: ","}}
      })
    ]
  });
}

function coordsHistogram(collection, width) {
  return Plot.plot({
    width,
    height: 200,
    x: {label: "Year collected", tickFormat: "d"},
    y: {label: "Specimens", grid: true},
    color: {domain: ["Has coordinates", "No coordinates"], range: ["#4a6fa5", "#d0d0d0"]},
    marks: [
      Plot.rectY(dated.filter((d) => d.collection === collection),
        Plot.binX({y: "count"}, {
          x: "year", interval: 10,
          fill: (d) => (hasCoords(d) ? "Has coordinates" : "No coordinates"),
          tip: {format: {x1: "d", x2: "d"}}
        })),
      Plot.ruleX([GPS_YEAR], {stroke: "#999", strokeDasharray: "4,3"}),
      Plot.ruleY([0])
    ]
  });
}
```

```js
const blFiltered = backlog.filter((d) =>
  (blCollection === "All collections" || d.collection === blCollection) &&
  (blCounty === "All counties" || d.nyCounty === blCounty) &&
  (blStatus === "All" || d.backlogStatus === blStatus));
const blSearchInput = Inputs.search(blFiltered, {
  placeholder: "Search locality, name, collector, or catalog number…",
  columns: ["locality", "scientificName", "recordedBy", "catalogNumber"],
  width: 480
});
const blSearch = Generators.input(blSearchInput);
```

```js
// ---------- Suspect coordinates ----------
const suspects = specimens
  .filter((d) => d.coordStatus === "suspect")
  .map((d) => ({
    collection: d.collection, catalogNumber: d.catalogNumber, scientificName: d.scientificName,
    county: d.county, locality: d.locality, latitude: d.lat, longitude: d.lon,
    year: d.year, recordURL: d.recordURL
  }));
```

```js
function csvLink(rows, filename, label) {
  const url = URL.createObjectURL(new Blob([d3.csvFormat(rows)], {type: "text/csv"}));
  invalidation.then(() => URL.revokeObjectURL(url));
  return html`<a download=${filename} href=${url}>${label}</a>`;
}

if (tab === "Completeness") {
  display(html`<p>How many records have each key field filled in. Fields with low
    completeness are where digitization or data cleanup would add the most value.</p>`);
  display(html`<h3>All collections</h3>`);
  display(completenessChart(specimens, {width}));
  display(html`<h3>By collection</h3>`);
  display(completenessGridChart(width));

} else if (tab === "Georeferencing backlog") {
  display(html`<p><strong>${backlog.length.toLocaleString()}</strong> specimens
    (${d3.format(".0%")(backlog.length / specimens.length)}) have no coordinates.
    <strong>${ready.length.toLocaleString()}</strong> have a written locality description
    and could be georeferenced, and ${countyOnly.toLocaleString()} have only a county.
    ${readyTypes ? html`<strong>${readyTypes.toLocaleString()} type specimens</strong> have written localities and are missing coordinates.` : ""}</p>`);
  display(backlogChart(width));
  display(html`<h3>Is this because most specimens predate GPS?</h3>
    <p>Before GPS was widely available, collectors recorded specimen locations as written descriptions. Missing coordinates reflect
    both when a specimen was collected and whether its collection has been georeferenced since.</p>
    <ul>
      <li>Of specimens collected <strong>before 1950</strong>, <strong>${pctFmt(shareOf(early))}</strong>
        have coordinates, compared with <strong>${pctFmt(shareOf(recent))}</strong> of those
        collected <strong>since ${GPS_YEAR}</strong>.</li>
      ${best && worst && best.share - worst.share > 0.3 ? html`<li>Age isn't the whole story:
        ${best.c.toLowerCase()} collected before 1950 are <strong>${pctFmt(best.share)}</strong>
        georeferenced, versus <strong>${pctFmt(worst.share)}</strong> for ${worst.c.toLowerCase()}
        from the same period. Old specimens <em>can</em> be georeferenced, so much of
        the gap reflects the need for ongoing georeferencing work.</li>` : ""}
      ${recentMissing ? html`<li><strong>${recentMissing.toLocaleString()}</strong> specimens
        collected since ${GPS_YEAR} still have no coordinates. Many of these may have GPS
        coordinates on their labels that were never entered.</li>` : ""}
    </ul>`);
  display(html`<h4>Share of specimens with coordinates, by decade</h4>
    <p><small>Decades with fewer than 20 specimens in a collection are left out.</small></p>`);
  display(shareByDecadeChart(width));
  display(html`<h4>Specimens collected per decade, with and without coordinates</h4>
    <div style="display:flex; gap:1.2em; margin-bottom:0.5em;">
      <span><span style="display:inline-block; width:10px; height:10px; background:#4a6fa5;"></span> Has coordinates</span>
      <span><span style="display:inline-block; width:10px; height:10px; background:#d0d0d0;"></span> No coordinates</span>
    </div>`);
  display(html`<div class="grid grid-cols-2">
    ${collectionNames.map((c) => html`<div class="card"><h3>${c}</h3>
      ${resize((w) => coordsHistogram(c, w))}</div>`)}
  </div>`);
  display(html`<h3>Where to start</h3>
    <p>New York counties with the most specimens ready to georeference. </p>`);
  display(readyByCountyChart(width));

  display(html`<h3>Backlog list</h3>
    <p>Type specimens are listed first.</p>`);
  display(html`<div style="display:flex; gap:1rem; flex-wrap:wrap;">
    ${blCollectionInput}${blCountyInput}${blStatusInput}</div>`);
  display(blSearchInput);

  const blRows = blSearch
    .map((d) => ({
      catalogNumber: d.catalogNumber, name: d.scientificName, collection: d.collection,
      type: d.typeCat ?? "", status: d.backlogStatus, county: d.county,
      locality: d.locality, year: d.year, collector: d.recordedBy, record: d.recordURL
    }))
    .sort((a, b) => (b.type ? 1 : 0) - (a.type ? 1 : 0));

  const geolocateRows = blSearch
    .filter((d) => d.locality)
    .map((d) => ({
      "locality string": d.locality,
      "country": d.countryCode === "US" || d.stateProvince === "New York" ? "USA" : (d.countryCode ?? ""),
      "state": d.stateProvince ?? "",
      "county": d.county ?? "",
      "latitude": "", "longitude": "", "correction status": "", "precision": "",
      "error polygon": "", "multiple results": "", "uncertainty radius": "",
      "catalogNumber": d.catalogNumber, "collection": d.collection, "recordURL": d.recordURL
    }));

  display(html`<p>
    ${csvLink(blRows, "nysm-georeferencing-backlog.csv", `Download these ${blRows.length.toLocaleString()} records as CSV`)}
    · ${csvLink(geolocateRows, "nysm-geolocate-batch.csv", `Download ${geolocateRows.length.toLocaleString()} with localities in GEOLocate batch format`)}
  </p>`);

  display(Inputs.table(blRows, {
    rows: 20,
    header: {
      catalogNumber: "Catalog #", name: "Name", collection: "Collection", type: "Type",
      status: "Status", county: "County", locality: "Locality", year: "Year",
      collector: "Collector", record: "Record"
    },
    width: {locality: 320, name: 180},
    format: {
      year: yearFormat,
      name: (n) => html`<em>${n ?? ""}</em>`,
      record: (url) => url ? html`<a href=${url} target="_blank">View</a>` : ""
    }
  }));

} else {
  display(html`<p>Specimens labeled as collected in New York whose coordinates fall outside
    the state. Common causes are a missing minus sign on longitude or swapped latitude and
    longitude.</p>`);
  display(html`<p>${csvLink(suspects, "nysm-suspect-coordinates.csv",
    `Download ${suspects.length.toLocaleString()} suspect records as CSV`)}</p>`);
  display(Inputs.table(suspects, {
    format: {
      year: yearFormat,
      recordURL: (url) => url ? html`<a href=${url} target="_blank">View</a>` : ""
    }
  }));
}
```