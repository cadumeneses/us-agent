-- A taxonomia passa a ter três níveis explícitos:
-- domínio (área, como Mobile/IoT) -> módulo -> operação.
CREATE TABLE taxonomy_domains (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  taxonomy_version_id BIGINT NOT NULL REFERENCES taxonomy_versions(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  position SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (taxonomy_version_id, name)
);

ALTER TABLE taxonomy_modules
  ADD COLUMN domain_id BIGINT REFERENCES taxonomy_domains(id) ON DELETE CASCADE;

-- Preserva a estrutura já existente sem inferir uma área de negócio para ela.
INSERT INTO taxonomy_domains (taxonomy_version_id, name, description, position)
SELECT id, 'General', 'Domínio base para os módulos existentes.', 0
FROM taxonomy_versions
ON CONFLICT (taxonomy_version_id, name) DO NOTHING;

UPDATE taxonomy_modules module
SET domain_id = domain.id
FROM taxonomy_domains domain
WHERE domain.taxonomy_version_id = module.taxonomy_version_id
  AND domain.name = 'General'
  AND module.domain_id IS NULL;

ALTER TABLE taxonomy_modules
  ALTER COLUMN domain_id SET NOT NULL;

CREATE INDEX taxonomy_domains_version_idx
  ON taxonomy_domains (taxonomy_version_id, position);

CREATE INDEX taxonomy_modules_domain_idx
  ON taxonomy_modules (domain_id, position);

ALTER TABLE classification_fallback_suggestions
  ADD COLUMN target_domain VARCHAR(120),
  ADD COLUMN proposed_module VARCHAR(120);

ALTER TABLE taxonomy_feedback
  ADD COLUMN target_domain VARCHAR(120),
  ADD COLUMN proposed_module VARCHAR(120);
