CREATE TABLE web_users (
  username TEXT PRIMARY KEY CHECK (username ~ '^[a-z][a-z0-9._-]{0,63}$'),
  password_hash TEXT NOT NULL CHECK (password_hash ~ '^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$'),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE web_sessions ADD COLUMN username TEXT REFERENCES web_users(username);
CREATE INDEX web_sessions_username_idx ON web_sessions (username);
-- Sessions created by the former shared-password flow have no username and
-- are rejected by the application's user join. No passwords are seeded in SQL.
