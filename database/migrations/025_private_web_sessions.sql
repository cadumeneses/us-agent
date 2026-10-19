-- Shared private workspace access; this is not individual user/organization identity.
CREATE TABLE web_sessions (
  token_sha256 TEXT PRIMARY KEY CHECK (token_sha256 ~ '^[a-f0-9]{64}$'),
  credential_sha256 TEXT NOT NULL CHECK (credential_sha256 ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX web_sessions_expiry_idx ON web_sessions (expires_at);

-- One atomic rate-limit bucket shared by all serverless instances.
CREATE TABLE web_login_limits (
  scope TEXT PRIMARY KEY CHECK (scope = 'private_workspace'),
  window_start TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts > 0)
);
