-- ============================================================
-- 020_proposal_send.sql — Envoi & relances de propositions (ChantierPro 360)
-- Stocke le courriel du client (destinataire) et le suivi des relances,
-- pour envoyer la proposition par courriel et relancer les soumissions non
-- signées (comme les factures). Idempotent.
-- ============================================================

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS client_email     TEXT,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_count   INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN proposals.client_email IS 'Courriel du client (destinataire de la proposition et des relances).';
