-- ============================================================
-- 013 — Connexions comptables (QuickBooks OAuth)
-- ============================================================

CREATE TABLE IF NOT EXISTS accounting_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL DEFAULT 'quickbooks' CHECK (provider IN ('quickbooks')),
  realm_id          TEXT,
  access_token      TEXT,
  refresh_token     TEXT,
  token_expires_at  TIMESTAMPTZ,
  connected_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_acct_conn_owner ON accounting_connections(owner_id);

DROP TRIGGER IF EXISTS update_acct_conn_updated_at ON accounting_connections;
CREATE TRIGGER update_acct_conn_updated_at BEFORE UPDATE ON accounting_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE accounting_connections ENABLE ROW LEVEL SECURITY;

-- Jetons sensibles : visibles uniquement par le propriétaire (jamais exposés au client).
DROP POLICY IF EXISTS "acct_conn_all" ON accounting_connections;
CREATE POLICY "acct_conn_all" ON accounting_connections FOR ALL USING (owner_id = auth.uid());
