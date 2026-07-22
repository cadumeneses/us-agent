CREATE TABLE projects (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(160) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE taxonomy_versions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version VARCHAR(40) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX taxonomy_one_active_version
  ON taxonomy_versions (is_active)
  WHERE is_active;

CREATE TABLE taxonomy_modules (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  taxonomy_version_id BIGINT NOT NULL REFERENCES taxonomy_versions(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  position SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (taxonomy_version_id, name)
);

CREATE TABLE taxonomy_operations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  module_id BIGINT NOT NULL REFERENCES taxonomy_modules(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  position SMALLINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (module_id, name)
);

CREATE TABLE classification_runs (
  id VARCHAR(80) PRIMARY KEY,
  classification_mode VARCHAR(40),
  taxonomy_version VARCHAR(40),
  prompt_version VARCHAR(80),
  policy_version VARCHAR(80),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE stories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id),
  external_id VARCHAR(80) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, external_id)
);

CREATE TABLE classifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  story_id BIGINT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  run_id VARCHAR(80) REFERENCES classification_runs(id) ON DELETE SET NULL,
  review_status VARCHAR(40) NOT NULL DEFAULT 'pending_review',
  final_confidence DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (final_confidence BETWEEN 0 AND 1),
  uncertainty_score DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (uncertainty_score BETWEEN 0 AND 1),
  consensus_ratio DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (consensus_ratio BETWEEN 0 AND 1),
  uncertainty_band VARCHAR(20),
  final_decision VARCHAR(40),
  disagreement_cause VARCHAR(80),
  final_action VARCHAR(40),
  final_reason TEXT,
  notes_for_human TEXT,
  taxonomy_version VARCHAR(40),
  prompt_version VARCHAR(80),
  policy_version VARCHAR(80),
  auto_resolution_kind VARCHAR(40),
  auto_resolution_reason TEXT,
  auto_resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (story_id, run_id)
);

CREATE INDEX classifications_status_idx ON classifications (review_status);
CREATE INDEX classifications_created_at_idx ON classifications (created_at DESC);
CREATE INDEX classifications_story_idx ON classifications (story_id);

CREATE TABLE classification_labels (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  classification_id BIGINT NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
  module VARCHAR(120) NOT NULL,
  operation VARCHAR(180) NOT NULL,
  position SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (classification_id, position)
);

CREATE INDEX classification_labels_module_idx ON classification_labels (module);
CREATE INDEX classification_labels_operation_idx ON classification_labels (operation);

CREATE TABLE provider_votes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  classification_id BIGINT NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
  provider VARCHAR(80) NOT NULL,
  position SMALLINT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'success',
  error TEXT,
  confidence DOUBLE PRECISION CHECK (confidence BETWEEN 0 AND 1),
  rationale TEXT,
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (classification_id, provider)
);

CREATE TABLE provider_vote_labels (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vote_id BIGINT NOT NULL REFERENCES provider_votes(id) ON DELETE CASCADE,
  module VARCHAR(120) NOT NULL,
  operation VARCHAR(180) NOT NULL,
  position SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (vote_id, position)
);

CREATE TABLE provider_vote_evidence (
  vote_id BIGINT NOT NULL REFERENCES provider_votes(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (vote_id, position)
);

CREATE TABLE provider_vote_issues (
  vote_id BIGINT NOT NULL REFERENCES provider_votes(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (vote_id, position)
);

CREATE TABLE provider_vote_questions (
  vote_id BIGINT NOT NULL REFERENCES provider_votes(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (vote_id, position)
);

CREATE TABLE classification_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  classification_id BIGINT NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
  attempt SMALLINT NOT NULL,
  reason VARCHAR(80),
  average_confidence DOUBLE PRECISION CHECK (average_confidence BETWEEN 0 AND 1),
  any_needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  providers_total SMALLINT NOT NULL DEFAULT 0,
  providers_successful SMALLINT NOT NULL DEFAULT 0,
  providers_failed SMALLINT NOT NULL DEFAULT 0,
  uncertainty_score DOUBLE PRECISION CHECK (uncertainty_score BETWEEN 0 AND 1),
  uncertainty_band VARCHAR(20),
  consensus_ratio DOUBLE PRECISION CHECK (consensus_ratio BETWEEN 0 AND 1),
  disagreement_rate DOUBLE PRECISION,
  normalized_entropy DOUBLE PRECISION,
  UNIQUE (classification_id, attempt)
);

CREATE TABLE review_decisions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  classification_id BIGINT NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
  reviewer VARCHAR(120) NOT NULL,
  action VARCHAR(40) NOT NULL,
  outcome VARCHAR(80),
  queue_status VARCHAR(40),
  notes TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE taxonomy_feedback (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  classification_id BIGINT REFERENCES classifications(id) ON DELETE SET NULL,
  reviewer VARCHAR(120),
  proposal_type VARCHAR(40) NOT NULL,
  target_module VARCHAR(120),
  proposed_operation VARCHAR(180),
  justification TEXT NOT NULL,
  status VARCHAR(60) NOT NULL DEFAULT 'pending_taxonomy_board',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO taxonomy_versions (version, is_active) VALUES ('1.0.0', TRUE);

WITH version AS (SELECT id FROM taxonomy_versions WHERE version = '1.0.0')
INSERT INTO taxonomy_modules (taxonomy_version_id, name, position)
SELECT version.id, module.name, module.position
FROM version
CROSS JOIN (VALUES
  ('Registry', 1),
  ('Authentication', 2),
  ('Management', 3)
) AS module(name, position);

INSERT INTO taxonomy_operations (module_id, name, position)
SELECT module.id, operation.name, operation.position
FROM taxonomy_modules module
JOIN taxonomy_versions version ON version.id = module.taxonomy_version_id
JOIN (VALUES
  ('Registry', 'Insert data', 1),
  ('Registry', 'Retrieve data', 2),
  ('Registry', 'Update data', 3),
  ('Registry', 'Remove data', 4),
  ('Registry', 'Modify input behavior', 5),
  ('Authentication', 'Login with username and password', 1),
  ('Authentication', 'Login with OAuth', 2),
  ('Authentication', 'Password recovery', 3),
  ('Authentication', 'First login', 4),
  ('Authentication', 'Validate user permissions', 5),
  ('Authentication', 'Update profile', 6),
  ('Authentication', 'Create account', 7),
  ('Authentication', 'Remove account', 8),
  ('Management', 'View dashboard', 1),
  ('Management', 'Export report to PDF', 2),
  ('Management', 'Export report to XLS', 3),
  ('Management', 'Notify via app', 4),
  ('Management', 'Notify by email', 5)
) AS operation(module_name, name, position) ON operation.module_name = module.name
WHERE version.version = '1.0.0';
