# Integrated technical demonstration

Technical gate: **passed**. 23 preserved scenario conditions, two repetitions each; not independent samples.

| Example | Scenarios | Completed | Blocked | No candidates | No items | Technical failure |
| --- | --- | --- | --- | --- | --- | --- |
| nfr | 13 | 8 | 1 | 1 | 2 | 1 |
| tests | 6 | 3 | 1 | 0 | 1 | 1 |
| risks | 4 | 4 | 0 | 0 | 0 | 0 |

The two deliberate technical-failure scenarios remain in the report. NFR preserves 8/8 compatibility results; all four risk runs preserve result, explanation and projection. Other states are not discarded.

Synthetic relevance metrics remain separate inside each original evaluator result in report.json. They are not empirical accuracy and must not be pooled or compared with article results. Risk relevance, observed classification quality/error propagation, participant effort, and production availability were not evaluated.

The two version-2 risk conditions share the same definition, dataset and input identity. Changing one configured feature changes the selected neighbor. This is a calculation illustration, not a participant study or a result from an original research dataset.

Use npm run evaluate:integrated -- --replay DIRECTORY from the matching repository and recorded runtime. observations.json contains local in-process timings only; times are excluded from the deterministic hash and are not a benchmark.

Deterministic report SHA-256: 40ec09df722e799c02afc27f03a36d8f586f805b5b2edc1b853f2ae991b60871
