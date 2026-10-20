ALTER TABLE recommender_item_decisions ADD CONSTRAINT recommender_decision_copy_identity UNIQUE (id, run_id, item_key);
CREATE TABLE nfr_adapted_copies (
  id UUID PRIMARY KEY, decision_id UUID NOT NULL, run_id UUID NOT NULL, item_key TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0), previous_copy_id UUID,
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
  content JSONB NOT NULL CHECK (content @> '{"schemaVersion":1}'::jsonb),
  hash_format TEXT NOT NULL CHECK (hash_format = 'us-agent-json-v1'),
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (decision_id, revision), UNIQUE (id, decision_id),
  FOREIGN KEY (decision_id, run_id, item_key) REFERENCES recommender_item_decisions(id, run_id, item_key),
  FOREIGN KEY (previous_copy_id, decision_id) REFERENCES nfr_adapted_copies(id, decision_id),
  CHECK ((revision = 1) = (previous_copy_id IS NULL)),
  CHECK (content->'run'->>'id' IS NOT NULL AND content->'run'->>'id' = run_id::text),
  CHECK (content->>'revision' IS NOT NULL AND (content->>'revision')::integer = revision),
  CHECK (content->'request'->'content'->>'id' IS NOT NULL AND content->'request'->'content'->>'id' = id::text)
);
CREATE TRIGGER nfr_copy_integrity BEFORE UPDATE OR DELETE ON nfr_adapted_copies
  FOR EACH ROW EXECUTE FUNCTION protect_recommender_review();
