-- Additive preparation only: the classifier continues reading WIS until explicit cutover.
-- Run through the transactional release runner. No old IDs, rows or references change.
LOCK TABLE taxonomy_versions, taxonomy_domains, taxonomy_modules, taxonomy_operations
  IN SHARE MODE;

CREATE TABLE legacy_taxonomy_imports (
  legacy_version_id BIGINT PRIMARY KEY REFERENCES taxonomy_versions(id),
  taxonomy_id TEXT,
  version TEXT,
  source_snapshot JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (taxonomy_id, version) REFERENCES recommender_taxonomy_versions(taxonomy_id, version) MATCH FULL,
  CHECK ((taxonomy_id IS NULL) = (version IS NULL))
);

-- Immutable provenance, including inactive/empty versions and original positions/IDs.
CREATE FUNCTION protect_legacy_taxonomy_import() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Legacy taxonomy import evidence is immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER legacy_taxonomy_import_integrity
  BEFORE UPDATE OR DELETE ON legacy_taxonomy_imports
  FOR EACH ROW EXECUTE FUNCTION protect_legacy_taxonomy_import();

DO $$
DECLARE
  source_version RECORD;
  original JSONB;
  tree_nodes JSONB;
  draft JSONB;
  target_version TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM taxonomy_modules m JOIN taxonomy_domains d ON d.id = m.domain_id
    WHERE m.taxonomy_version_id <> d.taxonomy_version_id
  ) THEN
    RAISE EXCEPTION '029: module/domain version mismatch; resolve source data before retrying';
  END IF;

  FOR source_version IN SELECT * FROM taxonomy_versions ORDER BY id LOOP
    target_version := 'wis-v-' || source_version.id;
    SELECT jsonb_build_object(
      'version', to_jsonb(source_version),
      'domains', COALESCE((SELECT jsonb_agg(to_jsonb(d) || jsonb_build_object('nodeId', 'wis-domain-' || d.id) ORDER BY d.position, d.id)
        FROM taxonomy_domains d WHERE d.taxonomy_version_id = source_version.id), '[]'::jsonb),
      'modules', COALESCE((SELECT jsonb_agg(to_jsonb(m) || jsonb_build_object('nodeId', 'wis-module-' || m.id, 'parentNodeId', 'wis-domain-' || m.domain_id) ORDER BY m.position, m.id)
        FROM taxonomy_modules m WHERE m.taxonomy_version_id = source_version.id), '[]'::jsonb),
      'operations', COALESCE((SELECT jsonb_agg(to_jsonb(o) || jsonb_build_object('nodeId', 'wis-operation-' || o.id, 'parentNodeId', 'wis-module-' || o.module_id) ORDER BY o.position, o.id)
        FROM taxonomy_operations o JOIN taxonomy_modules m ON m.id = o.module_id
        WHERE m.taxonomy_version_id = source_version.id), '[]'::jsonb)
    ) INTO original;

    SELECT COALESCE(jsonb_agg(node ORDER BY path), '[]'::jsonb) INTO tree_nodes FROM (
      SELECT jsonb_build_object('id', 'wis-domain-' || d.id, 'name', d.name,
        'description', d.description, 'parentId', NULL, 'selectable', FALSE) AS node,
        ARRAY[d.position::bigint, d.id] AS path
      FROM taxonomy_domains d WHERE d.taxonomy_version_id = source_version.id
      UNION ALL
      SELECT jsonb_build_object('id', 'wis-module-' || m.id, 'name', m.name,
        'description', m.description, 'parentId', 'wis-domain-' || d.id, 'selectable', FALSE),
        ARRAY[d.position::bigint, d.id, m.position::bigint, m.id]
      FROM taxonomy_modules m JOIN taxonomy_domains d ON d.id = m.domain_id
      WHERE m.taxonomy_version_id = source_version.id
      UNION ALL
      SELECT jsonb_build_object('id', 'wis-operation-' || o.id, 'name', o.name,
        'description', o.description, 'parentId', 'wis-module-' || m.id, 'selectable', o.is_active),
        ARRAY[d.position::bigint, d.id, m.position::bigint, m.id, o.position::bigint, o.id]
      FROM taxonomy_operations o JOIN taxonomy_modules m ON m.id = o.module_id
      JOIN taxonomy_domains d ON d.id = m.domain_id
      WHERE m.taxonomy_version_id = source_version.id
    ) nodes;

    -- Fail atomically rather than truncate, drop nodes, or invent a node for empty versions.
    IF jsonb_array_length(tree_nodes) > 5000 OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(tree_nodes) n
      WHERE length(n->>'name') > 180 OR btrim(n->>'name') = ''
    ) THEN
      RAISE EXCEPTION '029: source version ID % exceeds taxonomy limits; no content was truncated', source_version.id;
    END IF;

    IF jsonb_array_length(tree_nodes) = 0 THEN
      INSERT INTO legacy_taxonomy_imports (legacy_version_id, source_snapshot)
        VALUES (source_version.id, original);
      CONTINUE;
    END IF;

    draft := jsonb_build_object('schemaVersion', 1, 'id', 'wis-legacy',
      'version', target_version, 'name', 'WIS: ' || source_version.version,
      'kind', 'tree', 'selection', 'any',
      'source', 'Legacy WIS catalog; source version ID ' || source_version.id || '. Original metadata and IDs: legacy_taxonomy_imports.',
      'nodes', tree_nodes);
    IF octet_length(convert_to(draft::text, 'UTF8')) > 900000 THEN
      RAISE EXCEPTION '029: source version ID % exceeds editor request budget; split explicitly before migration', source_version.id;
    END IF;

    -- Deliberately no upsert: existing target identity must never be overwritten.
    INSERT INTO recommender_taxonomy_versions (taxonomy_id, version, content, created_by)
      VALUES ('wis-legacy', target_version, draft, 'migration:029');
    INSERT INTO legacy_taxonomy_imports (legacy_version_id, taxonomy_id, version, source_snapshot)
      VALUES (source_version.id, 'wis-legacy', target_version, original);
  END LOOP;
END;
$$;

CREATE VIEW legacy_taxonomy_node_map AS
SELECT i.legacy_version_id, i.taxonomy_id, i.version, entries.kind,
  (node->>'id')::bigint AS legacy_node_id, node->>'nodeId' AS node_id
FROM legacy_taxonomy_imports i
CROSS JOIN (VALUES ('domains', 'domain'), ('modules', 'module'), ('operations', 'operation')) entries(collection, kind)
CROSS JOIN LATERAL jsonb_array_elements(i.source_snapshot->entries.collection) node;
