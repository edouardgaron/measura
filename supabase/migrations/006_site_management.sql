-- ============================================================
-- 006 — Gestion chantier & rapport journalier
-- ============================================================
-- Produit les HEURES RÉELLES et COÛTS RÉELS (colonnes générées
-- labor_cost / total_cost) consommés ensuite par le module
-- Rentabilité temps réel.
-- Self-contained : RLS via pattern inline (pas de helper ad-hoc).

-- ============================================================
-- TABLE: employees (roster — peut inclure des non-utilisateurs)
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id    UUID REFERENCES companies(id),
  user_id       UUID REFERENCES profiles(id),   -- si l'employé possède un compte
  full_name     TEXT NOT NULL,
  role          TEXT,
  email         TEXT,
  phone         TEXT,
  hourly_cost   NUMERIC(10,2) DEFAULT 0,         -- coût horaire chargé (pour rentabilité)
  hourly_rate   NUMERIC(10,2) DEFAULT 0,         -- taux facturable (optionnel)
  is_active     BOOLEAN DEFAULT TRUE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: daily_reports (rapport journalier de chantier)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_reports (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id         UUID REFERENCES companies(id),
  created_by         UUID REFERENCES profiles(id),
  report_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  weather            TEXT,                        -- 'sunny','cloudy','rain','snow','wind','cold','hot'
  temperature        NUMERIC(5,1),
  crew_summary       TEXT,
  work_performed     TEXT,
  progress_percent   INTEGER CHECK (progress_percent BETWEEN 0 AND 100),
  incidents          TEXT,
  comments           TEXT,
  status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','submitted','approved')),
  generated_summary  TEXT,                        -- résumé généré (direction)
  client_summary     TEXT,                        -- résumé adressé au client
  photo_ids          JSONB NOT NULL DEFAULT '[]'::jsonb,
  pdf_storage_path   TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: time_entries (pointage — heures réelles + coût main d'œuvre)
-- ============================================================
CREATE TABLE IF NOT EXISTS time_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  daily_report_id UUID REFERENCES daily_reports(id) ON DELETE SET NULL,
  employee_id     UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_name   TEXT,                           -- snapshot / fallback si pas d'employee_id
  work_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in        TIME,
  clock_out       TIME,
  break_minutes   INTEGER DEFAULT 0,
  hours           NUMERIC(6,2) DEFAULT 0,         -- heures nettes travaillées
  hourly_cost     NUMERIC(10,2) DEFAULT 0,        -- snapshot du coût horaire
  labor_cost      NUMERIC(12,2) GENERATED ALWAYS AS (COALESCE(hours,0) * COALESCE(hourly_cost,0)) STORED,
  gps_lat         NUMERIC(9,6),
  gps_lng         NUMERIC(9,6),
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: daily_report_materials (matériaux consommés — coût réel)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_report_materials (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id  UUID REFERENCES daily_reports(id) ON DELETE CASCADE,
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  material_id      UUID REFERENCES materials_catalog(id),
  description      TEXT NOT NULL,
  quantity         NUMERIC(10,3),
  unit             TEXT,
  unit_cost        NUMERIC(10,2),
  total_cost       NUMERIC(12,2) GENERATED ALWAYS AS (COALESCE(quantity,0) * COALESCE(unit_cost,0)) STORED,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: site_issues (problèmes / retards / risques)
-- ============================================================
CREATE TABLE IF NOT EXISTS site_issues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  daily_report_id UUID REFERENCES daily_reports(id) ON DELETE SET NULL,
  type            TEXT NOT NULL DEFAULT 'issue'
                    CHECK (type IN ('delay','issue','risk','safety','quality')),
  severity        TEXT NOT NULL DEFAULT 'medium'
                    CHECK (severity IN ('low','medium','high','critical')),
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','in_progress','resolved')),
  reported_by     UUID REFERENCES profiles(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: deliveries (livraisons matériel)
-- ============================================================
CREATE TABLE IF NOT EXISTS deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  supplier        TEXT,
  description     TEXT NOT NULL,
  quantity        TEXT,
  expected_date   DATE,
  received_date   DATE,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','received','delayed','cancelled')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_employees_owner          ON employees(owner_id);
CREATE INDEX IF NOT EXISTS idx_employees_company         ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_project     ON daily_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date        ON daily_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_project      ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_report       ON time_entries(daily_report_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee     ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_drm_report                ON daily_report_materials(daily_report_id);
CREATE INDEX IF NOT EXISTS idx_drm_project               ON daily_report_materials(project_id);
CREATE INDEX IF NOT EXISTS idx_site_issues_project       ON site_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_project        ON deliveries(project_id);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_reports_updated_at ON daily_reports;
CREATE TRIGGER update_daily_reports_updated_at BEFORE UPDATE ON daily_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_time_entries_updated_at ON time_entries;
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_site_issues_updated_at ON site_issues;
CREATE TRIGGER update_site_issues_updated_at BEFORE UPDATE ON site_issues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deliveries_updated_at ON deliveries;
CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE employees              ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports          ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_issues            ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries             ENABLE ROW LEVEL SECURITY;

-- ---- employees ----
DROP POLICY IF EXISTS "employees_select" ON employees;
CREATE POLICY "employees_select" ON employees FOR SELECT USING (
  owner_id = auth.uid()
  OR user_id = auth.uid()
  OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);
DROP POLICY IF EXISTS "employees_write" ON employees;
CREATE POLICY "employees_write" ON employees FOR ALL USING (
  owner_id = auth.uid()
  OR (company_id IS NOT NULL AND is_company_admin(company_id))
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);

-- Helper réutilisable inline pour les tables liées à un projet :
-- accès si propriétaire du projet, membre du projet, membre de la compagnie, ou admin.

-- ---- daily_reports ----
DROP POLICY IF EXISTS "daily_reports_all" ON daily_reports;
CREATE POLICY "daily_reports_all" ON daily_reports FOR ALL USING (
  created_by = auth.uid()
  OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = daily_reports.project_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      OR (p.company_id IS NOT NULL AND is_company_member(p.company_id))
    )
  )
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);

-- ---- time_entries ----
DROP POLICY IF EXISTS "time_entries_all" ON time_entries;
CREATE POLICY "time_entries_all" ON time_entries FOR ALL USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = time_entries.project_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      OR (p.company_id IS NOT NULL AND is_company_member(p.company_id))
    )
  )
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);

-- ---- daily_report_materials ----
DROP POLICY IF EXISTS "drm_all" ON daily_report_materials;
CREATE POLICY "drm_all" ON daily_report_materials FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects p WHERE p.id = daily_report_materials.project_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      OR (p.company_id IS NOT NULL AND is_company_member(p.company_id))
    )
  )
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);

-- ---- site_issues ----
DROP POLICY IF EXISTS "site_issues_all" ON site_issues;
CREATE POLICY "site_issues_all" ON site_issues FOR ALL USING (
  reported_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = site_issues.project_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      OR (p.company_id IS NOT NULL AND is_company_member(p.company_id))
    )
  )
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);

-- ---- deliveries ----
DROP POLICY IF EXISTS "deliveries_all" ON deliveries;
CREATE POLICY "deliveries_all" ON deliveries FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects p WHERE p.id = deliveries.project_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      OR (p.company_id IS NOT NULL AND is_company_member(p.company_id))
    )
  )
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);
