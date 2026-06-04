-- ============================================================
-- 018_reminders.sql — Suivi des relances automatiques (ChantierPro 360)
-- Permet les relances de factures (et soumissions) sans spam :
-- on enregistre la dernière relance et le compteur.
-- Idempotent.
-- ============================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_count   INTEGER NOT NULL DEFAULT 0;

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_count   INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN invoices.last_reminder_at IS 'Horodatage de la dernière relance de paiement envoyée.';
COMMENT ON COLUMN invoices.reminder_count   IS 'Nombre de relances de paiement envoyées.';
