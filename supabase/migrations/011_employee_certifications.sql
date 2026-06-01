-- ============================================================
-- 011 — Certifications / formations des employés
-- (le pointage GPS réutilise time_entries.gps_lat/gps_lng existants)
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_certifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  issuer       TEXT,
  category     TEXT DEFAULT 'other'
                 CHECK (category IN ('safety','trade','license','training','other')),
  issued_date  DATE,
  expiry_date  DATE,
  document_url TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emp_cert_employee ON employee_certifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_cert_expiry   ON employee_certifications(expiry_date);

DROP TRIGGER IF EXISTS update_emp_cert_updated_at ON employee_certifications;
CREATE TRIGGER update_emp_cert_updated_at BEFORE UPDATE ON employee_certifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE employee_certifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emp_cert_all" ON employee_certifications;
CREATE POLICY "emp_cert_all" ON employee_certifications FOR ALL USING (
  EXISTS (
    SELECT 1 FROM employees e WHERE e.id = employee_certifications.employee_id AND (
      e.owner_id = auth.uid()
      OR (e.company_id IS NOT NULL AND is_company_member(e.company_id))
      OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
    )
  )
);
