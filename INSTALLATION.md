# Measura — Instructions d'installation

## Prérequis

- Node.js 18+
- Un compte Supabase (gratuit sur supabase.com)
- Un compte Resend (gratuit sur resend.com) pour les emails

---

## Étape 1 — Créer le projet Supabase

1. Allez sur [supabase.com](https://supabase.com) et créez un nouveau projet
2. Notez votre **URL de projet** et votre **Anon Key** (Project Settings → API)
3. Notez aussi votre **Service Role Key** (attention: ne jamais l'exposer côté client)

---

## Étape 2 — Configurer la base de données

1. Dans le dashboard Supabase, allez dans **SQL Editor**
2. Copiez-collez le contenu du fichier `supabase/migrations/001_initial_schema.sql`
3. Exécutez le SQL
4. Allez dans **Storage** → Créez ces 3 buckets:
   - `photos` — Privé, limite 50MB, types autorisés: `image/*`
   - `reports` — Privé, limite 10MB, types autorisés: `application/pdf`
   - `avatars` — Public, limite 2MB, types autorisés: `image/*`

5. Pour le bucket `photos`, ajoutez cette policy RLS de storage:
   ```sql
   -- Dans Storage → Policies → photos bucket
   -- Allow authenticated users to upload
   CREATE POLICY "Authenticated upload" ON storage.objects
     FOR INSERT TO authenticated
     WITH CHECK (bucket_id = 'photos');
   
   -- Allow read via signed URL
   CREATE POLICY "Signed URL read" ON storage.objects
     FOR SELECT TO authenticated
     USING (bucket_id = 'photos');
   ```

---

## Étape 3 — Variables d'environnement

Copiez le fichier `.env.local.example` en `.env.local`:

```bash
cp .env.local.example .env.local
```

Remplissez les valeurs:

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-anon-key
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key
RESEND_API_KEY=re_votre_cle_api
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Étape 4 — Configurer l'authentification Supabase

1. Dans Supabase → **Authentication** → **URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/api/auth/callback`

2. Dans **Authentication** → **Email Templates**, personnalisez si désiré

---

## Étape 5 — Installer et démarrer

```bash
# Installer les dépendances (déjà fait si vous lisez ceci)
npm install

# Démarrer en développement
npm run dev
```

L'application sera disponible sur: **http://localhost:3000**

---

## Étape 6 — Créer le premier compte admin

1. Allez sur `http://localhost:3000/register`
2. Créez un compte entrepreneur
3. Dans Supabase → **Table Editor** → `profiles`, changez votre `role` à `admin`

---

## Structure des dossiers

```
measura/
├── app/                    # Pages Next.js (App Router)
│   ├── (auth)/             # Pages publiques d'authentification
│   ├── (dashboard)/        # Pages protégées (tableau de bord)
│   ├── api/                # Routes API
│   └── client-portal/      # Portail client (sans auth)
├── components/
│   ├── ui/                 # Composants UI réutilisables
│   ├── layout/             # Header, Sidebar
│   ├── measurement/        # Canvas de mesure Konva
│   ├── model3d/            # Viewer 3D Three.js
│   └── report/             # Template PDF
├── lib/
│   ├── supabase/           # Client Supabase
│   ├── measurement/        # Utilitaires de calcul
│   └── utils/              # Formatage, classes CSS
├── messages/               # Traductions FR/EN
└── supabase/
    └── migrations/         # Schéma SQL
```

---

## Fonctionnalités du MVP

| Fonctionnalité | Statut |
|---|---|
| Authentification (email/mdp) | ✅ |
| Tableau de bord | ✅ |
| Création de projets (wizard 3 étapes) | ✅ |
| Upload de photos avec glisser-déposer | ✅ |
| Portail client (upload sans compte) | ✅ |
| Invitation client par courriel | ✅ |
| Outil de mesure manuel (ligne, surface) | ✅ |
| Calibration par référence | ✅ |
| Visualisation mesures en m² et pi² | ✅ |
| Modèle 3D (pignon, croupe, plat, appentis) | ✅ |
| Personnalisation couleurs 3D | ✅ |
| Génération rapport PDF | ✅ |
| Rapport bilingue FR/EN | ✅ |
| Gestion des clients | ✅ |
| Page d'administration | ✅ |
| Paramètres utilisateur | ✅ |

---

## Limites actuelles

- La détection automatique des mesures par IA n'est pas encore implémentée (mesure manuelle uniquement)
- Le modèle 3D est simplifié (boîtes simples, pas de géométrie complexe)
- Pas d'application mobile native (web mobile-responsive)
- Pas d'intégration CRM
- Pas d'estimation de prix de matériaux

---

## Prochaines étapes recommandées

1. **IA de mesure** — Intégrer un modèle de vision (Roboflow, Google Vision API) pour détecter automatiquement les murs/fenêtres
2. **Meilleur 3D** — Utiliser photogrammétrie ou LIDAR pour reconstruction 3D précise
3. **Estimation de prix** — Ajouter un calculateur matériaux (revêtement, peinture, toiture)
4. **Mobile native** — React Native ou Capacitor
5. **Intégration CRM** — HubSpot, Salesforce
6. **Emails automatisés** — Suites de rappels, notifications de statut

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 16 (App Router) |
| Langage | TypeScript |
| CSS | Tailwind CSS v4 |
| Base de données | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Stockage photos | Supabase Storage |
| Canvas mesure | react-konva (Konva.js) |
| Modèle 3D | @react-three/fiber + @react-three/drei |
| PDF | @react-pdf/renderer |
| Emails | Resend |
| Formulaires | react-hook-form + Zod |
| UI | Radix UI + Lucide React |
