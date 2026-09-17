-- ═══════════════════════════════════════════════════════════════════
-- INFOSPRO.NET — Extensions PostgreSQL (spécification §06.2)
-- À exécuter sur la base de PRODUCTION PostgreSQL 16+ avant les migrations.
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "citext";
