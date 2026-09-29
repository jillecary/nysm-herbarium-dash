---
title: Type specimens
toc: false
---

[← Overview](./)

# Type specimens

Type specimens are the reference specimens tied to a scientific name, usually the
specimen a species was originally described from. They are among the most
scientifically valuable objects in any herbarium.

```js
import {loadSpecimens, collectionsIn, typeChart, yearFormat, COLORS} from "./components/specimens.js";

const specimens = await loadSpecimens();
const allTypes = specimens.filter((d) => d.typeCat);
const collectionNames = collectionsIn(allTypes);
const categories = d3.rollups(allTypes, (v) => v.length, (d) => d.typeCat)
  .sort((a, b) => b[1] - a[1])
  .map(([c]) => c);
```

```js
const collections = view(Inputs.checkbox(collectionNames, {label: "Collections", value: collectionNames}));
const category = view(Inputs.select(["All categories", ...categories], {label: "Type category"}));
```

```js
const filteredTypes = allTypes.filter((d) =>
  collections.includes(d.collection) &&
  (category === "All categories" || d.typeCat === category));
const types = view(Inputs.search(filteredTypes, {
  placeholder: "Search by name, family, collector, county, or catalog number…",
  columns: ["scientificName", "family", "recordedBy", "county", "catalogNumber", "typeStatus"],
  width: 480
}));
```

```js
const holotypes = types.filter((d) => d.typeCat === "Holotype").length;
const byCollection = d3.rollups(types, (v) => v.length, (d) => d.collection).sort((a, b) => b[1] - a[1]);

function typeCollectorChart(width) {
  return Plot.plot({
    width,
    marginLeft: 170,
    x: {label: "Type specimens", grid: true},
    y: {label: null},
    color: {domain: Object.keys(COLORS), range: Object.values(COLORS)},
    marks: [
      Plot.barX(types.filter((d) => d.primaryCollector),
        Plot.groupY({x: "count"}, {y: "primaryCollector", fill: "collection", sort: {y: "-x", limit: 12}, tip: true})),
      Plot.ruleX([0])
    ]
  });
}
```

**${types.length.toLocaleString()}** type specimens match${holotypes ? `, including **${holotypes.toLocaleString()}** holotypes` : ""}.${byCollection.length > 1 ? ` The ${byCollection[0][0].toLowerCase()} collection holds the most (${byCollection[0][1].toLocaleString()}).` : ""}

<div class="grid grid-cols-2">
  <div class="card">
    <h2>By type category</h2>
    ${resize((width) => typeChart(types, {width}))}
  </div>
  <div class="card">
    <h2>Top collectors of type specimens</h2>
    ${resize((width) => typeCollectorChart(width))}
  </div>
</div>

## All matching type specimens

Click a column header to sort.

```js
const rows = types.map((d) => ({
  category: d.typeCat,
  typeStatus: d.typeStatus,
  name: d.scientificName,
  family: d.family,
  collection: d.collection,
  collector: d.recordedBy,
  year: d.year,
  county: d.county,
  catalogNumber: d.catalogNumber,
  record: d.recordURL
}));

const csvLink = URL.createObjectURL(new Blob([d3.csvFormat(rows)], {type: "text/csv"}));
invalidation.then(() => URL.revokeObjectURL(csvLink));
display(html`<p><a download="nysm-type-specimens.csv" href=${csvLink}>
  Download these ${rows.length.toLocaleString()} records as CSV</a></p>`);

display(Inputs.table(rows, {
  rows: 20,
  header: {
    category: "Category", typeStatus: "Type status (as recorded)", name: "Name",
    family: "Family", collection: "Collection", collector: "Collector", year: "Year",
    county: "County", catalogNumber: "Catalog #", record: "Record"
  },
  width: {typeStatus: 220, name: 200},
  format: {
    year: yearFormat,
    name: (n) => html`<em>${n ?? ""}</em>`,
    record: (url) => url ? html`<a href=${url} target="_blank">View</a>` : ""
  }
}));
```