/*
  Warnings:

  - The primary key for the `ad_events` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `ad_events` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `audit_log` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `audit_log` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `email_events` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `email_events` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `page_views` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `page_views` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `search_queries` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `search_queries` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ad_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
INSERT INTO "new_ad_events" ("campaign_id", "country", "creative_id", "device", "event_type", "id", "occurred_at", "page_path", "slot_code", "visitor_hash") SELECT "campaign_id", "country", "creative_id", "device", "event_type", "id", "occurred_at", "page_path", "slot_code", "visitor_hash" FROM "ad_events";
DROP TABLE "ad_events";
ALTER TABLE "new_ad_events" RENAME TO "ad_events";
CREATE INDEX "ad_events_campaign_id_occurred_at_idx" ON "ad_events"("campaign_id", "occurred_at" DESC);
CREATE INDEX "ad_events_slot_code_occurred_at_idx" ON "ad_events"("slot_code", "occurred_at" DESC);
CREATE TABLE "new_audit_log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
INSERT INTO "new_audit_log" ("action", "after", "before", "created_at", "id", "ip_hash", "resource_id", "resource_type", "user_agent", "user_id") SELECT "action", "after", "before", "created_at", "id", "ip_hash", "resource_id", "resource_type", "user_agent", "user_id" FROM "audit_log";
DROP TABLE "audit_log";
ALTER TABLE "new_audit_log" RENAME TO "audit_log";
CREATE INDEX "idx_audit_resource" ON "audit_log"("resource_type", "resource_id", "created_at" DESC);
CREATE INDEX "idx_audit_user" ON "audit_log"("user_id", "created_at" DESC);
CREATE TABLE "new_email_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaign_id" TEXT NOT NULL,
    "subscriber_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "link_url" TEXT,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "email_campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "email_events_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_email_events" ("campaign_id", "event_type", "id", "link_url", "occurred_at", "subscriber_id") SELECT "campaign_id", "event_type", "id", "link_url", "occurred_at", "subscriber_id" FROM "email_events";
DROP TABLE "email_events";
ALTER TABLE "new_email_events" RENAME TO "email_events";
CREATE INDEX "email_events_campaign_id_occurred_at_idx" ON "email_events"("campaign_id", "occurred_at" DESC);
CREATE INDEX "email_events_subscriber_id_occurred_at_idx" ON "email_events"("subscriber_id", "occurred_at" DESC);
CREATE TABLE "new_page_views" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
INSERT INTO "new_page_views" ("article_id", "country", "device", "dwell_sec", "id", "occurred_at", "path", "referrer_host", "scroll_depth", "visitor_hash") SELECT "article_id", "country", "device", "dwell_sec", "id", "occurred_at", "path", "referrer_host", "scroll_depth", "visitor_hash" FROM "page_views";
DROP TABLE "page_views";
ALTER TABLE "new_page_views" RENAME TO "page_views";
CREATE INDEX "page_views_path_occurred_at_idx" ON "page_views"("path", "occurred_at" DESC);
CREATE INDEX "page_views_article_id_occurred_at_idx" ON "page_views"("article_id", "occurred_at" DESC);
CREATE TABLE "new_search_queries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "query" TEXT NOT NULL,
    "results_count" INTEGER NOT NULL,
    "clicked_article_id" TEXT,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_search_queries" ("clicked_article_id", "id", "occurred_at", "query", "results_count") SELECT "clicked_article_id", "id", "occurred_at", "query", "results_count" FROM "search_queries";
DROP TABLE "search_queries";
ALTER TABLE "new_search_queries" RENAME TO "search_queries";
CREATE INDEX "search_queries_occurred_at_idx" ON "search_queries"("occurred_at" DESC);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
