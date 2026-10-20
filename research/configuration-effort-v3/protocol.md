# Configuration effort across three recommenders — protocol v3

Status: engineering proposal, awaiting methodological review. No participant recruitment, consent, observations, or academic approval is asserted. This version does not replace the preserved v1/v2 packages.

## Questions and scope

RQ-C1: Can a person configure, publish, import, execute, inspect, replay, and export each of the three recommenders using the supplied manual without changing application code? RQ-C2: What elapsed time, pauses, errors, requests for help, and configuration/code changes are observed? These questions concern guided configuration. They do not measure autonomous discovery or the empirical relevance of recommendations.

Tasks: NFR (`ramos_2019_manhattan_k1_v2`), test cases (`us_agent_e21_equations_demo_v1`), and project risks (`configurable_project_knn_v1`). Datasets are declared synthetic or reconstructed technical fixtures. The test and risk demonstrations are not claimed to reproduce the corresponding published experiments.

## Proposed design for review

Use a within-participant exploratory pilot with the three tasks, one fresh namespace for every attempted task. Alternate the six possible task orders before recruitment. A proposed pilot of six people covers these six orders once; this is an engineering proposal for identifying procedure problems, not a power calculation or a sufficient sample for population claims. The supervisor/research owner must decide population, recruitment, sample justification, participation procedures, and whether a later study requires another protocol version. Store that decision and its evidence outside participant task material.

Recruit adults with software-development familiarity; record experience as novice, experienced, or not recorded without collecting personal identifiers in repository files. Use pseudonyms, not application usernames. Participation must be voluntary; the research owner determines applicable consent/ethics procedures before collection. Keep identity links and recordings in access-controlled storage outside this repository; fix retention/access/deletion rules in the review record. Do not approach participants or send invitations automatically.

Provide the same introduction, an independent training namespace, and the task manual to everyone. Record training duration separately. Authentication, creation of an authorized isolated organization, and environment preparation occur before the task clock; record failures in an environment log. Use English UI, the recorded software revision and worktree hash, the same browser/environment policy, and a fresh namespace. Verify the actual installation before collection. Do not share answer keys or existing answers with the participant.

Start at zero when the participant first reads a task. Proposed maximum is 30 minutes per task; stop as incomplete at the limit, preserving partial evidence. A participant may withdraw at any point; record abandoned rather than inventing completion. Only externally observed interruptions/environment pauses stop active time. Waiting for the application remains in elapsed and active time. No concurrent work or unlogged assistance.

The observer provides help only after a request or when intervention is necessary to recover the environment; record procedural, conceptual, or technical help. Count a persistent error once until a distinct retry; record a new occurrence on a new explicit attempt. Log configuration changes separately from application-code edits. A completed task with help or code changes remains distinguishable in the report and does not support a claim of unaided configuration without code changes.

## Checkpoints and outcomes

All tasks require published definition, published dataset, actual run, successful replay, and exported run evidence. NFR also requires its taxonomy; tests require taxonomy and test catalog. Risks require neither story/classification nor an invented taxonomy/catalog. Save IDs, versions where applicable, snapshot hashes and exported files at each checkpoint. An offline answer key is never evidence of an actual participant publication.

The CLI checks the supplied file bytes and snapshot envelopes; replay reports must identify the observed run and report matching result/explanation/projection. A researcher must still verify that an artifact belongs to the claimed attempt, participant, installation, and chronological event. Hashes do not authenticate human behavior or a methodological approval. Audit discrepancies and keep the observer's completion claim separate from verified provenance.

Register every planned attempt. `not_started` is an attempt-register outcome without a fabricated session or a zero duration. Sessions are recorded only when started and must end as completed, incomplete, or abandoned. Preserve missing checkpoints and exclusions with reasons. Do not silently remove failures, learning, repeated attempts, or participant withdrawal.

## Analysis and interpretation

Report the number planned, not started, pending, started, completed, incomplete and abandoned separately for each method. Report participant counts, order and repeated attempts. Sessions from one person are repeated measures, not independent people. Report per-session elapsed/active time, errors, help, and code/configuration changes; median times among completed sessions have the completed-session denominator and do not estimate all-attempt performance. Do not pool the three methods into a platform accuracy or general usability score. The initial empty observation register yields zero sessions and null timing/completion estimates.

Freeze decisions, material manifests, software identity and this protocol before observed collection. `methodology.reviewEvidence` records a human review reference; the CLI cannot certify that review. Change materials or procedure only by producing another version and classifying whether earlier observations belong to a pilot or another study. Never rewrite old packages or reinterpret authored fixtures as people.

## Independent evaluation of recommendation quality

Before an empirical recommendation experiment, obtain authorized targets and independent relevance judgments; fix grouping/folds, tuning policy, matching and missing-judgment rules before inspecting results. Preserve every failure/empty result. For functional classification, pair reference labels, actual model outputs and actual human revisions for the same targets under the same frozen definition/base and reference items. Assessors must not derive relevance labels from the recommender output itself. Project risks have no functional-story classification stage: that condition is not applicable, rather than perfectly accurate. Existing source ambiguities and incomplete datasets remain documented in `docs/referencias-e-fidelidade.md`.
