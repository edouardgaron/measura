-- ============================================================
-- 017_expenses.sql — Module Dépenses (ChantierPro 360)
-- Dépenses d'entreprise, optionnellement liées à un projet/chantier.
-- Alimente la rentabilité (coûts réels) et les rapports financiers.
-- Multi-tenant : isolation par company_id + propriété projet (mêmes
-- helpers que les autres modules : is_company_member, project_members).
-- Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  supplier        TEXT,
  category        TEXT NOT NULL DEFAULT 'material'
    CHECK (category IN ('material','labor','equipment','subcontractor','permit','fuel','rental','insurance','office','other')),
  description     TEXT,
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,   -- montant avant taxes
  tax_gst         NUMERIC(12,2) NOT NULL DEFAULT 0,   -- TPS
  tax_qst         NUMERIC(12,2) NOT NULL DEFAULT 0,   -- TVQ
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,   -- montant avec taxes
  payment_method  TEXT NOT NULL DEFAULT 'card'
    CHECK (payment_method IN ('cash','card','cheque','transfer','other')),
  receipt_storage_path TEXT,                          -- photo du reçu (bucket reports/receipts)
  billable        BOOLEAN NOT NULL DEFAULT TRUE,      -- refacturable au client
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_company  ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project  ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_all" ON expenses;
CREATE POLICY "expenses_all" ON expenses FOR ALL USING (
  created_by = auth.uid()
  OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = expenses.project_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      OR (p.company_id IS NOT NULL AND is_company_member(p.company_id))
    )
  )
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);
