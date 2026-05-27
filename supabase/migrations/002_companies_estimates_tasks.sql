-- supabase/migrations/002_companies_estimates_tasks.sql
-- ============================================================
-- MEASURA - Migration 002: Companies, Estimates, Tasks, etc.
-- ============================================================

-- ============================================================
-- TABLE: companies
-- ============================================================
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

-- ============================================================
-- TABLE: company_members
-- ============================================================
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

-- ============================================================
-- ALTER TABLE: add company_id to projects (nullable, backward compat)
-- ============================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- ============================================================
-- TABLE: estimates
-- ============================================================
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

-- ============================================================
-- TABLE: estimate_items
-- ============================================================
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

-- ============================================================
-- TABLE: surface_calculations
-- ============================================================
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

-- ============================================================
-- TABLE: materials_catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS materials_catalog (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id),   -- NULL = global catalog
  category    TEXT CHECK (category IN ('paint','primer','siding','roofing','trim','fasteners','other')),
  name        TEXT NOT NULL,
  description TEXT,
  unit        TEXT CHECK (unit IN ('gallon','sqft','lf','each','bundle')),
  coverage    NUMERIC(10,3),                    -- sqft per unit
  unit_cost   NUMERIC(10,2),
  brand       TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: estimate_materials
-- ============================================================
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

-- ============================================================
-- TABLE: photo_tags
-- ============================================================
CREATE TABLE IF NOT EXISTS photo_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id   UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  tag        TEXT NOT NULL
               CHECK (tag IN ('damage','repair','attention','completed','good','priority','before','after')),
  note       TEXT,
  x          NUMERIC(5,4),   -- normalized 0-1 horizontal position on photo
  y          NUMERIC(5,4),   -- normalized 0-1 vertical position on photo
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: tasks
-- ============================================================
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

-- ============================================================
-- TABLE: task_comments
-- ============================================================
CREATE TABLE IF NOT EXISTS task_comments (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id   UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id),
  content   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: design_versions
-- ============================================================
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

-- companies
CREATE INDEX IF NOT EXISTS idx_companies_owner         ON companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_companies_slug          ON companies(slug);

-- company_members
CREATE INDEX IF NOT EXISTS idx_company_members_company ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user    ON company_members(user_id);

-- projects (new company_id column)
CREATE INDEX IF NOT EXISTS idx_projects_company        ON projects(company_id);

-- estimates
CREATE INDEX IF NOT EXISTS idx_estimates_project       ON estimates(project_id);
CREATE INDEX IF NOT EXISTS idx_estimates_company       ON estimates(company_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status        ON estimates(status);

-- estimate_items
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate ON estimate_items(estimate_id);

-- surface_calculations
CREATE INDEX IF NOT EXISTS idx_surface_calc_project    ON surface_calculations(project_id);

-- materials_catalog
CREATE INDEX IF NOT EXISTS idx_materials_catalog_company ON materials_catalog(company_id);

-- estimate_materials
CREATE INDEX IF NOT EXISTS idx_estimate_materials_est  ON estimate_materials(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_materials_mat  ON estimate_materials(material_id);

-- photo_tags
CREATE INDEX IF NOT EXISTS idx_photo_tags_photo        ON photo_tags(photo_id);

-- tasks
CREATE INDEX IF NOT EXISTS idx_tasks_project           ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company           ON tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to       ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status            ON tasks(status);

-- task_comments
CREATE INDEX IF NOT EXISTS idx_task_comments_task      ON task_comments(task_id);

-- design_versions
CREATE INDEX IF NOT EXISTS idx_design_versions_project ON design_versions(project_id);

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_surface_calculations_updated_at
  BEFORE UPDATE ON surface_calculations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_design_versions_updated_at
  BEFORE UPDATE ON design_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE companies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE surface_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials_catalog  ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_tags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_versions    ENABLE ROW LEVEL SECURITY;

-- Helper: returns TRUE if the current user is a member of the given company
CREATE OR REPLACE FUNCTION is_company_member(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = p_company_id
      AND user_id    = auth.uid()
      AND is_active  = TRUE
  );
$$;

-- Helper: returns TRUE if the current user is an admin/owner of the given company
CREATE OR REPLACE FUNCTION is_company_admin(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = p_company_id
      AND user_id    = auth.uid()
      AND role       IN ('owner','admin')
      AND is_active  = TRUE
  );
$$;

-- ---- companies ----
CREATE POLICY "companies_select" ON companies FOR SELECT USING (
  owner_id = auth.uid()
  OR is_company_member(id)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "companies_insert" ON companies FOR INSERT WITH CHECK (
  owner_id = auth.uid()
);
CREATE POLICY "companies_update" ON companies FOR UPDATE USING (
  owner_id = auth.uid()
  OR is_company_admin(id)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "companies_delete" ON companies FOR DELETE USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ---- company_members ----
CREATE POLICY "company_members_select" ON company_members FOR SELECT USING (
  user_id = auth.uid()
  OR is_company_admin(company_id)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "company_members_insert" ON company_members FOR INSERT WITH CHECK (
  is_company_admin(company_id)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "company_members_update" ON company_members FOR UPDATE USING (
  user_id = auth.uid()
  OR is_company_admin(company_id)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "company_members_delete" ON company_members FOR DELETE USING (
  is_company_admin(company_id)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ---- estimates ----
CREATE POLICY "estimates_select" ON estimates FOR SELECT USING (
  created_by = auth.uid()
  OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = estimates.project_id AND p.owner_id = auth.uid()
  )
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

-- ---- estimate_items ----
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

-- ---- surface_calculations ----
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
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = surface_calculations.project_id AND p.owner_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ---- materials_catalog ----
CREATE POLICY "materials_catalog_select" ON materials_catalog FOR SELECT USING (
  company_id IS NULL   -- global catalog visible to all authenticated users
  OR is_company_member(company_id)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "materials_catalog_write" ON materials_catalog FOR ALL USING (
  (company_id IS NOT NULL AND is_company_admin(company_id))
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ---- estimate_materials ----
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

-- ---- photo_tags ----
CREATE POLICY "photo_tags_select" ON photo_tags FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM photos ph
    JOIN projects p ON p.id = ph.project_id
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
    SELECT 1 FROM photos ph
    JOIN projects p ON p.id = ph.project_id
    WHERE ph.id = photo_tags.photo_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      OR (p.company_id IS NOT NULL AND is_company_member(p.company_id))
    )
  )
);
CREATE POLICY "photo_tags_delete" ON photo_tags FOR DELETE USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ---- tasks ----
CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (
  created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = tasks.project_id AND p.owner_id = auth.uid()
  )
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
  created_by  = auth.uid()
  OR assigned_to = auth.uid()
  OR (company_id IS NOT NULL AND is_company_admin(company_id))
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "tasks_delete" ON tasks FOR DELETE USING (
  created_by = auth.uid()
  OR (company_id IS NOT NULL AND is_company_admin(company_id))
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ---- task_comments ----
CREATE POLICY "task_comments_select" ON task_comments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_comments.task_id AND (
      t.created_by  = auth.uid()
      OR t.assigned_to = auth.uid()
      OR (t.company_id IS NOT NULL AND is_company_member(t.company_id))
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  )
);
CREATE POLICY "task_comments_insert" ON task_comments FOR INSERT WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_comments.task_id AND (
      t.created_by  = auth.uid()
      OR t.assigned_to = auth.uid()
      OR (t.company_id IS NOT NULL AND is_company_member(t.company_id))
    )
  )
);
CREATE POLICY "task_comments_delete" ON task_comments FOR DELETE USING (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ---- design_versions ----
CREATE POLICY "design_versions_select" ON design_versions FOR SELECT USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = design_versions.project_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      OR (p.company_id IS NOT NULL AND is_company_member(p.company_id))
      OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
    )
  )
);
CREATE POLICY "design_versions_write" ON design_versions FOR ALL USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = design_versions.project_id AND p.owner_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
