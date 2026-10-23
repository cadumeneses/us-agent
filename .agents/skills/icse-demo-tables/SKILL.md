---
name: icse-demo-tables
description: Build compact, traceable booktabs tables for the US-Agent IEEEtran ICSE demonstration paper, preserving units, denominators, missing data, and the distinction between synthetic and empirical evidence.
---

# ICSE demonstration tables

Use when a paper needs precise values or a compact comparison. Read the passage, underlying artifact, and applicable venue constraints in `../icse-demo-writing/references/venue.md`. Choose columns around one reader question. Do not add a table that merely repeats the surrounding prose.

## Evidence and meaning

- Quantitative rows must trace to actual output files with their version and measurement unit. For repeated exports, use a small deterministic generator from the canonical source rather than manual transcription. Keep its command and source locator.
- Identify the unit: scenario, run, story, project, item, or participant. For US-Agent's preserved 23-condition demonstration, retain the 13/6/4 split and the dependence between conditions. Do not relabel those conditions as independent users or projects.
- Preserve blocked, empty, and deliberate failure outcomes. State the denominator for percentages; distinguish `0`, missing, and not applicable. Explain rounding. Do not average metrics across incompatible populations or synthetic relevance rules.
- Separate implemented capability, local technical check, planned study, and measured empirical outcome. Local replay time is neither participant effort nor deployed response time.
- For related-work comparisons, verify each cell against the source. Distinguish unreported from absent. Do not manufacture novelty by marking undocumented features as unsupported.

## IEEEtran layout

Use `booktabs` with `\toprule`, `\midrule`, and `\bottomrule`; avoid vertical rules and repetitive horizontal lines. Put the caption above the table and `\label` after the caption. Use `Table~\ref{...}` in the prose. Align numeric columns, place units in headers, keep precision consistent, and explain abbreviations and missing-value symbols.

Fit ordinary tables within `\columnwidth`. Shorten headers, wrap descriptive columns with `tabularx` or `p{...}`, or remove redundant columns before reducing type size. Use `table*` for necessary wide comparisons and check its placement in the compiled PDF. Do not use `\resizebox` to squeeze unreadable text or negative spacing/font overrides to meet the page limit.

Read [table-template.tex](assets/table-template.tex) for a wrapping textual comparison. It is an integration snippet requiring booktabs and tabularx. Its rows are illustrative guidance, not measured results: replace them with verified manuscript content. For numeric output, choose appropriate numeric alignment rather than copying its text-only columns.

## Review

Reconcile every value and total with its source; review exclusions and undefined cases. Inspect the PDF for overflow, readable headers, excessive wrapping, caption accuracy, and agreement with the abstract and body. State any pending compilation or visual check.

Source: [booktabs package and manual](https://ctan.org/pkg/booktabs). Formatting choices here are project conventions unless required by the track.
