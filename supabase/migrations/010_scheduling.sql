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
