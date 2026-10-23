---
name: icse-demo-writing
description: Write and revise the US-Agent ICSE 2027 tool demonstration in LaTeX, grounding claims in repository evidence and checking venue requirements, citations, prose, and the submission PDF.
---

# ICSE demonstration writing

Use for `main.tex` and its bibliography or sections. Discuss work in Portuguese and write manuscript prose in English unless requested otherwise. Preserve the user's intended contribution; make routine editorial decisions without requiring outline approval.

## Establish the argument

Read [venue.md](references/venue.md) for submission constraints and [evidence.md](references/evidence.md) for project sources and limits. Recheck the live call before submission; distinguish its requirements from our editorial choices.

Read the actual manuscript before editing. Identify the user, concrete engineering problem, implemented contribution, observable demonstration, evidence, and limitations. A tool paper should let a reviewer understand what they can do with the tool and why that matters. Do not force a full IMRAD structure onto four pages.

Maintain a compact claim-to-evidence table in the writing notes when drafting substantive claims. Record claim, exact artifact/locator, evidence type, and unresolved qualification. Repository documentation guides discovery; inspect code or preserved outputs before making stronger implementation or quantitative claims. Historical notes and public deployment can lag the checkout.

## Draft and revise

- Build paragraphs around a concrete claim and its supporting behavior or evidence. Explain one end-to-end user scenario, including a meaningful decision and its observable result.
- Describe the shared mechanism and method-specific differences; a list of screens alone does not establish a contribution. Position novelty against verified related work with comparable scope.
- Distinguish implemented, locally checked, publicly deployed, empirically evaluated, and planned. Use future tense only for actual plans. Do not report anticipated benefits as measured improvements.
- Use the current evidence boundaries in `evidence.md`; do not infer participant observations from replay, fixtures, tutorial steps, or runtime durations.
- Preserve known author metadata. Never invent names, affiliations, approvals, video links, or availability claims. Keep unresolved facts visible in writing notes.
- Draft citations only after opening the source and verifying bibliographic metadata. Resolve DOI/title/authors/year against the publisher or source document. Keep unresolved references out of the final bibliography rather than manufacturing metadata from a cite key.
- Apply [style.md](references/style.md) during revision. Preserve technical precision and legitimate qualifications when shortening text.

For figures, read `../icse-demo-figures/SKILL.md`. For tables, read `../icse-demo-tables/SKILL.md`. Load only the skill relevant to the current change; both are supplied in this project.

## LaTeX and final checks

Preserve `IEEEtran` and its conference defaults. Use semantic labels, `Figure~\ref{...}`, `Table~\ref{...}`, `\cite{...}`, `\bibliographystyle{IEEEtran}`, and a real `.bib` file. Avoid geometry/font/spacing overrides, negative spacing to fit pages, `[H]`, and packages that replace IEEE caption styling. Resolve page pressure by editing content and figure design.

When available, build from the repository root with `latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex`. Otherwise use pdflatex, BibTeX, pdflatex twice. Inspect the log for errors, unresolved references/citations, missing glyphs/assets, and overfull boxes. Inspect the rendered PDF at final size, including every page and the references; count all pages toward the limit. Do not claim visual validation from source inspection.

If no TeX engine is installed, report that limitation and perform source checks without claiming a successful build. Do not silently install a TeX distribution or switch the document class. Before submission, check author metadata, bibliography, video, tool access, usage instructions, final page count, and any applicable current publisher AI disclosure instructions. Never fabricate an AI-use statement or conceal assistance to satisfy a style heuristic.
