-- Add cover_url to feed_item if it doesn't exist (idempotent)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we catch the error in the migration runner
ALTER TABLE feed_item ADD COLUMN cover_url TEXT NOT NULL DEFAULT '';
