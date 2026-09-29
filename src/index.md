---
title: Overview
toc: false
---

<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/maplibre-gl@5/dist/maplibre-gl.css">

<style>
a.tile { display: block; color: inherit; text-decoration: none; }
a.tile .card { height: 100%; margin: 0; transition: box-shadow 0.15s, transform 0.15s; }
a.tile:hover .card { box-shadow: 0 6px 18px rgba(0,0,0,0.15); transform: translateY(-2px); }
.tile-footer { margin-top: 0.6rem; font-size: 0.85rem; color: var(--theme-foreground-muted); }
.kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem; margin-top: 0.5rem; }
.big { font-size: 2rem; font-weight: 700; line-height: 1.1; }
</style>

# NYSM Herbarium Dashboard

```js
import {loadSpecimens, collectionsIn, countyChart, familyChart, COLORS} from "./components/specimens.js";
import {createSpecimenMap, toGeoJSON} from "./components/specimen-map.js";

const specimens = await loadSpecimens();
const mapped = specimens.filter((d) => d.hasCoords && d.coordStatus === "ok");
const collectionNames = collectionsIn(specimens);
const [firstYear, lastYear] = d3.extent(specimens, (d) => d.year);
const familyCount = new Set(specimens.map((d) => d.family).filter(Boolean)).size;
const mapPreview = html`<div style="height: 300px; border-radius: 6px; overflow: hidden;"></div>`;
```

```js
display(html`<div style="display:flex; gap:1.2em; flex-wrap:wrap; margin-bottom:1rem;">
  ${collectionNames.map((c) => html`<span>
    <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${COLORS[c]};"></span>
    ${c}</span>`)}
</div>`);
```

<div class="grid grid-cols-2">
  <a class="tile" href="./map">
    <div class="card">
      <h2>Specimen map</h2>
      <h3>${mapped.length.toLocaleString()} georeferenced specimens</h3>
      ${mapPreview}
      <div class="tile-footer">Open the full map with filters and year-by-year animation →</div>
    </div>
  </a>
  <a class="tile" href="./summary">
    <div class="card">
      <h2>Collection summary</h2>
      <h3>All published NYSM herbarium records</h3>
      <div class="kpis">
        <div><div class="big">${specimens.length.toLocaleString()}</div>specimens</div>
        <div><div class="big">${d3.format(".0%")(mapped.length / specimens.length)}</div>can be mapped</div>
        <div><div class="big">${familyCount.toLocaleString()}</div>families</div>
        <div><div class="big">${firstYear}–${lastYear}</div>collection years</div>
      </div>
      <div class="tile-footer">Open the summary table and data quality report →</div>
    </div>
  </a>
  <a class="tile" href="./counties">
    <div class="card">
      <h2>Specimens by county</h2>
      <h3>Top 12 New York counties</h3>
      ${resize((width) => countyChart(specimens, {width, top: 12, legend: false}))}
      <div class="tile-footer">Open all 62 counties with filters →</div>
    </div>
  </a>
  <a class="tile" href="./families">
    <div class="card">
      <h2>Families</h2>
      <h3>Top 12 families across all collections</h3>
      ${resize((width) => familyChart(specimens, {width, top: 12, legend: false}))}
      <div class="tile-footer">Open families by collection →</div>
    </div>
  </a>
</div>

```js
const previewMap = await createSpecimenMap(mapPreview, {interactive: false, cluster: false});
previewMap.getSource("specimens").setData(toGeoJSON(mapped));
invalidation.then(() => previewMap.remove());
```