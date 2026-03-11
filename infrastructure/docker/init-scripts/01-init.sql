-- ─── PostgreSQL Init Script ──────────────────────────────────────────────────
-- galactic-ionosphere Education Platform
-- Runs automatically when postgres container is first created

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- Fast text search
CREATE EXTENSION IF NOT EXISTS "unaccent";       -- Turkish character support
CREATE EXTENSION IF NOT EXISTS "btree_gin";      -- GIN indexes for composite queries

-- Performance tuning (adjust based on RAM available)
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = '0.9';
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = '100';
ALTER SYSTEM SET random_page_cost = '1.1';     -- SSD optimized
ALTER SYSTEM SET effective_io_concurrency = '200';
ALTER SYSTEM SET work_mem = '8MB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET max_wal_size = '4GB';
ALTER SYSTEM SET max_connections = '100';       -- PgBouncer handles the rest

-- Read-replica user (for future read replicas)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'replica_user') THEN
    CREATE ROLE replica_user WITH REPLICATION LOGIN PASSWORD 'CHANGE_ME_replica_pass';
  END IF;
END
$$;

-- Reload config
SELECT pg_reload_conf();

-- Create schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS schools;
CREATE SCHEMA IF NOT EXISTS lessons;
CREATE SCHEMA IF NOT EXISTS games;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS ai;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE platform TO platform;
GRANT ALL PRIVILEGES ON SCHEMA auth, users, schools, lessons, games, analytics, ai TO platform;

-- Search path
ALTER USER platform SET search_path = public, auth, users, schools, lessons, games, analytics, ai;
