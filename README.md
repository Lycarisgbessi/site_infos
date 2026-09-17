# INFOSPRO.NET

Plateforme média numérique complète — site d'information, back-office éditorial, moteur
SEO, régie publicitaire, newsletter. Conakry, République de Guinée.

> **Spécification :** `INFOSPRO-SPEC.md` (document normatif, fait autorité).
> **Décisions techniques :** [`docs/DECISIONS.md`](docs/DECISIONS.md).
> **Dictionnaire des données :** [`docs/DATA-DICTIONARY.md`](docs/DATA-DICTIONARY.md).

## Stack

Next.js (App Router, RSC) · TypeScript strict · Tailwind CSS 4 · Prisma · Auth sessions
Argon2id + TOTP 2FA · Zod. Détail complet : spécification §02.

## Prérequis

- [Bun](https://bun.sh) ≥ 1.3 (runtime + gestionnaire de paquets)
- PostgreSQL 16+ **en production** (Neon / Supabase / Aurora Serverless v2).
  En développement local sans PostgreSQL : SQLite, voir `docs/DECISIONS.md` (D-01).

## Installation

```bash
bun install
cp .env.example .env          # renseigner les variables (§04 de la spécification)
bun run db:migrate            # crée le schéma + les index (migration initiale)
bun run db:seed               # rôles, rubriques, menus, réglages, slots pub, contenu de départ
bun run dev                   # http://localhost:3000
```

## Commandes

| Commande | Rôle |
|---|---|
| `bun run dev` | Serveur de développement |
| `bun run lint` | ESLint + `tsc --noEmit` |
| `bun run format` | Prettier |
| `bun run db:migrate` | Migration (dev, génère/applique) |
| `bun run db:migrate:deploy` | Migration (production) |
| `bun run db:seed` | Données de départ (§21) |
| `bun run db:seed:clean` | Supprime le contenu de démonstration (garde le référentiel) |
| `bun run db:studio` | Prisma Studio |

## Structure (§03 adaptée — voir D-06)

```
src/
├── app/            # (public) site · admin back-office · api/v1 · api/admin · api/cron
├── components/     # ui · public · admin · editor · blocks · ads
├── lib/            # db · auth · permissions · cache · redis · i18n · seo · ads …
├── server/         # services (métier) · repositories (accès données)
├── schemas/        # schémas Zod partagés
├── styles/         # globals.css · tokens.css (jetons §05)
├── types/
└── middleware.ts   # garde /admin, i18n
prisma/             # schema.prisma · migrations · seed.ts · sql/postgres (DDL production)
docs/               # DECISIONS · DATA-DICTIONARY · DEPLOYMENT · OPERATIONS · USER-MANUAL
```

## Comptes de départ (seed)

Le seed crée un compte administrateur et des comptes de test (rôles distincts).
Le mot de passe administrateur temporaire est affiché **une seule fois** à l'exécution du
seed ; la 2FA (TOTP) est activée à la première connexion, conformément au §08.3.

## Phases (§20)

1. **Socle technique** — en cours
2. Back-office éditorial
3. API publique et recherche
4. Front-office
5. Modules éditoriaux
6. SEO
7. Monétisation
8. Finition et lancement
