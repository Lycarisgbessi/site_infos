-- ═══════════════════════════════════════════════════════════════════
-- INFOSPRO.NET — Partitionnement mensuel (spécification §06.1/§06.3)
-- Tables : ad_events, email_events, page_views (PARTITION BY RANGE).
-- Le cron /api/cron/partitions (§07.3, 30 j) crée la partition du mois
-- suivant via la fonction ci-dessous.
-- ═══════════════════════════════════════════════════════════════════

-- ─── ad_events ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ad_events')
     AND NOT EXISTS (
       SELECT 1 FROM pg_partitioned_table pt
       JOIN pg_class c ON c.oid = pt.ptrelid WHERE c.relname = 'ad_events'
     ) THEN
    ALTER TABLE ad_events PARTITION BY RANGE (occurred_at);
  END IF;
END $$;

-- ─── email_events ────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_events')
     AND NOT EXISTS (
       SELECT 1 FROM pg_partitioned_table pt
       JOIN pg_class c ON c.oid = pt.ptrelid WHERE c.relname = 'email_events'
     ) THEN
    ALTER TABLE email_events PARTITION BY RANGE (occurred_at);
  END IF;
END $$;

-- ─── page_views ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'page_views')
     AND NOT EXISTS (
       SELECT 1 FROM pg_partitioned_table pt
       JOIN pg_class c ON c.oid = pt.ptrelid WHERE c.relname = 'page_views'
     ) THEN
    ALTER TABLE page_views PARTITION BY RANGE (occurred_at);
  END IF;
END $$;

-- Création idempotente d'une partition mensuelle
CREATE OR REPLACE FUNCTION create_monthly_partition(
  p_table text,
  p_year int,
  p_month int
) RETURNS void AS $$
DECLARE
  start_date date := make_date(p_year, p_month, 1);
  end_date date := (start_date + interval '1 month')::date;
  partition_name text := p_table || '_' || to_char(start_date, 'YYYY_MM');
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c WHERE c.relname = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L);',
      partition_name, p_table, start_date, end_date
    );
  END IF;
END $$ LANGUAGE plpgsql;
