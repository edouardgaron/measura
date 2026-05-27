# Measura — Guide de déploiement production

## Prérequis

- Node.js 18+ installé localement
- Compte [Supabase](https://supabase.com) (gratuit pour démarrer)
- Compte [Vercel](https://vercel.com) (gratuit pour démarrer)
- Compte [Resend](https://resend.com) pour les emails (optionnel au début)
- Repository Git (GitHub, GitLab ou Bitbucket)

---

## 1. Supabase — Configuration base de données

### 1.1 Créer un projet

1. Allez sur [supabase.com](https://supabase.com) → **New project**
2. Choisissez une région proche du Canada (ex. `us-east-1`)
3. Notez le mot de passe de la base de données

### 1.2 Exécuter le schéma SQL

Dans **Supabase Dashboard → SQL Editor → New query** :

**Étape A — Schéma principal** (tables + RLS)
```
Copiez et collez le contenu de : supabase/schema.sql
Cliquez Run
```

**Étape B — Storage** (buckets + policies)
```
Copiez et collez le contenu de : supabase/storage.sql
Cliquez Run
```

> Si certaines politiques existent déjà, des erreurs "already exists" sont normales. Continuez.

### 1.3 Récupérer les clés API

**Supabase Dashboard → Project Settings → API** :

| Variable | Emplacement |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / public |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (secret) |

### 1.4 Configurer l'authentification

**Supabase Dashboard → Authentication → URL Configuration** :

| Champ | Valeur |
|---|---|
| Site URL | `https://votre-domaine.com` |
| Redirect URLs | `https://votre-domaine.com/**` |

> En développement, ajoutez aussi `http://localhost:3000/**` dans Redirect URLs.

**Email Templates** (Supabase envoie automatiquement ces emails) :

Pour le **reset de mot de passe**, assurez-vous que le template pointe vers :
```
{{ .SiteURL }}/api/auth/callback?code={{ .Code }}&next=/reset-password
```

### 1.5 Vérifier le trigger d'auto-création de profil

Dans **SQL Editor**, vérifiez que le trigger existe :
```sql
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'users'
AND trigger_schema = 'auth';
```
Doit retourner `on_auth_user_created`.

---

## 2. Variables d'environnement

Copiez `.env.local.example` vers `.env.local` et remplissez :

```bash
cp .env.local.example .env.local
```

Fichier `.env.local` pour le développement local :
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
RESEND_API_KEY=re_...           # optionnel en dev
RESEND_FROM_EMAIL=onboarding@resend.dev  # email de test Resend
```

---

## 3. Test local avant déploiement

```bash
# Installer les dépendances
npm install

# Vérifier TypeScript
npx tsc --noEmit

# Build production
npm run build

# Démarrer en mode production
npm run start
```

Ouvrez http://localhost:3000 — vous devriez voir la page de login.

---

## 4. Déploiement Vercel

### 4.1 Pousser le code sur Git

```bash
git init
git add .
git commit -m "Initial production deployment"
git remote add origin https://github.com/votre-user/measura.git
git push -u origin main
```

### 4.2 Créer le projet sur Vercel

1. Allez sur [vercel.com](https://vercel.com) → **Add New Project**
2. Importez votre repository Git
3. Framework : **Next.js** (détecté automatiquement)
4. Root Directory : `.` (racine du projet)
5. Build Command : `npm run build` (défaut)
6. Output Directory : `.next` (défaut)

### 4.3 Ajouter les variables d'environnement dans Vercel

**Vercel Dashboard → Project → Settings → Environment Variables**

Ajoutez ces variables pour **Production** (et Preview si souhaité) :

| Nom | Valeur | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Secret, serveur only |
| `NEXT_PUBLIC_APP_URL` | `https://votre-domaine.com` | URL de production |
| `RESEND_API_KEY` | `re_...` | Pour emails invitation |
| `RESEND_FROM_EMAIL` | `noreply@votre-domaine.com` | Domaine vérifié dans Resend |

> `SUPABASE_SERVICE_ROLE_KEY` est automatiquement protégé côté serveur par Vercel (pas de préfixe `NEXT_PUBLIC_`).

### 4.4 Déployer

Cliquez **Deploy**. Vercel lancera :
1. `npm install`
2. `npm run build`
3. Déploiement sur CDN global

L'URL temporaire sera : `https://measura-xxxxx.vercel.app`

---

## 5. Domaine personnalisé

### 5.1 Ajouter le domaine dans Vercel

**Vercel Dashboard → Project → Settings → Domains** :
1. Cliquez **Add Domain**
2. Entrez `votre-domaine.com` et `www.votre-domaine.com`
3. Vercel vous donnera les enregistrements DNS à configurer

### 5.2 Configurer le DNS

Chez votre registraire (Namecheap, GoDaddy, Cloudflare, etc.) :

**Pour le domaine racine** (`votre-domaine.com`) :
```
Type : A
Hôte : @
Valeur : 76.76.21.21
```

**Pour www** :
```
Type : CNAME
Hôte : www
Valeur : cname.vercel-dns.com
```

> Vercel gère automatiquement le certificat SSL (Let's Encrypt). Disponible sous 10-15 minutes après la propagation DNS.

### 5.3 Mettre à jour les variables après ajout du domaine

1. Dans **Vercel** : mettez à jour `NEXT_PUBLIC_APP_URL` avec votre vrai domaine
2. Dans **Supabase → Authentication → URL Configuration** :
   - Site URL : `https://votre-domaine.com`
   - Redirect URLs : `https://votre-domaine.com/**`
3. Redéployez : **Vercel Dashboard → Deployments → Redeploy**

---

## 6. Emails d'invitation (Resend)

### 6.1 Configurer Resend

1. Créez un compte sur [resend.com](https://resend.com)
2. **Resend Dashboard → Domains → Add Domain**
3. Ajoutez les enregistrements DNS fournis par Resend chez votre registraire
4. Attendez la vérification (quelques minutes)
5. **Resend → API Keys → Create API Key** → copiez la clé

### 6.2 Tester l'envoi

Sans domaine vérifié, utilisez l'adresse de test de Resend :
- `RESEND_FROM_EMAIL=onboarding@resend.dev`
- Les emails de test arrivent uniquement à votre propre adresse Resend

---

## 7. Premier compte utilisateur

Après déploiement :

1. Allez sur `https://votre-domaine.com/register`
2. Créez votre compte avec email + mot de passe
3. Dans **Supabase Dashboard → Table Editor → profiles** :
   - Trouvez votre ligne
   - Changez `role` de `client` à `entrepreneur`
4. Reconnectez-vous — le tableau de bord complet est maintenant accessible

---

## 8. Tests après déploiement

### Checklist fonctionnelle

- [ ] `https://votre-domaine.com` → redirige vers `/login`
- [ ] Création de compte (`/register`)
- [ ] Connexion (`/login`)
- [ ] Oubli de mot de passe (`/forgot-password`) → email reçu
- [ ] Tableau de bord (`/dashboard`) accessible
- [ ] Création d'un projet
- [ ] Upload d'une photo
- [ ] Dessin d'une mesure sur une photo
- [ ] Génération d'un rapport PDF
- [ ] Invitation d'un client (email envoyé si Resend configuré)
- [ ] Accès portail client (`/client-portal/[token]`)
- [ ] Paramètres entreprise (`/dashboard/settings/company`)

### Checklist technique

- [ ] HTTPS actif (cadenas dans le navigateur)
- [ ] Pas d'erreurs dans **Vercel → Deployments → Functions Logs**
- [ ] Pas d'erreurs dans **Supabase → Logs**
- [ ] Images Supabase Storage chargent correctement

---

## 9. Erreurs fréquentes et solutions

### "Error: supabase client not initialized"
**Cause** : Variables d'environnement manquantes dans Vercel.
**Solution** : Vérifiez que `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont bien dans Vercel → Settings → Environment Variables, puis redéployez.

### "Invalid login credentials"
**Cause** : L'email n'est pas confirmé (Supabase envoie un email de confirmation par défaut).
**Solution** : Dans **Supabase → Authentication → Providers → Email**, désactivez "Confirm email" pendant les tests.

### Photos ne s'affichent pas en production
**Cause** : Bucket `photos` est privé — les URLs directes ne fonctionnent pas.
**Solution** : L'app utilise des URLs signées via `supabase.storage.from('photos').createSignedUrl()`. Vérifiez que la fonction `getSignedUrl` est appelée dans les composants photos.

### "Function timeout" pour les PDFs
**Cause** : La génération PDF prend plus de 10 secondes (limite Vercel par défaut).
**Solution** : Le `vercel.json` inclut déjà `"maxDuration": 30` pour la route PDF. Si le timeout persiste, passez à Vercel Pro (60s max).

### Redirect loop sur `/dashboard`
**Cause** : Supabase Redirect URLs non configuré.
**Solution** : Ajoutez `https://votre-domaine.com/**` dans **Supabase → Authentication → URL Configuration → Redirect URLs**.

### Erreur RLS "permission denied for table"
**Cause** : L'utilisateur essaie d'insérer avec un rôle insuffisant (ex. `client` créant un projet).
**Solution** : Vérifiez le rôle dans `profiles.role`. Les entrepreneurs ont accès à la création de projets, les clients non.

---

## 10. Limites de la version actuelle (MVP)

| Fonctionnalité | Status |
|---|---|
| Upload photos | Fonctionnel via URLs signées |
| Mesures sur photos (calibration + canvas) | Fonctionnel |
| Génération PDF | Fonctionnel (max 30s sur Vercel) |
| Invitations client par email | Fonctionnel si Resend configuré |
| Modèle 3D (Three.js) | Fonctionnel (rendu client uniquement) |
| Paiements Stripe | Non implémenté (MVP) |
| Notifications temps réel | Non implémenté |
| Application mobile | Non implémentée |
| Export Excel estimations | Non implémenté |
| Signature électronique devis | Non implémentée |

---

## 11. Structure des fichiers de configuration

```
measura/
├── proxy.ts              ← Auth middleware (Next.js 16)
├── next.config.ts        ← Config Next.js + security headers
├── vercel.json           ← Config Vercel (timeout PDF)
├── .env.local.example    ← Template variables d'environnement
├── supabase/
│   ├── schema.sql        ← Schéma complet (à exécuter en 1er)
│   ├── storage.sql       ← Buckets + policies storage (2ème)
│   └── migrations/       ← Historique des migrations
└── DEPLOYMENT.md         ← Ce fichier
```
