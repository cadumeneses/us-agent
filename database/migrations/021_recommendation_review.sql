CREATE TABLE recommender_run_targets (
  run_id UUID PRIMARY KEY REFERENCES recommender_runs(id),
  kind TEXT NOT NULL CHECK (kind IN ('input', 'classification')),
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object' AND content @> '{"schemaVersion":1}'::jsonb),
  hash_format TEXT NOT NULL CHECK (hash_format = 'us-agent-json-v1'),
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (content->'run'->>'id' IS NOT NULL AND content->'run'->>'id' = run_id::text),
  CHECK (content->'destination'->>'kind' IS NOT NULL AND content->'destination'->>'kind' = kind)
);
CREATE TABLE recommender_item_links (
  identity_sha256 TEXT PRIMARY KEY CHECK (identity_sha256 ~ '^[a-f0-9]{64}$'),
  source_run_id UUID NOT NULL REFERENCES recommender_runs(id),
  item_key TEXT NOT NULL CHECK (item_key ~ '^[a-f0-9]{64}$'),
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object' AND content @> '{"schemaVersion":1}'::jsonb),
  hash_format TEXT NOT NULL CHECK (hash_format = 'us-agent-json-v1'),
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (content->'identity'->>'sha256' IS NOT NULL AND content->'identity'->>'sha256' = identity_sha256),
  CHECK (content->'identity'->'content'->>'itemKey' IS NOT NULL AND content->'identity'->'content'->>'itemKey' = item_key)
);
CREATE TABLE recommender_item_decisions (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES recommender_run_targets(run_id),
  item_key TEXT NOT NULL CHECK (item_key ~ '^[a-f0-9]{64}$'),
  decision TEXT NOT NULL CHECK (decision IN ('accepted', 'rejected')),
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
  link_identity_sha256 TEXT REFERENCES recommender_item_links(identity_sha256),
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object' AND content @> '{"schemaVersion":1}'::jsonb),
  hash_format TEXT NOT NULL CHECK (hash_format = 'us-agent-json-v1'),
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, item_key),
  CHECK ((decision = 'accepted') = (link_identity_sha256 IS NOT NULL)),
  CHECK (content->'request'->'content'->>'id' IS NOT NULL AND content->'request'->'content'->>'id' = id::text),
  CHECK (content->'run'->>'id' IS NOT NULL AND content->'run'->>'id' = run_id::text),
  CHECK (content->'request'->'content'->>'itemKey' IS NOT NULL AND content->'request'->'content'->>'itemKey' = item_key),
  CHECK (content->'request'->'content'->>'decision' IS NOT NULL AND content->'request'->'content'->>'decision' = decision)
);
CREATE FUNCTION protect_recommender_review() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Recommendation review evidence is immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER recommender_target_integrity BEFORE UPDATE OR DELETE ON recommender_run_targets
  FOR EACH ROW EXECUTE FUNCTION protect_recommender_review();
CREATE TRIGGER recommender_item_link_integrity BEFORE UPDATE OR DELETE ON recommender_item_links
  FOR EACH ROW EXECUTE FUNCTION protect_recommender_review();
CREATE TRIGGER recommender_decision_integrity BEFORE UPDATE OR DELETE ON recommender_item_decisions
  FOR EACH ROW EXECUTE FUNCTION protect_recommender_review();
