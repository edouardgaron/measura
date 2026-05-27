# Measura

Application SaaS de mesure de bâtiments pour entrepreneurs en rénovation.  
Inspiré de Hover — prenez des photos, mesurez, générez des devis et rapports PDF.

## Fonctionnalités

- **Mesures photo** — Calibration et tracé de mesures sur photos avec react-konva
- **Modèle 3D** — Visualisation 3D du bâtiment avec Three.js
- **Devis automatique** — Calcul des surfaces, matériaux et main-d'œuvre
- **Rapports PDF** — Génération de rapports professionnels
- **Portail client** — Lien d'invitation pour que le client dépose ses photos
- **Multi-entreprise** — Gestion d'équipe et rôles
- **Bilingue FR/EN** — next-intl

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 16 (App Router) |
| Langage | TypeScript 5 |
| Styles | Tailwind CSS v4 |
| Base de données | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Canvas mesures | react-konva |
| 3D | @react-three/fiber + drei |
| PDF | @react-pdf/renderer |
| Emails | Resend |
| i18n | next-intl v4 |
| Déploiement | Railway |

## Développement local

### Prérequis

- Node.js 18+
- Compte [Supabase](https://supabase.com)

### Installation

```bash
# 1. Cloner le repo
git clone https://github.com/votre-user/measura.git
cd measura

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env.local
# Remplissez .env.local avec vos vraies clés Supabase

# 4. Initialiser la base de données Supabase
# Supabase Dashboard → SQL Editor → exécuter supabase/schema.sql
# Supabase Dashboard → SQL Editor → exécuter supabase/storage.sql

# 5. Démarrer le serveur de développement
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

### Premier compte

1. Allez sur `/register` et créez un compte
2. Dans Supabase → Table Editor → `profiles`, changez votre `role` à `entrepreneur`
3. Reconnectez-vous

## Déploiement

Voir [DEPLOYMENT_RAILWAY.md](./DEPLOYMENT_RAILWAY.md) pour les instructions complètes Railway + GitHub.

## Structure du projet

```
measura/
├── app/
│   ├── (auth)/          # Login, register, reset password
│   ├── (dashboard)/     # Dashboard, projets, settings
│   ├── api/             # Routes API
│   └── client-portal/   # Portail client public
├── components/
│   ├── layout/          # Sidebar, Header
│   ├── measurement/     # Canvas de mesure
│   ├── model3d/         # Viewer 3D
│   ├── photos/          # Tagging photos
│   ├── report/          # Template PDF
│   └── ui/              # Composants UI
├── lib/
│   ├── supabase/        # Client/server Supabase
│   ├── measurement/     # Calculs métriques
│   └── validators/      # Schémas Zod
├── supabase/
│   ├── schema.sql       # Schéma complet (à exécuter)
│   └── storage.sql      # Buckets + policies
├── .env.example         # Template variables d'environnement
├── railway.json         # Configuration Railway
└── DEPLOYMENT_RAILWAY.md
```

## Variables d'environnement

| Variable | Requis | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Oui | URL de votre projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Oui | Clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Oui | Clé service role (serveur) |
| `NEXT_PUBLIC_APP_URL` | Oui | URL de l'app en production |
| `RESEND_API_KEY` | Non | Pour envoi d'emails d'invitation |
| `RESEND_FROM_EMAIL` | Non | Adresse expéditeur des emails |

## Licence

Propriétaire — tous droits réservés.
