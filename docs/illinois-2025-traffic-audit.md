# Illinois, Lake Bluff and CPD 2025 traffic upload audit

Review date: 2026-11-16. **Staged counts, not new mapped coverage.** Fourteen files were inspected: eight statewide/Lake Bluff files and six CPD traffic files. The separate CPD pedestrian folder is excluded. Raw files remain outside this repository. Only file checksums, quality counters and coarse count aggregates are versioned in [the review directory](data/illinois-2025/).

## Exact counts and alternatives

- Statewide part 1: **999,999** TXT rows and the same XLSX row count; 54 columns.
- Statewide part 2A: **419,998** TXT rows and the same XLSX row count; 54 columns.
- Statewide part 2B: **417,064** TXT rows and the same XLSX row count; 54 columns.
- Statewide total: **1,837,061** rows, **774** distinct reporting-agency codes. There are no repeated full rows including ID, repeated agency/ID pairs, or conflicting copies of an agency/ID. Excluding IDs, **247** additional rows repeat all other normalized attributes within the same agency. These are candidate repeats, not proof of duplicate encounters; different source IDs must not be silently collapsed.
- CPD January–June: **134,090** rows; July–December: **88,011**; supplementary January–June: **2,750**. Each has 52 columns. Combined: **224,851** source rows, **183** candidate repeated normalized full rows, **224,668** distinct attribute rows. No unique stop IDs are supplied. The compact review CSV contains **3,278** beat-month groups across **275** beat codes.
- Revised Lake Bluff: **1,517** rows, 52 columns, no repeated normalized full rows. Its TXT/XLSX pair matches exactly after date/time normalization. It has no agency-code or stop-ID column.

These seven extracts contain **2,063,429 source rows before cross-family overlap decisions**. This is not an accepted-stop total. Never sum the fourteen files: XLSX and TXT are alternate representations. All TXT dates parse as valid 2025 calendar dates and all times parse; no dates or times were rejected in this audit.

The files named `.txt` are comma-delimited CSV, not the tilde-delimited submission format in the [IDOT 2024 specification](https://idot.illinois.gov/content/dam/soi/en/web/idot/documents/transportation-system/pamphlets---brochures/safety/trafficstopdbfileformat.pdf). Date representations include ISO date-times, US dates with a midnight suffix, Excel serial dates, 24-hour clocks, AM/PM clocks and Excel fractional-day times, including scientific notation. Workbook parsing resolves shared strings, sparse cells and all worksheets; formulas are rejected.

The CPD and Lake Bluff pairs match completely after ordinary normalization. The statewide pairs have **13 / 12 / 5** strict normalized row differences. The differences are tilde versus apostrophe spellings in vehicle-make or beat text: part 1 has 7 vehicle-make and 6 beat differences; part 2A has 12 beat differences; part 2B has 4 vehicle-make and 1 beat difference. A separate comparison-only export-equivalence rule is recorded in `audit.json`. It does not rewrite source identities, beats or the cross-family overlap comparison. These alternatives are never treated as extra stops.

## Ownership and historical overlap

No CPD 52-attribute row exactly matches a statewide row after removing the statewide ID/agency prefix. This is an exact-attribute check, not proof that the files share no encounters with corrected attributes.

The revised Lake Bluff file has **1,100 distinct exact-attribute matches** in the statewide files, all under code **13478**. The statewide files contain **1,104 total rows** under that code; **4** do not exactly match the revised extract. The revised extract has **417** rows without exact statewide matches. Code 13478 is a **candidate agency identity**, not an approved geographic mapping. No local revision automatically replaces or supplements that agency's statewide rows. Confirm agency identity and whether the revised release supersedes the entire earlier extract; preserve one explicit owner for each agency/year before promotion.

The existing accepted Illinois map sources are Chicago OPP (**1,877,250** records, 2012-01-01 through 2020-05-16) and Urbana stop-level (**28,241**, 2013-01-01 through 2023-02-14). Their published date ranges do not overlap these 2025 rows. Other states' sources are not Illinois owners. This audit does not import statewide OPP or combine pedestrian/offense tables with vehicle stops. The existing snapshot remains **7,766,114** mapped records and **183,115** occupied cells; this change adds **0** mapped records, cells, counties or population coverage.

## Geographic verification and blockers

The [official current Chicago police-beat layer](https://data.cityofchicago.org/d/aerh-rz74) exposes its tabular geometry at [n9it-hstw](https://data.cityofchicago.org/resource/n9it-hstw.geojson). It contains **277** polygons. All **275** observed CPD beat codes occur in that set, covering all **224,851** source rows. The publisher names the table `PoliceBeatDec2012`; its row-update timestamp is 2013-02-13. See `coverage-review.json` for pinned geometry/metadata checksums. These are **code matches**, not a separate certification of the uploaded field's meaning or historical applicability throughout 2025. No centroid, random point, driver ZIP, officer assignment or other-agency beat is used.

Promotion still requires:

1. Authoritative uploaded-data provenance/codebook and reuse/release conditions; the boundary service's terms do not establish the traffic extract's reuse terms.
2. An official agency-code dictionary for the statewide records and confirmation of Lake Bluff's agency identity and revision ownership.
3. Effective-year agency-specific beat/location definitions and boundaries. Statewide location values contain mixed local codes/free text and no verified stop coordinates. The local filename is not geographic authority. For CPD, confirm `BEAT_I` is stop location and the official boundary version applies to 2025.
4. A reviewed source-year ownership decision, especially for the 1,100 Lake Bluff matches and 4 differing statewide rows. Exact attribute matches and the 247 statewide attribute repeats do not establish unique encounters.

The [IDOT study page](https://idot.illinois.gov/form-and-reports/crash-reports/illinois-traffic-and-pedestrian-stop-study.html) and the existing Illinois coverage notes record conflicting published statewide totals, **2,062,235** versus **2,062,325**. Replacing all 1,104 candidate-agency rows with the revised local 1,517, then adding CPD, would arithmetically yield 2,062,325 raw source rows. That coincidence does not authorize the replacement or certify the published total, and it does not account for candidate duplicate encounters.

## Replay, checks and output privacy

Use Python 3.11+ with no additional packages. Prepare a local JSON manifest containing seven objects with `family`, `txt`, and `xlsx`; families must be exactly three `statewide`, three `cpd` and one `lake_bluff`. All fourteen paths must be distinct and outside the checkout. The source schemas are pinned by header checksum. The audit verifies input file hashes before and after parsing. Choose a fresh output directory; public asset output is refused.

```sh
python scripts/audit-illinois-2025.py --manifest ../illinois-manifest.json --out ../illinois-review
python scripts/test-illinois-2025.py
npm test
npm run build
```

No driver/officer identity, address, ZIP, birth year, demographics, vehicle description, precise stop date/time, source stop ID, or row fingerprint is written to output. Full-row fingerprints are in-memory comparison aids only. The only count outputs are agency/month source counts and CPD beat/month raw, candidate-repeat and distinct-attribute counts. They have no geographic coordinates, reason/outcome labels, or map-ready source indices. Source families stay separate; the review CSVs must not be appended to the existing map tiles. A future complete validated map build must reconcile source ownership, counts and coverage before promotion.

Validation: two full real-file audits produced byte-identical agency/month and CPD beat/month CSVs; all fourteen source checksums remained unchanged. The second audit verified all seven pairs completely under the documented export-equivalence rule while retaining the 30 strict differences. Seven synthetic Python tests include a full fourteen-file ingestion, comparison-only substitutions, atomic output and privacy checks. All **362** JavaScript tests across **51** files pass, and the TypeScript/web build passes. Raw files are not needed in CI.

## Merge and release limits

The repository's `pages.yml` deploys the website on every main-branch push. A normal merge would therefore publish to production, contrary to the request for this work. Leave this PR unmerged until an established non-production merge path is available; do not disable checks or alter deployment policy just to force a merge.

The existing Android workflow builds signed release AAB artifacts but contains no Google Play upload step. An AAB artifact or public debug APK is not delivery to the existing Alpha testers. No Play upload, tester-list change, production publication or release is performed by this ingestion. Alpha remains blocked by the data-promotion issues above and the absence of a verified existing Alpha delivery path.
