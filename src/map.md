---
title: Specimen map
toc: false
---

<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/maplibre-gl@5/dist/maplibre-gl.css">

[← Overview](./)

# Specimen map

```js
import {loadSpecimens, collectionsIn, COLORS} from "./components/specimens.js";
import {createSpecimenMap, toGeoJSON, EMPTY} from "./components/specimen-map.js";

const specimens = await loadSpecimens();
const rows = specimens.filter((d) => d.hasCoords);
const collectionNames = collectionsIn(rows);
const [minYear, maxYear] = d3.extent(rows, (d) => d.year);
```

```js
const collections = view(Inputs.checkbox(collectionNames, {label: "Collections", value: collectionNames}));
const startYear = view(Inputs.range([minYear, maxYear], {label: "From year", step: 1, value: minYear}));
const endYear = view(Inputs.range([minYear, maxYear], {label: "To year", step: 1, value: maxYear}));
const options = view(Inputs.checkbox(
  ["Include undated specimens", "Include suspect coordinates"],
  {label: "Options", value: ["Include undated specimens"]}
));
```

```js
const animYear = Mutable(null);
const setAnimYear = (y) => (animYear.value = y);
```

```js
let timer = null;
let current = null;
const playBtn = html`<button>▶ Play</button>`;
const stopBtn = html`<button>■ Stop</button>`;
const speed = html`<select>
  <option value="1200">Slow</option>
  <option value="600" selected>Medium</option>
  <option value="250">Fast</option>
</select>`;

function play() {
  if (current == null || current >= endYear) current = startYear - 1;
  timer = setInterval(() => {
    current += 1;
    setAnimYear(current);
    if (current >= endYear) pause();
  }, +speed.value);
  playBtn.textContent = "⏸ Pause";
}
function pause() {
  clearInterval(timer);
  timer = null;
  playBtn.textContent = "▶ Play";
}
function stop() {
  pause();
  current = null;
  setAnimYear(null);
}
playBtn.onclick = () => (timer ? pause() : play());
stopBtn.onclick = stop;
speed.onchange = () => { if (timer) { pause(); play(); } };
invalidation.then(stop);

display(html`<div style="display:flex; gap:0.6em; align-items:center; flex-wrap:wrap; margin:0.5em 0;">
  <strong>Year-by-year animation:</strong> ${playBtn} ${stopBtn}
  <label>Speed ${speed}</label>
  <small>(steps through the From–To years above)</small>
</div>`);
```

```js
const includeUndated = options.includes("Include undated specimens");
const includeSuspect = options.includes("Include suspect coordinates");
const filtered = rows.filter((d) =>
  collections.includes(d.collection) &&
  (d.coordStatus !== "suspect" || includeSuspect) &&
  (animYear != null
    ? d.year === animYear
    : d.year == null ? includeUndated : d.year >= startYear && d.year <= endYear)
);
```

**${filtered.length.toLocaleString()}** mapped specimens ${animYear != null ? `collected in ${animYear}` : "match your filters"}. Suspect coordinates are outlined in red.

```js
display(html`<div style="display:flex; gap:1.2em; flex-wrap:wrap; margin-bottom:0.5em;">
  ${collectionNames.map((c) => html`<span>
    <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${COLORS[c]};"></span>
    ${c}</span>`)}
</div>`);
```

```js
const container = html`<div style="height: 70vh; min-height: 480px;"></div>`;
const yearLabel = html`<div style="position:absolute; top:10px; left:10px; z-index:2;
  background:rgba(255,255,255,0.92); color:#222; padding:4px 14px; border-radius:6px;
  font-size:26px; font-weight:700; display:none;"></div>`;
display(html`<div style="position:relative; border-radius:8px; overflow:hidden;">${container}${yearLabel}</div>`);

const map = await createSpecimenMap(container);
invalidation.then(() => map.remove());
```

```js
const fc = toGeoJSON(filtered);
map.getSource("specimens").setData(animYear == null ? fc : EMPTY);
map.getSource("animation").setData(animYear == null ? EMPTY : fc);
yearLabel.style.display = animYear == null ? "none" : "block";
yearLabel.textContent = animYear == null ? "" : `${animYear} · ${fc.features.length.toLocaleString()} specimens`;
```