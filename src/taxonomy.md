---
title: Taxonomy
toc: false
---

[← Overview](./)

# Taxonomy

```js
import {loadSpecimens, collectionsIn, familyChart, inYears} from "./components/specimens.js";
const specimens = await loadSpecimens();
const collectionNames = collectionsIn(specimens);
const [minYear, maxYear] = d3.extent(specimens, (d) => d.year);
```

```js
const tab = view(Inputs.radio(["All collections", ...collectionNames], {value: "All collections"}));
const topN = view(Inputs.select([15, 25, 50, "All"], {label: "Show top", value: 25}));
const startYear = view(Inputs.range([minYear, maxYear], {label: "From year", step: 1, value: minYear, format: String}));
const endYear = view(Inputs.range([minYear, maxYear], {label: "To year", step: 1, value: maxYear, format: String}));
const includeUndated = view(Inputs.toggle({label: "Include undated", value: true}));
```

```js
const collection = tab === "All collections" ? null : tab;
const selected = specimens.filter((d) =>
  (!collection || d.collection === collection) && inYears(d, startYear, endYear, includeUndated));
const familyTotal = new Set(selected.map((d) => d.family).filter(Boolean)).size;
const noFamily = selected.filter((d) => !d.family).length;
```

${tab}: **${familyTotal.toLocaleString()}** families, **${selected.length.toLocaleString()}** specimens in the selected years${noFamily ? ` (${noFamily.toLocaleString()} with no family recorded)` : ""}.

```js
display(familyChart(selected, {width, collection, top: topN}));
```