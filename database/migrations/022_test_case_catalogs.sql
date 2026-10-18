CREATE TABLE test_case_catalog_versions (
  catalog_id TEXT NOT NULL,
  version TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'published' CHECK (state IN ('published', 'retired')),
  original_file BYTEA NOT NULL CHECK (octet_length(original_file) BETWEEN 1 AND 5000000),
  file_sha256 TEXT NOT NULL CHECK (file_sha256 ~ '^[a-f0-9]{64}$'),
  publication JSONB NOT NULL CHECK (jsonb_typeof(publication) = 'object' AND publication @> '{"schemaVersion":1}'::jsonb),
  hash_format TEXT NOT NULL CHECK (hash_format = 'us-agent-json-v1'),
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  published_by TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at TIMESTAMPTZ,
  PRIMARY KEY (catalog_id, version),
  CHECK (publication->>'id' IS NOT NULL AND publication->>'id' = catalog_id
    AND publication->>'version' IS NOT NULL AND publication->>'version' = version),
  CHECK ((state = 'published' AND retired_at IS NULL) OR (state = 'retired' AND retired_at IS NOT NULL))
);

CREATE FUNCTION protect_test_case_catalog_version() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Published test-case catalog is immutable'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'published' THEN RAISE EXCEPTION 'Test-case catalog starts as published'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.catalog_id IS DISTINCT FROM OLD.catalog_id OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.original_file IS DISTINCT FROM OLD.original_file OR NEW.file_sha256 IS DISTINCT FROM OLD.file_sha256
    OR NEW.publication IS DISTINCT FROM OLD.publication OR NEW.hash_format IS DISTINCT FROM OLD.hash_format
    OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256 OR NEW.published_by IS DISTINCT FROM OLD.published_by
    OR NEW.published_at IS DISTINCT FROM OLD.published_at
    OR OLD.state = 'retired' AND (NEW.state <> 'retired' OR NEW.retired_at IS DISTINCT FROM OLD.retired_at)
    OR OLD.state = 'published' AND NEW.state = 'published' AND NEW.retired_at IS DISTINCT FROM OLD.retired_at THEN
    RAISE EXCEPTION 'Published test-case catalog is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER test_case_catalog_version_integrity BEFORE INSERT OR UPDATE OR DELETE ON test_case_catalog_versions
  FOR EACH ROW EXECUTE FUNCTION protect_test_case_catalog_version();
