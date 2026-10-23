---
name: icse-demo-figures
description: Design and integrate evidence-grounded workflow diagrams, UI screenshots, and scientific plots for the US-Agent IEEEtran ICSE tool paper, with editable sources and readable final-size output.
---

# ICSE demonstration figures

Read the target passage and identify the figure's single job before drawing: explain a mechanism, show an actual user decision, or support a quantitative claim. For this submission use IEEEtran conference defaults; venue constraints are in `../icse-demo-writing/references/venue.md`.

## Choose the representation

- Architecture/workflow: use editable TikZ or a deterministic diagram source exported to PDF. Verify components and arrow meanings against `docs/arquitetura-executada.md` and the implementation. Distinguish input, immutable publications, computation, recorded evidence, and human decisions when relevant. Do not imply that all methods require story classification or use identical policies.
- UI: capture the real version being described using demonstration data. Crop to the task and use restrained numbered callouts linked to the narrative. Keep enough context to understand the action/result. Do not synthesize interface screenshots or expose credentials or real personal records.
- Quantitative plot: use existing data and a repeatable plotting script. Preserve raw inputs, units, denominators, transformations, exclusions, missing values, and any uncertainty method. Do not generate plausible curves or invent error bars. Use a table instead when readers need exact values.

For these technical figures, prefer code/vector tools to image generation: labels, arrows, UI state, and data must be exact. Decorative generated artwork rarely earns space in a four-page demo paper. If illustrative generated artwork is explicitly requested, follow the available image generation workflow and identify its illustrative status.

## Design at publication size

Start with `\columnwidth`; use `figure*` only when a genuinely wide figure needs both columns. Choose orientation and detail for the available width before export. As a local readability target, keep labels around 8–10 pt at final size; this is not an ICSE-prescribed threshold. Avoid shrinking a large dashboard until text becomes illegible.

Use consistent terms, fonts, and line weights; label edges where their meaning is ambiguous. Give color a consistent semantic role and reinforce it with labels, shapes, or line styles. Check contrast and grayscale. For screenshots use lossless PNG; for diagrams/plots prefer vector PDF with embedded fonts. Keep the editable source and generation command with the artifact. Do not assume raw SVG is directly supported by pdflatex.

Read [figure-template.tex](assets/figure-template.tex) when integrating an actual asset. It is a snippet, not a standalone file; replace the example path/caption. Put caption below the figure and label after caption. Reference it in text, explain the takeaway, and write a caption that states what the reader should inspect. Explain abbreviations and any synthetic/example status. Provide a meaningful description through the target workflow's supported accessibility mechanism; do not copy `acmart`-specific commands into IEEEtran without support.

## Review

Compile and inspect the rendered figure in its page context at final size. Check clipping, overlapping labels, arrow direction, raster quality, color independence, and caption/legend agreement. Confirm that screenshots match demonstrated functionality and plotted values match their evidence source. If PDF rendering is unavailable, explicitly leave visual verification pending.

Reference tools: [PGF/TikZ](https://ctan.org/pkg/pgf), [Matplotlib export documentation](https://matplotlib.org/stable/api/_as_gen/matplotlib.pyplot.savefig.html). These are implementation aids, not venue requirements.
