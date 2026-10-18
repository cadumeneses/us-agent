CREATE TABLE recommender_definition_versions (
  definition_id TEXT NOT NULL,
  version TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'published', 'retired')),
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object' AND content @> '{"schemaVersion":1}'::jsonb),
  publication JSONB,
  hash_format TEXT,
  content_sha256 TEXT,
  created_by TEXT NOT NULL,
  published_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  PRIMARY KEY (definition_id, version),
  CHECK (content->>'id' IS NOT NULL AND content->>'id' = definition_id AND content->>'version' IS NOT NULL AND content->>'version' = version),
  CHECK (
    (state = 'draft' AND content->>'state' IS NOT NULL AND content->>'state' = 'draft'
      AND publication IS NULL AND hash_format IS NULL AND content_sha256 IS NULL AND published_at IS NULL AND published_by IS NULL)
    OR (state IN ('published', 'retired') AND content->>'state' IS NOT NULL AND content->>'state' = 'published'
      AND publication IS NOT NULL AND jsonb_typeof(publication) = 'object'
      AND publication->'definition' IS NOT NULL AND publication->'definition' = content
      AND hash_format IS NOT NULL AND hash_format = 'us-agent-json-v1'
      AND content_sha256 IS NOT NULL AND content_sha256 ~ '^[a-f0-9]{64}$' AND published_at IS NOT NULL AND published_by IS NOT NULL)
  )
);

CREATE TABLE recommender_definition_taxonomies (
  definition_id TEXT NOT NULL,
  definition_version TEXT NOT NULL,
  taxonomy_id TEXT NOT NULL,
  taxonomy_version TEXT NOT NULL,
  hash_format TEXT NOT NULL CHECK (hash_format = 'us-agent-json-v1'),
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (definition_id, definition_version, taxonomy_id, taxonomy_version),
  FOREIGN KEY (definition_id, definition_version) REFERENCES recommender_definition_versions(definition_id, version) ON DELETE CASCADE,
  FOREIGN KEY (taxonomy_id, taxonomy_version) REFERENCES recommender_taxonomy_versions(taxonomy_id, version)
);

CREATE FUNCTION protect_recommender_definition_version() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'draft' THEN RAISE EXCEPTION 'A definition version must start as draft'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.state <> 'draft' THEN RAISE EXCEPTION 'Published definition content is immutable'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.definition_id IS DISTINCT FROM OLD.definition_id OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Definition version identity is immutable';
  END IF;
  IF OLD.state IN ('published', 'retired') THEN
    IF NEW.content IS DISTINCT FROM OLD.content OR NEW.publication IS DISTINCT FROM OLD.publication
      OR NEW.hash_format IS DISTINCT FROM OLD.hash_format OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256
      OR NEW.published_at IS DISTINCT FROM OLD.published_at OR NEW.published_by IS DISTINCT FROM OLD.published_by
      OR (OLD.state = 'retired' AND NEW.state <> 'retired') OR NEW.state NOT IN ('published', 'retired') THEN
      RAISE EXCEPTION 'Published definition content is immutable';
    END IF;
  ELSIF NEW.state NOT IN ('draft', 'published') THEN
    RAISE EXCEPTION 'Publish a definition before retiring it';
  END IF;
  IF OLD.state = 'draft' AND NEW.state = 'published' THEN
    IF jsonb_typeof(NEW.publication->'taxonomies') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Publication must contain a taxonomy dependency array';
    END IF;
    IF jsonb_array_length(NEW.publication->'taxonomies') <> (
      SELECT COUNT(*) FROM recommender_definition_taxonomies
      WHERE definition_id = NEW.definition_id AND definition_version = NEW.version
    ) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(NEW.publication->'taxonomies') dependency
      WHERE NOT EXISTS (
        SELECT 1 FROM recommender_definition_taxonomies binding
        WHERE binding.definition_id = NEW.definition_id AND binding.definition_version = NEW.version
          AND binding.taxonomy_id = dependency->'snapshot'->'content'->>'id'
          AND binding.taxonomy_version = dependency->'snapshot'->'content'->>'version'
          AND binding.hash_format = dependency->'snapshot'->>'format'
          AND binding.content_sha256 = dependency->'snapshot'->>'sha256'
      )
    ) THEN RAISE EXCEPTION 'Publication taxonomy dependencies must match persisted bindings'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recommender_definition_version_integrity
  BEFORE INSERT OR UPDATE OR DELETE ON recommender_definition_versions
  FOR EACH ROW EXECUTE FUNCTION protect_recommender_definition_version();

CREATE FUNCTION protect_recommender_definition_taxonomy() RETURNS trigger AS $$
DECLARE
  definition_state TEXT;
  taxonomy_state TEXT;
  taxonomy_format TEXT;
  taxonomy_hash TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Definition taxonomy bindings cannot be updated'; END IF;
  IF TG_OP = 'DELETE' THEN
    SELECT state INTO definition_state FROM recommender_definition_versions
      WHERE definition_id = OLD.definition_id AND version = OLD.definition_version FOR UPDATE;
    IF definition_state IN ('published', 'retired') THEN RAISE EXCEPTION 'Published definition bindings are immutable'; END IF;
    RETURN OLD;
  END IF;
  SELECT state INTO definition_state FROM recommender_definition_versions
    WHERE definition_id = NEW.definition_id AND version = NEW.definition_version FOR UPDATE;
  IF definition_state IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'Bindings can only be added before publication'; END IF;
  SELECT state, hash_format, content_sha256 INTO taxonomy_state, taxonomy_format, taxonomy_hash
    FROM recommender_taxonomy_versions WHERE taxonomy_id = NEW.taxonomy_id AND version = NEW.taxonomy_version FOR SHARE;
  IF taxonomy_state IS DISTINCT FROM 'published' OR taxonomy_format IS DISTINCT FROM NEW.hash_format
    OR taxonomy_hash IS DISTINCT FROM NEW.content_sha256 THEN RAISE EXCEPTION 'Binding requires the exact published taxonomy'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recommender_definition_taxonomy_integrity
  BEFORE INSERT OR UPDATE OR DELETE ON recommender_definition_taxonomies
  FOR EACH ROW EXECUTE FUNCTION protect_recommender_definition_taxonomy();
