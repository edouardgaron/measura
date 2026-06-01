-- ============================================================
-- 007 — Facturation & paiements (Stripe, taxes Québec)
-- ============================================================
-- Self-contained : RLS via pattern inline (owner/membre/compagnie/admin).

CREATE TABLE IF NOT EXISTS invoices (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id         UUID REFERENCES companies(id),
  estimate_id        UUID REFERENCES estimates(id) ON DELETE SET NULL,
  created_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,

  invoice_number     TEXT NOT NULL,                 -- ex. F-2026-001
  status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','sent','partial','paid','overdue','cancelled')),

  -- Snapshot client
  client_name        TEXT,
  client_email       TEXT,
  client_address     TEXT,

  issue_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date           DATE,

  currency           TEXT NOT NULL DEFAULT 'CAD',
  subtotal           NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_gst_rate       NUMERIC(6,5) NOT NULL DEFAULT 0.05000,    -- TPS
  tax_qst_rate       NUMERIC(6,5) NOT NULL DEFAULT 0.09975,    -- TVQ
  tax_gst            NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_qst            NUMERIC(12,2) NOT NULL DEFAULT 0,
  total              NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,         -- dépôt demandé
  amount_paid        NUMERIC(12,2) NOT NULL DEFAULT 0,         -- cumul des paiements

  notes              TEXT,
  terms              TEXT,

  -- Stripe
  stripe_session_id        TEXT,
  stripe_payment_intent_id TEXT,

  pdf_storage_path   TEXT,
  share_token        TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  locale             TEXT NOT NULL DEFAULT 'fr',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sort_order  INTEGER DEFAULT 0,
  description TEXT NOT NULL,
  quantity    NUMERIC(10,3) DEFAULT 1,
  unit        TEXT,
  unit_price  NUMERIC(12,2) DEFAULT 0,
  total       NUMERIC(12,2) GENERATED ALWAYS AS (COALESCE(quantity,0) * COALESCE(unit_price,0)) STORED,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id               UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  project_id               UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount                   NUMERIC(12,2) NOT NULL,
  method                   TEXT NOT NULL DEFAULT 'stripe'
                             CHECK (method IN ('stripe','cash','cheque','transfer','other')),
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','succeeded','failed','refunded')),
  is_deposit               BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_payment_intent_id TEXT,
  stripe_session_id        TEXT,
  paid_at                  TIMESTAMPTZ,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_invoices_project   ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company    ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status     ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_token      ON invoices(share_token);
CREATE INDEX IF NOT EXISTS idx_invoice_items_inv   ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice    ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_project    ON payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_intent     ON payments(stripe_payment_intent_id);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments      ENABLE ROW LEVEL SECURITY;

-- ---- invoices ----
DROP POLICY IF EXISTS "invoices_all" ON invoices;
CREATE POLICY "invoices_all" ON invoices FOR ALL USING (
  created_by = auth.uid()
  OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = invoices.project_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      OR (p.company_id IS NOT NULL AND is_company_member(p.company_id))
    )
  )
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);
-- Vue publique restreinte (page de paiement par token) : factures envoyées/partielles/payées
DROP POLICY IF EXISTS "invoices_public_view" ON invoices;
CREATE POLICY "invoices_public_view" ON invoices FOR SELECT USING (
  status IN ('sent','partial','paid','overdue')
);

-- ---- invoice_items ----
DROP POLICY IF EXISTS "invoice_items_all" ON invoice_items;
CREATE POLICY "invoice_items_all" ON invoice_items FOR ALL USING (
  EXISTS (
    SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id AND (
      i.created_by = auth.uid()
      OR (i.company_id IS NOT NULL AND is_company_member(i.company_id))
      OR EXISTS (SELECT 1 FROM projects p WHERE p.id = i.project_id AND p.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
    )
  )
);
DROP POLICY IF EXISTS "invoice_items_public_view" ON invoice_items;
CREATE POLICY "invoice_items_public_view" ON invoice_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id
    AND i.status IN ('sent','partial','paid','overdue'))
);

-- ---- payments ----
DROP POLICY IF EXISTS "payments_all" ON payments;
CREATE POLICY "payments_all" ON payments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects p WHERE p.id = payments.project_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      OR (p.company_id IS NOT NULL AND is_company_member(p.company_id))
    )
  )
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);
