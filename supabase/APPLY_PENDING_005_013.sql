-- ============================================================
-- MEASURA — Migrations en attente 005 → 013 (à exécuter dans l'ordre)
-- Généré pour application en une seule fois dans Supabase SQL Editor.
-- ============================================================


-- ░░░░░░░░░░░░░░░░░░ 005_work_orders ░░░░░░░░░░░░░░░░░░
-- ============================================================
-- 005 — Bons de travail intelligents (work_orders)
-- ============================================================
-- Self-contained: ne dépend d'aucune fonction helper ad-hoc.
-- Les policies reprennent le pattern inline des tables estimates/tasks.

CREATE TABLE IF NOT EXISTS work_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  estimate_id         UUID REFERENCES estimates(id) ON DELETE SET NULL,
  company_id          UUID REFERENCES companies(id),
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,

  wo_number           INTEGER NOT NULL DEFAULT 1,
  title               TEXT,
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','issued','in_progress','completed','signed','cancelled')),
  work_type           TEXT
                        CHECK (work_type IN ('painting','roofing','siding','windows','doors','inspection','insurance','cleaning','repair','other')),

  -- Snapshot client (figé au moment de l'émission)
  client_name         TEXT,
  client_phone        TEXT,
  client_email        TEXT,
  site_address        TEXT,

  -- Planification / équipe
  scheduled_date      DATE,
  crew_lead           TEXT,
  crew_members        TEXT,
  estimated_hours     NUMERIC(8,2),

  -- Contenus (snapshots JSONB)
  products            JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{name,brand,color,color_code,quantity,unit,category}]
  instructions        JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {preparation,application,cleanup,quality_control}
  checklist           JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {before:[{label,checked}],during:[...],after:[...]}
  measurements_summary JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{label,value,unit,surface_type,facade_side}]
  photo_ids           JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ids des photos de référence sélectionnées
  notes               TEXT,

  -- Validation / signatures (base64 PNG)
  crew_signature      TEXT,
  crew_signed_name    TEXT,
  crew_signed_at      TIMESTAMPTZ,
  client_signature    TEXT,
  client_signed_name  TEXT,
  client_signed_at    TIMESTAMPTZ,

  -- PDF généré
  pdf_storage_path    TEXT,

  locale              TEXT NOT NULL DEFAULT 'fr',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_work_orders_project  ON work_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_company  ON work_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_estimate ON work_orders(estimate_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status   ON work_orders(status);

-- ============================================================
-- TRIGGER updated_at (réutilise la fonction globale existante)
-- ============================================================
DROP TRIGGER IF EXISTS update_work_orders_updated_at ON work_orders;
CREATE TRIGGER update_work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_orders_select" ON work_orders;
CREATE POLICY "work_orders_select" ON work_orders FOR SELECT USING (
  created_by = auth.uid()
  OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = work_orders.project_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
    )
  )
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);

DROP POLICY IF EXISTS "work_orders_insert" ON work_orders;
CREATE POLICY "work_orders_insert" ON work_orders FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND (
    (company_id IS NOT NULL AND is_company_member(company_id))
    OR EXISTS (SELECT 1 FROM projects p WHERE p.id = work_orders.project_id AND p.owner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "work_orders_update" ON work_orders;
CREATE POLICY "work_orders_update" ON work_orders FOR UPDATE USING (
  created_by = auth.uid()
  OR (company_id IS NOT NULL AND is_company_admin(company_id))
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = work_orders.project_id AND p.owner_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);

DROP POLICY IF EXISTS "work_orders_delete" ON work_orders;
CREATE POLICY "work_orders_delete" ON work_orders FOR DELETE USING (
  created_by = auth.uid()
  OR (company_id IS NOT NULL AND is_company_admin(company_id))
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = work_orders.project_id AND p.owner_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);


-- ░░░░░░░░░░░░░░░░░░ 006_site_management ░░░░░░░░░░░░░░░░░░
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


-- ░░░░░░░░░░░░░░░░░░ 007_invoices_payments ░░░░░░░░░░░░░░░░░░
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


-- ░░░░░░░░░░░░░░░░░░ 008_crm_leads ░░░░░░░░░░░░░░░░░░
-- ============================================================
-- 008 — CRM : pipeline de leads & historique d'activités
-- ============================================================
-- Self-contained : RLS via pattern inline (owner/compagnie/admin).

CREATE TABLE IF NOT EXISTS leads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id          UUID REFERENCES companies(id),

  name                TEXT NOT NULL,
  contact_name        TEXT,
  contact_email       TEXT,
  contact_phone       TEXT,

  address_line1       TEXT,
  address_city        TEXT,
  address_province    TEXT,
  address_postal      TEXT,
  address_country     TEXT DEFAULT 'CA',

  source              TEXT NOT NULL DEFAULT 'other'
                        CHECK (source IN ('referral','website','phone','social','ad','walk_in','other')),
  stage               TEXT NOT NULL DEFAULT 'new'
                        CHECK (stage IN ('new','contacted','appointment','measuring','quote_sent',
                                         'follow_up','won','in_production','invoiced','completed','lost')),
  work_type           TEXT
                        CHECK (work_type IN ('painting','roofing','siding','windows','doors','inspection','insurance','cleaning','repair','other')),
  estimated_value     NUMERIC(12,2) NOT NULL DEFAULT 0,
  priority            TEXT NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('low','medium','high')),
  notes               TEXT,

  project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
  expected_close_date DATE,
  lost_reason         TEXT,

  position            INTEGER NOT NULL DEFAULT 0,         -- ordre dans la colonne
  last_activity_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type        TEXT NOT NULL DEFAULT 'note'
                CHECK (type IN ('note','call','email','sms','meeting','stage_change','task','created')),
  content     TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_owner    ON leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_company   ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage     ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_project   ON leads(project_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE leads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_select" ON leads;
CREATE POLICY "leads_select" ON leads FOR SELECT USING (
  owner_id = auth.uid()
  OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);
DROP POLICY IF EXISTS "leads_insert" ON leads;
CREATE POLICY "leads_insert" ON leads FOR INSERT WITH CHECK (
  owner_id = auth.uid()
);
DROP POLICY IF EXISTS "leads_update" ON leads;
CREATE POLICY "leads_update" ON leads FOR UPDATE USING (
  owner_id = auth.uid()
  OR (company_id IS NOT NULL AND is_company_admin(company_id))
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);
DROP POLICY IF EXISTS "leads_delete" ON leads;
CREATE POLICY "leads_delete" ON leads FOR DELETE USING (
  owner_id = auth.uid()
  OR (company_id IS NOT NULL AND is_company_admin(company_id))
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);

DROP POLICY IF EXISTS "lead_activities_all" ON lead_activities;
CREATE POLICY "lead_activities_all" ON lead_activities FOR ALL USING (
  EXISTS (
    SELECT 1 FROM leads l WHERE l.id = lead_activities.lead_id AND (
      l.owner_id = auth.uid()
      OR (l.company_id IS NOT NULL AND is_company_member(l.company_id))
      OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
    )
  )
);


-- ░░░░░░░░░░░░░░░░░░ 009_automation ░░░░░░░░░░░░░░░░░░
-- ============================================================
-- 009 — Automatisation : modèles, règles, messages, relances
-- ============================================================
-- Self-contained : RLS via owner_id (+ compagnie/admin).

-- Modèles de messages réutilisables (courriel / SMS)
CREATE TABLE IF NOT EXISTS message_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id  UUID REFERENCES companies(id),
  name        TEXT NOT NULL,
  channel     TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email','sms')),
  subject     TEXT,                          -- courriel seulement
  body        TEXT NOT NULL,                 -- supporte les variables {{contact_name}}, {{name}}, ...
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Journal des messages envoyés
CREATE TABLE IF NOT EXISTS messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  lead_id      UUID REFERENCES leads(id) ON DELETE SET NULL,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  channel      TEXT NOT NULL CHECK (channel IN ('email','sms')),
  direction    TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound','inbound')),
  to_address   TEXT NOT NULL,                -- courriel ou numéro
  subject      TEXT,
  body         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  provider_id  TEXT,                         -- id Resend / Twilio
  error        TEXT,
  is_automated BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Règles d'automatisation (déclenchées par changement d'étape de lead)
CREATE TABLE IF NOT EXISTS automation_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id    UUID REFERENCES companies(id),
  name          TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_type  TEXT NOT NULL DEFAULT 'lead_stage_changed' CHECK (trigger_type IN ('lead_stage_changed')),
  trigger_stage TEXT NOT NULL CHECK (trigger_stage IN ('new','contacted','appointment','measuring','quote_sent',
                                       'follow_up','won','in_production','invoiced','completed','lost')),
  channel       TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email','sms')),
  template_id   UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  delay_minutes INTEGER NOT NULL DEFAULT 0,  -- 0 = immédiat ; >0 = relance planifiée
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- File des messages planifiés (relances)
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rule_id     UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
  lead_id     UUID REFERENCES leads(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL CHECK (channel IN ('email','sms')),
  to_address  TEXT NOT NULL,
  subject     TEXT,
  body        TEXT NOT NULL,
  run_at      TIMESTAMPTZ NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','cancelled','failed')),
  error       TEXT,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_templates_owner       ON message_templates(owner_id);
CREATE INDEX IF NOT EXISTS idx_messages_owner          ON messages(owner_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead           ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_rules_owner             ON automation_rules(owner_id);
CREATE INDEX IF NOT EXISTS idx_rules_stage             ON automation_rules(trigger_stage);
CREATE INDEX IF NOT EXISTS idx_scheduled_run           ON scheduled_messages(run_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_lead          ON scheduled_messages(lead_id);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
DROP TRIGGER IF EXISTS update_message_templates_updated_at ON message_templates;
CREATE TRIGGER update_message_templates_updated_at BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_automation_rules_updated_at ON automation_rules;
CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (scope par owner_id + compagnie + admin)
-- ============================================================
ALTER TABLE message_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_all" ON message_templates;
CREATE POLICY "templates_all" ON message_templates FOR ALL USING (
  owner_id = auth.uid()
  OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);

DROP POLICY IF EXISTS "messages_all" ON messages;
CREATE POLICY "messages_all" ON messages FOR ALL USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);

DROP POLICY IF EXISTS "rules_all" ON automation_rules;
CREATE POLICY "rules_all" ON automation_rules FOR ALL USING (
  owner_id = auth.uid()
  OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);

DROP POLICY IF EXISTS "scheduled_all" ON scheduled_messages;
CREATE POLICY "scheduled_all" ON scheduled_messages FOR ALL USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);


-- ░░░░░░░░░░░░░░░░░░ 010_scheduling ░░░░░░░░░░░░░░░░░░
-- ============================================================
-- 010 — Planification (calendrier, horaires, assignation équipes)
-- ============================================================

CREATE TABLE IF NOT EXISTS schedule_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id    UUID REFERENCES companies(id),
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  event_type    TEXT NOT NULL DEFAULT 'job'
                  CHECK (event_type IN ('job','appointment','meeting','delivery','other')),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  start_time    TIME,
  end_time      TIME,
  all_day       BOOLEAN NOT NULL DEFAULT TRUE,
  status        TEXT NOT NULL DEFAULT 'planned'
                  CHECK (status IN ('planned','confirmed','in_progress','done','cancelled')),
  color         TEXT DEFAULT '#2563eb',
  notes         TEXT,
  estimated_hours NUMERIC(8,2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedule_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_event_id UUID NOT NULL REFERENCES schedule_events(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (schedule_event_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_owner    ON schedule_events(owner_id);
CREATE INDEX IF NOT EXISTS idx_schedule_company   ON schedule_events(company_id);
CREATE INDEX IF NOT EXISTS idx_schedule_project   ON schedule_events(project_id);
CREATE INDEX IF NOT EXISTS idx_schedule_dates     ON schedule_events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_sched_assign_event ON schedule_assignments(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_sched_assign_emp   ON schedule_assignments(employee_id);

DROP TRIGGER IF EXISTS update_schedule_events_updated_at ON schedule_events;
CREATE TRIGGER update_schedule_events_updated_at BEFORE UPDATE ON schedule_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE schedule_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule_events_all" ON schedule_events;
CREATE POLICY "schedule_events_all" ON schedule_events FOR ALL USING (
  owner_id = auth.uid()
  OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);

DROP POLICY IF EXISTS "schedule_assignments_all" ON schedule_assignments;
CREATE POLICY "schedule_assignments_all" ON schedule_assignments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM schedule_events e WHERE e.id = schedule_assignments.schedule_event_id AND (
      e.owner_id = auth.uid()
      OR (e.company_id IS NOT NULL AND is_company_member(e.company_id))
      OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
    )
  )
);


-- ░░░░░░░░░░░░░░░░░░ 011_employee_certifications ░░░░░░░░░░░░░░░░░░
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


-- ░░░░░░░░░░░░░░░░░░ 012_inventory ░░░░░░░░░░░░░░░░░░
-- ============================================================
-- 012 — Gestion matériaux : fournisseurs, inventaire, commandes, stock
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id   UUID REFERENCES companies(id),
  name         TEXT NOT NULL,
  contact_name TEXT,
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  notes        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id        UUID REFERENCES companies(id),
  supplier_id       UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  sku               TEXT,
  name              TEXT NOT NULL,
  category          TEXT,
  unit              TEXT DEFAULT 'unité',
  unit_cost         NUMERIC(10,2) DEFAULT 0,
  quantity_on_hand  NUMERIC(12,3) NOT NULL DEFAULT 0,
  reorder_threshold NUMERIC(12,3) NOT NULL DEFAULT 0,
  location          TEXT,
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id    UUID REFERENCES companies(id),
  supplier_id   UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  po_number     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','ordered','received','cancelled')),
  order_date    DATE,
  expected_date DATE,
  received_date DATE,
  notes         TEXT,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  description       TEXT NOT NULL,
  quantity          NUMERIC(12,3) DEFAULT 1,
  unit              TEXT,
  unit_cost         NUMERIC(10,2) DEFAULT 0,
  total             NUMERIC(12,2) GENERATED ALWAYS AS (COALESCE(quantity,0) * COALESCE(unit_cost,0)) STORED,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  owner_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  type              TEXT NOT NULL DEFAULT 'adjust' CHECK (type IN ('in','out','adjust')),
  quantity          NUMERIC(12,3) NOT NULL,
  reason            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_suppliers_owner     ON suppliers(owner_id);
CREATE INDEX IF NOT EXISTS idx_inventory_owner      ON inventory_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_inventory_supplier   ON inventory_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_owner             ON purchase_orders(owner_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier          ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_items_po          ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_item       ON stock_movements(inventory_item_id);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory_items;
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_po_updated_at ON purchase_orders;
CREATE TRIGGER update_po_updated_at BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (owner + compagnie + admin)
-- ============================================================
ALTER TABLE suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_all" ON suppliers;
CREATE POLICY "suppliers_all" ON suppliers FOR ALL USING (
  owner_id = auth.uid() OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);
DROP POLICY IF EXISTS "inventory_all" ON inventory_items;
CREATE POLICY "inventory_all" ON inventory_items FOR ALL USING (
  owner_id = auth.uid() OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);
DROP POLICY IF EXISTS "po_all" ON purchase_orders;
CREATE POLICY "po_all" ON purchase_orders FOR ALL USING (
  owner_id = auth.uid() OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);
DROP POLICY IF EXISTS "po_items_all" ON purchase_order_items;
CREATE POLICY "po_items_all" ON purchase_order_items FOR ALL USING (
  EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_items.purchase_order_id AND (
    po.owner_id = auth.uid() OR (po.company_id IS NOT NULL AND is_company_member(po.company_id))
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
  ))
);
DROP POLICY IF EXISTS "stock_mov_all" ON stock_movements;
CREATE POLICY "stock_mov_all" ON stock_movements FOR ALL USING (
  EXISTS (SELECT 1 FROM inventory_items i WHERE i.id = stock_movements.inventory_item_id AND (
    i.owner_id = auth.uid() OR (i.company_id IS NOT NULL AND is_company_member(i.company_id))
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
  ))
);


-- ░░░░░░░░░░░░░░░░░░ 013_accounting_connections ░░░░░░░░░░░░░░░░░░
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

