/*
# Create reminders table (single-tenant, no auth)

## Purpose
IAI System Projet needs persistent reminders so the user can schedule tasks with
a title, optional note, and a due date/time. Reminders are listed in the UI and
can be marked done or deleted. This is a single-tenant app (no sign-in screen),
so reminders are intentionally shared/public — the anon-key frontend must be able
to read and write them directly.

1. New Tables
- `reminders`
  - `id`         (uuid, primary key, default gen_random_uuid())
  - `title`      (text, not null) — short label of the reminder
  - `note`       (text, nullable) — optional longer description
  - `due_at`     (timestamptz, nullable) — when the reminder should fire
  - `done`       (boolean, not null, default false) — completion flag
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `reminders`.
- Add 4 CRUD policies (select/insert/update/delete) scoped to
  `TO anon, authenticated` because this is a single-tenant app with no
  sign-in screen. The anon-key client needs full CRUD, so `USING (true)` /
  `WITH CHECK (true)` is acceptable here — the data is intentionally shared.

3. Indexes
- Index on `due_at` for chronological listing.
- Index on `done` for filtering pending vs completed.
*/

CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  note text,
  due_at timestamptz,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reminders" ON reminders;
CREATE POLICY "anon_select_reminders" ON reminders FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_reminders" ON reminders;
CREATE POLICY "anon_insert_reminders" ON reminders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_reminders" ON reminders;
CREATE POLICY "anon_update_reminders" ON reminders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_reminders" ON reminders;
CREATE POLICY "anon_delete_reminders" ON reminders FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_reminders_due_at ON reminders (due_at);
CREATE INDEX IF NOT EXISTS idx_reminders_done ON reminders (done);
