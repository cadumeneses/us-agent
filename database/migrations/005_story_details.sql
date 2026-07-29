CREATE TABLE story_tasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  classification_id BIGINT NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  position SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE story_functional_requirements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  classification_id BIGINT NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  position SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE story_non_functional_requirements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  classification_id BIGINT NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  nfr_type VARCHAR(80) NOT NULL,
  metric VARCHAR(120) NOT NULL,
  position SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX story_tasks_classification_idx ON story_tasks (classification_id, position);
CREATE INDEX story_functional_requirements_classification_idx ON story_functional_requirements (classification_id, position);
CREATE INDEX story_non_functional_requirements_classification_idx ON story_non_functional_requirements (classification_id, position);
