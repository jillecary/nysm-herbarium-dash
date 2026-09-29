import {FileAttachment} from "observablehq:stdlib";
import * as Plot from "npm:@observablehq/plot";
import * as Inputs from "npm:@observablehq/inputs";
import * as d3 from "npm:d3";
import * as topojson from "npm:topojson-client";

export const COLORS = {
  "Lichens": "#1b9e77",
  "Vascular plants": "#d95f02",
  "Algae": "#7570b3",
  "Fungi": "#e7298a"
};

export const NY_COUNTIES = [
  "Albany", "Allegany", "Bronx", "Broome", "Cattaraugus", "Cayuga", "Chautauqua",
  "Chemung", "Chenango", "Clinton", "Columbia", "Cortland", "Delaware", "Dutchess",
  "Erie", "Essex", "Franklin", "Fulton", "Genesee", "Greene", "Hamilton", "Herkimer",
  "Jefferson", "Kings", "Lewis", "Livingston", "Madison", "Monroe", "Montgomery",
  "Nassau", "New York", "Niagara", "Oneida", "Onondaga", "Ontario", "Orange",
  "Orleans", "Oswego", "Otsego", "Putnam", "Queens", "Rensselaer", "Richmond",
  "Rockland", "Saratoga", "Schenectady", "Schoharie", "Schuyler", "Seneca",
  "St. Lawrence", "Steuben", "Suffolk", "Sullivan", "Tioga", "Tompkins", "Ulster",
  "Warren", "Washington", "Wayne", "Westchester", "Wyoming", "Yates"
];

export function normalizeCounty(c) {
  if (!c) return null;
  const s = c.replace(/^(saint|st\.?)\s+/i, "St. ").trim().toLowerCase();
  return NY_COUNTIES.find((n) => n.toLowerCase() === s) ?? null;
}

// Type status: "Isotype of Agaricus X" -> "Isotype"
const TYPE_TERMS = [
  "holotype", "isotype", "lectotype", "isolectotype", "neotype", "isoneotype",
  "epitype", "isoepitype", "syntype", "isosyntype", "paratype", "paralectotype",
  "topotype", "type"
];
export function typeCategory(s) {
  if (!s) return null;
  const t = s.toLowerCase();
  if (/\bnot\b|\bnon\b/.test(t)) return null;
  const hit = TYPE_TERMS.find((term) => new RegExp(`\\b${term}\\b`).test(t));
  return hit ? hit[0].toUpperCase() + hit.slice(1) : "Other type";
}

// Load every specimen as a plain object
export async function loadSpecimens() {
  const table = await FileAttachment("../data/specimens.parquet").parquet();
  return table.toArray().map((row) => {
    const d = row.toJSON();
    for (const k of Object.keys(d)) if (typeof d[k] === "bigint") d[k] = Number(d[k]);
    d.lat = d.decimalLatitude;
    d.lon = d.decimalLongitude;
    d.hasCoords = Number.isFinite(d.lat) && Number.isFinite(d.lon);
    d.nyCounty = d.stateProvince === "New York" ? normalizeCounty(d.county) : null;
    d.typeCat = typeCategory(d.typeStatus);
    return d;
  });
}

export function collectionsIn(rows) {
  return Object.keys(COLORS).filter((c) => rows.some((d) => d.collection === c));
}

export function inYears(d, startYear, endYear, includeUndated) {
  return d.year == null ? includeUndated : d.year >= startYear && d.year <= endYear;
}

export const yearFormat = (y) => (y == null ? "" : String(y));

const colorScale = (legend) => ({domain: Object.keys(COLORS), range: Object.values(COLORS), legend});

// ---------- Tabs: a radio input styled as tab buttons ----------
let tabStyleAdded = false;
export function tabs(options, {value} = {}) {
  if (!tabStyleAdded) {
    document.head.append(Object.assign(document.createElement("style"), {textContent: `
      .tabs { margin: 0.5rem 0 1rem; }
      .tabs label:has(input) {
        padding: 0.35rem 0.9rem; margin: 0 0.4rem 0.4rem 0; border-radius: 999px;
        border: 1px solid var(--theme-foreground-faint); cursor: pointer;
      }
      .tabs label:has(input:checked) { background: var(--theme-foreground); color: var(--theme-background); }
      .tabs input[type=radio] { position: absolute; opacity: 0; width: 1px; }
    `}));
    tabStyleAdded = true;
  }
  const input = Inputs.radio(options, {value: value ?? options[0]});
  input.classList.add("tabs");
  return input;
}

// ---------- Charts ----------

// Stacked bar chart of New York counties, colored by collection
export function countyChart(rows, {width, top, sort = "count", legend = true} = {}) {
  const countyRows = rows.filter((d) => d.nyCounty);
  const data = d3.flatRollup(countyRows, (v) => v.length, (d) => d.nyCounty, (d) => d.collection)
    .map(([county, collection, n]) => ({county, collection, n}));
  const totals = d3.rollup(data, (v) => d3.sum(v, (d) => d.n), (d) => d.county);
  let order = sort === "alpha"
    ? NY_COUNTIES.slice()
    : NY_COUNTIES.slice().sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0));
  if (top) order = order.slice(0, top);
  return Plot.plot({
    width,
    height: order.length * 16 + 50,
    marginLeft: 100,
    x: {label: "Specimens", grid: true},
    y: {label: null, domain: order},
    color: colorScale(legend),
    marks: [
      Plot.barX(data.filter((d) => order.includes(d.county)), {x: "n", y: "county", fill: "collection", tip: true}),
      Plot.ruleX([0])
    ]
  });
}

// Bar chart of families; one collection, or all collections stacked
export function familyChart(rows, {width, collection = null, top = 25, legend = true} = {}) {
  const subset = (collection ? rows.filter((d) => d.collection === collection) : rows).filter((d) => d.family);
  const totals = d3.rollups(subset, (v) => v.length, (d) => d.family).sort((a, b) => b[1] - a[1]);
  const order = (top === "All" ? totals : totals.slice(0, top)).map(([f]) => f);
  const keep = new Set(order);
  const data = d3.flatRollup(subset.filter((d) => keep.has(d.family)), (v) => v.length, (d) => d.family, (d) => d.collection)
    .map(([family, collection, n]) => ({family, collection, n}));
  return Plot.plot({
    width,
    height: order.length * 18 + 50,
    marginLeft: 150,
    x: {label: "Specimens", grid: true},
    y: {label: null, domain: order},
    color: colorScale(legend && !collection),
    marks: [
      Plot.barX(data, {x: "n", y: "family", fill: "collection", tip: true}),
      Plot.ruleX([0])
    ]
  });
}

// Specimens collected per year or decade, stacked by collection
export function timeChart(rows, {width, interval = 10, height = 360, legend = true} = {}) {
  return Plot.plot({
    width,
    height,
    x: {label: "Year collected", tickFormat: "d"},
    y: {label: "Specimens", grid: true},
    color: colorScale(legend),
    marks: [
      Plot.rectY(rows.filter((d) => d.year != null),
        Plot.binX({y: "count"}, {x: "year", fill: "collection", interval, tip: {format: {x1: "d", x2: "d"}}})),
      Plot.ruleY([0])
    ]
  });
}

// Running total of specimens collected, one line per collection
export function cumulativeChart(rows, {width, height = 280} = {}) {
  return Plot.plot({
    width,
    height,
    x: {label: "Year collected", tickFormat: "d"},
    y: {label: "Total specimens collected", grid: true},
    color: colorScale(false),
    marks: [
      Plot.lineY(rows.filter((d) => d.year != null),
        Plot.mapY("cumsum", Plot.binX({y: "count", x: "x1"}, {x: "year", stroke: "collection", interval: 1, tip: {format: {x: "d"}}}))),
      Plot.ruleY([0])
    ]
  });
}

// Top collectors: grey line = active span, ticks = specimens by year
export function collectorChart(rows, {width, top = 20} = {}) {
  const dated = rows.filter((d) => d.primaryCollector && d.year != null);
  const stats = d3.rollups(dated, (v) => ({
      n: v.length,
      first: d3.min(v, (d) => d.year),
      last: d3.max(v, (d) => d.year)
    }), (d) => d.primaryCollector)
    .map(([name, s]) => ({name, ...s}))
    .sort((a, b) => b.n - a.n)
    .slice(0, top)
    .sort((a, b) => a.first - b.first);
  const names = new Set(stats.map((d) => d.name));
  return Plot.plot({
    width,
    height: stats.length * 22 + 60,
    marginLeft: 170,
    marginRight: 60,
    x: {label: "Year collected", tickFormat: "d", grid: true},
    y: {label: null, domain: stats.map((d) => d.name)},
    color: colorScale(true),
    marks: [
      Plot.ruleY(stats, {y: "name", x1: "first", x2: "last", stroke: "#bbb", strokeWidth: 2}),
      Plot.tickX(dated.filter((d) => names.has(d.primaryCollector)),
        {x: "year", y: "primaryCollector", stroke: "collection", strokeOpacity: 0.35}),
      Plot.text(stats, {x: "last", y: "name", text: (d) => d.n.toLocaleString(), dx: 6, textAnchor: "start", fontSize: 10}),
      Plot.tip(stats, Plot.pointerY({y: "name", x: "first",
        title: (d) => `${d.name}\n${d.n.toLocaleString()} specimens\n${d.first}–${d.last}`}))
    ]
  });
}

// Type specimens by category, stacked by collection
export function typeChart(rows, {width, legend = true} = {}) {
  const types = rows.filter((d) => d.typeCat);
  const categories = new Set(types.map((d) => d.typeCat)).size;
  return Plot.plot({
    width,
    height: categories * 22 + 50,
    marginLeft: 100,
    x: {label: "Specimens", grid: true},
    y: {label: null},
    color: colorScale(legend),
    marks: [
      Plot.barX(types, Plot.groupY({x: "count"}, {y: "typeCat", fill: "collection", sort: {y: "-x"}, tip: true})),
      Plot.ruleX([0])
    ]
  });
}

// How many records have each important field filled in
export const COMPLETENESS_FIELDS = [
  ["Collection year", (d) => d.year != null],
  ["Collector", (d) => !!d.recordedBy],
  ["Family", (d) => !!d.family],
  ["Identified to species", (d) => !!d.species],
  ["County", (d) => !!d.county],
  ["Locality description", (d) => !!d.locality],
  ["Usable coordinates", (d) => d.coordStatus === "ok"]
];
export function completenessChart(rows, {width} = {}) {
  const data = COMPLETENESS_FIELDS.map(([field, test]) => ({field, pct: d3.mean(rows, (d) => (test(d) ? 1 : 0))}));
  return Plot.plot({
    width,
    height: data.length * 24 + 40,
    marginLeft: 150,
    marginRight: 40,
    x: {domain: [0, 1], tickFormat: "%", label: "Share of records", grid: true},
    y: {label: null, domain: data.map((d) => d.field)},
    marks: [
      Plot.barX(data, {x: "pct", y: "field", fill: "#4a6fa5"}),
      Plot.text(data, {x: "pct", y: "field", text: (d) => d3.format(".0%")(d.pct), dx: 4, textAnchor: "start", fontSize: 11}),
      Plot.ruleX([0])
    ]
  });
}

// ---------- County map ----------
const EARTH_RADIUS_MI = 3958.8;
let countyShapesPromise;

// New York county outlines (US Census via us-atlas), with names matched and areas in sq mi
export function loadNYCounties() {
  countyShapesPromise ??= fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json")
    .then((r) => r.json())
    .then((us) => {
      const counties = topojson.feature(us, us.objects.counties).features
        .filter((f) => String(f.id).startsWith("36"));
      for (const f of counties) {
        f.properties.county = normalizeCounty(f.properties.name) ?? f.properties.name;
        f.properties.sqmi = d3.geoArea(f) * EARTH_RADIUS_MI ** 2;
      }
      const state = topojson.feature(us, us.objects.states).features.find((f) => f.id === "36");
      return {counties, state};
    });
  return countyShapesPromise;
}

// Choropleth of New York counties: specimens per 100 sq mi, or total specimens
export function choropleth(rows, shapes, {width, metric = "density", legend = true} = {}) {
  const counts = d3.rollup(rows.filter((d) => d.nyCounty), (v) => v.length, (d) => d.nyCounty);
  const n = (f) => counts.get(f.properties.county) ?? 0;
  const density = (f) => (n(f) / f.properties.sqmi) * 100;
  return Plot.plot({
    width,
    height: Math.round(width * 0.78),
    projection: {type: "mercator", domain: shapes.state},
    color: {
      type: "sqrt",
      scheme: "YlGn",
      legend,
      label: metric === "density" ? "Specimens per 100 sq mi" : "Specimens"
    },
    marks: [
      Plot.geo(shapes.counties, Plot.centroid({
        fill: metric === "density" ? density : n,
        stroke: "white",
        strokeWidth: 0.6,
        channels: {
          County: (f) => f.properties.county,
          Specimens: n,
          "Per 100 sq mi": density
        },
        tip: {format: {fill: false, Specimens: ",", "Per 100 sq mi": ".1f"}}
      })),
      Plot.geo(shapes.state, {stroke: "#444", strokeWidth: 0.8})
    ]
  });
}