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
