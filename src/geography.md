---
title: Geography
toc: false
---

[← Overview](./)

# Geography

Where in New York has the collection been built, and where are the gaps?

```js
import {
  loadSpecimens, loadNYCounties, collectionsIn, countyChart, choropleth, inYears, tabs
} from "./components/specimens.js";

const specimens = await loadSpecimens();
const nyShapes = await loadNYCounties();
const collectionNames = collectionsIn(specimens);
const [minYear, maxYear] = d3.extent(specimens, (d) => d.year);
```

```js
const collections = view(Inputs.checkbox(collectionNames, {label: "Collections", value: collectionNames}));
const startYear = view(Inputs.range([minYear, maxYear], {label: "From year", step: 1, value: minYear, format: String}));
const endYear = view(Inputs.range([minYear, maxYear], {label: "To year", step: 1, value: maxYear, format: String}));
const includeUndated = view(Inputs.toggle({label: "Include undated", value: true}));
const tab = view(tabs(["Collecting density map", "By county"]));
```

```js
// Controls that only show on their own tab
const metricInput = Inputs.radio(["Per 100 square miles", "Total specimens"], {label: "Show", value: "Per 100 square miles"});
const metric = Generators.input(metricInput);
const sortInput = Inputs.radio(["Most specimens", "Alphabetical"], {label: "Sort", value: "Most specimens"});
const countySort = Generators.input(sortInput);
```

```js
const selected = specimens.filter((d) =>
  collections.includes(d.collection) && inYears(d, startYear, endYear, includeUndated));
const nyRows = selected.filter((d) => d.stateProvince === "New York");
const unmatched = nyRows.filter((d) => !d.nyCounty).length;

const counts = d3.rollup(nyRows.filter((d) => d.nyCounty), (v) => v.length, (d) => d.nyCounty);
const countyStats = nyShapes.counties
  .map((f) => {
    const n = counts.get(f.properties.county) ?? 0;
    return {county: f.properties.county, n, sqmi: f.properties.sqmi, density: (n / f.properties.sqmi) * 100};
  })
  .sort((a, b) => a.density - b.density);

function countyTable(rows) {
  return html`<table>
    <thead><tr><th>County</th><th>Specimens</th><th>Area (sq mi)</th><th>Per 100 sq mi</th></tr></thead>
    <tbody>${rows.map((d) => html`<tr>
      <td>${d.county}</td>
      <td>${d.n.toLocaleString()}</td>
      <td>${Math.round(d.sqmi).toLocaleString()}</td>
      <td>${d.density.toFixed(1)}</td>
    </tr>`)}</tbody>
  </table>`;
}
```

```js
if (tab === "Collecting density map") {
  display(metricInput);
  display(choropleth(selected, nyShapes, {
    width: Math.min(width, 900),
    metric: metric === "Total specimens" ? "count" : "density"
  }));
  display(html`<p><small>Hover over a county for details.
    ${unmatched.toLocaleString()} New York specimens have no county or an unrecognized
    county name and aren't shown.</small></p>`);
  display(html`<div class="grid grid-cols-2">
    <div class="card"><h3>Least collected</h3>
      <p><small>Fewest specimens per 100 sq mi: possible collecting gaps</small></p>
      ${countyTable(countyStats.slice(0, 10))}</div>
    <div class="card"><h3>Most collected</h3>
      <p><small>Most specimens per 100 sq mi</small></p>
      ${countyTable(countyStats.slice(-10).reverse())}</div>
  </div>`);
} else {
  display(html`<p>All New York specimens with a recognizable county, including those
    without coordinates. ${unmatched.toLocaleString()} New York specimens have no county
    or an unrecognized county name.</p>`);
  display(sortInput);
  display(countyChart(selected, {width, sort: countySort === "Alphabetical" ? "alpha" : "count"}));
}
```