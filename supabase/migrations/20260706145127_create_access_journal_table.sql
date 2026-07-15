/*
# Create access_journal table (single-tenant, no auth)

## Purpose
The "ACCESS | MY PHONE" module of IAI System Projet logs every sensitive action
the user attempts from the phone-control center (open/close apps, send SMS,
toggle torch, create routine, etc.). Each row records the timestamp, the action
performed, its category, and the outcome (success, denied, mobile-only, error).
This journal is displayed in /access so the user can audit what happened.

1. New Tables
- `access_journal`
  - `id`         (uuid, primary key, default gen_random_uuid())
  - `action`     (text, not null) — short label, e.g. "Ouvrir App: Spotify"
  - `category`   (text, not null) — section: apps | comms | phone | automation
  - `status`     (text, not null) — success | denied | mobile_only | error
  - `detail`     (text, nullable) — optional extra info / error message
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `access_journal`.
- Add 4 CRUD policies (select/insert/update/delete) scoped to
  TO anon, authenticated because this is a single-tenant app with no
  sign-in screen. The anon-key client needs full CRUD.

3. Indexes
- Index on created_at descending for chronological journal display.
- Index on category for filtering by section.
*/

CREATE TABLE IF NOT EXISTS access_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  category text NOT NULL,
  status text NOT NULL,
  detail text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE access_journal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_access_journal" ON access_journal;
CREATE POLICY "anon_select_access_journal" ON access_journal FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_access_journal" ON access_journal;
CREATE POLICY "anon_insert_access_journal" ON access_journal FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_access_journal" ON access_journal;
CREATE POLICY "anon_update_access_journal" ON access_journal FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_access_journal" ON access_journal;
CREATE POLICY "anon_delete_access_journal" ON access_journal FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_access_journal_created_at ON access_journal (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_journal_category ON access_journal (category);
