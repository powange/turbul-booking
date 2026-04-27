# Turbul Booking

Application de gestion d'attribution des caravanes pour l'**école de cirque Turbul** (Nîmes).

Stack : **Nuxt 4** · **PostgreSQL** · **Prisma** · **better-auth** · **Nuxt UI** · **Leaflet** · **WebSocket Nitro** · **Docker**.

## Fonctionnalités

- **Plan interactif** (Leaflet + OpenStreetMap) : caravanes positionnées et orientées sur une carte à l'échelle, dimensions configurables, drag & drop pour les déplacer.
- **Caravanes** : nombre de lits, capacité par lit (1, 2 ou 3 places), électricité on/off, soft-delete pour préserver l'historique.
- **Réservations** : multi-nuits, multi-occupants par lit, contrôle de capacité côté serveur, hôtes existants ou nouveaux.
- **Synchronisation temps réel** : toute modification (plan, lit, réservation) est diffusée par WebSocket à tous les clients connectés.
- **3 rôles** : ADMIN (tout), MANAGER (attribuer des lits), VIEWER (lecture seule).
- **Audit log** complet et page **Hôtes** avec historique de séjours (regroupement automatique des nuits consécutives).

## Prérequis

- Node.js 22+
- Docker & Docker Compose
- npm 11 (recommandé)

## Démarrage rapide — développement local

Deux options selon vos préférences.

### Option A — Node sur le poste, Postgres en Docker (HMR le plus rapide)

```bash
npm install
cp .env.example .env

# PostgreSQL seul (port 5432)
docker compose -f docker-compose.dev.yml up -d

npm run db:migrate
npm run dev
```

### Option B — Tout en Docker (zéro Node sur le poste)

```bash
# Lance PostgreSQL + Nuxt dev (HMR activé) dans des conteneurs
docker compose -f docker-compose.dev.yml --profile full up -d

# Suivre les logs (premier démarrage : compilation Nitro/Vite)
docker compose -f docker-compose.dev.yml --profile full logs -f app-dev
```

Le code source est bind-monté → toute modification d'un fichier Vue / TS déclenche le HMR Vite ou la recompilation Nitro côté serveur. `node_modules` reste isolé dans un volume Docker (pas de conflit binaire hôte ↔ Linux).

**Quand rebuilder l'image dev ?** Uniquement après modification du `package.json` :

```bash
docker compose -f docker-compose.dev.yml --profile full build app-dev
docker compose -f docker-compose.dev.yml --profile full up -d
```

---

L'application est accessible sur http://localhost:3000.

À la première visite, vous serez redirigé vers la page **/signup** pour créer le **compte administrateur initial**. Une fois ce compte créé, l'inscription publique est définitivement fermée — les comptes suivants doivent être créés par un administrateur depuis **/admin/users**.

## Déploiement en production (Docker)

Le `docker-compose.yml` contient deux services :

- `postgres` : PostgreSQL 17, volume persistant `postgres_data`
- `app` : Nuxt 4 buildé via le `Dockerfile` ; les migrations Prisma sont appliquées automatiquement au démarrage du conteneur

```bash
# 1. Renseigner les variables sensibles dans .env
cp .env.example .env

# Important : générer un BETTER_AUTH_SECRET aléatoire (64+ caractères)
# Exemple :
openssl rand -hex 48 | sed 's/^/BETTER_AUTH_SECRET=/' >> .env

# 2. Builder et lancer
docker compose up -d --build

# 3. Suivre les logs (vérifier que les migrations sont appliquées)
docker compose logs -f app
```

L'app est exposée sur le port `3000` par défaut. Pour la mettre derrière un reverse proxy (Caddy, Traefik, nginx), exposer ce port en interne uniquement et configurer le proxy pour HTTPS.

### Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `BETTER_AUTH_SECRET` | **Obligatoire en prod.** Clé de signature des sessions. | — |
| `BETTER_AUTH_URL` | URL publique de l'app. | `http://localhost:3000` |
| `NUXT_PUBLIC_APP_URL` | URL publique côté client. | `http://localhost:3000` |
| `DATABASE_URL` | URL Postgres. Auto-renseignée par docker-compose. | — |
| `NUXT_PUBLIC_MAP_DEFAULT_LAT/LNG/ZOOM` | Centrage initial du plan. | Nîmes / 19 |
| `POSTGRES_USER/PASSWORD/DB` | Identifiants de la base. | `turbul` / `turbul` / `turbul_booking` |
| `APP_PORT` | Port d'exposition de l'app. | `3000` |

### Mise à jour

```bash
git pull
docker compose up -d --build app    # rebuild + redéploiement à chaud
```

Les migrations Prisma sont appliquées automatiquement par le conteneur au démarrage (`npx prisma migrate deploy`).

## Scripts utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de dev avec HMR |
| `npm run build` | Build de production |
| `npm run start` | Démarre le serveur de production (`.output/server/index.mjs`) |
| `npm run typecheck` | Vérification TypeScript globale |
| `npm run lint` | Lint ESLint |
| `npm run db:migrate` | Crée et applique une migration Prisma (dev) |
| `npm run db:migrate:deploy` | Applique les migrations existantes (prod) |
| `npm run db:studio` | Ouvre Prisma Studio (GUI base de données) |

## Rôles

| Rôle | Permissions |
|------|-------------|
| **ADMIN** | Plan : ajouter/déplacer/supprimer caravanes et lits ; gestion des utilisateurs ; audit log |
| **MANAGER** | Attribuer/libérer des lits, gérer les hôtes |
| **VIEWER** | Lecture seule (plan, réservations, hôtes) |

## Structure du code

```
app/
  pages/                    Pages (auto-routées)
    admin/                  Pages réservées ADMIN (audit, users)
    bookings.vue            Grille des réservations
    guests.vue              Liste des hôtes + historique
    index.vue               Plan Leaflet
    login.vue / signup.vue
  components/               Composants Vue (Leaflet, modals, grille)
  composables/              useAuth, useCaravans, useBookings, useGuests, useUsers, useRealtime
  layouts/                  default (authentifié) + auth (login/signup)
  middleware/               auth.global.ts (connexion) + admin.ts (rôle)
  utils/                    geo (lat/lng), dates (FR)
  lib/                      authClient (better-auth Vue)

server/
  api/                      Endpoints REST Nitro
    auth/                   better-auth handler + signup-first
    caravans/  beds/        CRUD plan
    bookings/               Création multi-nuits transactionnelle
    guests/                 Search + détail historique
    users/                  Gestion utilisateurs admin
    audit-logs/             Filtrable + distinct values
  routes/_ws.ts             WebSocket realtime
  utils/                    db (Prisma), auth, session/role guards, audit, realtime, dateRange

shared/types.ts             Types partagés client/serveur
prisma/schema.prisma        Schéma de base
prisma/migrations/          Migrations Prisma
docker-compose.yml          Stack prod (Nuxt + Postgres)
docker-compose.dev.yml      Postgres pour le dev (+ app-dev avec --profile full)
Dockerfile                  Build multi-stage
```

## Sauvegardes

La base PostgreSQL persiste dans le volume `postgres_data`. Pour la sauvegarder :

```bash
docker exec turbul-postgres pg_dump -U turbul turbul_booking | gzip > backup-$(date +%F).sql.gz
```

Pour restaurer :

```bash
gunzip -c backup-2026-04-27.sql.gz | docker exec -i turbul-postgres psql -U turbul turbul_booking
```
