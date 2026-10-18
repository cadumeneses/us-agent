CREATE TABLE recommender_dataset_imports (
  id UUID PRIMARY KEY,
  definition_id TEXT NOT NULL,
  definition_version TEXT NOT NULL,
  original_file BYTEA NOT NULL CHECK (octet_length(original_file) BETWEEN 1 AND 5000000),
  file_sha256 TEXT NOT NULL CHECK (file_sha256 ~ '^[a-f0-9]{64}$'),
  preview JSONB NOT NULL CHECK (jsonb_typeof(preview) = 'object' AND preview @> '{"schemaVersion":1}'::jsonb),
  hash_format TEXT NOT NULL CHECK (hash_format = 'us-agent-json-v1'),
  preview_sha256 TEXT NOT NULL CHECK (preview_sha256 ~ '^[a-f0-9]{64}$'),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (definition_id, definition_version) REFERENCES recommender_definition_versions(definition_id, version)
);

CREATE TABLE recommender_dataset_versions (
  dataset_id TEXT NOT NULL,
  version TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'published' CHECK (state IN ('published', 'retired')),
  import_id UUID NOT NULL REFERENCES recommender_dataset_imports(id),
  definition_id TEXT NOT NULL,
  definition_version TEXT NOT NULL,
  publication JSONB NOT NULL CHECK (jsonb_typeof(publication) = 'object' AND publication @> '{"schemaVersion":1}'::jsonb),
  hash_format TEXT NOT NULL CHECK (hash_format = 'us-agent-json-v1'),
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  published_by TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at TIMESTAMPTZ,
  PRIMARY KEY (dataset_id, version),
  FOREIGN KEY (definition_id, definition_version) REFERENCES recommender_definition_versions(definition_id, version),
  CHECK (publication->>'id' IS NOT NULL AND publication->>'id' = dataset_id AND publication->>'version' IS NOT NULL AND publication->>'version' = version),
  CHECK (publication->'import'->>'id' IS NOT NULL AND publication->'import'->>'id' = import_id::text),
  CHECK (publication->'definition'->>'id' IS NOT NULL AND publication->'definition'->>'id' = definition_id
    AND publication->'definition'->>'version' IS NOT NULL AND publication->'definition'->>'version' = definition_version),
  CHECK ((state = 'published' AND retired_at IS NULL) OR (state = 'retired' AND retired_at IS NOT NULL))
);

CREATE FUNCTION protect_recommender_dataset_import() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Dataset import evidence is immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER recommender_dataset_import_integrity BEFORE UPDATE OR DELETE ON recommender_dataset_imports
  FOR EACH ROW EXECUTE FUNCTION protect_recommender_dataset_import();

CREATE FUNCTION protect_recommender_dataset_version() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Published dataset content is immutable'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'published' THEN RAISE EXCEPTION 'Dataset version starts as published'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.dataset_id IS DISTINCT FROM OLD.dataset_id OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.import_id IS DISTINCT FROM OLD.import_id OR NEW.definition_id IS DISTINCT FROM OLD.definition_id
    OR NEW.definition_version IS DISTINCT FROM OLD.definition_version OR NEW.publication IS DISTINCT FROM OLD.publication
    OR NEW.hash_format IS DISTINCT FROM OLD.hash_format OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256
    OR NEW.published_by IS DISTINCT FROM OLD.published_by OR NEW.published_at IS DISTINCT FROM OLD.published_at
    OR OLD.state = 'retired' AND (NEW.state <> 'retired' OR NEW.retired_at IS DISTINCT FROM OLD.retired_at) THEN
    RAISE EXCEPTION 'Published dataset content is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER recommender_dataset_version_integrity BEFORE INSERT OR UPDATE OR DELETE ON recommender_dataset_versions
  FOR EACH ROW EXECUTE FUNCTION protect_recommender_dataset_version();
