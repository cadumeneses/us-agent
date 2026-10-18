-- Independent catalogs for configurable recommenders. Existing WIS tables stay intact.
CREATE TABLE recommender_taxonomy_versions (
  taxonomy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'published', 'retired')),
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object' AND content @> '{"schemaVersion":1}'::jsonb),
  hash_format TEXT,
  content_sha256 TEXT,
  created_by TEXT NOT NULL,
  published_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  PRIMARY KEY (taxonomy_id, version),
  CHECK (content->>'id' IS NOT NULL AND content->>'id' = taxonomy_id AND content->>'version' IS NOT NULL AND content->>'version' = version),
  CHECK (
    (state = 'draft' AND hash_format IS NULL AND content_sha256 IS NULL AND published_at IS NULL AND published_by IS NULL)
    OR (state IN ('published', 'retired') AND hash_format IS NOT NULL AND hash_format = 'us-agent-json-v1'
      AND content_sha256 IS NOT NULL AND content_sha256 ~ '^[a-f0-9]{64}$' AND published_at IS NOT NULL AND published_by IS NOT NULL)
  )
);

CREATE FUNCTION protect_recommender_taxonomy_version() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'draft' THEN RAISE EXCEPTION 'A taxonomy version must start as draft'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.state <> 'draft' THEN RAISE EXCEPTION 'Published taxonomy content is immutable'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.taxonomy_id IS DISTINCT FROM OLD.taxonomy_id OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Taxonomy version identity is immutable';
  END IF;
  IF OLD.state IN ('published', 'retired') THEN
    IF NEW.content IS DISTINCT FROM OLD.content OR NEW.hash_format IS DISTINCT FROM OLD.hash_format
      OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256 OR NEW.published_at IS DISTINCT FROM OLD.published_at
      OR NEW.published_by IS DISTINCT FROM OLD.published_by
      OR (OLD.state = 'retired' AND NEW.state <> 'retired') OR NEW.state NOT IN ('published', 'retired') THEN
      RAISE EXCEPTION 'Published taxonomy content is immutable';
    END IF;
  ELSIF NEW.state NOT IN ('draft', 'published') THEN
    RAISE EXCEPTION 'Publish a taxonomy before retiring it';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recommender_taxonomy_version_integrity
  BEFORE INSERT OR UPDATE OR DELETE ON recommender_taxonomy_versions
  FOR EACH ROW EXECUTE FUNCTION protect_recommender_taxonomy_version();
