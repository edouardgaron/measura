-- ============================================================
-- 023_company_billing.sql — Abonnement SaaS de l'entrepreneur (ChantierPro 360)
-- Ajoute les champs de facturation Stripe sur companies. La colonne
-- subscription_tier (free/pro/enterprise) existe déjà (migration 002) ;
-- on ajoute ici l'état de l'abonnement Stripe (client, abonnement, statut,
-- période, essai). Idempotent.
-- ============================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_customer_id       TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_subscription_id   TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_status      TEXT;     -- trialing|active|past_due|canceled|incomplete
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_price_id    TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS current_period_end       TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS trial_ends_at            TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_companies_stripe_customer     ON companies(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_companies_stripe_subscription ON companies(stripe_subscription_id);
