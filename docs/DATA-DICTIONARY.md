# DATA-DICTIONARY.md — Dictionnaire des données

> Référence normative : INFOSPRO-SPEC.md §06. Ce document décrit chaque table, chaque
> colonne et chaque énumération de la base INFOSPRO.NET. Les adaptations SQLite de
> développement sont documentées dans docs/DECISIONS.md (D-01) et signalées ci-dessous.
> **Noms contractuels :** les noms de tables et colonnes en base sont exactement ceux
> du §06 (les modèles Prisma utilisent `@map`/`@@map` pour garantir cette correspondance).

## Conventions (§06.1)

| Convention | Valeur |
|---|---|
| Identifiants | UUID v7 (`id`) — générés côté application, `@default(uuid(7))` (D-05) |
| Horodatages | `timestamptz` UTC, `created_at` + `updated_at` sur les tables de contenu |
| Suppression logique | `deleted_at timestamptz null` — toute lecture filtre `deleted_at IS NULL` |
| Nommage | `snake_case`, tables au pluriel |
| Intégrité | Contraintes déclarées en base (FK + actions `CASCADE`/`SET NULL`/`RESTRICT`) |
| Index partiels | Créés en SQL de migration (statut `published`, `deleted_at IS NULL`, `scheduled`) |
| Partitionnement | mensuel sur `ad_events`, `email_events`, `page_views` (production — `prisma/sql/postgres/03-partitions.sql`) |

## Énumérations (14)

| Enum | Valeurs |
|---|---|
| `article_status` | draft, in_review, changes_requested, approved, scheduled, published, updated, archived, unpublished |
| `article_format` | brief, standard, analysis, investigation, interview, opinion, portrait, live, video, infographic, factcheck, press_review, longform |
| `article_visibility` | public, unlisted, restricted |
| `media_type` | image, video, audio, document |
| `geo_type` | continent, country, region, city |
| `entity_type` | person, organization, place |
| `user_status` | active, invited, suspended, disabled |
| `comment_status` | pending, approved, rejected, spam |
| `campaign_status` | draft, scheduled, running, paused, completed, cancelled |
| `creative_type` | image, html5, video, native, third_party_script |
| `subscriber_status` | pending, confirmed, unsubscribed, bounced, complained |
| `email_campaign_status` | draft, scheduled, sending, sent, failed, cancelled |
| `keyword_trend` | spiking, rising, stable, declining, seasonal |
| `live_status` | upcoming, live, ended |

## Tables — utilisateurs, rôles, sessions

### `users`
Comptes de la rédaction. `email` (citext → minuscules applicatives en dev), `password_hash`
(Argon2id), `slug` public d'auteur, `display_name`, `job_title`, `bio`,
`avatar_media_id` → media (SET NULL), `socials` (JSON `[{platform,url}]`),
`expertise` (liste), `phone`, `locale` (défaut `fr`), `status` (`user_status`),
`two_factor_secret` (TOTP base32, renseigné à la configuration),
`two_factor_enabled` (actif après vérification d'un premier code),
`failed_attempts` + `locked_until` (verrouillage 5 échecs / 15 min, §08.3),
`last_login_at`, `is_author_public`, horodatages, `deleted_at`.
Index : `idx_users_slug` + index partiel sur `slug` hors corbeille.

### `roles`
Rôles (systèmes ou personnalisés). `key` unique (`admin`, `publisher`…), `label`,
`description`, `permissions` (liste — matrice §08.2 pour les rôles système), `is_system`.

### `user_roles`
Attribution des rôles. PK (`user_id`, `role_id`), `category_ids` (restriction optionnelle
du rôle à des rubriques — `null` = non restreint, §08.2 section_editor),
`granted_at`, `granted_by` → users.

### `sessions`
Sessions serveur opaques (§08.3). `token_hash` unique (SHA-256 du jeton, le jeton brut
n'est stocké nulle part), `ip_hash` (sel AUTH_SECRET — IP jamais en clair, §17.3),
`user_agent`, `expires_at` (glissant 8 h, plafond 30 j « se souvenir »).

### `user_backup_codes` — **table additive (D-04)**
Codes de secours 2FA à usage unique (§08.3). `code_hash` (Argon2id), `used_at`.

## Tables — médias

### `media`
`type` (`media_type`), `storage_key`, `url`, `mime_type`, `file_size`,
`width`/`height`/`duration_sec`, `blurhash`, `checksum` (doublons), `title`,
`alt_text` (obligatoire pour les images — contrôle applicatif), `caption`,
`credit` (obligatoire, bloque la publication), `license`, `shot_at`, `location`,
`focal_point` (JSON, défaut centre), `crops` (JSON par ratio), `variants` (JSON — 6
largeurs AVIF/WebP en production), `provider`/`provider_id` (mux…), `transcript`
(indexable, a11y), `captions` (JSON `[{lang,url}]`), `uploaded_by` → users.

## Tables — taxonomies

### `categories`
Arbre à 3 niveaux max : `parent_id` (RESTRICT), `slug` (unique par parent), `name`,
`short_name`, `description`, `intro_html` (SEO rubrique), `color_accent`, `cover_media_id`,
`icon`, `position`, `depth`, `is_visible`, `show_in_nav`, `seo` (JSON),
`article_count` (dénormalisé — trigger en production, couche service en dev).

### `tags`
`slug` unique, `name`, `description`, `intro_html`, `synonyms`, `is_featured`,
`usage_count`, `seo`. Index trigramme `name` en production.

### `dossiers`
`slug`, `title`, `lede`, `description`, `cover_media_id`, `is_active`, `is_featured`,
`started_at`, `ended_at`, `seo`.

### `geo_zones`
Arbre continent → pays → région → ville : `type` (`geo_type`), `slug` unique par parent,
`name`, `iso_code`, `latitude`/`longitude`, `position`, `is_visible`.

### `entities`
Fiches personnes/organisations/lieux : `type`, `slug`, `name`, `aliases`, `description`,
`role_title`, `image_media_id`, `wikidata_id`, `official_url`.

## Tables — articles (cœur éditorial)

### `articles`
- **Identité** : `slug` (unique par `locale`), `locale`, `translation_of_id` (lien
  entre versions linguistiques).
- **Contenu** : `kicker` (surtitre), `title`, `short_title` (une), `seo_title`, `lede`
  (chapô), `body` (**tableau JSON de blocs §06.4** — jamais de HTML brut),
  `plain_text` (généré), `word_count`, `reading_time_min` (ceil(words/220)).
- **Classement** : `format` (`article_format`), `status` (`article_status`),
  `visibility`, `importance` (1–5), `is_sponsored`, `sponsor_name`, `is_breaking`,
  `category_id` (RESTRICT, obligatoire), `dossier_id`, `live_blog_id`.
- **Médias** : `cover_media_id`, `social_image_id`.
- **Datation** : `dateline`, `source_agency`, `published_at`, `scheduled_at`,
  `expires_at`, `updated_content_at` (mise à jour éditoriale réelle).
- **SEO** : `meta_title`, `meta_description`, `canonical_url`, `robots_directives`,
  `focus_keyword`, `seo_score` (0–100), `seo_checks` (JSON — détail des contrôles §12.7).
- **Diffusion** : `send_push`, `include_newsletter`, `social_text`.
- **Traçabilité** : `created_by`, `published_by`, `correction_note`, `sources` (JSON).
- **Mesure** : `view_count`, `share_count`.
- **Recherche** : `search_vector` (tsvector en production — trigger §06.2 ; inutilisé
  en dev, D-01).
- Index partiels normatifs : `idx_articles_published`, `idx_articles_category`,
  `idx_articles_scheduled` (+ GIN `search_vector` et `body` en production).

### Tables de liaison n-n
`article_authors` (PK article+user+`role` : author|coauthor|photographer|translator|editor,
`position`) · `article_tags` · `article_categories` (rubriques secondaires) ·
`article_geo_zones` · `article_entities` (+ `relevance`) · `article_related`
(`position`, `is_manual` — manuels d'abord).

### `article_versions`
Historique complet : `version`, `snapshot` (copie JSON de l'article), `change_note`,
`created_by`. Unique (article, version).

### `review_comments`
Commentaires de relecture ancrés : `block_id` (ancre sur un bloc), `text`, `resolved`,
`created_by`.

### `article_locks`
Verrou d'édition : PK `article_id`, `user_id`, `locked_at`, `expires_at`
(5 min, renouvelé par heartbeat).

## Tables — modules éditoriaux

### `featured_slots`
Composition de la une : `zone` (`home_lead`, `home_secondary`, `category:<id>`),
`article_id`, `position` (unique par zone), `pinned`, `starts_at`/`ends_at`,
`override_title`, `override_media_id`, `created_by`.

### `flash_news`
`text`, `article_id` (lien optionnel), `external_url`, `priority` (1 urgent rouge → 3
normal), `published_at`, `expires_at` (défaut applicatif now + 12 h, §06.2),
`created_by`, `deleted_at`. Index partiel `idx_flash_active`.

### `live_blogs` / `live_entries`
Direct : `slug`, `title`, `summary` (« l'essentiel », JSON), `status` (`live_status`),
`category_id`, `cover_media_id`, `started_at`/`ended_at`, `entry_count`, `seo`.
Entrées : `title`, `body` (blocs), `is_pinned`, `is_key`, `published_at`, `created_by`.

### `weather_cities` / `weather_cache`
Villes (§21.3) : `name`, `country_code`, coordonnées, `is_default`, `is_visible`.
Cache serveur 15 min : `payload` (JSON), `fetched_at`.

## Tables — pages, menus, accueil, réglages

| Table | Colonnes clés |
|---|---|
| `pages` | `slug`, `locale`, `title`, `body` (blocs), `template` (default\|contact\|about\|advertising\|legal), `is_published`, `seo`, `updated_by` — unique (locale, slug) |
| `menus` | `key` (main, secondary, footer_1..4, mobile, utility), `label` |
| `menu_items` | `menu_id`, `parent_id` (arbre), `label`, `target_type` (category\|page\|dossier\|tag\|url\|home\|section), `target_id`, `target_url`, `icon`, `open_new_tab`, `highlight` (CTA rouge), `position`, `is_visible`, `locale` |
| `homepage_blocks` | `code` (Z-03…), `type` (alert\|flash\|lead\|live\|latest\|section\|video\|newsletter\|weather\|dossier\|world\|opinion\|ad\|most_read\|custom_html), `variant`, `title`, `subtitle`, `source_type`, `source_id`, `manual_article_ids`, `item_count`, `settings` (JSON), `position`, `is_active`, `starts_at`/`ends_at`, `locale`, `updated_by` — unique (code, locale) |
| `homepage_layouts` | versions sauvegardées : `name`, `snapshot` (JSON), `is_current`, `created_by` |
| `settings` | PK `key`, `value` (JSON), `group_key` (identity\|contact\|social\|editorial\|seo\|ads\|email\|features\|legal), `label`, `updated_by` |
| `translations` | PK (`key`, `locale`), `value`, `context` — tous les libellés d'interface |
| `site_banners` | `message`, `link_url`, `link_label`, `style` (alert\|info\|promo), `is_dismissible`, `target_paths`, période, `is_active` |
| `redirects` | `source_path` unique, `target_path`, `status_code` (301…), `hit_count`, `is_auto` |
| `not_found_log` | PK `path`, `hit_count`, `referrer`, `last_seen` |

## Tables — commentaires et messages

| Table | Colonnes clés |
|---|---|
| `comments` | `article_id`, `parent_id` (fils), `author_name`, `author_email`, `body`, `status` (`comment_status`, défaut pending = modération a priori §24-7), `is_staff`, `ip_hash`, `moderated_by`, `moderated_at` |
| `inbox_messages` | `kind` (contact\|tip\|right_of_reply\|advertising\|correction\|job), `department`, `name`, `email`, `phone`, `subject`, `body`, `attachments` (JSON), `is_anonymous` (alerte info — pas d'IP journalisée §15.4), `status` (new\|read\|assigned\|closed\|spam), `assigned_to` |

### `audit_log` — `bigserial` (Int en dev, D-01)
`user_id`, `action` (`article.publish`, `auth.login`, `settings.update`…),
`resource_type`, `resource_id`, `before`/`after` (JSON), `ip_hash`, `user_agent`,
`created_at`. Index `idx_audit_resource` et `idx_audit_user`.

## Tables — régie publicitaire (§06.3)

| Table | Colonnes clés |
|---|---|
| `ad_slots` | PK `code` (AD-01…AD-19), `name`, `description`, `placement`, `sizes` (JSON par breakpoint), `pages`, `is_active`, `max_creative_kb`, `allows_third_party`, `refresh_sec`, `max_refresh`, `base_cpm`, `position` |
| `advertisers` | `name`, `agency`, `sector` (exclusions concurrentielles), contacts, `address`, `notes`, `report_token` unique (accès lecture) |
| `ad_campaigns` | `advertiser_id` (RESTRICT), `name`, `status` (`campaign_status`), période, `goal_type`/`goal_value`, `budget`, `currency` (GNF), `priority` (1 garanti → 9 remplissage), `weight` (rotation), `frequency_cap`, `targeting` (JSON — voir §06.3), `created_by` |
| `ad_creatives` | `campaign_id` (CASCADE), `slot_code` → `ad_slots.code`, `type` (`creative_type`), `media_id`, `html`, `script_tag`, champs natifs (`native_title/text/cta/brand`), `click_url`, `alt_text`, dimensions, `weight`, `is_active` |
| `ad_events` | **partitionnée (prod)** — `creative_id`, `campaign_id`, `slot_code`, `event_type` (impression\|viewable\|click), `page_path`, `country`, `device`, `visitor_hash`, `occurred_at` |
| `ad_daily_stats` | agrégat horaire — PK (date, campaign, creative, slot), `impressions`, `viewable`, `clicks` |

## Tables — newsletter (§06.3)

| Table | Colonnes clés |
|---|---|
| `newsletter_lists` | `key` (morning\|breaking\|weekly\|economy\|diaspora), `name`, `description`, `cadence`, `send_time` ("HH:MM" GMT), `is_active`, `is_public`, `auto_compose`, `template_key`, `position` |
| `subscribers` | `email` unique, `first_name`, `country`, `locale`, `interests`, `status` (`subscriber_status` — double opt-in), `confirm_token`, `unsubscribe_token` unique, `source`/`source_url`, consentement (`consent_at`, `consent_ip_hash`), engagement (`last_open_at`, `last_click_at`, `engagement_score`), `bounce_count` |
| `subscriber_lists` | PK (subscriber, list), `subscribed_at` |
| `email_campaigns` | `list_id`, `subject` (+`subject_b` A/B), `preheader`, `blocks` (JSON), `html_cache`/`text_cache`, `segment` (JSON), `status` (`email_campaign_status`), `scheduled_at`, `sent_at`, `recipients_count`, `sponsor_creative_id`, `created_by` |
| `email_events` | **partitionnée (prod)** — `campaign_id`, `subscriber_id`, `event_type` (sent\|delivered\|open\|click\|bounce\|complaint\|unsubscribe), `link_url`, `occurred_at` |

## Tables — SEO (§06.3)

| Table | Colonnes clés |
|---|---|
| `seo_keywords` | `term`, `term_normalized` (minuscules sans accents), `locale`, `country` (GN), `word_count`, `tail_type` (short\|medium\|long), `intent`, `cluster_id`, `is_tracked` — unique (term, locale, country) |
| `keyword_metrics` | PK (keyword, source, collected_at) — `search_volume`, `volume_weighted` (coefficient régional §12.5), `difficulty`, `cpc`, `trend` (`keyword_trend`), `trend_series` (12 mois), `serp_features` |
| `keyword_clusters` | `label`, `centroid` (embedding), `coverage` (none\|partial\|covered\|cannibalized) |
| `article_keywords` | PK (article, keyword) — `role` (focus\|secondary\|longtail\|question), `opportunity_score`, `was_suggested`, `was_accepted` |
| `seo_rankings` | PK (keyword, date) — `position`, `impressions`, `clicks`, `ctr`, `url` |
| `seo_provider_usage` | PK date — `provider`, `calls`, `estimated_cost` (maîtrise des coûts §12.4) |

## Tables — analytics interne (§06.3)

| Table | Colonnes clés |
|---|---|
| `page_views` | **partitionnée (prod)** — `path`, `article_id`, `referrer_host`, `country`, `device`, `visitor_hash`, `scroll_depth`, `dwell_sec`, `occurred_at` |
| `article_daily_stats` | PK (date, article) — `views`, `uniques`, `avg_dwell`, `completion_rate`, `shares`, `newsletter_signups` |
| `search_queries` | `query`, `results_count`, `clicked_article_id`, `occurred_at` (requêtes sans résultats = idées éditoriales §12.8) |
| `push_subscriptions` | `endpoint` unique, `keys` (JSON VAPID), `topics`, `locale`, `last_sent_at` |

## Script SQL de production

| Fichier | Contenu |
|---|---|
| `prisma/sql/postgres/01-extensions.sql` | `pgcrypto`, `pg_trgm`, `unaccent`, `citext` |
| `prisma/sql/postgres/02-triggers.sql` | `articles_search_trigger` (pondération A/B/C), `set_updated_at`, `categories_article_count`, index GIN `search_vector`/`body`/média/`tags_trgm` |
| `prisma/sql/postgres/03-partitions.sql` | `PARTITION BY RANGE` sur `ad_events`/`email_events`/`page_views` + `create_monthly_partition()` (cron §07.3) |
