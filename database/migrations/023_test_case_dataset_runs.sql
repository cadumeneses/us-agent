ALTER TABLE recommender_dataset_imports DROP CONSTRAINT recommender_dataset_imports_preview_check;
ALTER TABLE recommender_dataset_imports ADD CONSTRAINT recommender_dataset_imports_preview_check
  CHECK (jsonb_typeof(preview) = 'object' AND preview->'schemaVersion' IN ('1'::jsonb, '2'::jsonb) AND preview ? 'schemaVersion');
ALTER TABLE recommender_dataset_versions DROP CONSTRAINT recommender_dataset_versions_publication_check;
ALTER TABLE recommender_dataset_versions ADD CONSTRAINT recommender_dataset_versions_publication_check
  CHECK (jsonb_typeof(publication) = 'object' AND publication->'schemaVersion' IN ('1'::jsonb, '2'::jsonb) AND publication ? 'schemaVersion');
ALTER TABLE recommender_runs DROP CONSTRAINT recommender_runs_content_check;
ALTER TABLE recommender_runs ADD CONSTRAINT recommender_runs_content_check
  CHECK (jsonb_typeof(content) = 'object' AND content->'schemaVersion' IN ('1'::jsonb, '2'::jsonb) AND content ? 'schemaVersion');
