# Test-case configuration task — {{NAMESPACE}}

Use your supplied task IDs and synthetic test artifacts. Do not edit application code.

1. In **Configure recommenders → Test catalogs**, review and publish `tests/catalog.json` with the supplied synthetic-use declaration.
2. In **Taxonomies**, create/review/publish the criteria list in `tests/settings.json`, preserving IDs, descriptions and selection rules. Return using **Configure recommenders**.
3. In **Definitions**, choose **New test-case demonstration**. Use the supplied ID/version and change the acceptance-criteria field to the exact taxonomy publication. Preserve the method's other settings, review and publish.
4. Import `tests/dataset.json` against that definition and the exact published test catalog. Apply the supplied source declaration and IDs, inspect the preview, and publish the valid records.
5. In runs, select that definition, dataset and catalog; enter `tests/target.json`, execute and inspect the original test artifacts, source neighbors and explanations.
6. Verify replay in the history and download the actual run JSON. Record all real publications and their hashes for the observer. Catalog/template data are demonstrations, not original empirical TestRec results.
