CREATE TABLE project_sprints (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, name)
);

INSERT INTO project_sprints (project_id, name, status)
SELECT id, 'Backlog', 'planning' FROM projects
ON CONFLICT (project_id, name) DO NOTHING;

ALTER TABLE stories ADD COLUMN sprint_id BIGINT REFERENCES project_sprints(id);

UPDATE stories story
SET sprint_id = sprint.id
FROM project_sprints sprint
WHERE sprint.project_id = story.project_id
  AND sprint.name = 'Backlog'
  AND story.sprint_id IS NULL;

ALTER TABLE stories ALTER COLUMN sprint_id SET NOT NULL;
CREATE INDEX stories_sprint_idx ON stories (sprint_id);

INSERT INTO project_sprints (project_id, name, status)
SELECT project_id, sprint, 'planning' FROM quality_plan_scopes
ON CONFLICT (project_id, name) DO NOTHING;

ALTER TABLE quality_plan_scopes ADD COLUMN sprint_id BIGINT REFERENCES project_sprints(id);

UPDATE quality_plan_scopes scope
SET sprint_id = sprint.id
FROM project_sprints sprint
WHERE sprint.project_id = scope.project_id
  AND sprint.name = scope.sprint
  AND scope.sprint_id IS NULL;

ALTER TABLE quality_plan_scopes ALTER COLUMN sprint_id SET NOT NULL;
ALTER TABLE quality_plan_scopes DROP CONSTRAINT IF EXISTS quality_plan_scopes_project_id_sprint_key;
ALTER TABLE quality_plan_scopes ADD CONSTRAINT quality_plan_scopes_sprint_id_key UNIQUE (sprint_id);
