---
title: About
---

# About this project

This dashboard is an independent project that maps and summarizes the
publicly available herbarium records of the New York State Museum (NYSM). It is
**not an official New York State Museum website**, and the museum has not reviewed
or endorsed it.

It was built by Jill Cary, a volunteer at NYSM, to explore the collection's
history and geography and to demonstrate what a public collections visualization could look like.

## Data sources

| Collection | Source | Records online | License |
|---|---|---|---|
| Lichens | [GBIF](https://doi.org/10.15468/bzm397), via the Consortium of Lichen Herbaria | ~18,700 | CC BY-NC 4.0 |
| Fungi | [GBIF](https://doi.org/10.15468/8dy35f), via MyCoPortal | ~18,800 | CC0 |
| Algae | [GBIF](https://doi.org/10.15468/6mvv2g), via the Algae Herbarium Portal | ~590 | CC BY-NC 4.0 |
| Vascular plants | [Consortium of Northeastern Herbaria](https://portal.neherbaria.org/portal/collections/misc/collprofiles.php?collid=65) | ~41,700 | CC0 |

All data are the property of the New York State Museum and are used under the licenses above.
Data from the Consortium of Northeastern Herbaria are used in accordance with the CNH data usage policy.

## What this dashboard does and doesn't show

- **Only digitized, published records appear.** Much of the physical collection has
  not yet been digitized, and the museum's bryophyte records are not yet included.
- **Most specimens can't be mapped.** Only about a quarter of records have coordinates.
  Many older specimens record only a county or a written locality description.
  Fungi in particular have almost no coordinates.
- **Some records are flagged, not corrected.** Specimens labeled as collected in
  New York whose coordinates fall outside the state are marked as "suspect."
  Years before 1750 or in the future were removed as likely data-entry errors.
- **Names are shown as published.** Collector names and taxonomy have not been
  standardized across sources.

## Updates

GBIF data refresh automatically each month. Vascular plant data from CNH are
updated manually.

## Source code

The code for this dashboard is open source: \[[GitHub repository link](https://github.com/jillecary/nysm-herbarium-dash)\]

Questions or corrections: [jillecary@gmail.com]
