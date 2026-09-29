---
title: History
toc: false
---

[← Overview](./)

# History of the collection

```js
import {
  loadSpecimens, collectionsIn, tabs,
  timeChart, cumulativeChart, collectorChart
} from "./components/specimens.js";

const specimens = await loadSpecimens();
const collectionNames = collectionsIn(specimens);
```

```js
const collections = view(Inputs.checkbox(collectionNames, {label: "Collections", value: collectionNames}));
const tab = view(tabs(["Over time", "Collectors"]));
```

```js
const selected = specimens.filter((d) => collections.includes(d.collection));
const dated = selected.filter((d) => d.year != null);
const byDecade = d3.rollups(dated, (v) => v.length, (d) => Math.floor(d.year / 10) * 10)
  .sort((a, b) => b[1] - a[1]);
const [peakDecade, peakCount] = byDecade[0] ?? [null, 0];
const undated = selected.length - dated.length;
```

```js
// Controls that only show on their own tab
const intervalInput = Inputs.radio(["Decade", "Year"], {label: "Group by", value: "Decade"});
const interval = Generators.input(intervalInput);
const topInput = Inputs.select([15, 25, 50], {label: "Show top", value: 25});
const topCollectors = Generators.input(topInput);
```

```js
if (tab === "Over time") {
  display(html`<p><strong>Collecting peaked in the ${peakDecade}s</strong>, with
    ${peakCount.toLocaleString()} specimens collected that decade.
    ${undated ? `${undated.toLocaleString()} specimens have no collection year and aren't shown.` : ""}</p>`);
  display(intervalInput);
  display(timeChart(selected, {width, interval: interval === "Year" ? 1 : 10}));
  display(html`<h3>Growth of the collection</h3>
    <p>Running total of specimens by the year they were collected.</p>`);
  display(cumulativeChart(selected, {width}));
} else {
  display(html`<p>The most prolific collectors, ordered by when they started collecting.
    The grey line spans each collector's first and last specimen, the ticks mark individual
    specimens, and the number is their total.</p>
    <p><small>Collector names are shown as recorded and haven't been standardized, so one
    person may appear under more than one spelling (for example "C. H. Peck" and "Peck, C.H.").</small></p>`);
  display(topInput);
  display(collectorChart(selected, {width, top: topCollectors}));
}
```