import { supabase } from './chatClient';
import type { Message, Mode } from './types';

const USER_ID_KEY = 'aipp_user_id';

export interface MemoryRow {
  id: string;
  key: string;
  value: string;
  created_at: string;
}

export interface ConversationRow {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  name: string | null;
}

/**
 * Returns the cached user id from localStorage, or null if none yet.
 */
export function getCachedUserId(): string | null {
  try {
    return localStorage.getItem(USER_ID_KEY);
  } catch {
    return null;
  }
}

export function setCachedUserId(id: string) {
  try {
    localStorage.setItem(USER_ID_KEY, id);
  } catch {
    /* ignore */
  }
}

/**
 * Get-or-create the single anon user row. The id is cached in localStorage so
 * all subsequent inserts reference the same user across reloads.
 */
export async function getOrCreateUser(): Promise<UserProfile | null> {
  if (!supabase) return null;

  const cached = getCachedUserId();
  if (cached) {
    const { data } = await supabase
      .from('users')
      .select('id, name')
      .eq('id', cached)
      .maybeSingle();
    if (data) return data as UserProfile;
  }

  const { data, error } = await supabase
    .from('users')
    .insert({})
    .select('id, name')
    .single();
  if (error || !data) return null;
  setCachedUserId(data.id);
  return data as UserProfile;
}

export async function loadMemories(userId: string): Promise<MemoryRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('memories')
    .select('id, key, value, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data as MemoryRow[]) ?? [];
}

export async function loadConversations(userId: string): Promise<ConversationRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('conversations')
    .select('id, role, content, mode, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(15);
  if (error) return [];
  return ((data as ConversationRow[]) ?? []).reverse();
}

export function rowsToMessages(rows: ConversationRow[]): Message[] {
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    mode: (r.mode as Mode | null) ?? undefined,
    createdAt: new Date(r.created_at).getTime(),
  }));
}

export async function deleteMemory(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('memories').delete().eq('id', id);
  return !error;
}

export async function deleteAllMemories(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('memories')
    .delete()
    .eq('user_id', userId);
  return !error;
}

export async function clearConversations(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('user_id', userId);
  return !error;
}

export async function getUser(userId: string): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('users')
    .select('id, name')
    .eq('id', userId)
    .maybeSingle();
  return (data as UserProfile) ?? null;
}

// ---- Reminders CRUD ----

export interface ReminderRow {
  id: string;
  title: string;
  note: string | null;
  due_at: string | null;
  done: boolean;
  created_at: string;
}

export async function loadReminders(): Promise<ReminderRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('reminders')
    .select('id, title, note, due_at, done, created_at')
    .order('due_at', { ascending: true, nullsFirst: false });
  if (error) return [];
  return (data as ReminderRow[]) ?? [];
}

export async function createReminder(
  title: string,
  dueAt: string | null,
  note: string | null = null,
): Promise<ReminderRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('reminders')
    .insert({ title, due_at: dueAt, note })
    .select('id, title, note, due_at, done, created_at')
    .single();
  if (error) return null;
  return data as ReminderRow;
}

export async function toggleReminderDone(id: string, done: boolean): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('reminders').update({ done }).eq('id', id);
  return !error;
}

export async function deleteReminder(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  return !error;
}

// ---- Theme preference ----

export async function loadTheme(): Promise<'dark' | 'light'> {
  if (!supabase) return 'dark';
  const { data } = await supabase
    .from('preferences')
    .select('theme')
    .limit(1)
    .maybeSingle();
  return (data?.theme as 'dark' | 'light') ?? 'dark';
}

export async function saveTheme(theme: 'dark' | 'light'): Promise<void> {
  if (!supabase) return;
  // Upsert into preferences (single-tenant: operate on first row).
  const { data: existing } = await supabase
    .from('preferences')
    .select('id')
    .limit(1)
    .maybeSingle();
  if (existing) {
    await supabase.from('preferences').update({ theme }).eq('id', existing.id);
  } else {
    await supabase.from('preferences').insert({ theme });
  }
}

// ---- Access journal (ACCESS | MY PHONE module) ----

export interface AccessJournalRow {
  id: string;
  action: string;
  category: string;
  status: string;
  detail: string | null;
  created_at: string;
}

export async function loadAccessJournal(limit = 100): Promise<AccessJournalRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('access_journal')
    .select('id, action, category, status, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data as AccessJournalRow[]) ?? [];
}

export async function logAccessAction(
  action: string,
  category: string,
  status: 'success' | 'denied' | 'mobile_only' | 'error',
  detail: string | null = null,
): Promise<void> {
  if (!supabase) return;
  await supabase.from('access_journal').insert({ action, category, status, detail });
}

// Delete entries older than the given number of hours (default 12h).
export async function cleanOldJournal(hours = 12): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('access_journal')
    .delete()
    .lt('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString());
}

// Delete every entry in the journal.
export async function clearAllJournal(): Promise<void> {
  if (!supabase) return;
  await supabase.from('access_journal').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}
