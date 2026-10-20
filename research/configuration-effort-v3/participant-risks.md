# Project-risk configuration task — {{NAMESPACE}}

Use `risks/settings.json`, `risks/dataset.json`, and `risks/target.json`. These are synthetic examples. No story, functional classification, or taxonomy is required.

1. Create a project named with your task namespace. Save the supplied platform/domain/language profile; create no story.
2. In **Configure recommenders → Definitions**, choose **New project-risk recommender**, use the supplied ID/version/name and preserve the categorical features, weights, neighbor limit and output role. Review and publish.
3. Import the supplied JSON dataset against this publication with its new dataset ID/version and synthetic-use declaration. Use the US-Agent record mapping. Inspect the preview and publish.
4. In **Recommenders → Project risks**, select the project, configuration and dataset. Confirm the values from the target, execute and inspect the source profiles, risks and feature contributions. Similarity is not a probability of risk occurrence.
5. Verify replay, export the actual run JSON, and record the actual IDs/hashes for the observer. Do not change application code or turn this example into a claimed reproduction of ARISE.
