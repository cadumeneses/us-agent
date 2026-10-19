-- Preparation belongs to the story, before any classification exists.
CREATE TABLE story_preparations (
  story_id BIGINT PRIMARY KEY REFERENCES stories(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  details JSONB NOT NULL DEFAULT '{"tasks":[],"functionalRequirements":[],"nonFunctionalRequirements":[]}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(details) = 'object')
);
