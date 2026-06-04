-- ============================================================
-- 024_company_invitations.sql — Invitations de membres au niveau entreprise
-- Permet d'inviter par courriel un membre qui n'a pas encore de compte.
-- La table company_members exige un user_id (compte existant) ; cette table
-- d'attente stocke l'invitation jusqu'à ce que la personne crée son compte,
-- puis l'API crée la ligne company_members définitive.
-- S'appuie sur les helpers is_company_admin()/is_company_member() (migration 002).
-- Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS company_invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'employee'
                 CHECK (role IN ('admin','employee','estimator','inspector')),
  token        TEXT NOT NULL UNIQUE,
  invited_by   UUID REFERENCES profiles(id),
  accepted_at  TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, email)
);

CREATE INDEX IF NOT EXISTS idx_company_invitations_company ON company_invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_company_invitations_token   ON company_invitations(token);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE company_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_invitations_select" ON company_invitations;
CREATE POLICY "company_invitations_select" ON company_invitations FOR SELECT USING (
  is_company_admin(company_id)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

DROP POLICY IF EXISTS "company_invitations_insert" ON company_invitations;
CREATE POLICY "company_invitations_insert" ON company_invitations FOR INSERT WITH CHECK (
  is_company_admin(company_id)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

DROP POLICY IF EXISTS "company_invitations_update" ON company_invitations;
CREATE POLICY "company_invitations_update" ON company_invitations FOR UPDATE USING (
  is_company_admin(company_id)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

DROP POLICY IF EXISTS "company_invitations_delete" ON company_invitations;
CREATE POLICY "company_invitations_delete" ON company_invitations FOR DELETE USING (
  is_company_admin(company_id)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
