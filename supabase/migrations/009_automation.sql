-- ============================================================
-- 009 — Automatisation : modèles, règles, messages, relances
-- ============================================================
-- Self-contained : RLS via owner_id (+ compagnie/admin).

-- Modèles de messages réutilisables (courriel / SMS)
CREATE TABLE IF NOT EXISTS message_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id  UUID REFERENCES companies(id),
  name        TEXT NOT NULL,
  channel     TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email','sms')),
  subject     TEXT,                          -- courriel seulement
  body        TEXT NOT NULL,                 -- supporte les variables {{contact_name}}, {{name}}, ...
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Journal des messages envoyés
CREATE TABLE IF NOT EXISTS messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  lead_id      UUID REFERENCES leads(id) ON DELETE SET NULL,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  channel      TEXT NOT NULL CHECK (channel IN ('email','sms')),
  direction    TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound','inbound')),
  to_address   TEXT NOT NULL,                -- courriel ou numéro
  subject      TEXT,
  body         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  provider_id  TEXT,                         -- id Resend / Twilio
  error        TEXT,
  is_automated BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Règles d'automatisation (déclenchées par changement d'étape de lead)
CREATE TABLE IF NOT EXISTS automation_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id    UUID REFERENCES companies(id),
  name          TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_type  TEXT NOT NULL DEFAULT 'lead_stage_changed' CHECK (trigger_type IN ('lead_stage_changed')),
  trigger_stage TEXT NOT NULL CHECK (trigger_stage IN ('new','contacted','appointment','measuring','quote_sent',
                                       'follow_up','won','in_production','invoiced','completed','lost')),
  channel       TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email','sms')),
  template_id   UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  delay_minutes INTEGER NOT NULL DEFAULT 0,  -- 0 = immédiat ; >0 = relance planifiée
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- File des messages planifiés (relances)
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rule_id     UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
  lead_id     UUID REFERENCES leads(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL CHECK (channel IN ('email','sms')),
  to_address  TEXT NOT NULL,
  subject     TEXT,
  body        TEXT NOT NULL,
  run_at      TIMESTAMPTZ NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','cancelled','failed')),
  error       TEXT,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_templates_owner       ON message_templates(owner_id);
CREATE INDEX IF NOT EXISTS idx_messages_owner          ON messages(owner_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead           ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_rules_owner             ON automation_rules(owner_id);
CREATE INDEX IF NOT EXISTS idx_rules_stage             ON automation_rules(trigger_stage);
CREATE INDEX IF NOT EXISTS idx_scheduled_run           ON scheduled_messages(run_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_lead          ON scheduled_messages(lead_id);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
DROP TRIGGER IF EXISTS update_message_templates_updated_at ON message_templates;
CREATE TRIGGER update_message_templates_updated_at BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_automation_rules_updated_at ON automation_rules;
CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (scope par owner_id + compagnie + admin)
-- ============================================================
ALTER TABLE message_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_all" ON message_templates;
CREATE POLICY "templates_all" ON message_templates FOR ALL USING (
  owner_id = auth.uid()
  OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);

DROP POLICY IF EXISTS "messages_all" ON messages;
CREATE POLICY "messages_all" ON messages FOR ALL USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);

DROP POLICY IF EXISTS "rules_all" ON automation_rules;
CREATE POLICY "rules_all" ON automation_rules FOR ALL USING (
  owner_id = auth.uid()
  OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);

DROP POLICY IF EXISTS "scheduled_all" ON scheduled_messages;
CREATE POLICY "scheduled_all" ON scheduled_messages FOR ALL USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);
