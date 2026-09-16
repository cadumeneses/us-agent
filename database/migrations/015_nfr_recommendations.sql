-- Historical quality-plan tables are retained as an archive only.
-- No generated test case is converted into an NFR.
CREATE TABLE nfr_recommendation_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  classification_id BIGINT REFERENCES classifications(id) ON DELETE SET NULL,
  method VARCHAR(80) NOT NULL,
  input_snapshot JSONB NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX nfr_runs_classification_idx ON nfr_recommendation_runs (classification_id, id DESC);

CREATE TABLE nfr_recommendation_decisions (
  run_id BIGINT NOT NULL REFERENCES nfr_recommendation_runs(id) ON DELETE CASCADE,
  item_key VARCHAR(64) NOT NULL,
  decision VARCHAR(20) NOT NULL CHECK (decision IN ('accepted', 'rejected')),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, item_key)
);
