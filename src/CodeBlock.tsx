import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Eye, EyeOff, Code2 } from 'lucide-react';

interface Props {
  code: string;
  lang?: string;
}

/**
 * Detects whether a code block is a self-contained HTML document that can be
 * previewed in an iframe via srcdoc.
 */
function isPreviewableHtml(code: string, lang?: string): boolean {
  const l = (lang ?? '').toLowerCase();
  if (l && l !== 'html' && l !== 'htm') return false;
  return /<!doctype html>|<html[\s>]/i.test(code.trim());
}

export function CodeBlock({ code, lang }: Props) {
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const canPreview = isPreviewableHtml(code, lang);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-neon-blue/25 bg-deep-900/80">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-neon-blue/70">
          <Code2 className="h-3 w-3" />
          {lang || 'code'}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" /> Copié
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copier
              </>
            )}
          </button>
          {canPreview && (
            <button
              onClick={() => setPreview((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              {preview ? (
                <>
                  <EyeOff className="h-3 w-3" /> Code
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" /> Voir Preview
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {preview && canPreview ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-64 w-full bg-white"
          >
            <iframe
              title="preview"
              srcDoc={code}
              sandbox="allow-scripts"
              className="h-full w-full border-0"
            />
          </motion.div>
        ) : (
          <motion.pre
            key="code"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-h-96 overflow-auto p-3 text-[13px] leading-relaxed text-sky-100"
          >
            <code className="font-mono">{code}</code>
          </motion.pre>
        )}
      </AnimatePresence>
    </div>
  );
}
