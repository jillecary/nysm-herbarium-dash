---
title: Overview
toc: false
---

<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/maplibre-gl@5/dist/maplibre-gl.css">

<style>
.kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.kpi-row .card { margin: 0; }
.big { font-size: 1.8rem; font-weight: 700; line-height: 1.1; }
.kpi-label { font-size: 0.85rem; color: var(--theme-foreground-muted); }
a.tile { display: block; color: inherit; text-decoration: none; }
a.tile .card { height: 100%; margin: 0; transition: box-shadow 0.15s, transform 0.15s; }
a.tile:hover .card { box-shadow: 0 6px 18px rgba(0,0,0,0.15); transform: translateY(-2px); }
.tile-footer { margin-top: 0.6rem; font-size: 0.85rem; color: var(--theme-foreground-muted); }
</style>

# NYSM Herbarium Dashboard

```js
import {
  loadSpecimens, collectionsIn, COLORS,
  countyChart, familyChart, timeChart, typeChart, completenessChart
} from "./components/specimens.js";
import {createSpecimenMap, toGeoJSON} from "./components/specimen-map.js";

const specimens = await loadSpecimens();
const mapped = specimens.filter((d) => d.hasCoords && d.coordStatus === "ok");
const collectionNames = collectionsIn(specimens);
const [firstYear, lastYear] = d3.extent(specimens, (d) => d.year);
const typeCount = specimens.filter((d) => d.typeCat).length;
const familyCount = new Set(specimens.map((d) => d.family).filter(Boolean)).size;
const collectorCount = new Set(specimens.map((d) => d.primaryCollector).filter(Boolean)).size;
const mapPreview = html`<div style="height: 230px; border-radius: 6px; overflow: hidden;"></div>`;
```

<div class="kpi-row">
  <div class="card"><div class="big">${specimens.length.toLocaleString()}</div><div class="kpi-label">specimens online</div></div>
  <div class="card"><div class="big">${d3.format(".0%")(mapped.length / specimens.length)}</div><div class="kpi-label">can be mapped</div></div>
  <div class="card"><div class="big">${typeCount.toLocaleString()}</div><div class="kpi-label">type specimens</div></div>
  <div class="card"><div class="big">${familyCount.toLocaleString()}</div><div class="kpi-label">families</div></div>
  <div class="card"><div class="big">${collectorCount.toLocaleString()}</div><div class="kpi-label">collector names</div></div>
  <div class="card"><div class="big">${firstYear}–${lastYear}</div><div class="kpi-label">collection years</div></div>
</div>

```js
display(html`<div style="display:flex; gap:1.2em; flex-wrap:wrap; margin-bottom:1rem;">
  ${collectionNames.map((c) => html`<span>
    <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${COLORS[c]};"></span>
    ${c}</span>`)}
</div>`);
```

<div class="grid grid-cols-3">
  <a class="tile" href="./map">
    <div class="card">
      <h2>Specimen map</h2>
      <h3>${mapped.length.toLocaleString()} georeferenced specimens</h3>
      ${mapPreview}
      <div class="tile-footer">Full map, filters, and animation →</div>
    </div>
  </a>
  <a class="tile" href="./history">
    <div class="card">
      <h2>History</h2>
      <h3>Specimens collected per decade</h3>
      ${resize((width) => timeChart(specimens, {width, height: 230, legend: false}))}
      <div class="tile-footer">Collecting over time and major collectors →</div>
    </div>
  </a>
  <a class="tile" href="./geography">
    <div class="card">
      <h2>Geography</h2>
      <h3>Top 10 New York counties</h3>
      ${resize((width) => countyChart(specimens, {width, top: 10, legend: false}))}
      <div class="tile-footer">All 62 counties →</div>
    </div>
  </a>
  <a class="tile" href="./taxonomy">
    <div class="card">
      <h2>Taxonomy</h2>
      <h3>Top 10 families</h3>
      ${resize((width) => familyChart(specimens, {width, top: 10, legend: false}))}
      <div class="tile-footer">Families by collection →</div>
    </div>
  </a>
  <a class="tile" href="./types">
    <div class="card">
      <h2>Type specimens</h2>
      <h3>${typeCount.toLocaleString()} name-bearing specimens</h3>
      ${resize((width) => typeChart(specimens, {width, legend: false}))}
      <div class="tile-footer">Browse type specimens →</div>
    </div>
  </a>
  <a class="tile" href="./data">
    <div class="card">
      <h2>Data & digitization</h2>
      <h3>Share of records with each field</h3>
      ${resize((width) => completenessChart(specimens, {width}))}
      <div class="tile-footer">Data quality and remaining work →</div>
    </div>
  </a>
</div>

```js
const previewMap = await createSpecimenMap(mapPreview, {interactive: false, cluster: false});
previewMap.getSource("specimens").setData(toGeoJSON(mapped));
invalidation.then(() => previewMap.remove());
```