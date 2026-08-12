CREATE TABLE quality_plan_scopes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sprint VARCHAR(120) NOT NULL,
  content JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, sprint)
);

CREATE TABLE quality_plan_scope_stories (
  quality_plan_scope_id BIGINT NOT NULL REFERENCES quality_plan_scopes(id) ON DELETE CASCADE,
  classification_id BIGINT NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
  PRIMARY KEY (quality_plan_scope_id, classification_id)
);

CREATE INDEX quality_plan_scopes_project_idx ON quality_plan_scopes (project_id, updated_at DESC);
CREATE INDEX quality_plan_scope_stories_classification_idx ON quality_plan_scope_stories (classification_id);
