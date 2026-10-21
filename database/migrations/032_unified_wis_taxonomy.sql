-- WIS is an ordinary versioned tree in the shared taxonomy catalog.
-- The relational tables remain a compatibility projection for classification/history.
SELECT set_config('app.actor','migration:032',true);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM taxonomy_modules m JOIN taxonomy_domains d ON d.id=m.domain_id
    WHERE m.taxonomy_version_id<>d.taxonomy_version_id) THEN
    RAISE EXCEPTION 'WIS source module/domain versions disagree; resolve the links before migration';
  END IF;
END; $$;
CREATE TABLE wis_taxonomy_bindings (
  taxonomy_id TEXT NOT NULL DEFAULT 'wis' CHECK (taxonomy_id = 'wis'),
  version TEXT PRIMARY KEY,
  taxonomy_version_id BIGINT NOT NULL REFERENCES taxonomy_versions(id),
  bound_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (taxonomy_id, version) REFERENCES recommender_taxonomy_versions(taxonomy_id, version)
);
CREATE INDEX wis_taxonomy_binding_source ON wis_taxonomy_bindings(taxonomy_version_id,bound_at DESC);
CREATE TABLE wis_taxonomy_node_bindings (
  version TEXT NOT NULL REFERENCES wis_taxonomy_bindings(version),
  node_id TEXT NOT NULL, module_id BIGINT, operation_id BIGINT,
  PRIMARY KEY (version,node_id),
  CHECK (num_nonnulls(module_id,operation_id)=1)
);

-- WIS contains only strings, booleans, null, arrays, objects and schemaVersion=1.
-- This serialization matches us-agent-json-v1 for that domain (keys ordered by code point).
CREATE FUNCTION wis_canonical_json(value JSONB) RETURNS TEXT LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE result TEXT;
BEGIN
  CASE jsonb_typeof(value)
    WHEN 'object' THEN
      SELECT '{'||COALESCE(string_agg(to_jsonb(key)::text||':'||wis_canonical_json(entry),',' ORDER BY key COLLATE "C"),'')||'}'
      INTO result FROM jsonb_each(value) items(key,entry);
    WHEN 'array' THEN
      SELECT '['||COALESCE(string_agg(wis_canonical_json(entry),',' ORDER BY position),'')||']'
      INTO result FROM jsonb_array_elements(value) WITH ORDINALITY items(entry,position);
    ELSE result:=value::text;
  END CASE;
  RETURN result;
END; $$;

CREATE FUNCTION ordered_wis_nodes(nodes JSONB) RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(jsonb_agg(child.node ORDER BY
    CASE WHEN child.node->>'parentId' IS NULL THEN ARRAY[child.position]
      ELSE ARRAY[parent.position,child.position] END),'[]'::jsonb)
  FROM jsonb_array_elements(nodes) WITH ORDINALITY child(node,position)
  LEFT JOIN jsonb_array_elements(nodes) WITH ORDINALITY parent(node,position)
    ON parent.node->>'id'=child.node->>'parentId';
$$;

-- Publishing through the common taxonomy API makes a classification projection atomically.
CREATE FUNCTION project_published_wis_taxonomy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_id BIGINT; domain_id BIGINT; module_id BIGINT; entry RECORD; has_binding BOOLEAN;
BEGIN
  IF NEW.taxonomy_id<>'wis' THEN RETURN NEW; END IF;
  IF NEW.state='retired' AND OLD.state='published' THEN
    UPDATE taxonomy_versions v SET is_active=false
      FROM wis_taxonomy_bindings b WHERE b.version=NEW.version AND b.taxonomy_version_id=v.id
      AND NOT EXISTS(SELECT 1 FROM wis_taxonomy_bindings newer WHERE newer.taxonomy_version_id=v.id AND newer.bound_at>b.bound_at);
    RETURN NEW;
  END IF;
  IF NEW.state<>'published' OR OLD.state<>'draft' THEN RETURN NEW; END IF;
  IF NEW.content->>'kind'<>'tree' OR NEW.content->>'selection'<>'leaf' OR length(NEW.version)>40
    OR jsonb_array_length(NEW.content->'nodes')=0 THEN
    RAISE EXCEPTION 'WIS requires a module/operation tree, leaf selection and a version of at most 40 characters';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.content->'nodes') n
    WHERE (n->>'parentId' IS NULL AND (length(n->>'name')>120 OR n->'selectable' IS DISTINCT FROM 'false'::jsonb))
      OR (n->>'parentId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.content->'nodes') p
        WHERE p->>'id'=n->>'parentId' AND p->>'parentId' IS NULL))) THEN
    RAISE EXCEPTION 'WIS has exactly two levels: module roots and their operations';
  END IF;
  SELECT b.taxonomy_version_id INTO source_id FROM wis_taxonomy_bindings b WHERE b.version=NEW.version;
  has_binding:=FOUND;
  IF has_binding AND EXISTS(SELECT 1 FROM wis_taxonomy_node_bindings WHERE version=NEW.version) THEN RETURN NEW; END IF;
  IF has_binding AND EXISTS(SELECT 1 FROM taxonomy_modules WHERE taxonomy_version_id=source_id) THEN
    RAISE EXCEPTION 'This WIS source evolved after the empty draft; publish under a new version';
  END IF;
  IF NOT has_binding THEN
    INSERT INTO taxonomy_versions(version,is_active) VALUES (NEW.version,true) RETURNING id INTO source_id;
  ELSE
    UPDATE taxonomy_versions SET is_active=true WHERE id=source_id AND NOT is_active;
  END IF;
  INSERT INTO taxonomy_domains(taxonomy_version_id,name,description,position)
    VALUES(source_id,'General','Compatibility grouping; WIS nodes are modules and operations.',0)
    ON CONFLICT(taxonomy_version_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id INTO domain_id;
  IF NOT has_binding THEN INSERT INTO wis_taxonomy_bindings(version,taxonomy_version_id) VALUES(NEW.version,source_id); END IF;
  FOR entry IN SELECT node,position FROM jsonb_array_elements(NEW.content->'nodes') WITH ORDINALITY n(node,position)
    WHERE node->>'parentId' IS NULL ORDER BY position LOOP
    INSERT INTO taxonomy_modules(taxonomy_version_id,domain_id,name,description,position)
      VALUES(source_id,domain_id,entry.node->>'name',entry.node->>'description',entry.position)
      RETURNING id INTO module_id;
    INSERT INTO wis_taxonomy_node_bindings(version,node_id,module_id) VALUES(NEW.version,entry.node->>'id',module_id);
  END LOOP;
  FOR entry IN SELECT node,position FROM jsonb_array_elements(NEW.content->'nodes') WITH ORDINALITY n(node,position)
    WHERE node->>'parentId' IS NOT NULL ORDER BY position LOOP
    SELECT b.module_id INTO module_id FROM wis_taxonomy_node_bindings b WHERE b.version=NEW.version AND b.node_id=entry.node->>'parentId';
    INSERT INTO taxonomy_operations(module_id,name,description,position,is_active)
      VALUES(module_id,entry.node->>'name',entry.node->>'description',entry.position,COALESCE((entry.node->>'selectable')::boolean,true))
      RETURNING id INTO source_id;
    INSERT INTO wis_taxonomy_node_bindings(version,node_id,operation_id) VALUES(NEW.version,entry.node->>'id',source_id);
  END LOOP;
  RETURN NEW;
END; $$;
CREATE TRIGGER unified_wis_publication BEFORE UPDATE ON recommender_taxonomy_versions
  FOR EACH ROW EXECUTE FUNCTION project_published_wis_taxonomy();

-- Older review/import callers still write relational rows. Capture each final transaction
-- as an ordinary immutable WIS version, rather than maintaining a second live catalog.
CREATE FUNCTION capture_wis_taxonomy(source_id BIGINT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE source RECORD; previous RECORD; tree JSONB; taxonomy_content JSONB; target_version TEXT; actor TEXT;
BEGIN
  SELECT * INTO source FROM taxonomy_versions WHERE id=source_id;
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('unified_wis_taxonomy'),(source_id % 2147483647)::int);
  SELECT t.*,b.bound_at INTO previous FROM wis_taxonomy_bindings b
    JOIN recommender_taxonomy_versions t ON t.taxonomy_id=b.taxonomy_id AND t.version=b.version
    WHERE b.taxonomy_version_id=source_id ORDER BY b.bound_at DESC LIMIT 1;
  SELECT COALESCE(jsonb_agg(node ORDER BY path),'[]'::jsonb) INTO tree FROM (
    SELECT jsonb_build_object('id',COALESCE(b.node_id,'wis-module-'||m.id),'name',m.name,
      'description',m.description,'parentId',NULL,'selectable',false) AS node, ARRAY[m.position::bigint,m.id] AS path
      FROM taxonomy_modules m LEFT JOIN wis_taxonomy_node_bindings b ON b.version=previous.version AND b.module_id=m.id
      WHERE m.taxonomy_version_id=source_id
    UNION ALL
    SELECT jsonb_build_object('id',COALESCE(ob.node_id,'wis-operation-'||o.id),'name',o.name,
      'description',o.description,'parentId',COALESCE(mb.node_id,'wis-module-'||m.id),'selectable',o.is_active),
      ARRAY[m.position::bigint,m.id,o.position::bigint,o.id]
      FROM taxonomy_operations o JOIN taxonomy_modules m ON m.id=o.module_id
      LEFT JOIN wis_taxonomy_node_bindings ob ON ob.version=previous.version AND ob.operation_id=o.id
      LEFT JOIN wis_taxonomy_node_bindings mb ON mb.version=previous.version AND mb.module_id=m.id
      WHERE m.taxonomy_version_id=source_id
  ) nodes;
  IF previous.version IS NOT NULL AND ordered_wis_nodes(previous.content->'nodes')=tree THEN
    IF NOT source.is_active AND previous.state='published' THEN
      UPDATE recommender_taxonomy_versions SET state='retired',updated_at=NOW() WHERE taxonomy_id='wis' AND version=previous.version;
    END IF;
    IF previous.state<>'retired' OR NOT source.is_active THEN RETURN; END IF;
  END IF;
  target_version:=CASE WHEN previous.version IS NULL AND source.version ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$'
    THEN source.version WHEN previous.version IS NULL THEN 'wis-'||source_id
    ELSE 'revision-'||substr(encode(sha256(convert_to(source_id::text||':'||txid_current()::text,'UTF8')),'hex'),1,24) END;
  -- Several deferred row events from one transaction describe the same final catalog.
  IF EXISTS(SELECT 1 FROM wis_taxonomy_bindings WHERE version=target_version AND taxonomy_version_id=source_id) THEN RETURN; END IF;
  actor:=COALESCE(NULLIF(current_setting('app.actor',true),''),'migration-or-offline');
  taxonomy_content:=jsonb_build_object('schemaVersion',1,'id','wis','version',target_version,'name','WIS',
    'kind','tree','selection','leaf','source','WIS module and operation taxonomy. Classification version: '||source.version||'.','nodes',tree);
  IF jsonb_array_length(tree)>5000 OR EXISTS(SELECT 1 FROM jsonb_array_elements(tree) n WHERE btrim(n->>'name')='' OR length(n->>'name')>180) THEN
    RAISE EXCEPTION 'WIS exceeds shared taxonomy limits; no nodes were truncated';
  END IF;
  INSERT INTO recommender_taxonomy_versions(taxonomy_id,version,content,created_by) VALUES('wis',target_version,taxonomy_content,actor);
  INSERT INTO wis_taxonomy_bindings(version,taxonomy_version_id) VALUES(target_version,source_id);
  INSERT INTO wis_taxonomy_node_bindings(version,node_id,module_id)
    SELECT target_version,COALESCE(b.node_id,'wis-module-'||m.id),m.id FROM taxonomy_modules m
    LEFT JOIN wis_taxonomy_node_bindings b ON b.version=previous.version AND b.module_id=m.id WHERE m.taxonomy_version_id=source_id;
  INSERT INTO wis_taxonomy_node_bindings(version,node_id,operation_id)
    SELECT target_version,COALESCE(b.node_id,'wis-operation-'||o.id),o.id FROM taxonomy_operations o JOIN taxonomy_modules m ON m.id=o.module_id
    LEFT JOIN wis_taxonomy_node_bindings b ON b.version=previous.version AND b.operation_id=o.id WHERE m.taxonomy_version_id=source_id;
  IF jsonb_array_length(tree)>0 THEN
    UPDATE recommender_taxonomy_versions SET state='published',hash_format='us-agent-json-v1',
      content_sha256=encode(sha256(convert_to(wis_canonical_json(taxonomy_content),'UTF8')),'hex'),published_at=NOW(),published_by=actor
      WHERE taxonomy_id='wis' AND version=target_version;
    IF NOT source.is_active THEN UPDATE recommender_taxonomy_versions SET state='retired' WHERE taxonomy_id='wis' AND version=target_version; END IF;
  END IF;
END; $$;

DO $$ DECLARE item RECORD;
BEGIN
  FOR item IN SELECT id FROM taxonomy_versions ORDER BY id LOOP PERFORM capture_wis_taxonomy(item.id); END LOOP;
END; $$;

CREATE FUNCTION capture_changed_wis_taxonomy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_id BIGINT;
BEGIN
  IF TG_TABLE_NAME='taxonomy_versions' THEN
    source_id:=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
  ELSIF TG_TABLE_NAME='taxonomy_modules' THEN
    source_id:=CASE WHEN TG_OP='DELETE' THEN OLD.taxonomy_version_id ELSE NEW.taxonomy_version_id END;
  ELSE
    SELECT taxonomy_version_id INTO source_id FROM taxonomy_modules
      WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.module_id ELSE NEW.module_id END;
  END IF;
  IF source_id IS NOT NULL THEN PERFORM capture_wis_taxonomy(source_id); END IF;
  IF TG_OP='UPDATE' THEN
    IF TG_TABLE_NAME='taxonomy_modules' THEN
      IF OLD.taxonomy_version_id IS DISTINCT FROM NEW.taxonomy_version_id THEN PERFORM capture_wis_taxonomy(OLD.taxonomy_version_id); END IF;
    ELSIF TG_TABLE_NAME='taxonomy_operations' THEN
      IF OLD.module_id IS DISTINCT FROM NEW.module_id THEN
        SELECT taxonomy_version_id INTO source_id FROM taxonomy_modules WHERE id=OLD.module_id;
        IF source_id IS NOT NULL THEN PERFORM capture_wis_taxonomy(source_id); END IF;
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER capture_wis_version AFTER INSERT OR UPDATE ON taxonomy_versions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_changed_wis_taxonomy();
CREATE CONSTRAINT TRIGGER capture_wis_module AFTER INSERT OR UPDATE OR DELETE ON taxonomy_modules
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_changed_wis_taxonomy();
CREATE CONSTRAINT TRIGGER capture_wis_operation AFTER INSERT OR UPDATE OR DELETE ON taxonomy_operations
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_changed_wis_taxonomy();

-- Untouched setup copies are historical evidence, not another live WIS taxonomy.
UPDATE recommender_taxonomy_versions SET state='published',hash_format='us-agent-json-v1',
  content_sha256=encode(sha256(convert_to(wis_canonical_json(content),'UTF8')),'hex'),published_at=NOW(),published_by='migration:032'
  WHERE taxonomy_id='wis-legacy' AND state='draft' AND created_by='migration:029' AND updated_at=created_at;
UPDATE recommender_taxonomy_versions SET state='retired'
  WHERE taxonomy_id='wis-legacy' AND state='published' AND published_by='migration:032';
