-- Structured inputs from Ramos (2019), sections 5.2 and 5.3.
-- Empty values mean not collected; they must not be inferred from classification.
CREATE TABLE project_research_profiles (
  project_id BIGINT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE story_tasks ADD COLUMN category TEXT NOT NULL DEFAULT '';
ALTER TABLE story_tasks ADD COLUMN technologies JSONB NOT NULL DEFAULT
  '{"languages":[],"frameworks":[],"apis":[],"dataPersistence":[]}'::jsonb
  CHECK (jsonb_typeof(technologies) = 'object');

COMMENT ON COLUMN story_non_functional_requirements.metric IS
  'Legacy API/column name for the NFR attribute in Ramos (2019), not a measured value.';
