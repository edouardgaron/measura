-- ============================================================
-- MEASURA - Schéma initial de base de données Supabase
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
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES profiles(id),
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'client'
                CHECK (role IN ('owner', 'editor', 'client')),
  invite_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invite_accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id        UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE UNIQUE,
  x1              FLOAT NOT NULL,
  y1              FLOAT NOT NULL,
  x2              FLOAT NOT NULL,
  y2              FLOAT NOT NULL,
  real_length     FLOAT NOT NULL,
  unit            TEXT NOT NULL DEFAULT 'm' CHECK (unit IN ('m','cm','ft','in')),
  px_per_unit     FLOAT NOT NULL,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Measurements (mesures tracées sur photos)
CREATE TABLE IF NOT EXISTS measurements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id        UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label           TEXT,
  measurement_type TEXT NOT NULL
                    CHECK (measurement_type IN ('line','area','angle','perimeter')),
  points          JSONB NOT NULL DEFAULT '[]',
  pixel_value     FLOAT,
  real_value      FLOAT,
  unit            TEXT NOT NULL DEFAULT 'm' CHECK (unit IN ('m','cm','ft','in')),
  facade_side     TEXT CHECK (facade_side IN ('front','back','left','right','roof','other')),
  color           TEXT DEFAULT '#EF4444',
  is_visible      BOOLEAN DEFAULT TRUE,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- House Models (modèle 3D généré)
CREATE TABLE IF NOT EXISTS house_models (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  geometry_json   JSONB,
  roof_type       TEXT DEFAULT 'gable' CHECK (roof_type IN ('gable','hip','flat','shed')),
  wall_height     FLOAT DEFAULT 2.7,
  footprint_json  JSONB,
  generated_at    TIMESTAMPTZ,
  gltf_storage_path TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reports (rapports PDF générés)
CREATE TABLE IF NOT EXISTS reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  generated_by    UUID REFERENCES profiles(id),
  storage_path    TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  include_photos  BOOLEAN DEFAULT TRUE,
  include_3d      BOOLEAN DEFAULT TRUE,
  include_measurements BOOLEAN DEFAULT TRUE,
  locale          TEXT DEFAULT 'fr',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_projects_owner        ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status       ON projects(status);
CREATE INDEX IF NOT EXISTS idx_project_members_proj  ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user  ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_token ON project_members(invite_token);
CREATE INDEX IF NOT EXISTS idx_photos_project        ON photos(project_id);
CREATE INDEX IF NOT EXISTS idx_measurements_photo    ON measurements(photo_id);
CREATE INDEX IF NOT EXISTS idx_measurements_project  ON measurements(project_id);
CREATE INDEX IF NOT EXISTS idx_calibrations_photo    ON calibrations(photo_id);
CREATE INDEX IF NOT EXISTS idx_reports_project       ON reports(project_id);

-- ============================================================
-- TRIGGER: auto-créer un profil après inscription
-- ============================================================
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

-- ============================================================
-- TRIGGER: updated_at automatique
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calibrations_updated_at BEFORE UPDATE ON calibrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_measurements_updated_at BEFORE UPDATE ON measurements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_house_models_updated_at BEFORE UPDATE ON house_models FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE house_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_trigger" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Projects RLS
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

-- Project Members RLS
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

-- Photos RLS (accès via appartenance au projet)
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

-- Calibrations & Measurements: même règle via projet
CREATE POLICY "calibrations_select" ON calibrations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM photos ph
    JOIN projects p ON p.id = ph.project_id
    WHERE ph.id = calibrations.photo_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
    )
  )
);
CREATE POLICY "calibrations_write" ON calibrations FOR ALL USING (
  EXISTS (
    SELECT 1 FROM photos ph
    JOIN projects p ON p.id = ph.project_id
    WHERE ph.id = calibrations.photo_id AND p.owner_id = auth.uid()
  )
);

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

-- ============================================================
-- STORAGE BUCKETS (à exécuter via le dashboard Supabase ou l'API)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES
--   ('photos', 'photos', false, 52428800, ARRAY['image/jpeg','image/png','image/webp','image/heic']),
--   ('reports', 'reports', false, 10485760, ARRAY['application/pdf']),
--   ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg','image/png','image/webp']);
