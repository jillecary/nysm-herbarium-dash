---
title: Data and Digitization
toc: false
---

[← Overview](./)

# Data and Digitization

```js
import {loadSpecimens, collectionsIn, yearFormat} from "./components/specimens.js";
const specimens = await loadSpecimens();
```

```js
const summary = collectionsIn(specimens).map((c) => {
  const v = specimens.filter((d) => d.collection === c);
  const ys = v.map((d) => d.year).filter((y) => y != null);
  return {
    "Collection": c,
    "Records": v.length,
    "Usable coordinates": v.filter((d) => d.coordStatus === "ok").length,
    "Suspect coordinates": v.filter((d) => d.coordStatus === "suspect").length,
    "No year": v.filter((d) => d.year == null).length,
    "No family": v.filter((d) => !d.family).length,
    "Earliest": d3.min(ys),
    "Latest": d3.max(ys)
  };
});
display(Inputs.table(summary, {format: {"Earliest": yearFormat, "Latest": yearFormat}}));
```

## Suspect coordinates

Specimens labeled as collected in New York whose coordinates fall outside the state. Common causes are a missing minus sign on longitude or swapped latitude and longitude.

```js
const suspects = specimens
  .filter((d) => d.coordStatus === "suspect")
  .map((d) => ({
    collection: d.collection, catalogNumber: d.catalogNumber, scientificName: d.scientificName,
    county: d.county, locality: d.locality, latitude: d.lat, longitude: d.lon,
    year: d.year, recordURL: d.recordURL
  }));
const csvLink = URL.createObjectURL(new Blob([d3.csvFormat(suspects)], {type: "text/csv"}));
invalidation.then(() => URL.revokeObjectURL(csvLink));

display(html`<p><a download="nysm-suspect-coordinates.csv" href=${csvLink}>
  Download ${suspects.length.toLocaleString()} suspect records as CSV</a></p>`);
display(Inputs.table(suspects, {format: {year: yearFormat}}));
```