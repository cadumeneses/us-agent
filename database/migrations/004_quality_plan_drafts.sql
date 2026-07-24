CREATE TABLE quality_plan_drafts (
  classification_id BIGINT PRIMARY KEY REFERENCES classifications(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX quality_plan_drafts_status_idx ON quality_plan_drafts (status);
