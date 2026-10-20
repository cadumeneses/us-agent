CREATE TABLE organizations (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_-]{0,63}$'),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  schema_name TEXT NOT NULL UNIQUE CHECK (schema_name ~ '^[a-z_][a-z0-9_]{0,62}$'),
  active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE organization_memberships (
  organization_id TEXT NOT NULL REFERENCES organizations(id), username TEXT NOT NULL REFERENCES web_users(username),
  role TEXT NOT NULL CHECK (role IN ('viewer','reviewer','maintainer','admin')), active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (organization_id,username)
);
-- Preserve the shared workspace and existing permissions. Future grants are explicit.
INSERT INTO organizations(id,name,schema_name) VALUES ('default','Current workspace',current_schema());
INSERT INTO organization_memberships(organization_id,username,role)
  SELECT 'default',username,'admin' FROM web_users WHERE active;

CREATE TABLE organization_access_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id), actor TEXT NOT NULL,
  subject TEXT NOT NULL, action TEXT NOT NULL, details JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER organization_access_audit_integrity BEFORE UPDATE OR DELETE ON organization_access_audit
  FOR EACH ROW EXECUTE FUNCTION protect_recommender_review();

CREATE TABLE domain_audit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id TEXT NOT NULL, actor TEXT NOT NULL,
  table_name TEXT NOT NULL, operation TEXT NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  row_identity JSONB NOT NULL, before_sha256 TEXT, after_sha256 TEXT,
  transaction_id BIGINT NOT NULL DEFAULT txid_current(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER domain_audit_events_integrity BEFORE UPDATE OR DELETE ON domain_audit_events
  FOR EACH ROW EXECUTE FUNCTION protect_recommender_review();

CREATE FUNCTION audit_domain_change() RETURNS trigger AS $$
DECLARE
  previous JSONB := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END;
  following JSONB := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END;
  identity_row JSONB := COALESCE(following,previous);
BEGIN
  INSERT INTO domain_audit_events(organization_id,actor,table_name,operation,row_identity,before_sha256,after_sha256)
  VALUES (COALESCE(NULLIF(current_setting('app.organization_id',true),''),'offline'),
    COALESCE(NULLIF(current_setting('app.actor',true),''),'migration-or-offline'),TG_TABLE_NAME,TG_OP,
    jsonb_strip_nulls(jsonb_build_object('id',identity_row->'id','run_id',identity_row->'run_id',
      'taxonomy_id',identity_row->'taxonomy_id','definition_id',identity_row->'definition_id',
      'dataset_id',identity_row->'dataset_id','version',identity_row->'version','identity_sha256',identity_row->'identity_sha256')),
    CASE WHEN previous IS NOT NULL THEN encode(sha256(convert_to(previous::text,'UTF8')),'hex') END,
    CASE WHEN following IS NOT NULL THEN encode(sha256(convert_to(following::text,'UTF8')),'hex') END);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE relation RECORD;
BEGIN
  FOR relation IN SELECT tablename FROM pg_tables WHERE schemaname=current_schema()
    AND tablename NOT IN ('schema_migrations','web_users','web_sessions','web_login_limits',
      'organizations','organization_memberships','organization_access_audit','domain_audit_events')
  LOOP
    EXECUTE format('CREATE TRIGGER domain_change_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_domain_change()',relation.tablename);
  END LOOP;
END; $$;
