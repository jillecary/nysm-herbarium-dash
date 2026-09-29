---
title: Specimen map
toc: false
---

<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/maplibre-gl@5/dist/maplibre-gl.css">

# NYSM Herbarium Specimen Map

```js
import maplibregl from "npm:maplibre-gl@5";

const db = await DuckDBClient.of({specimens: FileAttachment("data/specimens.parquet")});

// Load every specimen that has usable or suspect coordinates
const rows = (await db.query(`
  SELECT collection, scientificName, family, genus, recordedBy, eventDate,
         CAST(year AS INTEGER) AS year, county, locality, catalogNumber,
         recordURL, coordStatus,
         decimalLatitude AS lat, decimalLongitude AS lon
  FROM specimens
  WHERE decimalLatitude IS NOT NULL
`)).toArray().map((d) => d.toJSON());

const COLORS = {
  "Lichens": "#1b9e77",
  "Vascular plants": "#d95f02",
  "Algae": "#7570b3",
  "Fungi": "#e7298a"
};
const collectionNames = Object.keys(COLORS).filter((c) => rows.some((d) => d.collection === c));
const years = rows.map((d) => d.year).filter((y) => y != null);
const minYear = d3.min(years);
const maxYear = d3.max(years);
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
const filtered = rows.filter((d) =>
  collections.includes(d.collection) &&
  (d.year == null
    ? options.includes("Include undated specimens")
    : d.year >= startYear && d.year <= endYear) &&
  (d.coordStatus !== "suspect" || options.includes("Include suspect coordinates"))
);
```

**${filtered.length.toLocaleString()}** mapped specimens match your filters. Suspect coordinates are outlined in red.

```js
display(html`<div style="display:flex; gap:1.2em; flex-wrap:wrap; margin-bottom:0.5em;">
  ${collectionNames.map((c) => html`<span>
    <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${COLORS[c]};"></span>
    ${c}</span>`)}
</div>`);
```

```js
function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
}

const container = display(html`<div style="height: 620px; border-radius: 8px; overflow: hidden;"></div>`);

const map = new maplibregl.Map({
  container,
  style: "https://tiles.openfreemap.org/styles/positron",
  center: [-75.8, 42.9],
  zoom: 5.8
});
map.addControl(new maplibregl.NavigationControl());
invalidation.then(() => map.remove());

await new Promise((resolve) => map.on("load", resolve));

map.addSource("specimens", {
  type: "geojson",
  data: {type: "FeatureCollection", features: []},
  cluster: true,
  clusterRadius: 40,
  clusterMaxZoom: 10
});

map.addLayer({
  id: "clusters", type: "circle", source: "specimens",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": "#4a6fa5",
    "circle-opacity": 0.8,
    "circle-radius": ["step", ["get", "point_count"], 12, 50, 18, 500, 26],
    "circle-stroke-width": 1,
    "circle-stroke-color": "#fff"
  }
});

map.addLayer({
  id: "cluster-count", type: "symbol", source: "specimens",
  filter: ["has", "point_count"],
  layout: {"text-field": ["get", "point_count_abbreviated"], "text-size": 11, "text-font": ["Noto Sans Regular"]},
  paint: {"text-color": "#fff"}
});

map.addLayer({
  id: "points", type: "circle", source: "specimens",
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-radius": 5,
    "circle-color": ["match", ["get", "collection"], ...Object.entries(COLORS).flat(), "#888"],
    "circle-stroke-width": ["case", ["==", ["get", "coordStatus"], "suspect"], 2, 1],
    "circle-stroke-color": ["case", ["==", ["get", "coordStatus"], "suspect"], "#c00", "#fff"]
  }
});

// Click a cluster to zoom in
map.on("click", "clusters", async (e) => {
  const f = e.features[0];
  const zoom = await map.getSource("specimens").getClusterExpansionZoom(f.properties.cluster_id);
  map.easeTo({center: f.geometry.coordinates, zoom});
});

// Click a specimen to see its details
map.on("click", "points", (e) => {
  const p = e.features[0].properties;
  const link = p.recordURL ? `<a href="${esc(p.recordURL)}" target="_blank">View full record</a>` : "";
  new maplibregl.Popup({maxWidth: "300px"})
    .setLngLat(e.features[0].geometry.coordinates)
    .setHTML(`
      <strong><em>${esc(p.scientificName)}</em></strong><br>
      ${esc(p.family)} · ${esc(p.collection)}<br>
      Collector: ${esc(p.recordedBy)}<br>
      Date: ${esc(p.eventDate || p.year)}<br>
      County: ${esc(p.county)}<br>
      ${p.locality ? `<small>${esc(p.locality)}</small><br>` : ""}
      Catalog #: ${esc(p.catalogNumber)}<br>
      ${link}
    `)
    .addTo(map);
});

for (const layer of ["clusters", "points"]) {
  map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
}
```

```js
// Redraw the points whenever the filters change
map.getSource("specimens").setData({
  type: "FeatureCollection",
  features: filtered.map((d) => ({
    type: "Feature",
    geometry: {type: "Point", coordinates: [d.lon, d.lat]},
    properties: d
  }))
});
```
## Collection summary

```js
Inputs.table(await db.query(`
  SELECT collection AS "Collection",
         count(*) AS "Records",
         count(decimalLatitude) AS "With coordinates",
         min(year) AS "Earliest",
         max(year) AS "Latest"
  FROM specimens
  GROUP BY collection
  ORDER BY count(*) DESC
`))
```