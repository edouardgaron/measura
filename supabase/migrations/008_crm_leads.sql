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
