-- Uma sugestão só entra na taxonomia após aprovação explícita do revisor.
ALTER TABLE classification_fallback_suggestions
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS classification_fallback_suggestions_pending_idx
  ON classification_fallback_suggestions (classification_id, applied_at)
  WHERE applied_at IS NULL;
