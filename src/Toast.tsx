import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, AlertTriangle, Info } from 'lucide-react';

export interface ToastItem {
  id: number;
  message: string;
  kind: 'success' | 'error' | 'info';
}

let counter = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, kind: ToastItem['kind'] = 'success') => {
    const id = ++counter;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, push, dismiss };
}

export function ToastHost({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = t.kind === 'success' ? Check : t.kind === 'error' ? AlertTriangle : Info;
          const ring =
            t.kind === 'success'
              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
              : t.kind === 'error'
              ? 'border-rose-400/40 bg-rose-500/15 text-rose-200'
              : 'border-sky-400/40 bg-sky-500/15 text-sky-200';
          return (
            <motion.button
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              onClick={() => onDismiss(t.id)}
              className={`pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium backdrop-blur-md ${ring}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{t.message}</span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
