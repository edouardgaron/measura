-- ============================================================
-- 003 — Proposals & Inspections
-- ============================================================

-- Proposals
CREATE TABLE IF NOT EXISTS proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  estimate_id     UUID REFERENCES estimates(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  share_token     TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  title           TEXT,
  message         TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','viewed','accepted','rejected','expired')),
  valid_until     TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  rejected_at     TIMESTAMPTZ,
  client_name     TEXT,
  client_signature TEXT,
  client_ip       TEXT,
  locale          TEXT NOT NULL DEFAULT 'fr',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inspections
CREATE TABLE IF NOT EXISTS inspections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title         TEXT NOT NULL DEFAULT 'Inspection',
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'in_progress'
                  CHECK (status IN ('in_progress','completed','archived')),
  inspected_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inspection Items
CREATE TABLE IF NOT EXISTS inspection_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  photo_id      UUID REFERENCES photos(id) ON DELETE SET NULL,
  category      TEXT NOT NULL DEFAULT 'other'
                  CHECK (category IN ('crack','water_damage','paint','siding','roofing','window','door','structural','other')),
  title         TEXT NOT NULL,
  notes         TEXT,
  priority      TEXT NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high','urgent')),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','repaired','ignored')),
  x             NUMERIC(5,4),
  y             NUMERIC(5,4),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Triggers
CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inspections_updated_at
  BEFORE UPDATE ON inspections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inspection_items_updated_at
  BEFORE UPDATE ON inspection_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE proposals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_items  ENABLE ROW LEVEL SECURITY;

-- Proposals policies
CREATE POLICY "proposals_owner_all" ON proposals FOR ALL USING (
  is_project_owner(project_id) OR is_project_member(project_id)
);
CREATE POLICY "proposals_public_view" ON proposals FOR SELECT USING (
  status IN ('sent','viewed','accepted','rejected')
);

-- Inspections policies
CREATE POLICY "inspections_all" ON inspections FOR ALL USING (
  is_project_owner(project_id) OR is_project_member(project_id)
);
CREATE POLICY "inspection_items_all" ON inspection_items FOR ALL USING (
  EXISTS (SELECT 1 FROM inspections i WHERE i.id = inspection_id
    AND (is_project_owner(i.project_id) OR is_project_member(i.project_id)))
);
