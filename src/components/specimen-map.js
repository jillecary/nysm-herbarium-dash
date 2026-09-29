import maplibregl from "npm:maplibre-gl@5";
import {COLORS} from "./specimens.js";

export const EMPTY = {type: "FeatureCollection", features: []};

const FIELDS = ["collection", "scientificName", "family", "recordedBy", "eventDate", "year",
  "county", "locality", "catalogNumber", "recordURL", "coordStatus"];

export function toGeoJSON(rows) {
  return {
    type: "FeatureCollection",
    features: rows.map((d) => ({
      type: "Feature",
      geometry: {type: "Point", coordinates: [d.lon, d.lat]},
      properties: Object.fromEntries(FIELDS.map((k) => [k, d[k] ?? ""]))
    }))
  };
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
}

export async function createSpecimenMap(container, {interactive = true, cluster = true} = {}) {
  const map = new maplibregl.Map({
    container,
    style: "https://tiles.openfreemap.org/styles/positron",
    center: [-75.8, 42.9],
    zoom: interactive ? 5.8 : 5.2,
    interactive
  });
  if (interactive) map.addControl(new maplibregl.NavigationControl());
  await new Promise((resolve) => map.on("load", resolve));
  map.resize();

  const pointPaint = {
    "circle-radius": interactive ? 5 : 2.5,
    "circle-color": ["match", ["get", "collection"], ...Object.entries(COLORS).flat(), "#888"],
    "circle-stroke-width": interactive ? ["case", ["==", ["get", "coordStatus"], "suspect"], 2, 1] : 0,
    "circle-stroke-color": ["case", ["==", ["get", "coordStatus"], "suspect"], "#c00", "#fff"]
  };

  map.addSource("specimens", cluster
    ? {type: "geojson", data: EMPTY, cluster: true, clusterRadius: 40, clusterMaxZoom: 10}
    : {type: "geojson", data: EMPTY});

  if (cluster) {
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
  }
  map.addLayer({
    id: "points", type: "circle", source: "specimens",
    ...(cluster ? {filter: ["!", ["has", "point_count"]]} : {}),
    paint: pointPaint
  });

  // Unclustered layer used by the year-by-year animation
  map.addSource("animation", {type: "geojson", data: EMPTY});
  map.addLayer({id: "anim-points", type: "circle", source: "animation", paint: pointPaint});

  if (!interactive) return map;

  if (cluster) {
    map.on("click", "clusters", async (e) => {
      const f = e.features[0];
      const zoom = await map.getSource("specimens").getClusterExpansionZoom(f.properties.cluster_id);
      map.easeTo({center: f.geometry.coordinates, zoom});
    });
  }
  for (const layer of ["points", "anim-points"]) {
    map.on("click", layer, (e) => {
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
  }
  for (const layer of ["clusters", "points", "anim-points"]) {
    if (!map.getLayer(layer)) continue;
    map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
  }
  return map;
}