import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Mic,
  Bot,
  Sparkles,
  Trash2,
  AlertTriangle,
  Loader2,
  Brain,
  Code2,
  Image as ImageIcon,
  Music,
  FileText,
  Search,
  Languages,
  Bell,
  ScrollText,
  Paperclip,
  X,
  AudioLines,
  Mail,
  Download,
  Smartphone,
  MoreVertical,
} from 'lucide-react';
import { MODES, SUGGESTIONS } from './modes';
import type { Message, Mode } from './types';
import {
  sendChat,
  supabase,
  generateImage,
  analyzeFile,
  transcribeAudio,
  webSearch,
} from './chatClient';
import {
  getOrCreateUser,
  loadConversations,
  rowsToMessages,
  clearConversations,
  loadMemories,
} from './db';
import { MemoryPanel } from './MemoryPanel';
import { ChatBubble, TypingBubble } from './ChatBubble';
import { ToastHost, useToasts } from './Toast';
import { extractPdfText, fileToDataUrl } from './pdfUtils';
import { EmailModal } from './EmailModal';
import { RemindersPanel } from './RemindersPanel';
import { ThemeToggle } from './ThemeToggle';
import { exportConversationPdf } from './exportPdf';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function dataUrlToBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

const QUICK_ACTIONS = [
  { id: 'web', label: 'Recherche Web', Icon: Search },
  { id: 'translate', label: 'Traduire', Icon: Languages },
  { id: 'reminder', label: 'Rappel', Icon: Bell },
  { id: 'summarize', label: 'Résumer', Icon: ScrollText },
];

export default function App() {
  const [mode, setMode] = useState<Mode>('discussion');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [attachment, setAttachment] = useState<{ dataUrl: string; name: string } | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [memoryCount, setMemoryCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const overflowRef = useRef<HTMLDivElement>(null);
  const activeMode = useMemo(() => MODES.find((m) => m.id === mode)!, [mode]);
  const { toasts, push, dismiss } = useToasts();

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) {
        setBooting(false);
        return;
      }
      const user = await getOrCreateUser();
      if (!active || !user) {
        setBooting(false);
        return;
      }
      setUserId(user.id);
      setUserName(user.name);
      const [rows, mems] = await Promise.all([
        loadConversations(user.id),
        loadMemories(user.id),
      ]);
      if (!active) return;
      setMessages(rowsToMessages(rows));
      setMemoryCount(mems.length);
      setBooting(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Close overflow menu on outside click
  useEffect(() => {
    if (!overflowOpen) return;
    function onClick(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [overflowOpen]);

  async function refreshMemoryCount() {
    if (!userId) return;
    const mems = await loadMemories(userId);
    setMemoryCount(mems.length);
    const user = await getOrCreateUser();
    if (user) setUserName(user.name);
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, loading]);

  async function handleSend(text?: string, withAttachment = true) {
    const content = (text ?? input).trim();
    if ((!content && !attachment) || loading) return;
    setError(null);
    setInput('');

    const userMsg: Message = {
      id: uid(),
      role: 'user',
      content: content || (attachment ? `Image jointe : ${attachment.name}` : ''),
      mode,
      createdAt: Date.now(),
      attachmentUrl: withAttachment && attachment ? attachment.dataUrl : undefined,
      attachmentName: withAttachment && attachment ? attachment.name : undefined,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    const att = withAttachment && attachment
      ? { dataUrl: attachment.dataUrl, mime: 'image/jpeg' }
      : undefined;
    if (attachment) setAttachment(null);

    const result = await sendChat(next, mode, userId ?? undefined, att);

    if (!result.ok) {
      setError(result.error ?? 'Une erreur est survenue.');
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: 'Désolé, je n\'ai pas pu répondre. ' + (result.error ?? ''),
          mode,
          createdAt: Date.now(),
        },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: result.reply,
          mode,
          createdAt: Date.now(),
        },
      ]);
      if (result.memorySaved) refreshMemoryCount();
    }
    setLoading(false);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function toggleVoice() {
    if (isListening) {
      stopRecording();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone non supporté par ce navigateur.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mime });
        if (blob.size < 1000) {
          setIsListening(false);
          return;
        }
        await transcribeBlob(blob, mime);
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setIsListening(true);
      push('Enregistrement… clique pour stopper', 'info');
    } catch (err) {
      setError('Accès au micro refusé : ' + (err as Error).message);
      setIsListening(false);
    }
  }

  function stopRecording() {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    setIsListening(false);
  }

  async function transcribeBlob(blob: Blob, mime: string) {
    setTranscribing(true);
    push('Transcription Whisper…', 'info');
    try {
      const dataUrl = await blobToDataUrl(blob);
      const base64 = dataUrlToBase64(dataUrl);
      const result = await transcribeAudio(base64, mime);
      if (result.ok && result.transcript) {
        setInput((prev) => (prev ? prev + ' ' : '') + result.transcript);
        push('Transcription ajoutée', 'success');
      } else {
        setError(result.error ?? 'Échec de la transcription');
        push('Échec Whisper', 'error');
      }
    } catch (err) {
      setError((err as Error).message);
      push('Erreur transcription', 'error');
    }
    setTranscribing(false);
  }

  async function clearChat() {
    if (userId) await clearConversations(userId);
    setMessages([]);
    setError(null);
  }

  async function handleGenerateCode() {
    const prompt = input.trim() || 'Génère une petite page HTML de démonstration avec un compteur animé.';
    setInput('');
    setLoading(true);
    const userMsg: Message = {
      id: uid(),
      role: 'user',
      content: prompt,
      mode,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const result = await sendChat([...messages, userMsg], 'code', userId ?? undefined);
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'assistant',
        content: result.ok ? result.reply : 'Erreur: ' + (result.error ?? ''),
        mode: 'code',
        createdAt: Date.now(),
      },
    ]);
    setLoading(false);
    push(result.ok ? 'Code généré' : 'Échec de la génération', result.ok ? 'success' : 'error');
  }

  async function handleGenerateImage() {
    const prompt =
      input.trim() || 'un logo futuriste bleu et violet, style minimaliste, hautement détaillé';
    setInput('');
    const userMsg: Message = {
      id: uid(),
      role: 'user',
      content: `Génère une image : ${prompt}`,
      mode,
      createdAt: Date.now(),
    };
    const pendingId = uid();
    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        id: pendingId,
        role: 'assistant',
        content: '',
        kind: 'image',
        imageUrl: undefined,
        imagePrompt: prompt,
        pending: true,
        mode,
        createdAt: Date.now(),
      },
    ]);

    const result = await generateImage(prompt, mode, userId ?? undefined);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === pendingId
          ? {
              ...m,
              pending: false,
              imageUrl: result.ok ? result.url : undefined,
              content: result.ok ? '' : 'Erreur: ' + (result.error ?? ''),
            }
          : m,
      ),
    );
    push(result.ok ? 'Image générée par DALL-E 3' : 'Échec DALL-E', result.ok ? 'success' : 'error');
  }

  async function handleComposeMusic() {
    const prompt = input.trim() || 'une mélodie douce et mélancolique en mi mineur';
    setInput('');
    const userMsg: Message = {
      id: uid(),
      role: 'user',
      content: `Compose une musique : ${prompt}`,
      mode,
      createdAt: Date.now(),
    };
    const pendingId = uid();
    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        id: pendingId,
        role: 'assistant',
        content: '',
        kind: 'music',
        pending: true,
        mode,
        createdAt: Date.now(),
      },
    ]);
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                pending: false,
                content: `Composition pour « ${prompt} » :\n\n• Tonalité : Mi mineur\n• Tempo : 72 BPM\n• Structure : Intro → Couplet → Refrain → Pont → Outro\n• Accords : Em - G - D - C (couplet) | C - G - Em - D (refrain)\n\nLa piste audio sera disponible prochainement.`,
              }
            : m,
        ),
      );
      push('Composition terminée (simulée)', 'success');
    }, 4000);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const userMsg: Message = {
      id: uid(),
      role: 'user',
      content: `Analyse le document : ${file.name}`,
      mode,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    push(`Analyse de ${file.name}…`, 'info');

    try {
      const mime = file.type;
      let payload = '';
      if (mime.startsWith('image/')) {
        payload = await fileToDataUrl(file);
      } else if (mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const text = await extractPdfText(file);
        payload = text;
        if (!text.trim()) {
          push('PDF sans texte extractible', 'error');
          setLoading(false);
          return;
        }
      } else if (mime.startsWith('text/')) {
        payload = await file.text();
      } else {
        push('Format non supporté (PDF, image, texte)', 'error');
        setLoading(false);
        return;
      }

      const result = await analyzeFile(
        payload,
        mime,
        `Analyse et résume le document ${file.name}.`,
        mode,
        userId ?? undefined,
      );

      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: result.ok ? result.reply ?? '' : 'Erreur: ' + (result.error ?? ''),
          mode,
          createdAt: Date.now(),
        },
      ]);
      push(result.ok ? 'Document analysé' : 'Échec analyse', result.ok ? 'success' : 'error');
    } catch (err) {
      setError((err as Error).message);
      push('Erreur lors de la lecture du fichier', 'error');
    }
    setLoading(false);
  }

  async function handleImageAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      push('Sélectionne une image', 'error');
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setAttachment({ dataUrl, name: file.name });
  }

  async function handleQuickAction(actionId: string) {
    setOverflowOpen(false);
    if (actionId === 'web') {
      const query = input.trim();
      if (!query) {
        push('Écris ta recherche d\'abord', 'info');
        return;
      }
      setInput('');
      await doWebSearch(query);
    } else if (actionId === 'translate') {
      const text = input.trim();
      if (!text) {
        push('Écris le texte à traduire', 'info');
        return;
      }
      setInput('');
      handleSend(`Traduis ce texte en anglais : ${text}`, false);
    } else if (actionId === 'reminder') {
      setRemindersOpen(true);
    } else if (actionId === 'summarize') {
      const text = input.trim();
      if (!text) {
        push('Écris le texte à résumer', 'info');
        return;
      }
      setInput('');
      handleSend(`Résume le texte suivant : ${text}`, false);
    }
  }

  async function doWebSearch(query: string) {
    const userMsg: Message = {
      id: uid(),
      role: 'user',
      content: `Recherche web : ${query}`,
      mode,
      createdAt: Date.now(),
    };
    const pendingId = uid();
    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        id: pendingId,
        role: 'assistant',
        content: '',
        pending: true,
        mode,
        createdAt: Date.now(),
      },
    ]);
    setLoading(true);
    push('Recherche Tavily…', 'info');

    const result = await webSearch(query);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === pendingId
          ? {
              ...m,
              pending: false,
              content: result.ok
                ? result.reply ?? formatResultsLocal(query, result.results ?? [])
                : 'Erreur: ' + (result.error ?? ''),
            }
          : m,
      ),
    );
    setLoading(false);
    push(result.ok ? 'Résultats trouvés' : 'Échec recherche', result.ok ? 'success' : 'error');
  }

  function handleExportPdf() {
    if (messages.length === 0) {
      push('Aucune conversation à exporter', 'info');
      return;
    }
    exportConversationPdf(messages);
    push('Export PDF lancé', 'success');
  }

  const hasChat = messages.length > 0;
  const showName = userName && userName.length > 0;
  const greeting = showName ? `Bonjour ${userName}` : 'Bonjour';

  const modeAction = useMemo(() => {
    switch (mode) {
      case 'code':
        return { label: 'Générer Code', Icon: Code2, run: handleGenerateCode };
      case 'design':
        return { label: 'Générer Image', Icon: ImageIcon, run: handleGenerateImage };
      case 'musique':
        return { label: 'Composer Musique', Icon: Music, run: handleComposeMusic };
      case 'analyse':
        return { label: 'Upload PDF/Image', Icon: FileText, run: () => fileInputRef.current?.click() };
      default:
        return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, input, messages]);

  return (
    <div className="aurora-bg relative flex h-screen w-full flex-col overflow-hidden text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,212,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.3) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/*,text/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageAttach}
        className="hidden"
      />

      <ToastHost toasts={toasts} onDismiss={dismiss} />

      {/* ===== Compact Header — full width ===== */}
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-white/5 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2.5">
          {/* Compact robot logo */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 12 }}
            className="relative shrink-0"
          >
            <div className="absolute -inset-1.5 rounded-full bg-neon-blue/20 blur-lg animate-pulseGlow" />
            <div className="relative grid h-10 w-10 place-items-center rounded-xl border border-neon-blue/40 bg-gradient-to-br from-deep-700 to-deep-900 shadow-neon">
              <Bot className="h-5 w-5 text-neon-blue animate-float" strokeWidth={1.8} />
              <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-deep-900" />
              </span>
            </div>
          </motion.div>
          <div className="text-left">
            <h1 className="text-base font-bold leading-none tracking-tight sm:text-lg">
              <span className="neon-text">IAI System</span>{' '}
              <span className="text-white">Projet</span>
            </h1>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-slate-500">
              Assistant IA
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <a
            href="#/access"
            className="grid h-8 w-8 place-items-center rounded-full border border-blue-400/30 bg-blue-500/10 text-blue-300 transition hover:bg-blue-500/20 hover:shadow-[0_0_15px_rgba(0,212,255,0.3)] sm:inline-flex sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs sm:font-medium"
            title="ACCESS | MY PHONE"
          >
            <Smartphone className="h-4 w-4" />
            <span className="hidden sm:inline">ACCESS</span>
          </a>
          <button
            onClick={() => setRemindersOpen(true)}
            className="grid h-8 w-8 place-items-center rounded-full border border-neon-pink/30 bg-neon-pink/10 text-neon-pink transition hover:bg-neon-pink/20 hover:shadow-neon-pink"
            title="Rappels"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMemoryOpen(true)}
            className="relative grid h-8 w-8 place-items-center rounded-full border border-neon-violet/30 bg-neon-violet/10 text-neon-violet transition hover:bg-neon-violet/20 hover:shadow-neon-violet sm:inline-flex sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs sm:font-medium"
            title="Ma Mémoire"
          >
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">Mémoire</span>
            {memoryCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-neon-violet px-1 text-[10px] font-bold text-deep-900 sm:static sm:ml-0.5">
                {memoryCount}
              </span>
            )}
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* ===== Mode selector — full width ===== */}
      <div className="relative z-10 shrink-0 px-4 pt-3 sm:px-6">
        <div className="mx-auto grid max-w-5xl grid-cols-5 gap-2 sm:gap-3">
          {MODES.map((m) => {
            const isActive = m.id === mode;
            return (
              <motion.button
                key={m.id}
                whileTap={{ scale: 0.94 }}
                onClick={() => setMode(m.id)}
                className={`relative flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 transition-all sm:py-3 ${
                  isActive
                    ? `border-transparent ${m.glow} bg-gradient-to-br ${m.gradient}/15`
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="mode-glow"
                    className={`absolute inset-0 rounded-xl bg-gradient-to-br ${m.gradient} opacity-20`}
                  />
                )}
                <m.Icon
                  className={`relative h-5 w-5 sm:h-6 sm:w-6 ${isActive ? m.accent : 'text-slate-300'}`}
                  strokeWidth={2}
                />
                <span
                  className={`relative text-[10px] font-medium sm:text-xs ${
                    isActive ? 'text-white' : 'text-slate-400'
                  }`}
                >
                  {m.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ===== Chat area — scrolls independently, full width ===== */}
      <div className="relative z-0 flex flex-1 flex-col overflow-hidden px-4 pt-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
          {/* Top utility bar */}
          {hasChat && (
            <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setEmailOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neon-blue/30 bg-neon-blue/10 px-3 py-1.5 text-xs text-neon-blue transition hover:bg-neon-blue/20"
                >
                  <Mail className="h-3.5 w-3.5" /> Email
                </button>
                <button
                  onClick={handleExportPdf}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-500/20"
                >
                  <Download className="h-3.5 w-3.5" /> Exporter
                </button>
              </div>
              <button
                onClick={clearChat}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:border-rose-400/40 hover:text-rose-300"
              >
                <Trash2 className="h-3.5 w-3.5" /> Effacer
              </button>
            </div>
          )}

          {/* Scrollable chat container */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto rounded-2xl glass-soft p-3 sm:p-4"
          >
            {booting ? (
              <div className="flex h-full min-h-32 items-center justify-center text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : !hasChat ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <h2 className="text-xl font-bold text-slate-100 sm:text-2xl">
                      {greeting}{' '}
                      <span className="inline-block animate-float">👋</span>
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Comment puis-je aider aujourd'hui ?
                    </p>
                  </motion.div>
                </AnimatePresence>

                {/* Glassmorphism suggestion cards */}
                <div className="mt-6 grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
                  {SUGGESTIONS.map((s) => (
                    <motion.button
                      key={s.title}
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSend(s.prompt, false)}
                      className="glass-card group relative overflow-hidden rounded-2xl p-4 text-left"
                    >
                      <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl bg-neon-blue/10 ring-1 ring-neon-blue/20 transition group-hover:bg-neon-blue/20">
                        <s.Icon className="h-5 w-5 text-neon-blue" />
                      </div>
                      <h3 className="text-sm font-bold text-white">{s.title}</h3>
                      <p className="mt-1 text-xs text-slate-300/80">{s.desc}</p>
                      <div className="shimmer-line mt-3 h-px w-full opacity-0 transition-opacity group-hover:opacity-100" />
                    </motion.button>
                  ))}
                </div>

                <p className="mt-6 max-w-xs text-xs text-slate-500">
                  Choisissez un mode ci-dessus, écrivez votre message ou
                  sélectionnez une suggestion pour démarrer.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((msg) => (
                  <ChatBubble key={msg.id} msg={msg} />
                ))}
                {loading && <TypingBubble accent={activeMode.accent} />}
              </div>
            )}
          </div>

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-2 flex shrink-0 items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="flex-1">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ===== Bottom toolbar — full width, minimal ===== */}
      <div className="relative z-20 shrink-0 border-t border-white/5 px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-2">
          {/* Mode-specific action button */}
          {modeAction && (
            <div className="flex justify-center">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={modeAction.run}
                disabled={loading && mode !== 'analyse'}
                className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${activeMode.gradient} px-4 py-1.5 text-xs font-semibold text-deep-900 shadow-neon transition hover:shadow-neon-strong disabled:opacity-50`}
              >
                <modeAction.Icon className="h-4 w-4" />
                {modeAction.label}
              </motion.button>
            </div>
          )}

          {/* Attachment preview */}
          <AnimatePresence>
            {attachment && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex items-center gap-2 rounded-xl glass p-2"
              >
                <img
                  src={attachment.dataUrl}
                  alt={attachment.name}
                  className="h-10 w-10 rounded-lg object-cover ring-1 ring-white/15"
                />
                <span className="flex-1 truncate text-xs text-slate-300">{attachment.name}</span>
                <button
                  onClick={() => setAttachment(null)}
                  className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-slate-400 transition hover:bg-rose-500/20 hover:text-rose-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Attach submenu */}
          <AnimatePresence>
            {showAttach && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex gap-2 rounded-xl glass p-2"
              >
                {[
                  { label: 'Image', run: () => imageInputRef.current?.click() },
                  { label: 'Fichier', run: () => fileInputRef.current?.click() },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => {
                      setShowAttach(false);
                      opt.run();
                    }}
                    className="flex-1 rounded-lg bg-white/5 px-2 py-2 text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
                  >
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main input row: textarea + send + mic + overflow */}
          <div className="glass flex items-end gap-2 rounded-2xl p-2 shadow-neon">
            <button
              onClick={() => setShowAttach((v) => !v)}
              title="Joindre"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-neon-blue"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
              placeholder={`Écrire en mode ${activeMode.label.toLowerCase()}...`}
              className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />

            {/* Overflow "..." menu */}
            <div ref={overflowRef} className="relative shrink-0">
              <button
                onClick={() => setOverflowOpen((v) => !v)}
                title="Plus d'outils"
                className={`grid h-10 w-10 place-items-center rounded-xl transition ${
                  overflowOpen
                    ? 'bg-neon-blue/20 text-neon-blue ring-1 ring-neon-blue/40'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-neon-blue'
                }`}
              >
                <MoreVertical className="h-5 w-5" />
              </button>
              <AnimatePresence>
                {overflowOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-12 right-0 z-30 w-44 overflow-hidden rounded-xl glass shadow-neon-strong"
                  >
                    {QUICK_ACTIONS.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => handleQuickAction(a.id)}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-slate-300 transition hover:bg-neon-blue/10 hover:text-neon-blue"
                      >
                        <a.Icon className="h-4 w-4 shrink-0" />
                        {a.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={toggleVoice}
              title="Micro (Whisper)"
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${
                isListening || transcribing
                  ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/50 animate-pulseGlow'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-neon-pink'
              }`}
            >
              {transcribing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isListening ? (
                <AudioLines className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>

            <button
              onClick={() => handleSend()}
              disabled={(!input.trim() && !attachment) || loading}
              title="Envoyer"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-neon-blue to-neon-violet text-white shadow-neon transition hover:shadow-neon-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>

          <p className="text-center text-[10px] text-slate-500">
            {supabase ? 'IAI System Projet' : 'Mode démo — Supabase non configuré'}
          </p>
        </div>
      </div>

      <EmailModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        onSent={(msg) => push(msg, 'success')}
      />
      <RemindersPanel open={remindersOpen} onClose={() => setRemindersOpen(false)} />
      <MemoryPanel
        open={memoryOpen}
        onClose={() => {
          setMemoryOpen(false);
          refreshMemoryCount();
        }}
        userId={userId}
        userName={userName}
        onChanged={refreshMemoryCount}
      />
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function formatResultsLocal(
  query: string,
  results: Array<{ title: string; url: string; content: string }>,
): string {
  if (!results.length) return `Aucun résultat pour « ${query} ».`;
  let out = `Résultats pour « ${query} » :\n\n`;
  results.forEach((r, i) => {
    out += `**${i + 1}. ${r.title}**\n${r.content}\n🔗 [Source](${r.url})\n\n`;
  });
  return out.trim();
}
