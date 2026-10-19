# Integrated technical demonstration — version 1

This protocol consolidates existing, authorized local evidence for the three recommenders. It does not introduce evaluation targets, human observations, model predictions, or relevance judgments. Unit: one preserved scenario/input condition. Scenarios can share targets and datasets and are not independent samples.

## Inputs and execution

- NFR: the 13 scenarios in `docs/evidencias/b14a/bundle.json`, including eight compatibility scenarios and five synthetic relevance scenarios. Execute the existing NFR evaluator and its original partition, expected-failure, matching, and denominator rules.
- Test cases: the six scenarios in `docs/evidencias/b18a/bundle.json`. Execute the existing test-case evaluator, preserving its synthetic judgments, catalog identities, declared group holdout, blocked/empty/failure outcomes, and denominator rules.
- Project risks: the four stored runs `run-1-baseline.json`, `run-2-distributed.json`, `run-2-co-located.json`, and `run-ui.json` in `docs/evidencias/project-risks-2026-10-19`. Verify their envelopes and child hashes and execute the actual configurable method with only their preserved request/publications. Compare result, explanation, and projection with each stored run. No risk relevance judgment is available.

Input bytes must match their original artifact manifests before execution. Preserve those bytes inside the new package. Nothing is published, imported into a database, or added to an operational history by this command. No `.env`, database connection, network request, or LLM is used. Existing evidence packages are read-only.

Two executions per condition check determinism. NFR and test-case repetitions are declared in their original bundles and must be two for this protocol. Risk repetitions are also two. Keep timings outside the deterministic report. Timings measure local in-process execution, not HTTP/database latency, scalability, or human task time.

## Report

Report every scenario, including blocked, no-candidate, no-item, and expected technical failures. Retain original synthetic relevance metrics separately by example; do not pool different targets, item identities, or judging conventions into a platform accuracy score. No relevance metric is inferred for risks from the items returned by the method.

The technical gate requires both existing evaluator gates, all four risk comparisons, and deterministic repetitions to pass. A technical gate is not a statistical hypothesis test or evidence of empirical quality. CSV exports contain neutral scenario identifiers, states, counts, and hashes, without spreadsheet formulas or arbitrary user text.

## Classification and review

The source bundles provide declared classification inputs; they do not supply paired observed predictions and subsequent human revisions for the same evaluated targets. Report classification quality and its propagation as **not measured**. Do not rename manually changed labels as model predictions, infer accuracy from consensus, or treat recommendation acceptance as relevance ground truth.

To complete the empirical part of B22, obtain authorized targets with reference labels, actual predictions and predictor version, and actual reviewed labels with provenance. Execute all input conditions on the same frozen definition/base, without changing reference items, partition or tuning. Keep prediction/review events separate from relevance judgments. Report classification metrics separately from recommendation metrics and include failures and unreviewed targets in the declared denominators. Project-only methods have classification dependence **not applicable**, rather than perfect classification accuracy.

## Configurability and effort

The two risk conditions with the same version-2 definition/base differ only in the configured `team_distribution` value. Their distances and selected neighbors illustrate that a configured feature participates in calculation. Version 1 uses a different definition and k; it is not a controlled estimate of the feature's effect.

The existing configuration-effort v2 instrument covers two historical exercises. It has not collected participant observations and is not automatically extended to the third exercise. The new three-example tutorial is guidance for operation, not a validated study task pack. Before a three-example study, version its materials/instrument binding, fix the methodological decisions, verify the target installation, and collect actual observations.

## Reproduction and provenance

`npm run evaluate:integrated -- --output NEW_DIRECTORY` exports preserved inputs, deterministic report, per-scenario CSV, observational timings, and a manifest. Refuse an existing destination; never overwrite evidence. `--replay DIRECTORY` verifies the package and repeats all executions from its inputs, without requiring a running application.

Inventory the evaluator, protocol, dependency lockfile, and transitive method/evaluator source files. Record exact worktree hashes for audit and UTF-8/LF source hashes for checkout portability; replay permits only CRLF/LF differences in inventoried text sources. This new source identity format does not replace or normalize the older scientific manifests. Replay requires the recorded Node, ICU and collation locale because historical executor snapshots include runtime metadata. Record the Git revision and dirty state, without claiming that an uncommitted working tree is a published release.

The report separates: technical reproduction, original synthetic annotations, classification propagation not measured, participant effort not measured, empirical recommendation quality not measured, and production deployment not checked. B22/B23 remain partial until the evidence appropriate to each claim exists.
