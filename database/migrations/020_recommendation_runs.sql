CREATE TABLE recommender_runs (
  id UUID PRIMARY KEY,
  definition_id TEXT NOT NULL,
  definition_version TEXT NOT NULL,
  dataset_id TEXT NOT NULL,
  dataset_version TEXT NOT NULL,
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object' AND content @> '{"schemaVersion":1}'::jsonb),
  hash_format TEXT NOT NULL CHECK (hash_format = 'us-agent-json-v1'),
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  status TEXT NOT NULL CHECK (status IN ('blocked', 'no_candidates', 'no_items', 'completed')),
  duration_ms DOUBLE PRECISION NOT NULL CHECK (duration_ms >= 0),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (definition_id, definition_version) REFERENCES recommender_definition_versions(definition_id, version),
  FOREIGN KEY (dataset_id, dataset_version) REFERENCES recommender_dataset_versions(dataset_id, version),
  CHECK (content->'request'->'content'->>'id' IS NOT NULL AND content->'request'->'content'->>'id' = id::text),
  CHECK (content->'result'->'content'->>'status' IS NOT NULL AND content->'result'->'content'->>'status' = status)
);
CREATE FUNCTION protect_recommender_run() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Recommendation run evidence is immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER recommender_run_integrity BEFORE UPDATE OR DELETE ON recommender_runs
  FOR EACH ROW EXECUTE FUNCTION protect_recommender_run();
