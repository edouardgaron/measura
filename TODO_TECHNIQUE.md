# TODO_TECHNIQUE — ChantierPro 360 (Measura)

> Audit technique et plan d'exécution. Mis à jour le **2026-06-04**.
> Stack : Next.js 16 · React 19 · TypeScript · Supabase (Auth/DB/Storage) · Stripe · Resend · QuickBooks · Anthropic · @react-pdf/renderer · Three.js / react-konva.

## 0. État global

**Le projet n'est PAS une maquette — c'est une application SaaS quasi complète et déployable.**

Diagnostic santé au moment de l'audit :

- ✅ `tsc --noEmit` : **0 erreur** dans le code applicatif.
- ✅ `npm test` : **40 tests passants**, 1 skipped.
- ✅ `npm run build` : **succès** (exit 0), 53 pages + 100 routes API compilées.
- 📦 **100 routes API** réelles (Supabase / Stripe / QuickBooks / PDF / IA), **0 donnée mockée**.

Conclusion de l'audit : l'application couvre déjà les 20 modules demandés. Le travail
nécessaire était **de la finition ciblée**, pas une reconstruction.

---

## 1. Travaux réalisés dans cette passe

- [x] **Audit complet** du code (app, lib, components, migrations) — recherche de stubs,
      données mockées, boutons morts, pages « à venir ». Un seul vrai trou trouvé.
- [x] **Invitation de membres au niveau entreprise** (était le seul `TODO` stub).
  - [x] Migration `024_company_invitations.sql` (table + RLS, helpers `is_company_admin`).
  - [x] API `POST/GET/DELETE /api/company/[companyId]/invite` (créer + courriel Resend, lister, révoquer).
  - [x] `/api/invite/validate` et `/api/invite/accept` étendus pour gérer les tokens **projet ET entreprise** (création de `company_members` à l'acceptation).
  - [x] Page `/accept-invite` adaptée (affiche entreprise/rôle, inscrit avec le bon rôle).
  - [x] UI `settings/company` → membres : sélecteur de rôle, invitations en attente, révocation. (Plus de toast factice.)
  - [x] Type `CompanyInvitation` ajouté à `lib/supabase/types.ts`.
- [x] **Correction TS** dans `tests/sample-artifacts.test.ts` (cast `ReactElement<any>` comme en prod) → le test PDF du rapport s'exécute maintenant.
- [x] **Jeu de données démo** (`scripts/seed-demo.mjs`) — module 18 demandé, **manquait totalement** (DB quasi vide : 0 entreprise).
  - [x] Idempotent (UUID fixes + upsert), rattaché au compte propriétaire.
  - [x] Crée : 1 entreprise, 4 employés, 5 leads CRM, 3 projets, 3 estimations + items, 3 rapports journaliers + 7 pointages (alimentent la rentabilité réelle).
  - [x] **Exécuté sur la base** : connectez-vous avec le compte propriétaire pour voir un exemple réaliste immédiatement.

---

## 2. Modules — état détaillé (vérifié à l'audit)

| Module | État | Note |
|---|---|---|
| 1. Auth & comptes (login/register/reset/profil/rôles) | ✅ Complet | Supabase Auth + onboarding entreprise |
| 2. Tableau de bord (KPI, marges, alertes) | ✅ Complet | Dashboard KPI + rapports financiers |
| 3. CRM clients | ✅ Complet | `leads` + Kanban + activités + conversion projet |
| 4. Projets / chantiers | ✅ Complet | Statuts, documents, photos, rapports, rentabilité liés |
| 5. Photos & mesures | ✅ Complet | Upload, calibration, tracé, tags, surfaces, quantités |
| 5b. Photogrammétrie | ✅ Réel (paramétrique glTF) | Provider dense externe « gated » via env |
| 6. Estimations / soumissions | ✅ Complet | Items, taxes QC, options Éco/Standard/Premium, PDF, page publique |
| 7. Rentabilité chantier | ✅ Complet | Prévu vs réel, par employé/équipe/projet, alertes |
| 8. Employés & équipes | ✅ Complet | Taux, certifications, affectation, équipes |
| 9. Rapport de fin de journée | ✅ Complet | Mobile, photos, heures réelles, PDF, recalcul rentabilité |
| 10. Bons de travail / fiches | ✅ Complet | PDF rebrandés |
| 11. Matériaux / inventaire | ✅ Complet | Catalogue, mouvements, seuils, bons d'achat |
| 12. Facturation | ✅ Complet | Taxes, Stripe Checkout, relances, page publique |
| 13. Intégrations | ✅ Préparées | QuickBooks (OAuth + sync), Stripe, Resend, Twilio, Anthropic |
| 14. Admin SaaS / abonnement | ✅ Complet | Forfaits, `/settings/billing`, webhook Stripe, middleware |
| 15. Interface (FR/EN, responsive, dark) | ✅ Complet | Style Hover N&B, i18n next-intl |
| 16. Base de données | ✅ 24 migrations | Schéma complet + RLS par entreprise |
| 17. Qualité code | ✅ Bon | RLS, validation Zod, gestion erreurs, composants réutilisables |
| 18. Données démo | ✅ **Ajouté** | `scripts/seed-demo.mjs` (voir §1) |
| 19. Déploiement | ✅ Prêt | Railway + nixpacks, guides présents |

---

## 3. Reste à faire (opérationnel — hors code)

> Ces points dépendent de l'accès aux secrets / à la base de production, pas du code.

- [ ] **Appliquer la migration `024_company_invitations.sql` en production.**
      La table `company_invitations` n'existe pas encore en base. Tant qu'elle n'est pas
      appliquée, l'invitation d'équipe renverra une erreur. Commande :
      ```bash
      DATABASE_URL="postgresql://..." node scripts/run-migrations.mjs 024
      ```
- [ ] **Configurer les variables d'environnement** manquantes en prod (voir `.env.example`) :
  - `RESEND_API_KEY` / `RESEND_FROM_EMAIL` — sinon les invitations/factures ne partent pas par courriel
    (l'API renvoie alors le lien d'invitation à copier manuellement, déjà géré côté UI).
  - `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET`.
  - `QUICKBOOKS_*`, `TWILIO_*`, `ANTHROPIC_API_KEY` selon les modules activés.
  - `NEXT_PUBLIC_APP_URL` = URL publique réelle (utilisée dans les liens d'invitation/courriel).
- [ ] **(Optionnel) Re-seeder la démo** sur un autre compte : `OWNER_EMAIL=… node scripts/seed-demo.mjs`.

## 4. Améliorations futures suggérées (non bloquantes)

- [ ] Liste/édition complète des membres actifs (changer le rôle, désactiver) dans `settings/company`.
- [ ] Tests E2E (Playwright) sur les parcours clés : créer projet → estimation → PDF → facture.
- [ ] Internationalisation EN à compléter sur les pages secondaires (CRM, inventaire, marketplace).
- [ ] Photogrammétrie dense : brancher un vrai provider quand `PHOTOGRAMMETRY_API_URL` est fourni.
