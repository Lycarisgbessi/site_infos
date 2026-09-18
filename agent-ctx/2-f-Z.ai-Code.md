# Task ID: 2-f — Onglet Redirections dans /admin/pages + API /api/admin/redirects

Agent: Z.ai Code
Date: 2026-09-17
Statut: ✅ Terminé et vérifié

## Fichiers livrés

| Fichier | Action |
|---|---|
| `src/app/api/admin/redirects/route.ts` | Créé — GET/POST/PATCH/DELETE, permission `redirect.manage` |
| `src/components/admin/pages/PagesClient.tsx` | Modifié — 3ᵉ onglet « Redirections » (conventions Bannières respectées) |

Aucun autre fichier touché (schéma Prisma, nav.ts, page serveur /admin/pages intacts). Le dossier vide `src/app/api/admin/redirects/[id]/` existait avant la tâche (sans route.ts) — laissé tel quel.

## API `/api/admin/redirects` (runtime nodejs, ordre §07.2 : session → Zod → permission)

- **GET** : `q` (source OU cible, contains — sensible à la casse sur SQLite, limite D-01), `page`/`per_page` (défaut 1/50, max 200), orderBy `created_at desc`, `apiOk(items, {page, per_page, total})`.
- **POST** : Zod `{source_path, target_path, status_code: 301|302 (défaut 301)}` ; normalisation trim + `/` initial ; `source === target` → 422 ; source existante → 409 `CONFLICT` « Une redirection existe déjà pour ce chemin. » (findUnique + filet P2002) ; audit `redirect.create` (after complet, `getRequestContext`).
- **PATCH** : Zod `{id, target_path?, status_code?}` — **pas de champ `is_active`** (le modèle Redirect n'en a pas : pas de soft-disable, désactivation non émulée, champ non proposé du tout) ; aucun champ → 422 « Aucune modification fournie. » ; introuvable → 422 (convention maison, comme `structure.ts`) ; `target === source_path` → 422 (garde anti-boucle, extension prudente documentée) ; PATCH autorisé sur `is_auto` (correction de cible légitime) ; audit `redirect.update` before/after.
- **DELETE** : `?id=` obligatoire ; `is_auto: true` → **403** `AUTO_REDIRECT` « Redirection automatique : renommez la source ou contactez un administrateur. » ; audit `redirect.delete` (before = instantané complet).
- Toutes les routes : `requireApiSession` + `requirePermission(session.user, "redirect.manage")` + try/catch `toErrorResponse` + `export const runtime = "nodejs"`.

## UI — onglet Redirections (PagesClient.tsx, +593 lignes)

- `TabsTrigger value="redirects"` après Bannières ; chargement paresseux au 1er rendu de l'onglet (ref `redirectsRequested`, même pattern que Bannières).
- Liste `ul divide-y` : source → cible (font-mono, ArrowRight), « créée le » (Intl fr-FR), badge code (301 « Permanente » vert success, 302 « Temporaire » ambre warning), badge « Auto » (title explicatif) si is_auto, badge « N utilisations » si hit_count > 0, actions : modifier toujours, supprimer **uniquement si !is_auto** (bouton absent, pas juste désactivé).
- Recherche serveur (debounce 250 ms, reset page 1, bouton « Effacer la recherche » à l'état vide), pagination Précédent/Suivant + compteur aria-live (« N redirections » / « N résultats » · « page X / Y »), `per_page=50`, conteneur `max-h-[60vh] overflow-y-auto`.
- Dialog création/édition (max-h-[85vh], sm:max-w-lg) : source + cible (font-mono) avec **aperçu live normalisé** (« Aperçu : /chemin »), select 301 — Permanente / 302 — Temporaire ; en édition la source est `disabled` (non modifiable par contrat — PATCH ne l'accepte pas) avec texte d'aide ; validations client : champs requis, source ≠ cible (toast destructif) ; toasts « Redirection créée. » / « Redirection enregistrée. » / « Redirection supprimée. ».
- AlertDialog de suppression identique aux pages/bannières (texte source → cible, action rouge, spinner).
- États : skeletons (`ListSkeleton` réutilisé), erreur avec Réessayer (`LoadErrorCard` réutilisés), vide (ArrowRightLeft + CTA) / aucun résultat (Effacer la recherche).
- Jetons §05.1 uniquement (success/warning/danger/red-wash/paper-alt/rule/ink-faint — aucun bleu/indigo), UI 100 % française, aria-labels sur tous les contrôles, TypeScript strict sans any.

## Vérification

- `bunx tsc --noEmit` → **0 erreur** (projet entier) ; `bunx eslint src/components/admin/pages src/app/api/admin/redirects` → **0 erreur**.
- **curl** (session admin via flux login→MFA complet, code TOTP calculé depuis le secret en base avec la config otplib v13 de l'app, bucket rate-limit dédié via X-Forwarded-For) :
  - POST `/ancienne-page`→`/nouvelle-page` 301 (sans `/`, normalisé) → **200** `{data:{...is_auto:false}}` ;
  - POST doublon → **409** message contractuel exact ; POST source=cible (après normalisation) → **422** ; sans session → **401** ;
  - GET liste → **200** `{data, meta:{page,per_page,total}}` ; `?q=nouvelle` → 1 résultat (filtre cible) ;
  - PATCH cible+code → **200** ; PATCH cible=source → 422 ; PATCH sans champ → 422 ; PATCH id inconnu → 422 ;
  - DELETE d'une is_auto (fixture temporaire `is_auto:true` créée en base pour le test, récupérée via GET) → **403** message contractuel exact ; PATCH sur is_auto → 200 (décision documentée) ;
  - DELETE de la redirection manuelle de test → **200** `{ok:true}` ;
  - audit_log alimenté : `redirect.create` ×1, `redirect.update` ×2, `redirect.delete` ×1 avec before/after JSON, ip_hash, user_agent.
- **E2E navigateur** (agent-browser, session injectée) : 3 onglets rendus, onglet Redirections chargé à l'ouverture, badge Auto sans bouton supprimer sur is_auto, dialog création (bouton désactivé à vide, aperçu live « Aperçu : /ui-test-2f »), création → ligne affichée, édition → cible mise à jour, recherche q filtre côté serveur + compteur, effacement → liste complète, suppression via AlertDialog → ligne retirée, 0 erreur console.
- dev.log : toutes les requêtes `/api/admin/redirects` en 200, aucune erreur sur mes routes.

## Nettoyage

- Redirections de test supprimées (manuelle via API, fixture is_auto directement en base — non supprimable via l'API par conception) → table `redirects` rendue à son état initial (vide, le seed n'en crée pas).
- Session admin de test supprimée en base ; cookie local purgé ; fichiers temporaires supprimés.
- Entrées audit de test **conservées** (trace honnête, pratique des tâches 2-c/2-d).

## Points d'environnement

- Le serveur dev tournait déjà (`next dev -p 3000`) — non relancé, base intacte (pas de reset/re-seed nécessaire).
- Quirk agent-browser (non lié au code) : `fill` avec chaîne vide ne déclenche pas le onChange React ; validé autrement via native setter + event `input` (mécanisme standard React) — la saisie clavier réelle passe par les mêmes événements.
