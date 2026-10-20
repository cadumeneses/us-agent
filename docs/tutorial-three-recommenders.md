# Three recommenders: operator tutorial

The current release also provides **Access and audit** for organization selection and role administration, and **Adapt accepted NFR** for separately versioned contextual sentences. See the [access guide](acesso-organizacoes-e-auditoria.md), [NFR adaptation guide](adaptacao-rnf.md), and [three-task study v3](estudo-tres-casos-v3.md). Deployment requires the current release through migration 031; follow the [042 deployment sequence](entregas/042-fechamento-tecnico-e-preparacao-empirica.md). No participant study is claimed by these examples.

This guide describes the English interface delivered through 038. It covers ordinary project work and a repeatable demonstration with supplied files. The examples are synthetic or reconstructed compatibility material; they do not establish recommendation accuracy or participant effort.

## Prepare an installation

Use the repository dependencies and configuration described in [README](../README.md). For an existing deployment, follow the [deployment procedure](deploy-vercel.md) and apply migrations **027 and 028 before deploying the corresponding application code**. This guide does not apply production migrations, publish a deployment, reset accounts, or seed a database.

In a local development installation, configure `.env` from `.env.example`, use the intended local database, apply migrations, and start the API/web application. The normal web address is `http://localhost:5173`. A protected installation uses its existing username/password login; do not put integration credentials into browser storage or input fields.

Open **Recommenders**. Its three choices need different contexts:

| Choice | Required context | Reference | Output |
| --- | --- | --- | --- |
| Non-functional requirements | Reviewed classification, project profile and task categories in the project workflow | Explicitly selected published dataset, or explicitly selected operational history | Requirement statements |
| Test cases | Classified story, profile and the fields required by the selected definition | Published dataset with its exact published test catalog | Existing test artifacts |
| Project risks | Project profile and configured features | Published project-reference dataset | Risk statements from similar projects |

Only the first two project workflows request a classified story. The advanced published-dataset area also permits entering their declared values directly; entering those values is not an execution of a classifier. Project risks does not require any story, sprint, task or classification.

## Everyday project workflow

In **My Projects**, create a project and complete its profile. For a story-based recommendation, use **Add user story**, save it, and add **Tasks** and their categories. Use **Classify story** when ready. Complete any required classification review. Classifying or reclassifying a saved story preserves its identity and prepared details.

Open **Recommenders**, choose the desired option, then the project. For requirements or test cases, select the classified story. For NFRs, choose **Published dataset** or **Operational project history** explicitly; neither is silently substituted for the other.

Choose a published configuration/base. Compatible saved values are filled in. Complete the remaining fields; a published taxonomy requires its node IDs, not guesses based on names. Where several classification pairs exist, choose the pair required for this run. For test cases, review the acceptance criteria and other required context and use the exact catalog pinned by the dataset.

Run the recommendation and inspect the items and their origins. NFR decisions can link a statement to an explicitly confirmed destination. Test assessment/adaptation preserves the source and a separate copy. A risk result is a traceable suggestion for review; this version does not persist acceptance, adaptation or operational risk decisions.

## Demonstration materials for NFRs and test cases

Use a fresh namespace for each installation attempt. From the repository root:

```powershell
npm.cmd run prepare:configuration-tasks -- --namespace demo039 --output tmp/three-examples-demo039
```

If this namespace/destination is already used, choose a different lowercase identifier and a new directory. The command generates files only; it does not publish anything or contact the database. Files in `participant/` contain the input data/settings. `facilitator/` contains an offline answer key and observation forms, not a participant execution. The older generated task instructions are historical; use the current control names below. This tutorial is not a newly validated study task pack or a replacement binding for the configuration-effort instrument.

### Non-functional requirements

1. Open **Taxonomies** from the sidebar or recommender setup. Create and publish the list specified by `participant/rnf/settings.json → taxonomy`, preserving its IDs, node text, source and selection rule.
2. Return through **Configure recommenders**. In **Definitions**, select **New NFR from template**. Use the definition ID/version from the settings and a neutral name such as `NFR example`. Preserve the method and existing bindings. Add the `study_context` attribute exactly as described in `additionalAttribute`: single, required, artifact scope, context role, no vector representation. Select the taxonomy publication created above. Save and publish the reviewed draft.
3. In **Import dataset**, choose that definition, then **Load dataset schema**. Enter the dataset ID/version and source/use declaration from the settings. Select JSON and upload `participant/rnf/dataset.json`. Use **Use US-Agent record mapping**, review all mappings, then **Generate import preview**. Publish only after inspecting the records and any errors. Do not import the target file as a reference record.
4. Open **View published dataset runs → New run**. Choose the definition and compatible dataset. Enter `id`, `provenance.source` and the values in `participant/rnf/target.json`. Expand the published configuration to find attribute IDs if display names differ. Keep the output list `nfrs` empty. Select the declared module/operation pair and choose **Run recommendation**.
5. Inspect the neighbor and requirement items. The added context field is validated and preserved but does **not** change the NFR calculation. Use the project-risk exercise below to demonstrate a new calculation feature.

### Test cases

1. In **Test catalogs**, publish `participant/tests/catalog.json` using the catalog ID/version and synthetic declaration from `participant/tests/settings.json`. The preview includes the actual file hash to review.
2. Open **Taxonomies** and create and publish the criteria list from the same settings, including all node IDs, names and descriptions.
3. Return through **Configure recommenders**. In **Definitions**, select **New test-case demonstration**. Set the ID/version from the settings and name it `Test-case example`. Change the `acceptance_criteria` attribute to **Taxonomy node**, selecting the exact criteria publication. Preserve all other bindings and the implemented method parameters. Save and publish the reviewed draft.
4. Import `participant/tests/dataset.json` with the published definition, the exact synthetic catalog, dataset identity and source from the settings. Use the record mapping and inspect the four records before publishing. Output test IDs belong to reference records; missing associations must not be invented.
5. In **View published dataset runs → New run**, select the definition, base and exact catalog. Fill `participant/tests/target.json`. Output answers are withheld by the form. Use **Run recommendation**, then inspect the returned titles, steps, neighbors and contributions. These are retrieved test artifacts, not newly generated tests.

Names and translated attribute titles need not have the same full-publication hash as an older exercise answer key. Publication hashes in the current installation are authoritative. The synthetic method/values/results remain the relevant calculation comparison; no participant completion is inferred from this manual.

## Project risks and a new calculation attribute

1. In **My Projects**, create a demonstration project. Set platforms to `Web`, application domains to `Finance`, and languages to `TypeScript`. Save the profile. Do not create a story.
2. In the configuration area choose **New project-risk recommender**. Use a fresh definition ID, version `1`, and name `Project risks`. The default method uses three categorical features and a neighbor limit of two. Save and publish.
3. Use **Download risk sample dataset**, or the repository file [project-risks.synthetic.json](../config/recommenders/examples/project-risks.synthetic.json). Import it as JSON against this exact publication, with a fresh dataset ID, version `1`, and a synthetic use declaration. Map the record IDs/values, inspect the three profiles and publish.
4. In **Recommenders → Project risks**, select your project, configuration and dataset. Confirm the saved project values and choose **Recommend**. Inspect the source records and statements. No classified-story control is required.
5. Return to the definition and choose **Create a new definition version**. Set version `2`. Add `team_distribution`, name `Team distribution`, project scope, single value, required, **Feature**, binary presence. Use **Enumeration** with `co-located` and `distributed` on separate lines. Set its weight to `5` and the neighbor limit to `1`. Save and publish. No code change is needed for this attribute.
6. Import [project-risks-extended.synthetic.json](../config/recommenders/examples/project-risks-extended.synthetic.json) against version `2`, using a new dataset version. This file contains the same synthetic profiles with the added field; it is derived from the preserved version-2 demonstration. A base pinned to version `1` cannot be reused as if it belonged to version `2`.
7. Back in **Project risks**, choose version `2`, its base and `distributed`. Run. The demonstrated input selects `reference-b`. Change only this feature to `co-located` and run with the same definition/base: it selects `reference-a`. Expand the feature contributions to inspect the weighted distance. Both runs preserve their own inputs.

The comparison in step 7 holds configuration, k, base and other input values fixed. Comparing versions 1 and 2 alone would also change k and the feature vocabulary. Similarity is not a probability that a risk occurs. Custom profile values are saved per project/configuration version; they do not silently overwrite the ordinary project profile or other versions. **Reload saved profile** replaces unsaved changes with stored values.

## Preserve and repeat a run

Use **Run history**, **Verify replay**, and **Download JSON evidence**. Retired dependencies remain in preserved snapshots, while a new run requires currently available publications. Keep the run ID, definition/base/catalog versions where applicable, hashes and exported JSON. Do not copy the internal synthetic UUIDs from an offline answer key as evidence of an actual publication.

To repeat the already recorded calculations without an installation, database or provider:

```powershell
npm.cmd run evaluate:integrated -- --output tmp/integrated-demo-new
npm.cmd run evaluate:integrated -- --replay tmp/integrated-demo-new
```

The command consolidates 23 existing scenario conditions, preserving expected failures, empty results and blocked outcomes. Read `summary.md`, `scenarios.csv`, `report.json` and `manifest.json`. The [evaluation protocol](../research/integrated-demonstration-v1/protocol.md) explains the limited claim and runtime/source requirements. Classification error propagation and human effort are not measured by repeating these calculations.

## When a step cannot continue

| Symptom | Action |
| --- | --- |
| No compatible base | Check the exact definition ID/version/hash used by the import; load further catalog pages if present. Publish a new base for a new definition version. |
| Incomplete feature | Supply a real known category. Do not use an empty value as an inferred absence. |
| Taxonomy mismatch | Select an ID from the pinned publication; display-name similarity is not an ID mapping. |
| Profile conflict | Preserve your intended changes separately, reload the saved profile and review before retrying. |
| Publication changed or unavailable | Refresh the available configuration/base and inspect its state. Historical replay remains separate from new execution. |
| Original-study quality question | Consult the fidelity documentation and obtain the required reference data; a successful demonstration does not resolve empirical accuracy. |
