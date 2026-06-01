# Guide de déploiement Measura — pas à pas

Ce guide sécurise la mise en production de tous les modules (V1 → V4).
Suivre **dans l'ordre**. Temps estimé : 45–90 min.

> Contexte : app Next.js 16 déployée sur **Railway**, base/Storage/Auth sur **Supabase**.
> Prod actuelle : https://measura-production-3803.up.railway.app · Supabase : `zbdumrjpqfjcptfnvhyj`.

---

## 0. Pré-requis (sauvegarde)

1. Supabase → **Database → Backups** : vérifier qu'un backup récent existe (ou en déclencher un).
2. Noter la version actuelle déployée sur Railway (pour rollback éventuel).
3. Travailler d'abord sur un **projet Supabase de staging** si possible. Sinon, les migrations sont idempotentes (`IF NOT EXISTS`, `DROP ... IF EXISTS`) donc rejouables sans casse.

---

## 1. Migrations base de données (Supabase → SQL Editor)

Les migrations **005 → 014** ne sont **pas encore appliquées**. Les exécuter **dans l'ordre**.
Chaque fichier est auto-suffisant (dépend seulement de `update_updated_at_column`, `is_company_member`, `is_company_admin`, déjà en prod).

**Raccourci :** coller `supabase/APPLY_PENDING_005_013.sql` (regroupe 005→013) en une fois, puis exécuter `supabase/migrations/014_marketplace.sql`.

Ordre détaillé :

| # | Fichier | Apporte |
|---|---------|---------|
| 005 | `005_work_orders.sql` | Bons de travail |
| 006 | `006_site_management.sql` | Chantier, rapports journaliers, pointage, employés, livraisons |
| 007 | `007_invoices_payments.sql` | Facturation, paiements (taxes QC) |
| 008 | `008_crm_leads.sql` | CRM pipeline de leads |
| 009 | `009_automation.sql` | Modèles, règles, messages, relances |
| 010 | `010_scheduling.sql` | Calendrier / planification |
| 011 | `011_employee_certifications.sql` | Certifications employés |
| 012 | `012_inventory.sql` | Fournisseurs, inventaire, commandes, stock |
| 013 | `013_accounting_connections.sql` | Connexion QuickBooks (jetons) |
| 014 | `014_marketplace.sql` | Marketplace fournisseurs + RFQ |

**Vérification après exécution** (SQL Editor) :

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('work_orders','daily_reports','time_entries','invoices','payments',
    'leads','lead_activities','message_templates','automation_rules','scheduled_messages',
    'schedule_events','employee_certifications','suppliers','inventory_items',
    'purchase_orders','accounting_connections','marketplace_listings','rfqs')
order by table_name;
```

On doit voir **18 tables**. Vérifier aussi que RLS est actif :

```sql
select tablename, rowsecurity from pg_tables
where schemaname='public' and tablename in ('work_orders','invoices','leads','inventory_items');
-- rowsecurity doit être true partout
```

---

## 2. Storage (déjà en place)

Aucun nouveau bucket requis. Les PDF/modèles réutilisent le bucket **`reports`** avec préfixes :
`work-orders/`, `daily-reports/`, `invoices/`, `models/`.

Vérifier que le bucket `reports` existe (Supabase → Storage). Si absent, exécuter `supabase/storage.sql`.

---

## 3. Variables d'environnement (Railway → Variables)

### Déjà requises (existantes)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # serveur only
NEXT_PUBLIC_APP_URL=https://<votre-domaine>
NODE_ENV=production
# PORT injecté par Railway
```

### Courriel (recommandé — invitations, automatisation, factures)
```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@votre-domaine.com   # domaine vérifié dans Resend
```

### Paiements Stripe (facturation en ligne)
```
STRIPE_SECRET_KEY=sk_live_...                 # ou sk_test_ pour tester
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...               # voir §4
```

### SMS Twilio (automatisation SMS — optionnel)
```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
```

### Cron (relances automatiques planifiées)
```
CRON_SECRET=<longue-chaîne-aléatoire>         # voir §5
```

### IA (Anthropic — suivi IA, assistant, estimation, analyse photos)
```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-8               # optionnel (claude-haiku-4-5 = moins cher)
```

### QuickBooks (synchro comptable — optionnel)
```
QUICKBOOKS_CLIENT_ID=...
QUICKBOOKS_CLIENT_SECRET=...
QUICKBOOKS_REDIRECT_URI=https://<domaine>/api/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=production             # ou sandbox
```

### Photogrammétrie dense (optionnel — sinon paramétrique seulement)
```
PHOTOGRAMMETRY_API_URL=...
PHOTOGRAMMETRY_API_KEY=...
```

> **Toutes ces clés sont optionnelles sauf Supabase + APP_URL.** Chaque module dégrade proprement : sans Stripe le paiement est masqué, sans Anthropic l'IA bascule en heuristique, etc.

Après ajout des variables → Railway **redéploie automatiquement**.

---

## 4. Webhook Stripe

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. URL : `https://<votre-domaine>/api/stripe/webhook`
3. Événement à écouter : **`checkout.session.completed`**
4. Copier le **Signing secret** (`whsec_...`) → variable `STRIPE_WEBHOOK_SECRET` sur Railway.
5. Configurer Auth Supabase si besoin (Site URL + Redirect URLs = votre domaine).

**Test :** depuis une facture (onglet Facturation) → « Encaisser » → payer en mode test (carte `4242 4242 4242 4242`). Le webhook doit marquer la facture **payée** (statut + `amount_paid`).

---

## 5. Cron (relances automatiques)

L'endpoint `POST/GET /api/cron/process-automations` traite les messages planifiés dus.
Le protéger avec `CRON_SECRET` et l'appeler périodiquement.

**Option A — Railway Cron** (recommandé) : ajouter un service cron qui exécute toutes les 15 min :
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "$NEXT_PUBLIC_APP_URL/api/cron/process-automations"
```

**Option B — cron-job.org / GitHub Actions** : même requête, en-tête `Authorization: Bearer <CRON_SECRET>`.

**Test :** créer une règle d'automatisation avec délai 1 min sur une étape, déplacer un lead, attendre, déclencher le cron → vérifier l'envoi dans l'historique du lead.

---

## 6. QuickBooks (optionnel)

1. https://developer.intuit.com → créer une app → **Keys & OAuth**.
2. Redirect URI = `https://<domaine>/api/quickbooks/callback` (doit correspondre exactement à `QUICKBOOKS_REDIRECT_URI`).
3. Scope : `com.intuit.quickbooks.accounting`.
4. Renseigner les 4 variables QUICKBOOKS_* sur Railway.
5. Dans l'app : **Comptabilité → Connecter QuickBooks** → autoriser.
6. **Test :** ouvrir une facture → bouton « QuickBooks » → vérifier la création dans QuickBooks.

---

## 7. Compte de test / admin

Si pas déjà fait (voir note `project-deploy-status`) :
1. SQL Editor : `ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;`
2. Auth → Users → Add user (email + password, Auto Confirm ✓).
3. SQL Editor :
   ```sql
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   UPDATE profiles SET role='entrepreneur', full_name='Admin', company_name='Measura'
   WHERE id=(select id from auth.users where email='admin@measura.com');
   ```

---

## 8. Checklist de test end-to-end (post-déploiement)

Cocher dans l'ordre — chaque item vérifie un module :

- [ ] **Connexion** : login admin → tableau de bord s'affiche
- [ ] **CRM** : créer un lead → le glisser entre colonnes → ajouter une note → convertir en projet
- [ ] **Projet** : ouvrir le projet créé → uploader 1 photo
- [ ] **Mesures/Surfaces** : ajouter une surface (ou mesure)
- [ ] **Estimation** : créer une estimation avec lignes (dont une en « heures »)
- [ ] **Bon de travail** : générer → PDF s'ouvre → signer (pad) → re-générer PDF
- [ ] **Chantier** : créer un rapport journalier + pointage + matériau → générer résumé → PDF
- [ ] **Pointage GPS** : onglet Pointage → Arrivée (autoriser la géoloc) → Départ
- [ ] **Rentabilité** : onglet Rentabilité → KPIs prévu/réel + alertes cohérents
- [ ] **Facturation** : créer facture depuis l'estimation → TPS/TVQ corrects → PDF → lien de paiement
- [ ] **Paiement Stripe** (si configuré) : payer en test → facture passe « payée » (webhook)
- [ ] **Planification** : Calendrier → Auto-planifier le projet → événement créé avec bonne durée
- [ ] **Plans** : onglet Plans → PDF + DXF + IFC téléchargeables
- [ ] **Modèle 3D** : « Reconstruire (paramétrique) » → modèle s'affiche → « Voir en RA »
- [ ] **Design** : changer couleurs → Avant/Après → export GLB/OBJ
- [ ] **Assistant IA** (si configuré) : poser une question → « Estimation IA » → « Analyser photos »
- [ ] **Suivi IA** : `/follow-ups` → ouvrir un lead → suggestion générée → envoyer
- [ ] **Automatisation** : créer un modèle + une règle → tester (voir §5)
- [ ] **Équipe** : ajouter un employé + une certification (alerte d'expiration)
- [ ] **Inventaire** : ajouter un article (seuil) → mouvement de stock → alerte stock bas
- [ ] **Marketplace** : publier une annonce + une demande de prix → répondre
- [ ] **Comptabilité** : exporter factures CSV + sommaire TPS/TVQ
- [ ] **Portail client** : ouvrir le lien client → progression + photos + signer + payer
- [ ] **PWA** : sur mobile, « Ajouter à l'écran d'accueil » → app installable

---

## 9. Rollback

- **Code** : Railway → Deployments → redéployer la version précédente.
- **DB** : les migrations sont additives (nouvelles tables). En cas de souci, `DROP TABLE ... CASCADE` les tables ajoutées (aucune table existante n'est modifiée de façon destructive ; seules des colonnes ont été ajoutées via `ADD COLUMN IF NOT EXISTS` en 002/004).

---

## 10. Notes de sécurité

- Toutes les nouvelles tables ont **RLS activé** (isolation par propriétaire/compagnie).
- Les jetons QuickBooks (`accounting_connections`) ne sont **jamais** exposés au client (policy `owner_id = auth.uid()` + lecture serveur uniquement).
- Le webhook Stripe vérifie la **signature** ; le cron exige le **bearer secret**.
- Le marketplace est **inter-entreprises** (lecture des annonces/RFQ ouverts par tout utilisateur authentifié) — c'est voulu.
