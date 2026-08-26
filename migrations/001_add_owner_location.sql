-- Run once for existing SQLite databases. database.js applies the same
-- idempotent migration automatically on application startup.
ALTER TABLE users ADD COLUMN latitude REAL;
ALTER TABLE users ADD COLUMN longitude REAL;
ALTER TABLE users ADD COLUMN address_label TEXT;
ALTER TABLE users ADD COLUMN location TEXT;