-- ============================================================
-- 019_quote_options.sql — Options de soumission (ChantierPro 360)
-- Paliers Économique / Standard / Premium pour une même soumission.
-- Le client choisit un palier (augmente le panier moyen).
-- Multi-tenant : accès via l'estimation → projet.
-- Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS quote_options (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id    UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  tier           TEXT NOT NULL CHECK (tier IN ('economy','standard','premium')),
  name           TEXT,
  description    TEXT,
  features       JSONB NOT NULL DEFAULT '[]'::jsonb,   -- liste d'inclusions (strings)
  total          NUMERIC(12,2) NOT NULL DEFAULT 0,      -- prix HT du palier
  is_recommended BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (estimate_id, tier)
);

-- Palier choisi par le client (référence sur l'estimation)
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS selected_option_id UUID REFERENCES quote_options(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quote_options_estimate ON quote_options(estimate_id);

DROP TRIGGER IF EXISTS update_quote_options_updated_at ON quote_options;
CREATE TRIGGER update_quote_options_updated_at BEFORE UPDATE ON quote_options
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE quote_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_options_all" ON quote_options;
CREATE POLICY "quote_options_all" ON quote_options FOR ALL USING (
  EXISTS (
    SELECT 1 FROM estimates e
    JOIN projects p ON p.id = e.project_id
    WHERE e.id = quote_options.estimate_id AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      OR (p.company_id IS NOT NULL AND is_company_member(p.company_id))
      OR (e.company_id IS NOT NULL AND is_company_member(e.company_id))
    )
  )
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);
