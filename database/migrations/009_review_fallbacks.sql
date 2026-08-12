-- Contexto estruturado para que a fila de revisão consiga explicar os
-- fallbacks e transformar lacunas recorrentes em evolução da taxonomia.
CREATE TABLE classification_fallback_suggestions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  classification_id BIGINT NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
  source VARCHAR(80) NOT NULL,
  suggestion_type VARCHAR(40) NOT NULL,
  proposed_domain VARCHAR(120),
  target_module VARCHAR(120),
  proposed_operation VARCHAR(180),
  reason TEXT NOT NULL,
  position SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (classification_id, position)
);

CREATE INDEX classification_fallback_suggestions_classification_idx
  ON classification_fallback_suggestions (classification_id, position);

CREATE TABLE classification_fallback_evidence (
  fallback_suggestion_id BIGINT NOT NULL REFERENCES classification_fallback_suggestions(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (fallback_suggestion_id, position)
);

-- target_module continua representando um módulo já existente; a nova coluna
-- guarda explicitamente a proposta de um novo domínio/módulo.
ALTER TABLE taxonomy_feedback
  ADD COLUMN IF NOT EXISTS proposed_domain VARCHAR(120);
