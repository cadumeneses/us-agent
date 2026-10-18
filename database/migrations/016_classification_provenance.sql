ALTER TABLE provider_votes
  ADD COLUMN requested_model TEXT,
  ADD COLUMN model TEXT;

CREATE TABLE classification_provenance (
  classification_id BIGINT PRIMARY KEY REFERENCES classifications(id) ON DELETE CASCADE,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND payload @> '{"schemaVersion":1}'::jsonb),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automatic evidence is append-only. Human decisions have their own snapshots.
CREATE FUNCTION prevent_classification_provenance_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Classification provenance is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER classification_provenance_immutable
  BEFORE UPDATE ON classification_provenance
  FOR EACH ROW EXECUTE FUNCTION prevent_classification_provenance_update();

ALTER TABLE review_decisions
  ADD COLUMN before_snapshot JSONB,
  ADD COLUMN after_snapshot JSONB;
