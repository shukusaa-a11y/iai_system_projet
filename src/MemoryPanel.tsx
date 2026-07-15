import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Brain,
  Trash2,
  User,
  Heart,
  Lightbulb,
  Plus,
  Loader2,
} from 'lucide-react';
import type { MemoryRow } from './db';
import { deleteMemory, deleteAllMemories, loadMemories } from './db';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  userName: string | null;
  onChanged: () => void;
}

function memoryIcon(key: string) {
  if (key === 'name') return User;
  if (key === 'likes') return Heart;
  return Lightbulb;
}

function memoryLabel(key: string) {
  if (key === 'name') return 'Prénom';
  if (key === 'likes') return "J'aime";
  if (key === 'fact') return 'Fait retenu';
  return key;
}

export function MemoryPanel({
  open,
  onClose,
  userId,
  userName,
  onChanged,
}: Props) {
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !userId) return;
    let active = true;
    setLoading(true);
    loadMemories(userId).then((rows) => {
      if (active) {
        setMemories(rows);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [open, userId]);

  async function removeOne(id: string) {
    setBusy(id);
    await deleteMemory(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
    setBusy(null);
    onChanged();
  }

  async function removeAll() {
    if (!userId) return;
    setBusy('all');
    await deleteAllMemories(userId);
    setMemories([]);
    setBusy(null);
    onChanged();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex justify-end"
        >
          <div
            className="absolute inset-0 bg-deep-900/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="relative flex h-full w-full max-w-md flex-col border-l border-neon-blue/20 bg-gradient-to-b from-deep-800 to-deep-900 shadow-neon-strong"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon-blue/20 to-neon-violet/20 ring-1 ring-white/15">
                  <Brain className="h-5 w-5 text-neon-violet" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Ma Mémoire</h2>
                  <p className="text-xs text-slate-400">
                    {userName ? `Profil : ${userName}` : 'Profil invité'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loading ? (
                <div className="flex h-32 items-center justify-center text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : memories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                    <Brain className="h-7 w-7 text-slate-500" />
                  </div>
                  <p className="text-sm text-slate-400">
                    Aucun souvenir pour l'instant.
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-slate-500">
                    Dis-moi par exemple « Retiens que je m'appelle Boss » ou
                    « J'aime le café » et je l'enregistrerai ici.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  <AnimatePresence>
                    {memories.map((m) => {
                      const Icon = memoryIcon(m.key);
                      return (
                        <motion.li
                          key={m.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: 40 }}
                          className="group glass flex items-center gap-3 rounded-xl p-3"
                        >
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/10">
                            <Icon className="h-4.5 w-4.5 text-neon-blue" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] uppercase tracking-widest text-neon-blue/70">
                              {memoryLabel(m.key)}
                            </div>
                            <div className="truncate text-sm text-slate-100">
                              {m.value}
                            </div>
                          </div>
                          <button
                            onClick={() => removeOne(m.id)}
                            disabled={busy === m.id}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-slate-400 transition hover:bg-rose-500/20 hover:text-rose-300"
                          >
                            {busy === m.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {/* Footer */}
            {memories.length > 0 && (
              <div className="border-t border-white/10 px-5 py-4">
                <button
                  onClick={removeAll}
                  disabled={busy === 'all'}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                >
                  {busy === 'all' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Tout oublier ({memories.length})
                </button>
                <p className="mt-2 flex items-center justify-center gap-1 text-center text-[11px] text-slate-500">
                  <Plus className="h-3 w-3" />
                  Dis « Retiens que ... » dans le chat pour ajouter un souvenir.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
