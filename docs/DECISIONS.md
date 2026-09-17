# DECISIONS.md — Journal des choix techniques

> Conformément à la règle 4 du mode de travail et au §09 de la spécification :
> chaque choix technique est consigné ici avec sa justification.
> Les entrées sont datées et numérotées. Rien n'est supprimé — les revocations sont marquées.

---

## D-01 — Base de données : SQLite en développement, PostgreSQL en production

**Date :** 2026-09-17 · **Phase :** 1 · **Statut :** actif

La spécification (§02.1) impose PostgreSQL 16+. L'environnement d'exécution du développement
ne dispose d'aucun serveur PostgreSQL (ni binaire local, ni Docker). Le client n'a pas encore
fourni d'URL hébergée (Neon/Supabase) — infos promises « après » (échange du 2026-09-17).

**Décision :**
- Développement : SQLite via Prisma, avec schéma fidèle au contractuel (mêmes tables, mêmes
  colonnes, mêmes noms).
- Production : PostgreSQL, provider `postgresql` dans `datasource`, migrations régénérées.

**Adaptations SQLite documentées** (toutes réversibles dès l'arrivée de l'URL PostgreSQL) :

| Élément normatif (§06) | Adaptation SQLite | Retour PostgreSQL |
|---|---|---|
| `jsonb` | Colonne `String` contenant du JSON sérialisé, validé par Zod aux frontières | `Json` natif |
| `text[]` (permissions, expertise, synonyms, pages, serp_features, interests, topics, target_paths, category_ids, manual_article_ids) | `String` JSON sérialisé, accès via helpers typés | `String[]` natif |
| `citext` | `String` + normalisation en minuscules côté application | `citext` + extension |
| `tsvector` + GIN (`search_vector`) | Colonne conservée (`String?`, inutilisée en dev) ; recherche par `LIKE` insensible à la casse + normalisation accents applicative | Trigger `articles_search_trigger` + index GIN (DDL prêt dans `prisma/sql/postgres/`) |
| Index partiels (`WHERE deleted_at IS NULL`, `WHERE status='published'`) | Créés en SQL brut dans la migration (SQLite les supporte) | Identiques |
| `PARTITION BY RANGE` (ad_events, email_events, page_views) | Tables non partitionnées en dev | DDL complet dans `prisma/sql/postgres/03-partitions.sql` |
| `bigserial` | `Int @default(autoincrement())` | `bigserial` |
| `numeric` / `Decimal` | `Float` (Prisma SQLite ne supporte pas Decimal) — montants GNF entiers non affectés | `Decimal` |
| Extensions `pgcrypto`, `pg_trgm`, `unaccent` | Non applicables en dev | Script `prisma/sql/postgres/01-extensions.sql` |
| Triggers plpgsql (`search_vector`, `article_count`, `updated_at`) | `@updatedAt` Prisma ; compteurs dénormalisés maintenus par la couche service (transaction) | Triggers SQL (script `prisma/sql/postgres/02-triggers.sql`) |

---

## D-02 — Next.js 16 au lieu de 15.x

**Date :** 2026-09-17 · **Phase :** 1 · **Statut :** actif

L'environnement d'exécution est fixé sur Next.js 16.1.1 (App Router, RSC, ISR : sémantique
identique à 15.x pour tout ce que la spécification exige). La version imposée par la
spécification (15.x) est satisfaite en superset. React 19, TypeScript 5 strict : conformes.

---

## D-03 — Authentification : couche de session opaque custom au lieu d'Auth.js v5

**Date :** 2026-09-17 · **Phase :** 1 · **Statut :** actif

La spécification demande Auth.js v5 + Credentials + TOTP, mais §06.2 définit une table
`sessions` (token_hash, ip_hash, user_agent, expires_at) et §08.3 des sessions serveur
(8 h d'inactivité, 30 j absolus, révocation, liste des sessions). Le provider Credentials
de NextAuth impose des sessions JWT et **ne peut pas** alimenter une table de sessions :
le modèle normatif est incompatible avec NextAuth.

**Décision :** implémentation de la couche d'authentification exactement selon §08.3/§06.2 :
- Argon2id (`@node-rs/argon2`), politique 12 caractères, vérification HIBP k-anonymat ;
- TOTP (`otplib`) avec QR et 10 codes de secours hachés (table additive
  `user_backup_codes`, see D-04) ;
- Sessions opaques en base (SHA-256 du token), cookie `httpOnly`/`secure`/`sameSite=lax`,
  expiration glissante 8 h plafonnée à 30 jours avec « se souvenir de moi » ;
- Verrouillage 5 échecs / 15 minutes ;
- `requireSession()` / `requirePermission()` dans `lib/permissions.ts` comme prévu au §20.

NextAuth (v4, présent dans le projet) n'est pas utilisé pour ce flux.

---

## D-04 — Tables additives hors §06 : `user_backup_codes`

**Date :** 2026-09-17 · **Phase :** 1 · **Statut :** actif

Le §08.3 exige des « codes de secours à usage unique générés à l'activation » de la 2FA,
mais le schéma §06.2 n'a aucune colonne/table pour les stocker. Ajout d'une table
`user_backup_codes` (id, user_id, code_hash, used_at, created_at) — **additive**, aucun nom
contractuel modifié.

---

## D-05 — UUID v7 générés côté application

**Date :** 2026-09-17 · **Phase :** 1 · **Statut :** actif

Contradiction interne de la spécification : §06.1 impose UUID v7 (triables), le DDL §06.2
utilise `gen_random_uuid()` (v4 en PostgreSQL ≤ 17). **Décision :** `@default(uuid(7))`
Prisma (génération v7 côté application), défaut SQL conservé comme filet. Tri chronologique
garanti conformément à §06.1.

---

## D-06 — Dépôt mono-application (bun) au lieu du monorepo pnpm §03

**Date :** 2026-09-17 · **Phase :** 1 · **Statut :** actif

L'environnement impose une application Next.js unique à la racine, gérée par bun, avec un
seul port exposé. L'arborescence `apps/web/` + `pnpm-workspace.yaml` de §03 est adaptée :
la racine du dépôt **est** l'équivalent de `apps/web/` (`src/`, `prisma/`, `docs/`,
`.env.example`, `README.md` à la racine). Aucun nom de répertoire normatif sous `src/` n'est
modifié (`components/ui|public|admin|editor|blocks|ads`, `lib`, `server`, `schemas`,
`types`, `styles`, `middleware.ts`). Les scripts §22 sont fournis via bun (`bun run …`) ;
`db:seed` exécute `bun prisma/seed.ts` (tsx remplacé par le runner TS natif de bun).

---

## D-07 — Server Actions remplacées par des Route Handlers `/api/admin/*`

**Date :** 2026-09-17 · **Phase :** 1 · **Statut :** actif

L'environnement d'exécution impose « API au lieu de Server Actions ». Le modèle obligatoire
du §07.2 (session → Zod → permission → audit → revalidateTag) est conservé à l'identique ;
seul le transport change : mutations du back-office exposées en `POST /api/admin/*`
authentifiées par cookie de session, enveloppe `{ data, meta }` homogène avec §07.1.
La couche `src/server/services/*` reste la frontière métier prévue au §03.

---

## D-08 — Zod 4 (au lieu de 3.x), Prisma 6, Framer Motion 12

**Date :** 2026-09-17 · **Phase :** 1 · **Statut :** actif

L'environnement embarque Zod 4, Prisma 6.11 (spécification : « 5.x+ »), Framer Motion 12
(spécification : « 11.x+ »). API compatibles pour les usages de la spécification.

---

## D-09 — Tailwind 4 « CSS-first » : jetons dans `styles/tokens.css`, config JS minimale

**Date :** 2026-09-17 · **Phase :** 1 · **Statut :** actif

Tailwind 4 configure le thème en CSS (`@theme`). Les jetons normatifs du §05.1 sont écrits
dans `src/styles/tokens.css` (noms exacts) ; `globals.css` mappe les variables shadcn/ui
sur ces jetons afin que les primitives existantes respectent l'identité §00.4
(filets fins, radius 2–4 px, rouge en signal). `tailwind.config.ts` reste présent (§03)
pour les content globs et darkMode ; le theming vit en CSS — c'est la voie native v4.

---

## D-10 — Replis mémoire explicites pour services externes non fournis

**Date :** 2026-09-17 · **Phase :** 1 · **Statut :** actif

Upstash Redis, Meilisearch, S3/R2, Resend, Mux… ne sont pas encore provisionnés (client :
infos « après »). Les libs correspondantes sont de **vraies intégrations** pilotées par
variables d'environnement ; quand une clé manque, le repli est explicite, journalisé au
démarrage, et ne produit **jamais** de fausses données en base :
- `lib/redis.ts` → cache/limites en mémoire process (mono-instance dev uniquement),
- HIBP → échec ouvert (fail-open) avec avertissement journalisé si l'API est injoignable,
- Meilisearch (P3) → recherche FTS locale, conformément au « Repli : PostgreSQL FTS » du §02.1.

Chaque repli est activable/désactivable par variable d'env dès que les clés arrivent.

---

## D-11 — Spécificités Next.js 16 constatées à l'implémentation

**Date :** 2026-09-17 · **Phase :** 1 · **Statut :** actif

Trois ajustements rendus nécessaires par Next.js 16 (voir D-02) :
1. **`revalidateTag(tag, "max")`** — l'API v16 exige un second argument (profil de cache) ;
   le profil `max` purge l'étiquette quelle que soit la fenêtre. Encapsulé dans
   `lib/cache.ts::invalidateTags()`.
2. **`middleware.ts`** — le nom de fichier est déprécié au profit de `proxy` dans
   Next 16 ; la spécification (§03) nomme contractuellement `src/middleware.ts`, qui
   reste pleinement fonctionnel. Migration vers `proxy.ts` le moment venu, sans
   changement de comportement (avertissement de dépréciation visible en dev).
3. **otplib v13** — l'API a changé (classe `TOTP` + plugins `crypto`/`base32` au lieu
   de l'objet `authenticator`) ; encapsulé dans `lib/auth/totp.ts` avec tolérance
   ±30 s (équivalent `window: 1` de v12).

---

## D-12 — Correctif `bigserial` : `Int` en développement, `BigInt` en production

**Date :** 2026-09-17 · **Phase :** 1 · **Statut :** actif

Sur SQLite, Prisma ne génère pas d'`AUTOINCREMENT` pour les colonnes `BigInt` —
l'insertion échouait (contrainte `id NOT NULL`) sur `audit_log`, `ad_events`,
`email_events`, `page_views` et `search_queries`. En développement, ces clés sont
donc `Int @default(autoincrement())` (SQLite stocke du 64 bits nativement ; aucun
risque de dépassement dans la pratique dev). En production PostgreSQL, le schéma
restaure `BigInt @default(autoincrement())` (= `bigserial`, contractuel §06.2).
Consigné dans chaque modèle et dans DATA-DICTIONARY.md.
