import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, X, Loader2, Send, Check } from 'lucide-react';
import { sendEmail } from './chatClient';

interface Props {
  open: boolean;
  onClose: () => void;
  onSent: (msg: string) => void;
}

export function EmailModal({ open, onClose, onSent }: Props) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTo('');
    setSubject('');
    setBody('');
    setSent(false);
    setError(null);
  }

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    setError(null);
    const html = `<div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;padding:24px;color:#0f172a">
      <h2 style="color:#38bdf8;margin:0 0 16px">${escapeHtml(subject)}</h2>
      <p style="white-space:pre-wrap;line-height:1.6;font-size:15px">${escapeHtml(body)}</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
      <p style="font-size:12px;color:#94a3b8">Envoyé depuis IAI System Projet</p>
    </div>`;
    const result = await sendEmail(to.trim(), subject.trim(), html);
    setSending(false);
    if (result.ok) {
      setSent(true);
      onSent(`Email envoyé à ${to.trim()}`);
      setTimeout(() => {
        reset();
        onClose();
      }, 1600);
    } else {
      setError(result.error ?? 'Échec de l\'envoi');
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-deep-900/70 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 12, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-2xl glass shadow-neon-strong"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Mail className="h-4 w-4 text-neon-blue" />
                Envoyer un email
              </div>
              <button
                onClick={onClose}
                className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 p-4">
              {sent ? (
                <div className="flex flex-col items-center gap-2 py-8 text-emerald-300">
                  <Check className="h-10 w-10" />
                  <p className="text-sm font-medium">Email envoyé avec succès !</p>
                </div>
              ) : (
                <>
                  <Field label="Destinataire">
                    <input
                      type="email"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder="exemple@email.com"
                      className="w-full rounded-lg border border-white/10 bg-deep-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-neon-blue/50 focus:outline-none"
                    />
                  </Field>
                  <Field label="Objet">
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Objet du message"
                      className="w-full rounded-lg border border-white/10 bg-deep-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-neon-blue/50 focus:outline-none"
                    />
                  </Field>
                  <Field label="Message">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={5}
                      placeholder="Votre message..."
                      className="w-full resize-none rounded-lg border border-white/10 bg-deep-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-neon-blue/50 focus:outline-none"
                    />
                  </Field>

                  {error && (
                    <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                      {error}
                    </p>
                  )}

                  <button
                    onClick={handleSend}
                    disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-blue to-neon-violet px-4 py-2.5 text-sm font-semibold text-white shadow-neon transition hover:shadow-neon-strong disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Envoi...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" /> Envoyer
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
