import { motion } from 'framer-motion';
import {
  Bot,
  Copy,
  Check,
  Download,
  Music,
  Loader2,
  Image as ImageIcon,
  FileText,
  Volume2,
} from 'lucide-react';
import { useState, useRef } from 'react';
import type { Message } from './types';
import { CodeBlock } from './CodeBlock';
import { synthesizeSpeech } from './config/models';

/** Renders a code-fenced assistant message, or plain text otherwise. */
function renderAssistantContent(content: string) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```')) {
      const m = part.match(/```(\w+)?\n?([\s\S]*?)```/);
      const lang = m?.[1] ?? '';
      const code = m?.[2] ?? part.replace(/```(\w+)?\n?/, '').replace(/```$/, '');
      return <CodeBlock key={i} code={code} lang={lang} />;
    }
    return <span key={i}>{part}</span>;
  });
}

export function ChatBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';

  if (msg.kind === 'image') {
    return <ImageBubble msg={msg} />;
  }
  if (msg.kind === 'music') {
    return <MusicBubble msg={msg} />;
  }
  if (!isUser && msg.pending) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-start"
      >
        <div className="glass flex items-center gap-2 rounded-2xl px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-neon-blue" />
          <span className="text-sm text-slate-300">Recherche en cours…</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-gradient-to-br from-neon-blue/90 to-neon-violet/90 text-white shadow-neon'
            : 'glass text-slate-100'
        }`}
      >
        {!isUser && (
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-neon-blue/70">
            <Bot className="h-3 w-3" /> IAI System
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">
          {isUser ? msg.content : renderAssistantContent(msg.content)}
        </div>
        {isUser && msg.attachmentUrl && (
          <img
            src={msg.attachmentUrl}
            alt={msg.attachmentName ?? 'image jointe'}
            className="mt-2 max-h-48 rounded-lg object-cover ring-1 ring-white/20"
          />
        )}
        {!isUser && msg.content && <SpeakerButton text={msg.content} />}
      </div>
    </motion.div>
  );
}

function SpeakerButton({ text }: { text: string }) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function play() {
    if (audioRef.current) {
      audioRef.current.play();
      return;
    }
    setLoading(true);
    const res = await synthesizeSpeech(text);
    setLoading(false);
    if (!res.ok || !res.audioUrl) return;
    const audio = new Audio(res.audioUrl);
    audio.onplay = () => setPlaying(true);
    audio.onended = () => setPlaying(false);
    audioRef.current = audio;
    audio.play();
  }

  return (
    <button
      onClick={play}
      className="mt-2 inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10 hover:text-white"
      title="Écouter la réponse (TTS)"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Volume2 className={`h-3 w-3 ${playing ? 'text-neon-blue' : ''}`} />
      )}
      {loading ? 'Synthèse…' : playing ? 'Lecture…' : 'Écouter'}
    </button>
  );
}

function ImageBubble({ msg }: { msg: Message }) {
  const [copied, setCopied] = useState(false);
  async function copyUrl() {
    if (!msg.imageUrl) return;
    try {
      await navigator.clipboard.writeText(msg.imageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="max-w-[90%] overflow-hidden rounded-2xl glass">
        <div className="mb-1 flex items-center gap-1.5 px-3 pt-2 text-[10px] uppercase tracking-widest text-neon-violet/80">
          <ImageIcon className="h-3 w-3" /> Image DALL-E 3
        </div>
        {msg.pending ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-neon-violet" />
            <span className="text-xs">Génération de l'image…</span>
          </div>
        ) : (
        <img
          src={msg.imageUrl}
          alt={msg.imagePrompt ?? 'image générée'}
          className="w-full"
        />
        )}
        {msg.imagePrompt && (
          <p className="px-3 py-2 text-xs italic text-slate-400">« {msg.imagePrompt} »</p>
        )}
        {!msg.pending && (
          <div className="flex items-center gap-1 border-t border-white/10 px-3 py-2">
            <button
              onClick={copyUrl}
              className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" /> Copié
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copier l'URL
                </>
              )}
            </button>
            <a
              href={msg.imageUrl}
              download={`iaai-${Date.now()}.png`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <Download className="h-3 w-3" /> Télécharger
            </a>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function MusicBubble({ msg }: { msg: Message }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="max-w-[85%] rounded-2xl glass px-4 py-3">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-neon-pink/80">
          <Music className="h-3 w-3" /> Composition
        </div>
        {msg.pending ? (
          <div className="flex items-center gap-3 py-2">
            <Loader2 className="h-5 w-5 animate-spin text-neon-pink" />
            <div className="flex-1">
              <div className="text-sm text-slate-200">Génération en cours…</div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-pink-300"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 4, ease: 'easeInOut' }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm leading-relaxed text-slate-100">
            <p className="mb-2">{msg.content}</p>
            <div className="flex items-center gap-2 rounded-lg bg-white/5 p-2 text-xs text-slate-400">
              <FileText className="h-4 w-4 text-neon-pink" />
              Composition simulée — l'audio sera disponible dans une prochaine version.
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function TypingBubble({ accent }: { accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="glass flex items-center gap-1.5 rounded-2xl px-4 py-3">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className={`h-2 w-2 rounded-full ${accent.replace('text-', 'bg-')}`}
            animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </div>
    </motion.div>
  );
}
