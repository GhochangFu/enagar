-- ================================================================
-- eNagarSeba — Postgres extensions bootstrap
-- Runs once on first container start (mounted into /docker-entrypoint-initdb.d).
-- All extensions used across the platform are declared here so any
-- migration / seed script can rely on them being present.
-- ================================================================

-- gen_random_uuid() and other crypto helpers
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- UUID generation (v1 / v4) — pgcrypto already provides v4, but
-- uuid-ossp is the conventional dependency for v7-helper functions.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- GiST support for tstzrange exclusion constraints (booking anti-double-booking)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Trigram fuzzy text search for citizen name / holding number lookups
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Case-insensitive text type for unique constraints on email-like columns
CREATE EXTENSION IF NOT EXISTS citext;

-- Cron-like scheduled jobs in-database (used for SLA-tick fallback)
-- Comment out if you'd rather rely solely on BullMQ for scheduling.
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Verify
DO $$
BEGIN
    RAISE NOTICE 'eNagarSeba: Postgres extensions installed successfully.';
END $$;
