CREATE TABLE app_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_name VARCHAR(120) NOT NULL,
  initials VARCHAR(8) NOT NULL,
  role VARCHAR(80) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE execution_modes (
  key VARCHAR(40) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  position SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE application_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  environment_name VARCHAR(80) NOT NULL,
  default_user_id BIGINT NOT NULL REFERENCES app_users(id),
  default_execution_mode_key VARCHAR(40) NOT NULL REFERENCES execution_modes(key),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE review_decisions
  ADD COLUMN user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL;

ALTER TABLE classification_runs
  ADD COLUMN source VARCHAR(40) NOT NULL DEFAULT 'cli',
  ADD COLUMN execution_mode_key VARCHAR(40) REFERENCES execution_modes(key);

INSERT INTO app_users (display_name, initials, role)
VALUES ('Carlos Eduardo', 'CE', 'Administrador');

INSERT INTO execution_modes (key, name, description, position) VALUES
  ('preview', 'Pré-classificação rápida', 'Classificação local baseada na taxonomia ativa.', 1),
  ('committee', 'Comitê de modelos', 'Classificação completa usando os provedores configurados.', 2);

INSERT INTO application_settings (
  environment_name,
  default_user_id,
  default_execution_mode_key
)
SELECT 'Ambiente local', user_account.id, 'preview'
FROM app_users user_account
ORDER BY user_account.id
LIMIT 1;
