-- ============================================================
-- 021_qb_invoice_sync.sql — Suivi de synchronisation QuickBooks
-- Évite de pousser deux fois la même facture et permet la synchro en lot.
-- Idempotent.
-- ============================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS qb_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS qb_synced_at  TIMESTAMPTZ;

COMMENT ON COLUMN invoices.qb_invoice_id IS 'Id de la facture dans QuickBooks Online (null = jamais synchronisée).';
