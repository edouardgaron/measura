# Measura — Déploiement Railway + GitHub

## Vue d'ensemble

```
GitHub (code) ──push──► Railway (build + host) ──► URL publique
                              │
                         Supabase (DB + Auth + Storage)
```

Railway détecte automatiquement Next.js via Nixpacks, installe les dépendances, build et démarre l'app.

---

## Prérequis

- [ ] Compte GitHub
- [ ] Compte Railway ([railway.app](https://railway.app))
- [ ] Projet Supabase configuré (voir section Supabase ci-dessous)
- [ ] Node.js 18+ installé localement

---

## 1. Supabase — Configuration

### 1.1 Créer un projet Supabase

1. [supabase.com](https://supabase.com) → **New project**
2. Choisissez une région proche du Canada (ex. `us-east-1`)
3. Notez le mot de passe de la base de données

### 1.2 Exécuter le schéma SQL

**Supabase Dashboard → SQL Editor → New query :**

**Étape 1 — Tables + RLS :**
```
Copier le contenu de supabase/schema.sql → Coller → Run
```

**Étape 2 — Storage buckets :**
```
Copier le contenu de supabase/storage.sql → Coller → Run
```

### 1.3 Récupérer les clés API

**Supabase Dashboard → Project Settings → API :**

| Variable | Où la trouver |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / public |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (secret, ne jamais exposer) |

### 1.4 Configurer l'auth Supabase pour Railway

**Supabase Dashboard → Authentication → URL Configuration :**

| Champ | Valeur (à mettre à jour après déploiement) |
|---|---|
| Site URL | `https://measura-production.up.railway.app` |
| Redirect URLs | `https://measura-production.up.railway.app/**` |

> Ajoutez aussi `http://localhost:3000/**` pour le développement local.

---

## 2. GitHub — Initialisation du repo

### 2.1 Créer le repository sur GitHub

1. GitHub → **New repository**
2. Nom : `measura`
3. Visibilité : **Private** (recommandé)
4. Ne pas initialiser avec README (vous avez déjà le code)

### 2.2 Pousser le code

```bash
# Dans le dossier du projet
cd "C:\Users\Edouard\Desktop\App mesures\measura"

# Initialiser git
git init

# Ajouter tous les fichiers (les secrets sont exclus par .gitignore)
git add .

# Premier commit
git commit -m "Initial commit — Measura production ready"

# Connecter à GitHub
git remote add origin https://github.com/VOTRE-USER/measura.git
git branch -M main

# Pousser
git push -u origin main
```

> **Vérification :** Assurez-vous que `.env.local` n'est PAS dans le commit :
> ```bash
> git status  # .env.local ne doit PAS apparaître
> ```

---

## 3. Railway — Création du projet

### 3.1 Créer un service depuis GitHub

1. [railway.app](https://railway.app) → **New Project**
2. Choisissez **Deploy from GitHub repo**
3. Connectez votre compte GitHub si ce n'est pas fait
4. Sélectionnez le repository `measura`
5. Railway détecte automatiquement Next.js

### 3.2 Ajouter les variables d'environnement

**Railway Dashboard → Service → Variables → Add Variable**

Ajoutez chaque variable une par une :

```
NEXT_PUBLIC_SUPABASE_URL          = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     = eyJ...
SUPABASE_SERVICE_ROLE_KEY         = eyJ...
NEXT_PUBLIC_APP_URL               = https://votre-app.up.railway.app
RESEND_API_KEY                    = re_...
RESEND_FROM_EMAIL                 = noreply@votre-domaine.com
NODE_ENV                          = production
```

> **Note :** `PORT` est géré automatiquement par Railway. Ne l'ajoutez pas manuellement.

### 3.3 Déclencher le déploiement

Railway lance automatiquement le build après avoir ajouté les variables.

Sinon : **Railway → Service → Deployments → Deploy Now**

**Processus de build Railway (automatique) :**
```
1. git clone du repo
2. npm install
3. npm run build  (next build)
4. npm run start  (next start — lit PORT de Railway automatiquement)
```

### 3.4 Obtenir l'URL de l'application

**Railway → Service → Settings → Networking → Generate Domain**

Vous obtenez une URL du type : `https://measura-production.up.railway.app`

---

## 4. Configuration post-déploiement

### 4.1 Mettre à jour l'URL dans Railway

Après avoir obtenu votre URL Railway :

**Railway → Variables → Modifier** `NEXT_PUBLIC_APP_URL` :
```
NEXT_PUBLIC_APP_URL = https://measura-production.up.railway.app
```

Railway redéploie automatiquement.

### 4.2 Mettre à jour Supabase avec l'URL Railway

**Supabase → Authentication → URL Configuration :**
- Site URL : `https://measura-production.up.railway.app`
- Redirect URLs : `https://measura-production.up.railway.app/**`

---

## 5. Domaine personnalisé

### 5.1 Ajouter le domaine dans Railway

**Railway → Service → Settings → Networking → Custom Domain**

Entrez : `votre-domaine.com`

Railway vous donnera un enregistrement CNAME.

### 5.2 Configurer le DNS

Chez votre registraire (Namecheap, GoDaddy, Cloudflare, etc.) :

**Pour www** :
```
Type  : CNAME
Hôte  : www
Valeur: votre-app.up.railway.app
TTL   : Auto
```

**Pour le domaine racine** (selon votre registraire) :
```
Type  : ALIAS ou ANAME (si supporté)
Hôte  : @
Valeur: votre-app.up.railway.app
```

Ou avec Cloudflare (recommandé — supporte CNAME sur racine) :
```
Type  : CNAME (proxied)
Hôte  : @
Valeur: votre-app.up.railway.app
```

> SSL est automatiquement géré par Railway (Let's Encrypt). Disponible après propagation DNS (~5-30 min).

### 5.3 Mettre à jour les variables après domaine custom

**Railway → Variables :**
```
NEXT_PUBLIC_APP_URL = https://votre-domaine.com
```

**Supabase → Authentication → URL Configuration :**
- Site URL : `https://votre-domaine.com`
- Redirect URLs : `https://votre-domaine.com/**`

---

## 6. Auto-déploiement GitHub → Railway

Railway redéploie automatiquement à chaque `git push` sur `main`.

```
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push origin main
# → Railway démarre automatiquement un nouveau build
```

**Branches :**
- `main` → Production (auto-deploy activé par défaut)
- Autres branches → Pas de déploiement automatique

---

## 7. Variables d'environnement — Référence complète

| Variable | Requis | Côté | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Oui | Client + Serveur | URL projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Oui | Client + Serveur | Clé publique anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Oui | Serveur only | Clé service role (routes API) |
| `NEXT_PUBLIC_APP_URL` | Oui | Client + Serveur | URL complète de l'app |
| `RESEND_API_KEY` | Non | Serveur only | Envoi emails invitation |
| `RESEND_FROM_EMAIL` | Non | Serveur only | Adresse expéditeur |
| `NODE_ENV` | Oui | Serveur | `production` sur Railway |
| `PORT` | Auto | Railway | Injecté automatiquement |

---

## 8. Checklist avant lancement public

### Technique
- [ ] `npm run build` passe sans erreurs localement
- [ ] Build Railway réussi (Railway → Deployments → vert)
- [ ] URL Railway accessible dans le navigateur
- [ ] HTTPS actif (cadenas dans la barre d'adresse)

### Supabase
- [ ] `schema.sql` exécuté avec succès
- [ ] `storage.sql` exécuté avec succès
- [ ] Site URL configuré avec l'URL de production
- [ ] Redirect URLs configurés
- [ ] 3 buckets créés : `photos`, `reports`, `avatars`

### Fonctionnel
- [ ] `/login` → connexion fonctionne
- [ ] `/register` → création compte fonctionne
- [ ] Email de confirmation reçu (si activé dans Supabase)
- [ ] Tableau de bord accessible après connexion
- [ ] Création d'un projet
- [ ] Upload d'une photo
- [ ] Dessin d'une mesure
- [ ] Génération d'un rapport PDF
- [ ] Invitation d'un client (email si Resend configuré)
- [ ] Portail client `/client-portal/[token]` accessible sans login

---

## 9. Troubleshooting

### Build échoue — "Error: Cannot find module"
```bash
# Localement :
rm -rf node_modules .next
npm install
npm run build
```
Si ça passe localement → Railway relit le package.json au prochain push.

### "Invalid Supabase credentials" au démarrage
Vérifiez dans Railway → Variables que `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont correctes. Les variables `NEXT_PUBLIC_*` doivent être présentes au moment du **build** (pas seulement au runtime).

### Redirect loop sur /dashboard
→ Supabase Redirect URLs non configuré avec l'URL Railway.
→ Ajoutez `https://votre-app.up.railway.app/**` dans Supabase → Auth → URL Config.

### Photos ne s'affichent pas
→ Le bucket `photos` est privé. L'app génère des URLs signées.
→ Vérifiez que `supabase/storage.sql` a été exécuté.

### PDF timeout
→ Railway donne 5 min par défaut pour les requêtes HTTP.
→ La génération PDF devrait prendre < 30s. Si ce n'est pas le cas, vérifiez la taille des photos incluses.

### "Application failed to respond" sur Railway
→ Next.js n'écoute pas sur le bon port.
→ Railway injecte `PORT` automatiquement. `next start` le lit. Vérifiez que `npm run start` = `next start` dans package.json.

### Variables NEXT_PUBLIC_ vides en production
→ Ces variables sont injectées **au moment du build** (pas au runtime).
→ Si vous les ajoutez après le build, redéployez : Railway → Deployments → Redeploy.

---

## 10. Commandes utiles

```bash
# Vérifier TypeScript avant push
npx tsc --noEmit

# Build production local
npm run build && npm run start

# Voir les logs Railway (via CLI)
railway logs

# Déployer manuellement via CLI Railway
npm install -g @railway/cli
railway login
railway up
```

---

## 11. Architecture de déploiement

```
┌─────────────────────────────────────────────────────────────┐
│                         GitHub                               │
│  repo: measura (private)                                     │
│  branch main → auto-deploy vers Railway                      │
└───────────────────────┬─────────────────────────────────────┘
                        │ push
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Railway                                   │
│  Service: measura-production                                 │
│  Build: Nixpacks (détection Next.js auto)                    │
│  ├── npm install                                             │
│  ├── npm run build                                           │
│  └── npm run start   (PORT=xxxx injecté auto)                │
│  URL: https://measura-production.up.railway.app              │
└───────────────────────┬─────────────────────────────────────┘
                        │ API calls
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase                                  │
│  ├── PostgreSQL (18 tables + RLS)                            │
│  ├── Auth (email/password)                                   │
│  └── Storage (photos / reports / avatars)                    │
└─────────────────────────────────────────────────────────────┘
```
