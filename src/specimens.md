---
title: Specimen check
sql:
  specimens: ./data/specimens.parquet
---

# Specimen check

```sql
SELECT collection, count(*) AS records,
       count(decimalLatitude) AS with_coordinates,
       min(year) AS earliest, max(year) AS latest
FROM specimens
GROUP BY collection
```