import {FileAttachment} from "observablehq:stdlib";
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";

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