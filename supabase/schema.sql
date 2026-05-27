-- ============================================================
-- MEASURA — Schéma complet de production
-- Exécutez ce fichier dans Supabase Dashboard → SQL Editor
-- Il combine les migrations 001 et 002
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- TABLES DE BASE (Migration 001)
-- ============================================================

-- Profiles (liée à auth.users via trigger)
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'client'
                  CHECK (role IN ('admin', 'entrepreneur', 'client')),
  full_name     TEXT,
  company_name  TEXT,
  phone         TEXT,
  avatar_url    TEXT,
  locale        TEXT NOT NULL DEFAULT 'fr' CHECK (locale IN ('fr', 'en')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  building_type   TEXT DEFAULT 'residential' CHECK (building_type IN ('residential','commercial','industrial')),
  address_line1   TEXT,
  address_city    TEXT,
  address_province TEXT,
  address_postal  TEXT,
  address_country TEXT DEFAULT 'CA',
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','photos_pending','measuring','review','completed','archived')),
  unit_system     TEXT NOT NULL DEFAULT 'metric'
                    CHECK (unit_system IN ('metric', 'imperial')),
  notes           TEXT,
  thumbnail_url   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project Members (clients et collaborateurs)
CREATE TABLE IF NOT EXISTS project_members (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES profiles(id),
  email               TEXT NOT NULL,
  role                TEXT NOT NULL DEFAULT 'client'
                        CHECK (role IN ('owner', 'editor', 'client')),
  invite_token        TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invite_accepted_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, email)
);

-- Photos
CREATE TABLE IF NOT EXISTS photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by     UUID REFERENCES profiles(id),
  storage_path    TEXT NOT NULL,
  original_name   TEXT,
  width_px        INTEGER,
  height_px       INTEGER,
  file_size_bytes BIGINT,
  mime_type       TEXT DEFAULT 'image/jpeg',
  facade_label    TEXT CHECK (facade_label IN ('front','back','left','right','roof','other')),
  sort_order      INTEGER DEFAULT 0,
  is_calibrated   BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Calibrations (une par photo)
CREATE TABLE IF NOT EXISTS calibrations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id    UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE UNIQUE,
  x1          FLOAT NOT NULL,
  y1          FLOAT NOT NULL,
  x2          FLOAT NOT NULL,
  y2          FLOAT NOT NULL,
  real_length FLOAT NOT NULL,
  unit        TEXT NOT NULL DEFAULT 'm' CHECK (unit IN ('m','cm','ft','in')),
  px_per_unit FLOAT NOT NULL,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Measurements (mesures tracées sur photos)
CREATE TABLE IF NOT EXISTS measurements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id         UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label            TEXT,
  measurement_type TEXT NOT NULL
                     CHECK (measurement_type IN ('line','area','angle','perimeter')),
  points           JSONB NOT NULL DEFAULT '[]',
  pixel_value      FLOAT,
  real_value       FLOAT,
  unit             TEXT NOT NULL DEFAULT 'm' CHECK (unit IN ('m','cm','ft','in')),
  facade_side      TEXT CHECK (facade_side IN ('front','back','left','right','roof','other')),
  color            TEXT DEFAULT '#EF4444',
  is_visible       BOOLEAN DEFAULT TRUE,
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- House Models (modèle 3D généré)
CREATE TABLE IF NOT EXISTS house_models (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  geometry_json       JSONB,
  roof_type           TEXT DEFAULT 'gable' CHECK (roof_type IN ('gable','hip','flat','shed')),
  wall_height         FLOAT DEFAULT 2.7,
  footprint_json      JSONB,
  generated_at        TIMESTAMPTZ,
  gltf_storage_path   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reports (rapports PDF générés)
CREATE TABLE IF NOT EXISTS reports (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  generated_by         UUID REFERENCES profiles(id),
  storage_path         TEXT,
  version              INTEGER NOT NULL DEFAULT 1,
  include_photos       BOOLEAN DEFAULT TRUE,
  include_3d           BOOLEAN DEFAULT TRUE,
  include_measurements BOOLEAN DEFAULT TRUE,
  locale               TEXT DEFAULT 'fr',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLES AVANCÉES (Migration 002)
-- ============================================================

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  slug                TEXT UNIQUE,
  logo_url            TEXT,
  phone               TEXT,
  email               TEXT,
  website             TEXT,
  address_line1       TEXT,
  address_city        TEXT,
  address_province    TEXT,
  address_postal      TEXT,
  address_country     TEXT DEFAULT 'CA',
  tax_gst             NUMERIC(5,4) DEFAULT 0.05,
  tax_qst             NUMERIC(5,4) DEFAULT 0.09975,
  default_markup      NUMERIC(5,4) DEFAULT 0.20,
  default_labor_rate  NUMERIC(10,2) DEFAULT 45.00,
  unit_system         TEXT DEFAULT 'imperial',
  locale              TEXT DEFAULT 'fr',
  subscription_tier   TEXT DEFAULT 'free'
                        CHECK (subscription_tier IN ('free','pro','enterprise')),
  is_active           BOOLEAN DEFAULT TRUE,
  owner_id            UUID REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Company Members
CREATE TABLE IF NOT EXISTS company_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'employee'
                CHECK (role IN ('owner','admin','employee','estimator','inspector')),
  is_active   BOOLEAN DEFAULT TRUE,
  invited_by  UUID REFERENCES profiles(id),
  joined_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, user_id)
);

-- Ajouter company_id aux projets (rétrocompatible)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Estimates
CREATE TABLE IF NOT EXISTS estimates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id),
  created_by      UUID REFERENCES profiles(id),
  title           TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  work_type       TEXT
                    CHECK (work_type IN ('painting','roofing','siding','windows','doors','inspection','insurance','cleaning','repair','other')),
  subtotal        NUMERIC(12,2) DEFAULT 0,
  tax_gst         NUMERIC(12,2) DEFAULT 0,
  tax_qst         NUMERIC(12,2) DEFAULT 0,
  total           NUMERIC(12,2) DEFAULT 0,
  markup_percent  NUMERIC(5,2) DEFAULT 20,
  labor_cost      NUMERIC(12,2) DEFAULT 0,
  material_cost   NUMERIC(12,2) DEFAULT 0,
  equipment_cost  NUMERIC(12,2) DEFAULT 0,
  overhead_cost   NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  notes           TEXT,
  valid_until     DATE,
  sent_at         TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  locale          TEXT DEFAULT 'fr',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Estimate Items
CREATE TABLE IF NOT EXISTS estimate_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  sort_order  INTEGER DEFAULT 0,
  category    TEXT CHECK (category IN ('labor','material','equipment','overhead','other')),
  description TEXT NOT NULL,
  quantity    NUMERIC(10,3) DEFAULT 1,
  unit        TEXT CHECK (unit IN ('sqft','sqm','lf','each','hour','day','lot')),
  unit_price  NUMERIC(10,2) DEFAULT 0,
  total       NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  is_optional BOOLEAN DEFAULT FALSE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Surface Calculations
CREATE TABLE IF NOT EXISTS surface_calculations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES profiles(id),
  facade_side  TEXT CHECK (facade_side IN ('front','back','left','right','roof','other')),
  surface_type TEXT CHECK (surface_type IN ('wall','roof','gable','soffit','fascia','trim','door','window','garage')),
  label        TEXT,
  gross_area   NUMERIC(10,3),
  opening_area NUMERIC(10,3) DEFAULT 0,
  net_area     NUMERIC(10,3) GENERATED ALWAYS AS (GREATEST(gross_area - opening_area, 0)) STORED,
  perimeter    NUMERIC(10,2),
  length       NUMERIC(10,3),
  height       NUMERIC(10,3),
  pitch        NUMERIC(5,2),
  unit         TEXT DEFAULT 'ft',
  loss_factor  NUMERIC(5,4) DEFAULT 0.10,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Materials Catalog
CREATE TABLE IF NOT EXISTS materials_catalog (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id),
  category    TEXT CHECK (category IN ('paint','primer','siding','roofing','trim','fasteners','other')),
  name        TEXT NOT NULL,
  description TEXT,
  unit        TEXT CHECK (unit IN ('gallon','sqft','lf','each','bundle')),
  coverage    NUMERIC(10,3),
  unit_cost   NUMERIC(10,2),
  brand       TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Estimate Materials
CREATE TABLE IF NOT EXISTS estimate_materials (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id      UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  material_id      UUID REFERENCES materials_catalog(id),
  surface_calc_id  UUID REFERENCES surface_calculations(id),
  description      TEXT NOT NULL,
  quantity         NUMERIC(10,3),
  unit             TEXT,
  unit_cost        NUMERIC(10,2),
  total_cost       NUMERIC(12,2),
  waste_factor     NUMERIC(5,4) DEFAULT 0.10,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Photo Tags
CREATE TABLE IF NOT EXISTS photo_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id   UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  tag        TEXT NOT NULL
               CHECK (tag IN ('damage','repair','attention','completed','good','priority','before','after')),
  note       TEXT,
  x          NUMERIC(5,4),
  y          NUMERIC(5,4),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id   UUID REFERENCES companies(id),
  created_by   UUID REFERENCES profiles(id),
  assigned_to  UUID REFERENCES profiles(id),
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'todo'
                 CHECK (status IN ('todo','in_progress','blocked','done','cancelled')),
  priority     TEXT NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low','medium','high','urgent')),
  due_date     DATE,
  completed_at TIMESTAMPTZ,
  photo_id     UUID REFERENCES photos(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task Comments
CREATE TABLE IF NOT EXISTS task_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id  UUID REFERENCES profiles(id),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Design Versions
CREATE TABLE IF NOT EXISTS design_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          TEXT DEFAULT 'Design 1',
  is_active     BOOLEAN DEFAULT FALSE,
  colors        JSONB DEFAULT '{"walls":"#F5F5DC","roof":"#8B4513","trim":"#FFFFFF","doors":"#4A4A4A","windows":"#6B8E9F"}',
  materials     JSONB DEFAULT '{}',
  model_params  JSONB DEFAULT '{}',
  thumbnail_url TEXT,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_projects_owner         ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status        ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_company       ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_project_members_proj   ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user   ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_token  ON project_members(invite_token);
CREATE INDEX IF NOT EXISTS idx_photos_project         ON photos(project_id);
CREATE INDEX IF NOT EXISTS idx_measurements_photo     ON measurements(photo_id);
CREATE INDEX IF NOT EXISTS idx_measurements_project   ON measurements(project_id);
CREATE INDEX IF NOT EXISTS idx_calibrations_photo     ON calibrations(photo_id);
CREATE INDEX IF NOT EXISTS idx_reports_project        ON reports(project_id);
CREATE INDEX IF NOT EXISTS idx_companies_owner        ON companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_companies_slug         ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_company_members_co     ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user   ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_estimates_project      ON estimates(project_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status       ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimate_items_est     ON estimate_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_surface_calc_project   ON surface_calculations(project_id);
CREATE INDEX IF NOT EXISTS idx_materials_company      ON materials_catalog(company_id);
CREATE INDEX IF NOT EXISTS idx_photo_tags_photo       ON photo_tags(photo_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project          ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned         ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status           ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_comments_task     ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_design_versions_proj   ON design_versions(project_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Fonction updated_at générique
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger : créer un profil automatiquement à l'inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, company_name, role, locale)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'company_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    COALESCE(NEW.raw_user_meta_data->>'locale', 'fr')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER update_profiles_updated_at          BEFORE UPDATE ON profiles           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at          BEFORE UPDATE ON projects           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calibrations_updated_at      BEFORE UPDATE ON calibrations       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_measurements_updated_at      BEFORE UPDATE ON measurements       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_house_models_updated_at      BEFORE UPDATE ON house_models       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_companies_updated_at         BEFORE UPDATE ON companies          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_estimates_updated_at         BEFORE UPDATE ON estimates          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_surface_calc_updated_at      BEFORE UPDATE ON surface_calculations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at             BEFORE UPDATE ON tasks              FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_design_versions_updated_at   BEFORE UPDATE ON design_versions    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibrations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE house_models         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports              ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE surface_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials_catalog    ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_materials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_tags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_versions      ENABLE ROW LEVEL SECURITY;

-- Helpers
CREATE OR REPLACE FUNCTION is_company_member(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = p_company_id AND user_id = auth.uid() AND is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION is_company_admin(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = p_company_id AND user_id = auth.uid()
      AND role IN ('owner','admin') AND is_active = TRUE
  );
$$;

-- Profiles
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (
  auth.uid() = id
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "profiles_update_own"     ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_trigger" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Projects
CREATE POLICY "projects_select" ON projects FOR SELECT USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = projects.id AND pm.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "projects_insert" ON projects FOR INSERT WITH CHECK (
  owner_id = auth.uid()
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','entrepreneur'))
);
CREATE POLICY "projects_update" ON projects FOR UPDATE USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "projects_delete" ON projects FOR DELETE USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Project Members
CREATE POLICY "members_select" ON project_members FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "members_insert" ON project_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "members_update" ON project_members FOR UPDATE USING (
  EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  OR user_id = auth.uid()
);
CREATE POLICY "members_delete" ON project_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Photos
CREATE POLICY "photos_select" ON photos FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects p WHERE p.id = photos.project_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
    )
  )
);
CREATE POLICY "photos_insert" ON photos FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p WHERE p.id = photos.project_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
    )
  )
);
CREATE POLICY "photos_delete" ON photos FOR DELETE USING (
  EXISTS (SELECT 1 FROM projects p WHERE p.id = photos.project_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Calibrations
CREATE POLICY "calibrations_select" ON calibrations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM photos ph JOIN projects p ON p.id = ph.project_id
    WHERE ph.id = calibrations.photo_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
    )
  )
);
CREATE POLICY "calibrations_write" ON calibrations FOR ALL USING (
  EXISTS (
    SELECT 1 FROM photos ph JOIN projects p ON p.id = ph.project_id
    WHERE ph.id = calibrations.photo_id AND p.owner_id = auth.uid()
  )
);

-- Measurements
CREATE POLICY "measurements_select" ON measurements FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects p WHERE p.id = measurements.project_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
    )
  )
);
CREATE POLICY "measurements_write" ON measurements FOR ALL USING (
  EXISTS (SELECT 1 FROM projects p WHERE p.id = measurements.project_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

CREATE POLICY "house_models_all" ON house_models FOR ALL USING (
  EXISTS (SELECT 1 FROM projects p WHERE p.id = house_models.project_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

CREATE POLICY "reports_select" ON reports FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects p WHERE p.id = reports.project_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
    )
  )
);
CREATE POLICY "reports_write" ON reports FOR ALL USING (
  EXISTS (SELECT 1 FROM projects p WHERE p.id = reports.project_id AND p.owner_id = auth.uid())
);

-- Companies
CREATE POLICY "companies_select" ON companies FOR SELECT USING (
  owner_id = auth.uid() OR is_company_member(id)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "companies_insert" ON companies FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "companies_update" ON companies FOR UPDATE USING (
  owner_id = auth.uid() OR is_company_admin(id)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "companies_delete" ON companies FOR DELETE USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Company Members
CREATE POLICY "company_members_select" ON company_members FOR SELECT USING (
  user_id = auth.uid() OR is_company_admin(company_id)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "company_members_insert" ON company_members FOR INSERT WITH CHECK (
  is_company_admin(company_id)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "company_members_update" ON company_members FOR UPDATE USING (
  user_id = auth.uid() OR is_company_admin(company_id)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "company_members_delete" ON company_members FOR DELETE USING (
  is_company_admin(company_id)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Estimates
CREATE POLICY "estimates_select" ON estimates FOR SELECT USING (
  created_by = auth.uid()
  OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (SELECT 1 FROM projects p WHERE p.id = estimates.project_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "estimates_insert" ON estimates FOR INSERT WITH CHECK (
  created_by = auth.uid()
  OR (company_id IS NOT NULL AND is_company_member(company_id))
);
CREATE POLICY "estimates_update" ON estimates FOR UPDATE USING (
  created_by = auth.uid()
  OR (company_id IS NOT NULL AND is_company_admin(company_id))
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "estimates_delete" ON estimates FOR DELETE USING (
  created_by = auth.uid()
  OR (company_id IS NOT NULL AND is_company_admin(company_id))
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Estimate Items
CREATE POLICY "estimate_items_select" ON estimate_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM estimates e WHERE e.id = estimate_items.estimate_id AND (
      e.created_by = auth.uid()
      OR (e.company_id IS NOT NULL AND is_company_member(e.company_id))
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  )
);
CREATE POLICY "estimate_items_write" ON estimate_items FOR ALL USING (
  EXISTS (
    SELECT 1 FROM estimates e WHERE e.id = estimate_items.estimate_id AND (
      e.created_by = auth.uid()
      OR (e.company_id IS NOT NULL AND is_company_admin(e.company_id))
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  )
);

-- Surface Calculations
CREATE POLICY "surface_calc_select" ON surface_calculations FOR SELECT USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = surface_calculations.project_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      OR (p.company_id IS NOT NULL AND is_company_member(p.company_id))
    )
  )
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "surface_calc_write" ON surface_calculations FOR ALL USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM projects p WHERE p.id = surface_calculations.project_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Materials Catalog
CREATE POLICY "materials_catalog_select" ON materials_catalog FOR SELECT USING (
  company_id IS NULL OR is_company_member(company_id)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "materials_catalog_write" ON materials_catalog FOR ALL USING (
  (company_id IS NOT NULL AND is_company_admin(company_id))
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Estimate Materials
CREATE POLICY "estimate_materials_select" ON estimate_materials FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM estimates e WHERE e.id = estimate_materials.estimate_id AND (
      e.created_by = auth.uid()
      OR (e.company_id IS NOT NULL AND is_company_member(e.company_id))
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  )
);
CREATE POLICY "estimate_materials_write" ON estimate_materials FOR ALL USING (
  EXISTS (
    SELECT 1 FROM estimates e WHERE e.id = estimate_materials.estimate_id AND (
      e.created_by = auth.uid()
      OR (e.company_id IS NOT NULL AND is_company_admin(e.company_id))
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  )
);

-- Photo Tags
CREATE POLICY "photo_tags_select" ON photo_tags FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM photos ph JOIN projects p ON p.id = ph.project_id
    WHERE ph.id = photo_tags.photo_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      OR (p.company_id IS NOT NULL AND is_company_member(p.company_id))
      OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
    )
  )
);
CREATE POLICY "photo_tags_insert" ON photo_tags FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM photos ph JOIN projects p ON p.id = ph.project_id
    WHERE ph.id = photo_tags.photo_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
    )
  )
);
CREATE POLICY "photo_tags_delete" ON photo_tags FOR DELETE USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Tasks
CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (
  created_by = auth.uid() OR assigned_to = auth.uid()
  OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (SELECT 1 FROM projects p WHERE p.id = tasks.project_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "tasks_insert" ON tasks FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND (
    (company_id IS NOT NULL AND is_company_member(company_id))
    OR EXISTS (SELECT 1 FROM projects p WHERE p.id = tasks.project_id AND p.owner_id = auth.uid())
  )
);
CREATE POLICY "tasks_update" ON tasks FOR UPDATE USING (
  created_by = auth.uid() OR assigned_to = auth.uid()
  OR (company_id IS NOT NULL AND is_company_admin(company_id))
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "tasks_delete" ON tasks FOR DELETE USING (
  created_by = auth.uid()
  OR (company_id IS NOT NULL AND is_company_admin(company_id))
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Task Comments
CREATE POLICY "task_comments_select" ON task_comments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_comments.task_id AND (
      t.created_by = auth.uid() OR t.assigned_to = auth.uid()
      OR (t.company_id IS NOT NULL AND is_company_member(t.company_id))
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  )
);
CREATE POLICY "task_comments_insert" ON task_comments FOR INSERT WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_comments.task_id AND (
      t.created_by = auth.uid() OR t.assigned_to = auth.uid()
      OR (t.company_id IS NOT NULL AND is_company_member(t.company_id))
    )
  )
);
CREATE POLICY "task_comments_delete" ON task_comments FOR DELETE USING (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Design Versions
CREATE POLICY "design_versions_select" ON design_versions FOR SELECT USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = design_versions.project_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
    )
  )
);
CREATE POLICY "design_versions_write" ON design_versions FOR ALL USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM projects p WHERE p.id = design_versions.project_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
