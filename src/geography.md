---
title: Geography
toc: false
---

[← Overview](./)

# Geography

```js
import {loadSpecimens, collectionsIn, countyChart, inYears} from "./components/specimens.js";
const specimens = await loadSpecimens();
const collectionNames = collectionsIn(specimens);
const [minYear, maxYear] = d3.extent(specimens, (d) => d.year);
```

```js
const collections = view(Inputs.checkbox(collectionNames, {label: "Collections", value: collectionNames}));
const startYear = view(Inputs.range([minYear, maxYear], {label: "From year", step: 1, value: minYear, format: String}));
const endYear = view(Inputs.range([minYear, maxYear], {label: "To year", step: 1, value: maxYear, format: String}));
const includeUndated = view(Inputs.toggle({label: "Include undated", value: true}));
const countySort = view(Inputs.radio(["Most specimens", "Alphabetical"], {label: "Sort", value: "Most specimens"}));
```

```js
const selected = specimens.filter((d) =>
  collections.includes(d.collection) && inYears(d, startYear, endYear, includeUndated));
const nyRows = selected.filter((d) => d.stateProvince === "New York");
const unmatched = nyRows.filter((d) => !d.nyCounty).length;
```

All New York specimens with a recognizable county, including those without coordinates. ${unmatched.toLocaleString()} New York specimens have no county or an unrecognized county name.

```js
display(countyChart(selected, {width, sort: countySort === "Alphabetical" ? "alpha" : "count"}));
```