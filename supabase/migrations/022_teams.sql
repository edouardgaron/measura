-- ============================================================
-- 022_teams.sql — Notion d'équipe (ChantierPro 360)
-- Regroupe les employés en équipes (ex. « Équipe Toiture », « Équipe A »)
-- pour piloter la rentabilité par équipe. Un employé appartient à au plus
-- une équipe (employees.team_id). Multi-tenant : isolation par
-- owner_id / company_id (mêmes helpers que les autres modules). Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#0f172a',   -- pastille couleur (UI)
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_owner   ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_company ON teams(company_id);

-- Rattachement employé → équipe (un employé dans au plus une équipe)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_employees_team ON employees(team_id);

DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teams_all" ON teams;
CREATE POLICY "teams_all" ON teams FOR ALL USING (
  owner_id = auth.uid()
  OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);
