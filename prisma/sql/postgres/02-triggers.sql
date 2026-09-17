-- ═══════════════════════════════════════════════════════════════════
-- INFOSPRO.NET — Triggers PostgreSQL (spécification §06.2)
-- À exécuter en production après les migrations Prisma.
-- En développement SQLite : updated_at par @updatedAt Prisma,
-- article_count par la couche service (voir DECISIONS.md D-01).
-- ═══════════════════════════════════════════════════════════════════

-- Trigger : maintien de search_vector (pondération A titre, B kicker/chapô, C corps)
CREATE OR REPLACE FUNCTION articles_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', unaccent(coalesce(NEW.title,''))), 'A') ||
    setweight(to_tsvector('french', unaccent(coalesce(NEW.kicker,''))), 'B') ||
    setweight(to_tsvector('french', unaccent(coalesce(NEW.lede,''))), 'B') ||
    setweight(to_tsvector('french', unaccent(coalesce(NEW.plain_text,''))), 'C');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_articles_search ON articles;
CREATE TRIGGER trg_articles_search BEFORE INSERT OR UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION articles_search_trigger();

-- Index GIN sur search_vector (§06.2)
CREATE INDEX IF NOT EXISTS idx_articles_search ON articles USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_articles_body ON articles USING gin(body jsonb_path_ops);

-- Trigger : horodatage updated_at (§06.1)
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Trigger : compteur dénormalisé categories.article_count (§06.2)
CREATE OR REPLACE FUNCTION categories_article_count() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE categories SET article_count = article_count + 1 WHERE id = NEW.category_id;
    UPDATE categories SET article_count = article_count + 1
      WHERE id IN (SELECT category_id FROM article_categories WHERE article_id = NEW.id);
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE categories SET article_count = article_count - 1 WHERE id = OLD.category_id;
    UPDATE categories SET article_count = article_count - 1
      WHERE id IN (SELECT category_id FROM article_categories WHERE article_id = OLD.id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_categories_article_count ON articles;
CREATE TRIGGER trg_categories_article_count AFTER INSERT OR DELETE ON articles
  FOR EACH ROW EXECUTE FUNCTION categories_article_count();

-- Recherche médiathèque (§06.2 idx_media_search)
CREATE INDEX IF NOT EXISTS idx_media_search ON media USING gin (
  to_tsvector('french', coalesce(title,'')||' '||coalesce(caption,'')||' '||coalesce(credit,''))
);

-- Trigramme sur les noms de tags (§06.2 idx_tags_name_trgm)
CREATE INDEX IF NOT EXISTS idx_tags_name_trgm ON tags USING gin (name gin_trgm_ops);
