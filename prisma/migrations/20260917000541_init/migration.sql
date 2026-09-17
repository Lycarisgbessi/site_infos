-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "display_name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "job_title" TEXT,
    "bio" TEXT,
    "avatar_media_id" TEXT,
    "socials" TEXT NOT NULL DEFAULT '[]',
    "expertise" TEXT NOT NULL DEFAULT '[]',
    "phone" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "status" TEXT NOT NULL DEFAULT 'invited',
    "two_factor_secret" TEXT,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" DATETIME,
    "last_login_at" DATETIME,
    "is_author_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "users_avatar_media_id_fkey" FOREIGN KEY ("avatar_media_id") REFERENCES "media" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "category_ids" TEXT,
    "granted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" TEXT,

    PRIMARY KEY ("user_id", "role_id"),
    CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_roles_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_backup_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_backup_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration_sec" REAL,
    "blurhash" TEXT,
    "checksum" TEXT,
    "title" TEXT,
    "alt_text" TEXT,
    "caption" TEXT,
    "credit" TEXT NOT NULL,
    "license" TEXT,
    "shot_at" DATETIME,
    "location" TEXT,
    "focal_point" TEXT NOT NULL DEFAULT '{"x":0.5,"y":0.5}',
    "crops" TEXT NOT NULL DEFAULT '{}',
    "variants" TEXT NOT NULL DEFAULT '[]',
    "provider" TEXT,
    "provider_id" TEXT,
    "transcript" TEXT,
    "captions" TEXT NOT NULL DEFAULT '[]',
    "uploaded_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "media_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parent_id" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "description" TEXT,
    "intro_html" TEXT,
    "color_accent" TEXT,
    "cover_media_id" TEXT,
    "icon" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "show_in_nav" BOOLEAN NOT NULL DEFAULT true,
    "seo" TEXT NOT NULL DEFAULT '{}',
    "article_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "categories_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "intro_html" TEXT,
    "synonyms" TEXT NOT NULL DEFAULT '[]',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "seo" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "dossiers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "lede" TEXT,
    "description" TEXT,
    "cover_media_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "started_at" DATETIME,
    "ended_at" DATETIME,
    "seo" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "dossiers_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "geo_zones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parent_id" TEXT,
    "type" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iso_code" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "geo_zones_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "geo_zones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT NOT NULL DEFAULT '[]',
    "description" TEXT,
    "role_title" TEXT,
    "image_media_id" TEXT,
    "wikidata_id" TEXT,
    "official_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "entities_image_media_id_fkey" FOREIGN KEY ("image_media_id") REFERENCES "media" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "translation_of_id" TEXT,
    "kicker" TEXT,
    "title" TEXT NOT NULL,
    "short_title" TEXT,
    "seo_title" TEXT,
    "lede" TEXT,
    "body" TEXT NOT NULL DEFAULT '[]',
    "plain_text" TEXT,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "reading_time_min" INTEGER NOT NULL DEFAULT 1,
    "format" TEXT NOT NULL DEFAULT 'standard',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "importance" INTEGER NOT NULL DEFAULT 3,
    "is_sponsored" BOOLEAN NOT NULL DEFAULT false,
    "sponsor_name" TEXT,
    "is_breaking" BOOLEAN NOT NULL DEFAULT false,
    "category_id" TEXT NOT NULL,
    "dossier_id" TEXT,
    "live_blog_id" TEXT,
    "cover_media_id" TEXT,
    "social_image_id" TEXT,
    "dateline" TEXT,
    "source_agency" TEXT,
    "published_at" DATETIME,
    "scheduled_at" DATETIME,
    "expires_at" DATETIME,
    "updated_content_at" DATETIME,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "canonical_url" TEXT,
    "robots_directives" TEXT NOT NULL DEFAULT 'index,follow',
    "focus_keyword" TEXT,
    "seo_score" INTEGER,
    "seo_checks" TEXT NOT NULL DEFAULT '{}',
    "send_push" BOOLEAN NOT NULL DEFAULT false,
    "include_newsletter" BOOLEAN NOT NULL DEFAULT true,
    "social_text" TEXT,
    "created_by" TEXT,
    "published_by" TEXT,
    "correction_note" TEXT,
    "sources" TEXT NOT NULL DEFAULT '[]',
    "view_count" BIGINT NOT NULL DEFAULT 0,
    "share_count" INTEGER NOT NULL DEFAULT 0,
    "search_vector" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "articles_translation_of_id_fkey" FOREIGN KEY ("translation_of_id") REFERENCES "articles" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "articles_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "articles_live_blog_id_fkey" FOREIGN KEY ("live_blog_id") REFERENCES "live_blogs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "articles_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "articles_social_image_id_fkey" FOREIGN KEY ("social_image_id") REFERENCES "media" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "articles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "articles_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "article_authors" (
    "article_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'author',
    "position" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("article_id", "user_id", "role"),
    CONSTRAINT "article_authors_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "article_authors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "article_tags" (
    "article_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("article_id", "tag_id"),
    CONSTRAINT "article_tags_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "article_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "article_categories" (
    "article_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,

    PRIMARY KEY ("article_id", "category_id"),
    CONSTRAINT "article_categories_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "article_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "article_geo_zones" (
    "article_id" TEXT NOT NULL,
    "geo_zone_id" TEXT NOT NULL,

    PRIMARY KEY ("article_id", "geo_zone_id"),
    CONSTRAINT "article_geo_zones_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "article_geo_zones_geo_zone_id_fkey" FOREIGN KEY ("geo_zone_id") REFERENCES "geo_zones" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "article_entities" (
    "article_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "relevance" REAL NOT NULL DEFAULT 1,

    PRIMARY KEY ("article_id", "entity_id"),
    CONSTRAINT "article_entities_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "article_entities_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "article_related" (
    "article_id" TEXT NOT NULL,
    "related_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_manual" BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY ("article_id", "related_id"),
    CONSTRAINT "article_related_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "article_related_related_id_fkey" FOREIGN KEY ("related_id") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "article_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "article_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "change_note" TEXT,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "article_versions_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "article_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "review_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "article_id" TEXT NOT NULL,
    "block_id" TEXT,
    "text" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "review_comments_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "review_comments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "article_locks" (
    "article_id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "locked_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME NOT NULL,
    CONSTRAINT "article_locks_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "article_locks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "featured_slots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zone" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "starts_at" DATETIME,
    "ends_at" DATETIME,
    "override_title" TEXT,
    "override_media_id" TEXT,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "featured_slots_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "featured_slots_override_media_id_fkey" FOREIGN KEY ("override_media_id") REFERENCES "media" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "featured_slots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "flash_news" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "article_id" TEXT,
    "external_url" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "published_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME NOT NULL,
    "created_by" TEXT,
    "deleted_at" DATETIME,
    CONSTRAINT "flash_news_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "flash_news_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "live_blogs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "category_id" TEXT,
    "cover_media_id" TEXT,
    "started_at" DATETIME,
    "ended_at" DATETIME,
    "entry_count" INTEGER NOT NULL DEFAULT 0,
    "seo" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "live_blogs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "live_blogs_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "live_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "live_blog_id" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL DEFAULT '[]',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_key" BOOLEAN NOT NULL DEFAULT false,
    "published_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "deleted_at" DATETIME,
    CONSTRAINT "live_entries_live_blog_id_fkey" FOREIGN KEY ("live_blog_id") REFERENCES "live_blogs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "live_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "weather_cities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "country_code" TEXT NOT NULL DEFAULT 'GN',
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "weather_cache" (
    "city_id" TEXT NOT NULL PRIMARY KEY,
    "payload" TEXT NOT NULL,
    "fetched_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "weather_cache_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "weather_cities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '[]',
    "template" TEXT NOT NULL DEFAULT 'default',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "seo" TEXT NOT NULL DEFAULT '{}',
    "updated_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "pages_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "menus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menu_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "label" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "target_url" TEXT,
    "icon" TEXT,
    "open_new_tab" BOOLEAN NOT NULL DEFAULT false,
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    CONSTRAINT "menu_items_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "menu_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "menu_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "homepage_blocks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "variant" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "source_type" TEXT,
    "source_id" TEXT,
    "manual_article_ids" TEXT NOT NULL DEFAULT '[]',
    "item_count" INTEGER NOT NULL DEFAULT 6,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" DATETIME,
    "ends_at" DATETIME,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "updated_by" TEXT,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "homepage_blocks_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "homepage_layouts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "homepage_layouts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "group_key" TEXT NOT NULL,
    "label" TEXT,
    "updated_by" TEXT,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "translations" (
    "key" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "context" TEXT,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("key", "locale")
);

-- CreateTable
CREATE TABLE "site_banners" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message" TEXT NOT NULL,
    "link_url" TEXT,
    "link_label" TEXT,
    "style" TEXT NOT NULL DEFAULT 'alert',
    "is_dismissible" BOOLEAN NOT NULL DEFAULT true,
    "target_paths" TEXT NOT NULL DEFAULT '["/*"]',
    "starts_at" DATETIME,
    "ends_at" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "redirects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_path" TEXT NOT NULL,
    "target_path" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL DEFAULT 301,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "is_auto" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "not_found_log" (
    "path" TEXT NOT NULL PRIMARY KEY,
    "hit_count" INTEGER NOT NULL DEFAULT 1,
    "referrer" TEXT,
    "last_seen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "article_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "author_name" TEXT NOT NULL,
    "author_email" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "is_staff" BOOLEAN NOT NULL DEFAULT false,
    "ip_hash" TEXT,
    "moderated_by" TEXT,
    "moderated_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comments_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comments_moderated_by_fkey" FOREIGN KEY ("moderated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inbox_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "department" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'new',
    "assigned_to" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inbox_messages_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "before" TEXT,
    "after" TEXT,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ad_slots" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "placement" TEXT NOT NULL,
    "sizes" TEXT NOT NULL,
    "pages" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "max_creative_kb" INTEGER NOT NULL DEFAULT 150,
    "allows_third_party" BOOLEAN NOT NULL DEFAULT false,
    "refresh_sec" INTEGER,
    "max_refresh" INTEGER NOT NULL DEFAULT 5,
    "base_cpm" REAL,
    "position" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "advertisers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "agency" TEXT,
    "sector" TEXT,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "report_token" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "advertiser_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "starts_at" DATETIME NOT NULL,
    "ends_at" DATETIME NOT NULL,
    "goal_type" TEXT NOT NULL DEFAULT 'impressions',
    "goal_value" BIGINT,
    "budget" REAL,
    "currency" TEXT NOT NULL DEFAULT 'GNF',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "frequency_cap" INTEGER,
    "targeting" TEXT NOT NULL DEFAULT '{}',
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "ad_campaigns_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "advertisers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ad_campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ad_creatives" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaign_id" TEXT NOT NULL,
    "slot_code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "media_id" TEXT,
    "html" TEXT,
    "script_tag" TEXT,
    "native_title" TEXT,
    "native_text" TEXT,
    "native_cta" TEXT,
    "native_brand" TEXT,
    "click_url" TEXT NOT NULL,
    "alt_text" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "file_size_kb" INTEGER,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ad_creatives_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ad_creatives_slot_code_fkey" FOREIGN KEY ("slot_code") REFERENCES "ad_slots" ("code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ad_creatives_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ad_events" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "creative_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "slot_code" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "page_path" TEXT,
    "country" TEXT,
    "device" TEXT,
    "visitor_hash" TEXT,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ad_daily_stats" (
    "date" DATETIME NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "creative_id" TEXT NOT NULL,
    "slot_code" TEXT NOT NULL,
    "impressions" BIGINT NOT NULL DEFAULT 0,
    "viewable" BIGINT NOT NULL DEFAULT 0,
    "clicks" BIGINT NOT NULL DEFAULT 0,

    PRIMARY KEY ("date", "campaign_id", "creative_id", "slot_code")
);

-- CreateTable
CREATE TABLE "newsletter_lists" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cadence" TEXT,
    "send_time" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "auto_compose" BOOLEAN NOT NULL DEFAULT false,
    "template_key" TEXT NOT NULL DEFAULT 'default',
    "position" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "subscribers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "country" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "interests" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "confirm_token" TEXT,
    "unsubscribe_token" TEXT NOT NULL,
    "source" TEXT,
    "source_url" TEXT,
    "consent_at" DATETIME,
    "consent_ip_hash" TEXT,
    "last_open_at" DATETIME,
    "last_click_at" DATETIME,
    "engagement_score" INTEGER NOT NULL DEFAULT 0,
    "bounce_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed_at" DATETIME
);

-- CreateTable
CREATE TABLE "subscriber_lists" (
    "subscriber_id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "subscribed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("subscriber_id", "list_id"),
    CONSTRAINT "subscriber_lists_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "subscriber_lists_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "newsletter_lists" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "email_campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "list_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subject_b" TEXT,
    "preheader" TEXT,
    "blocks" TEXT NOT NULL DEFAULT '[]',
    "html_cache" TEXT,
    "text_cache" TEXT,
    "segment" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduled_at" DATETIME,
    "sent_at" DATETIME,
    "recipients_count" INTEGER NOT NULL DEFAULT 0,
    "sponsor_creative_id" TEXT,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_campaigns_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "newsletter_lists" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "email_campaigns_sponsor_creative_id_fkey" FOREIGN KEY ("sponsor_creative_id") REFERENCES "ad_creatives" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "email_campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "email_events" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "campaign_id" TEXT NOT NULL,
    "subscriber_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "link_url" TEXT,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "email_campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "email_events_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "seo_keywords" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "term" TEXT NOT NULL,
    "term_normalized" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "country" TEXT NOT NULL DEFAULT 'GN',
    "word_count" INTEGER NOT NULL,
    "tail_type" TEXT NOT NULL,
    "intent" TEXT,
    "cluster_id" TEXT,
    "is_tracked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seo_keywords_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "keyword_clusters" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "keyword_metrics" (
    "keyword_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "search_volume" INTEGER,
    "volume_weighted" INTEGER,
    "difficulty" REAL,
    "cpc" REAL,
    "trend" TEXT,
    "trend_series" TEXT,
    "serp_features" TEXT,
    "collected_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("keyword_id", "source", "collected_at"),
    CONSTRAINT "keyword_metrics_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "seo_keywords" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "keyword_clusters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "centroid" TEXT,
    "coverage" TEXT NOT NULL DEFAULT 'none',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "article_keywords" (
    "article_id" TEXT NOT NULL,
    "keyword_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "opportunity_score" REAL,
    "was_suggested" BOOLEAN NOT NULL DEFAULT true,
    "was_accepted" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("article_id", "keyword_id"),
    CONSTRAINT "article_keywords_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "article_keywords_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "seo_keywords" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "seo_rankings" (
    "keyword_id" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "position" REAL,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "ctr" REAL,
    "url" TEXT,

    PRIMARY KEY ("keyword_id", "date"),
    CONSTRAINT "seo_rankings_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "seo_keywords" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "seo_provider_usage" (
    "date" DATETIME NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost" REAL NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "page_views" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "path" TEXT NOT NULL,
    "article_id" TEXT,
    "referrer_host" TEXT,
    "country" TEXT,
    "device" TEXT,
    "visitor_hash" TEXT,
    "scroll_depth" INTEGER,
    "dwell_sec" INTEGER,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "article_daily_stats" (
    "date" DATETIME NOT NULL,
    "article_id" TEXT NOT NULL,
    "views" BIGINT NOT NULL DEFAULT 0,
    "uniques" BIGINT NOT NULL DEFAULT 0,
    "avg_dwell" INTEGER NOT NULL DEFAULT 0,
    "completion_rate" REAL,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "newsletter_signups" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("date", "article_id"),
    CONSTRAINT "article_daily_stats_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "search_queries" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "query" TEXT NOT NULL,
    "results_count" INTEGER NOT NULL,
    "clicked_article_id" TEXT,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "keys" TEXT NOT NULL,
    "topics" TEXT NOT NULL DEFAULT '[]',
    "locale" TEXT DEFAULT 'fr',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sent_at" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_slug_key" ON "users"("slug");

-- CreateIndex
CREATE INDEX "idx_users_slug" ON "users"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_backup_codes_user_id_idx" ON "user_backup_codes"("user_id");

-- CreateIndex
CREATE INDEX "idx_media_type" ON "media"("type");

-- CreateIndex
CREATE INDEX "idx_media_checksum" ON "media"("checksum");

-- CreateIndex
CREATE INDEX "idx_categories_parent" ON "categories"("parent_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "categories_parent_id_slug_key" ON "categories"("parent_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "idx_tags_name" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "dossiers_slug_key" ON "dossiers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "geo_zones_parent_id_slug_key" ON "geo_zones"("parent_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "entities_slug_key" ON "entities"("slug");

-- CreateIndex
CREATE INDEX "idx_articles_published" ON "articles"("published_at" DESC);

-- CreateIndex
CREATE INDEX "idx_articles_category" ON "articles"("category_id", "published_at" DESC);

-- CreateIndex
CREATE INDEX "idx_articles_status" ON "articles"("status", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "idx_articles_scheduled" ON "articles"("scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "articles_locale_slug_key" ON "articles"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "article_versions_article_id_version_key" ON "article_versions"("article_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "featured_slots_zone_position_key" ON "featured_slots"("zone", "position");

-- CreateIndex
CREATE INDEX "idx_flash_active" ON "flash_news"("published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "live_blogs_slug_key" ON "live_blogs"("slug");

-- CreateIndex
CREATE INDEX "idx_live_entries" ON "live_entries"("live_blog_id", "published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "pages_locale_slug_key" ON "pages"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "menus_key_key" ON "menus"("key");

-- CreateIndex
CREATE INDEX "menu_items_menu_id_position_idx" ON "menu_items"("menu_id", "position");

-- CreateIndex
CREATE INDEX "homepage_blocks_position_idx" ON "homepage_blocks"("position");

-- CreateIndex
CREATE UNIQUE INDEX "homepage_blocks_code_locale_key" ON "homepage_blocks"("code", "locale");

-- CreateIndex
CREATE INDEX "settings_group_key_idx" ON "settings"("group_key");

-- CreateIndex
CREATE UNIQUE INDEX "redirects_source_path_key" ON "redirects"("source_path");

-- CreateIndex
CREATE INDEX "comments_article_id_status_created_at_idx" ON "comments"("article_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "inbox_messages_kind_status_created_at_idx" ON "inbox_messages"("kind", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_resource" ON "audit_log"("resource_type", "resource_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_user" ON "audit_log"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "advertisers_report_token_key" ON "advertisers"("report_token");

-- CreateIndex
CREATE INDEX "idx_campaigns_active" ON "ad_campaigns"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "ad_creatives_slot_code_is_active_idx" ON "ad_creatives"("slot_code", "is_active");

-- CreateIndex
CREATE INDEX "ad_events_campaign_id_occurred_at_idx" ON "ad_events"("campaign_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "ad_events_slot_code_occurred_at_idx" ON "ad_events"("slot_code", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_lists_key_key" ON "newsletter_lists"("key");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_email_key" ON "subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_unsubscribe_token_key" ON "subscribers"("unsubscribe_token");

-- CreateIndex
CREATE INDEX "email_campaigns_status_scheduled_at_idx" ON "email_campaigns"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "email_events_campaign_id_occurred_at_idx" ON "email_events"("campaign_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "email_events_subscriber_id_occurred_at_idx" ON "email_events"("subscriber_id", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "seo_keywords_term_normalized_locale_country_key" ON "seo_keywords"("term_normalized", "locale", "country");

-- CreateIndex
CREATE INDEX "page_views_path_occurred_at_idx" ON "page_views"("path", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "page_views_article_id_occurred_at_idx" ON "page_views"("article_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "search_queries_occurred_at_idx" ON "search_queries"("occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- ═══════════════════════════════════════════════════════════════════
-- Index partiels normatifs (§06.2) — SQLite supporte les index partiels
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX idx_users_slug_partial ON users(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_type_partial ON media(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_flash_active_partial ON flash_news(published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_articles_published_partial ON articles(published_at DESC) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX idx_articles_category_partial ON articles(category_id, published_at DESC) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX idx_articles_scheduled_partial ON articles(scheduled_at) WHERE status = 'scheduled';
