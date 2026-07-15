/*
# Create core tables for Assistant IA Pro+

## Overview
Adds the four persistence tables that power the assistant's memory, conversation
history, and user preferences. This is a SINGLE-TENANT app with no sign-in screen,
so all policies are scoped to `anon, authenticated` and ownership is intentionally
shared/public — there is no per-user isolation because the app has no auth flow.

## New Tables

1. `users`
   - `id`        uuid PRIMARY KEY (defaults to a stable anon user id set on first launch)
   - `name`      text — display name learned from "Retiens que je m'appelle X"
   - `created_at` timestamptz, defaults to now()

2. `memories`
   - `id`         uuid PRIMARY KEY
   - `user_id`    uuid — references users(id) ON DELETE CASCADE
   - `key`        text — short label, e.g. "name", "likes", "fact"
   - `value`      text — the remembered content, e.g. "Boss", "café"
   - `created_at` timestamptz, defaults to now()
   - Index on (user_id, created_at desc) for "last 5 memories" lookups.

3. `conversations`
   - `id`         uuid PRIMARY KEY
   - `user_id`    uuid — references users(id) ON DELETE CASCADE
   - `role`       text — 'user' | 'assistant'
   - `content`    text — message body
   - `mode`       text — the active mode when the message was sent (nullable for legacy)
   - `created_at` timestamptz, defaults to now()
   - Index on (user_id, created_at desc) for "last 15 messages" lookups.

4. `preferences`
   - `id`         uuid PRIMARY KEY
   - `user_id`    uuid — references users(id) ON DELETE CASCADE
   - `theme`      text — UI theme, defaults to 'dark'
   - `language`   text — UI language, defaults to 'fr'
   - `created_at` timestamptz, defaults to now()
   - Unique constraint on user_id (one row per user).

## Security
- RLS enabled on ALL four tables.
- Because this is a no-auth single-tenant app, every policy uses `TO anon, authenticated`
  with `USING (true)` / `WITH CHECK (true)` — the data is intentionally shared and the
  anon-key frontend must be able to read and write its own rows.
- No `auth.uid()` ownership checks because there is no sign-in screen.

## Notes
1. The frontend creates one `users` row on first launch and reuses its id for all
   subsequent inserts into memories / conversations / preferences.
2. `conversations.mode` is nullable so older rows (if any) don't break.
3. All statements are idempotent (IF NOT EXISTS, DROP POLICY IF EXISTS before CREATE).
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  mode text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'dark',
  language text NOT NULL DEFAULT 'fr',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memories_user_recent_idx
  ON memories (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS conversations_user_recent_idx
  ON conversations (user_id, created_at DESC);

ALTER TABLE preferences
  DROP CONSTRAINT IF EXISTS preferences_user_id_key;
ALTER TABLE preferences
  ADD CONSTRAINT preferences_user_id_key UNIQUE (user_id);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;

-- users policies (single-tenant: anon + authenticated full access)
DROP POLICY IF EXISTS "anon_select_users" ON users;
CREATE POLICY "anon_select_users" ON users FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_users" ON users;
CREATE POLICY "anon_insert_users" ON users FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_users" ON users;
CREATE POLICY "anon_update_users" ON users FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_users" ON users;
CREATE POLICY "anon_delete_users" ON users FOR DELETE
  TO anon, authenticated USING (true);

-- memories policies
DROP POLICY IF EXISTS "anon_select_memories" ON memories;
CREATE POLICY "anon_select_memories" ON memories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_memories" ON memories;
CREATE POLICY "anon_insert_memories" ON memories FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_memories" ON memories;
CREATE POLICY "anon_update_memories" ON memories FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_memories" ON memories;
CREATE POLICY "anon_delete_memories" ON memories FOR DELETE
  TO anon, authenticated USING (true);

-- conversations policies
DROP POLICY IF EXISTS "anon_select_conversations" ON conversations;
CREATE POLICY "anon_select_conversations" ON conversations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_conversations" ON conversations;
CREATE POLICY "anon_insert_conversations" ON conversations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_conversations" ON conversations;
CREATE POLICY "anon_update_conversations" ON conversations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_conversations" ON conversations;
CREATE POLICY "anon_delete_conversations" ON conversations FOR DELETE
  TO anon, authenticated USING (true);

-- preferences policies
DROP POLICY IF EXISTS "anon_select_preferences" ON preferences;
CREATE POLICY "anon_select_preferences" ON preferences FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_preferences" ON preferences;
CREATE POLICY "anon_insert_preferences" ON preferences FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_preferences" ON preferences;
CREATE POLICY "anon_update_preferences" ON preferences FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_preferences" ON preferences;
CREATE POLICY "anon_delete_preferences" ON preferences FOR DELETE
  TO anon, authenticated USING (true);
