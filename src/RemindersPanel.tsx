import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  X,
  Plus,
  Trash2,
  Check,
  Clock,
  Loader2,
  CalendarDays,
} from 'lucide-react';
import {
  loadReminders,
  createReminder,
  toggleReminderDone,
  deleteReminder,
  type ReminderRow,
} from './db';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function RemindersPanel({ open, onClose }: Props) {
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    const rows = await loadReminders();
    setReminders(rows);
    setLoading(false);
  }

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    const row = await createReminder(title.trim(), dueAt || null, note.trim() || null);
    setCreating(false);
    if (row) {
      setTitle('');
      setDueAt('');
      setNote('');
      await refresh();
    }
  }

  async function handleToggle(id: string, done: boolean) {
    await toggleReminderDone(id, done);
    await refresh();
  }

  async function handleDelete(id: string) {
    await deleteReminder(id);
    await refresh();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-deep-900/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col glass shadow-neon-strong"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Bell className="h-4 w-4 text-neon-pink" />
                Rappels
                {reminders.length > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-neon-pink/20 px-1.5 text-[10px] font-bold text-neon-pink">
                    {reminders.length}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Create form */}
            <div className="space-y-2 border-b border-white/10 p-4">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre du rappel"
                className="w-full rounded-lg border border-white/10 bg-deep-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-neon-pink/50 focus:outline-none"
              />
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-deep-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-neon-pink/50 focus:outline-none"
              />
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optionnel)"
                className="w-full rounded-lg border border-white/10 bg-deep-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-neon-pink/50 focus:outline-none"
              />
              <button
                onClick={handleCreate}
                disabled={creating || !title.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white transition hover:shadow-neon-pink disabled:cursor-not-allowed disabled:opacity-40"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Créer le rappel
                  </>
                )}
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex justify-center py-8 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : reminders.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-slate-500">
                  <CalendarDays className="h-10 w-10 opacity-40" />
                  <p className="text-sm">Aucun rappel pour l'instant</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {reminders.map((r) => (
                    <motion.li
                      key={r.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className={`flex items-start gap-2 rounded-xl border p-3 transition ${
                        r.done
                          ? 'border-emerald-400/20 bg-emerald-500/5 opacity-60'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <button
                        onClick={() => handleToggle(r.id, !r.done)}
                        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                          r.done
                            ? 'border-emerald-400 bg-emerald-400 text-deep-900'
                            : 'border-white/30 hover:border-neon-pink'
                        }`}
                      >
                        {r.done && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-medium ${
                            r.done ? 'text-slate-400 line-through' : 'text-slate-100'
                          }`}
                        >
                          {r.title}
                        </p>
                        {r.note && (
                          <p className="mt-0.5 text-xs text-slate-400">{r.note}</p>
                        )}
                        {r.due_at && (
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-neon-pink/80">
                            <Clock className="h-3 w-3" />
                            {formatDate(r.due_at)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-rose-500/20 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
