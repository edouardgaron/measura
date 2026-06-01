-- ============================================================
-- 014 — Marketplace fournisseurs (annuaire + demandes de prix)
-- ============================================================
-- Marketplace inter-entreprises : lecture par tout utilisateur authentifié.

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id),
  title           TEXT NOT NULL,
  category        TEXT,
  description     TEXT,
  unit            TEXT DEFAULT 'unité',
  price           NUMERIC(12,2),
  region          TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rfqs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id    UUID REFERENCES companies(id),
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT,
  region        TEXT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','awarded')),
  needed_by     DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rfq_responses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id            UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  supplier_name     TEXT,
  price             NUMERIC(12,2),
  lead_time_days    INTEGER,
  message           TEXT,
  contact_email     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_mkt_listings_owner    ON marketplace_listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_mkt_listings_category ON marketplace_listings(category);
CREATE INDEX IF NOT EXISTS idx_rfqs_owner            ON rfqs(owner_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_status           ON rfqs(status);
CREATE INDEX IF NOT EXISTS idx_rfq_responses_rfq     ON rfq_responses(rfq_id);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
DROP TRIGGER IF EXISTS update_mkt_listings_updated_at ON marketplace_listings;
CREATE TRIGGER update_mkt_listings_updated_at BEFORE UPDATE ON marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_rfqs_updated_at ON rfqs;
CREATE TRIGGER update_rfqs_updated_at BEFORE UPDATE ON rfqs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (marketplace inter-entreprises)
-- ============================================================
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfqs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_responses        ENABLE ROW LEVEL SECURITY;

-- Annonces : lecture par tout utilisateur authentifié ; écriture par le propriétaire
DROP POLICY IF EXISTS "mkt_listings_select" ON marketplace_listings;
CREATE POLICY "mkt_listings_select" ON marketplace_listings FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "mkt_listings_write" ON marketplace_listings;
CREATE POLICY "mkt_listings_write" ON marketplace_listings FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- RFQ : visibles si ouvertes (tout authentifié) ou propriétaire ; écriture propriétaire
DROP POLICY IF EXISTS "rfqs_select" ON rfqs;
CREATE POLICY "rfqs_select" ON rfqs FOR SELECT USING (status = 'open' OR owner_id = auth.uid());
DROP POLICY IF EXISTS "rfqs_write" ON rfqs;
CREATE POLICY "rfqs_write" ON rfqs FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Réponses : visibles par l'auteur ou le propriétaire du RFQ ; insertion par tout authentifié
DROP POLICY IF EXISTS "rfq_resp_select" ON rfq_responses;
CREATE POLICY "rfq_resp_select" ON rfq_responses FOR SELECT USING (
  supplier_owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM rfqs r WHERE r.id = rfq_responses.rfq_id AND r.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "rfq_resp_insert" ON rfq_responses;
CREATE POLICY "rfq_resp_insert" ON rfq_responses FOR INSERT WITH CHECK (supplier_owner_id = auth.uid());
DROP POLICY IF EXISTS "rfq_resp_delete" ON rfq_responses;
CREATE POLICY "rfq_resp_delete" ON rfq_responses FOR DELETE USING (supplier_owner_id = auth.uid());
