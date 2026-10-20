# NFR configuration task — {{NAMESPACE}}

Use only your fresh task IDs and the supplied files. Data are technical fixtures, not an empirical source dataset. Do not edit application code.

1. Read `rnf/settings.json`. Open **Taxonomies**, create its list with exactly the supplied node IDs/text/source/selection rule, save, review and publish. Record the actual publication and hash.
2. Use **Configure recommenders → Definitions → New NFR from template**. Use the supplied definition ID/version and add the `additionalAttribute` exactly as specified, selecting the taxonomy publication from step 1. Preserve all other method settings. Save, review and publish.
3. Open **Import dataset**, select that publication, upload `rnf/dataset.json`, select the US-Agent record mapping, enter the supplied dataset ID/version and the declared synthetic/reconstructed source. Review the preview and publish only valid records. Record actual IDs/hashes.
4. Open runs, select the definition/base and enter `rnf/target.json` values, preserving IDs where required. Confirm the intended pair and execute. Inspect source, neighbor and suggestions.
5. Open the history, verify replay and download the actual JSON run evidence. Give these files/identities to the observer. Do not use an answer-key UUID as an actual publication ID.
