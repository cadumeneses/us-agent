ALTER TABLE recommender_runs DROP CONSTRAINT recommender_runs_content_check;
ALTER TABLE recommender_runs ADD CONSTRAINT recommender_runs_content_check
  CHECK (jsonb_typeof(content) = 'object' AND content->'schemaVersion' IN ('1'::jsonb, '2'::jsonb, '3'::jsonb) AND content ? 'schemaVersion');

CREATE TABLE project_recommender_profiles (
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  definition_id TEXT NOT NULL,
  definition_version TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  values JSONB NOT NULL CHECK (jsonb_typeof(values) = 'object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, definition_id, definition_version),
  FOREIGN KEY (definition_id, definition_version) REFERENCES recommender_definition_versions(definition_id, version)
);
