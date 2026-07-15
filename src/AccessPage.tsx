import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Smartphone,
  AppWindow,
  XCircle,
  Zap,
  MessageSquare,
  Mail,
  Users,
  Wifi,
  Bluetooth,
  Flashlight,
  Battery,
  Volume2,
  Play,
  Bot,
  CalendarClock,
  Clock,
  Lightbulb,
  Thermometer,
  Lock,
  Mic,
  Loader2,
  ShieldCheck,
  Check,
  AlertTriangle,
  ScrollText,
  Send,
  Home,
  SlidersHorizontal,
  Info,
  AudioLines,
} from 'lucide-react';
import { loadAccessJournal, logAccessAction, cleanOldJournal, clearAllJournal, type AccessJournalRow } from './db';

type ConfirmMode = 'always' | 'each';
type Tab = 'control' | 'journal';
type ToastKind = 'sim' | 'success' | 'info';
interface Toast { id: number; kind: ToastKind; text: string }
interface PendingAction { action: string; category: string; detail: string; preview: string; onConfirm: () => void }

let toastId = 0;

export function AccessPage() {
  const [activated, setActivated] = useState<boolean | null>(null);
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>('each');
  const [tab, setTab] = useState<Tab>('control');
  const [journal, setJournal] = useState<AccessJournalRow[]>([]);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('iai_access_enabled');
    const mode = localStorage.getItem('iai_access_confirm') as ConfirmMode | null;
    setActivated(saved === 'true');
    if (mode) setConfirmMode(mode);
    cleanOldJournal(12).then(refreshJournal);
    const interval = setInterval(() => { cleanOldJournal(12).then(refreshJournal); }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function refreshJournal() {
    const rows = await loadAccessJournal();
    setJournal(rows);
  }

  function pushToast(kind: ToastKind, text: string) {
    const id = ++toastId;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }

  async function executeOrQueue(action: string, category: string, detail: string, preview: string, run: () => void) {
    if (confirmMode === 'always') run();
    else setPending({ action, category, detail, preview, onConfirm: run });
  }

  async function confirmPending() {
    if (!pending) return;
    pending.onConfirm();
    setPending(null);
  }

  async function logAndRun(action: string, category: string, status: 'success' | 'mobile_only' | 'error', detail: string) {
    await logAccessAction(action, category, status, detail);
    await refreshJournal();
  }

  async function simulate(label: string, category: string, simText: string, detail: string) {
    pushToast('sim', simText);
    pushToast('success', 'Action envoyée à MY PHONE');
    await logAndRun(label, category, 'mobile_only', detail);
  }

  function goBack() { window.location.hash = ''; }

  async function toggleVoice() {
    if (voiceListening) {
      mediaRecorderRef.current?.stop();
      setVoiceListening(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      pushToast('info', 'Micro non supporté sur ce navigateur.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        if (blob.size < 1000) { setVoiceListening(false); return; }
        pushToast('info', 'Transcription en cours…');
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
        const dataUrl = await blobToDataUrl(blob);
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({ action: 'transcribe', audioBase64: base64, audioMime: 'audio/webm' }),
          });
          const data = await res.json();
          const text = data?.transcript ?? '';
          if (text) { setVoiceText(text); pushToast('success', 'Voix convertie en texte.'); }
          else pushToast('info', 'Aucune parole détectée.');
        } catch {
          pushToast('info', 'Transcription indisponible — saisis ta commande manuellement.');
        }
        setVoiceListening(false);
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setVoiceListening(true);
      pushToast('info', 'Écoute en cours…');
    } catch {
      setVoiceListening(false);
      pushToast('info', 'Accès au micro refusé.');
    }
  }

  function runVoiceCommand() {
    const text = voiceText.trim();
    if (!text) return;
    const lower = text.toLowerCase();
    if (lower.includes('envoie') || lower.includes('équipe') || lower.includes('reunion') || lower.includes('réunion')) {
      const msg = text.replace(/.*(?:envoie|envoyer)\s+(?:à\s+(?:mon\s+)?(?:équipe|groupe|contact)\s*[:：]?\s*)?/i, '').trim() || text;
      executeOrQueue('Commande vocale → Diffusion groupe', 'comms', `Message: "${msg}"`, `Diffuser à l'équipe : "${msg}"`,
        () => simulate(`Diffuser groupe (vocale): "${msg}"`, 'comms', 'Fonction disponible sur App Mobile. Simulation: diffusion à l\'équipe.', 'WhatsApp Business requis'));
    } else if (lower.includes('lampe') || lower.includes('torche')) {
      executeOrQueue('Commande vocale → Lampe torche', 'phone', 'Toggle torche', 'Activer/désactiver la lampe torche',
        () => simulate('Lampe torche (vocale)', 'phone', 'Fonction disponible sur App Mobile. Simulation: torche activée.', 'API téléphone requise'));
    } else if (lower.includes('batterie')) {
      executeOrQueue('Commande vocale → Batterie', 'phone', 'Lecture batterie', 'Vérifier la batterie',
        () => simulate('Batterie (vocale)', 'phone', 'Fonction disponible sur App Mobile. Simulation: Batterie à 78%', 'Battery API non disponible'));
    } else {
      pushToast('info', 'Commande non reconnue dans ACCESS — essaie « Envoie à mon équipe… »');
    }
    setVoiceText('');
  }

  if (activated === null) {
    return <div className="grid min-h-screen place-items-center bg-[#050A18] px-4"><Loader2 className="h-6 w-6 animate-spin text-[#00D4FF]" /></div>;
  }
  if (!activated) {
    return <ActivationGate onActivate={(mode) => {
      localStorage.setItem('iai_access_enabled', 'true');
      localStorage.setItem('iai_access_confirm', mode);
      setConfirmMode(mode);
      setActivated(true);
      logAccessAction('Activation ACCESS', 'phone', 'success', `Mode: ${mode === 'always' ? 'Autoriser pour toujours' : 'Demander à chaque fois'}`);
    }} />;
  }

  return (
    <div className="min-h-screen bg-[#050A18] text-[#E0E0E0]">
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="absolute -left-20 top-0 h-96 w-96 rounded-full bg-[#00D4FF]/20 blur-[120px]" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <ToastStack toasts={toasts} />

      <div className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* ===== Sticky glassmorphism header ===== */}
        <header className="sticky top-0 z-30 -mx-4 mb-5 border-b border-white/5 bg-[rgba(5,10,24,0.7)] px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={goBack} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-[#00D4FF]">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
                  <Smartphone className="h-6 w-6 text-[#00D4FF]" />
                  <span className="font-bold">ACCESS</span>
                  <span className="text-slate-600">|</span>
                  <span className="font-bold">MY PHONE</span>
                </h1>
                <p className="text-xs font-normal" style={{ color: '#8A94A8' }}>Centre de contrôle</p>
              </div>
            </div>
          </div>

          {/* Pill tabs */}
          <div className="mt-3 flex gap-2">
            <PillTab active={tab === 'control'} onClick={() => setTab('control')} icon={SlidersHorizontal} label="Contrôle" />
            <PillTab active={tab === 'journal'} onClick={() => { setTab('journal'); refreshJournal(); }} icon={ScrollText} label="Journal" badge={journal.length} />
          </div>
        </header>

        {tab === 'control' ? (
          <>
            {/* ===== Authorization card with toggle ===== */}
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0A1128]/80 p-4 backdrop-blur-sm">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/30">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#E0E0E0]">
                  {confirmMode === 'always' ? 'Autorisé pour toujours' : 'Confirmation requise'}
                </p>
                <p className="text-xs" style={{ color: '#8A94A8' }}>
                  {confirmMode === 'always'
                    ? 'Les actions s\'exécutent sans confirmation.'
                    : 'Chaque action sensible requiert une confirmation.'}
                </p>
              </div>
              <ToggleSwitch
                on={confirmMode === 'always'}
                onChange={() => {
                  const next = confirmMode === 'always' ? 'each' : 'always';
                  setConfirmMode(next);
                  localStorage.setItem('iai_access_confirm', next);
                }}
              />
            </div>

            {/* ===== Voice command bar — large, centered ===== */}
            <div className="mb-8">
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0A1128]/80 p-3 backdrop-blur-sm">
                <button
                  onClick={toggleVoice}
                  className={`grid h-14 w-14 shrink-0 place-items-center rounded-full transition ${
                    voiceListening
                      ? 'bg-rose-500/20 text-rose-300 ring-2 ring-rose-400/50'
                      : 'bg-[#00D4FF]/15 text-[#00D4FF] hover:bg-[#00D4FF]/25'
                  }`}
                >
                  {voiceListening ? (
                    <span className="relative">
                      <AudioLines className="h-6 w-6 animate-pulse" />
                      <span className="absolute -inset-2 animate-ping rounded-full border-2 border-rose-400/40" />
                    </span>
                  ) : (
                    <Mic className="h-6 w-6" />
                  )}
                </button>

                <input
                  value={voiceText}
                  onChange={(e) => setVoiceText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runVoiceCommand()}
                  placeholder="Parlez ou tapez: Envoie à mon équipe un msg..."
                  style={{ height: 56 }}
                  className="min-w-0 flex-1 rounded-xl border border-[#1F2937] bg-[#0A1128] px-4 text-sm text-[#E0E0E0] placeholder:text-slate-600 focus:border-[#00D4FF] focus:outline-none focus:ring-1 focus:ring-[#00D4FF]/30"
                />

                <RippleButton
                  onClick={runVoiceCommand}
                  disabled={!voiceText.trim()}
                  round
                  className="h-14 w-14 shrink-0"
                >
                  <Send className="h-5 w-5" />
                </RippleButton>
              </div>
            </div>

            {/* ===== Section A: Contrôle Apps ===== */}
            <SectionTitle title="Contrôle Apps" />
            <div className="mb-8 grid gap-4 sm:grid-cols-2">
              <AppControlCard icon={AppWindow} title="Ouvrir App" placeholder="Nom de l'app (ex: Spotify)" actionLabel="Ouvrir"
                onAction={(name) => executeOrQueue(`Ouvrir App: ${name}`, 'apps', `App: ${name}`, `Ouvrir l'application "${name}"`,
                  () => simulate(`Ouvrir App: ${name}`, 'apps', `Fonction disponible sur App Mobile. Simulation: ouverture de ${name}.`, 'Capacitor + Permissions Android requis'))} />
              <AppControlCard icon={XCircle} title="Fermer App" placeholder="Nom de l'app à fermer" actionLabel="Fermer"
                onAction={(name) => executeOrQueue(`Fermer App: ${name}`, 'apps', `App: ${name}`, `Fermer l'application "${name}"`,
                  () => simulate(`Fermer App: ${name}`, 'apps', `Fonction disponible sur App Mobile. Simulation: fermeture de ${name}.`, 'Capacitor + Permissions Android requis'))} />
              <AppControlCard icon={Zap} title="Lancer Raccourci" placeholder="Nom du raccourci" actionLabel="Lancer"
                onAction={(name) => executeOrQueue(`Raccourci: ${name}`, 'apps', `Raccourci: ${name}`, `Lancer le raccourci "${name}"`,
                  () => simulate(`Raccourci: ${name}`, 'apps', `Fonction disponible sur App Mobile. Simulation: raccourci ${name} lancé.`, 'Shortcuts API requise'))} />
            </div>

            {/* ===== Section B: Communication Intelligente ===== */}
            <SectionTitle title="Communication Intelligente" />
            <div className="mb-8 grid gap-4 sm:grid-cols-2">
              <SmsCard onConfirm={(num, msg) => executeOrQueue(`SMS → ${num}`, 'comms', `À: ${num}`, `SMS à ${num}: "${msg}"`,
                () => { pushToast('success', `Message envoyé à ${num} — SIMULATION`); pushToast('success', 'Action envoyée à MY PHONE'); logAndRun(`SMS → ${num}`, 'comms', 'success', `Message: "${msg}"`); })} />
              <CommsCard icon={Bot} title="Préparer WhatsApp" fields={['Numéro/Contact', 'Message']} onConfirm={(vals) => executeOrQueue(`WhatsApp → ${vals[0]}`, 'comms', `À: ${vals[0]}`, `WhatsApp à ${vals[0]}: "${vals[1]}"`,
                () => simulate(`WhatsApp → ${vals[0]}`, 'comms', `Fonction disponible sur App Mobile. Simulation: WhatsApp à ${vals[0]}.`, 'API WhatsApp Business requis'))} />
              <CommsCard icon={Mail} title="Envoyer Email" fields={['Destinataire', 'Objet', 'Message']} onConfirm={(vals) => executeOrQueue(`Email → ${vals[0]}`, 'comms', `À: ${vals[0]}`, `Email à ${vals[0]} — "${vals[1]}"`,
                () => simulate(`Email → ${vals[0]}`, 'comms', `Fonction disponible sur App Mobile. Simulation: email envoyé à ${vals[0]}.`, 'SendGrid requis'))} />
              <CommsCard icon={CalendarClock} title="Planifier Message" fields={['Date/Heure', 'Destinataire', 'Message']} onConfirm={(vals) => executeOrQueue(`Message planifié → ${vals[1]}`, 'comms', `À: ${vals[1]} le ${vals[0]}`, `Planifier pour ${vals[0]} → ${vals[1]}: "${vals[2]}"`,
                () => simulate(`Message planifié → ${vals[1]}`, 'comms', `Fonction disponible sur App Mobile. Simulation: message planifié pour ${vals[0]}.`, 'Service de planification requis'))} />
              <CommsCard icon={Users} title="Diffuser à un Groupe" fields={['Nom du groupe', 'Message']} onConfirm={(vals) => executeOrQueue(`Diffusion → ${vals[0]}`, 'comms', `Groupe: ${vals[0]}`, `Diffuser à "${vals[0]}": "${vals[1]}"`,
                () => simulate(`Diffusion → ${vals[0]}`, 'comms', `Fonction disponible sur App Mobile. Simulation: diffusion à ${vals[0]}.`, 'WhatsApp Business / SendGrid requis'))} />
            </div>

            {/* ===== Section C: Téléphone & Multimédia ===== */}
            <SectionTitle title="Téléphone & Multimédia" />
            <div className="mb-8 grid gap-4 sm:grid-cols-2">
              <ToggleCard icon={Wifi} title="Wi-Fi" onToggle={(on) => executeOrQueue('Wi-Fi Toggle', 'phone', 'Toggle Wi-Fi', 'Activer/désactiver le Wi-Fi',
                () => simulate('Wi-Fi On/Off', 'phone', `Fonction disponible sur App Mobile. Simulation: Wi-Fi ${on ? 'activé' : 'désactivé'}.`, 'API téléphone requise'))} />
              <ToggleCard icon={Bluetooth} title="Bluetooth" onToggle={(on) => executeOrQueue('Bluetooth Toggle', 'phone', 'Toggle Bluetooth', 'Activer/désactiver le Bluetooth',
                () => simulate('Bluetooth On/Off', 'phone', `Fonction disponible sur App Mobile. Simulation: Bluetooth ${on ? 'activé' : 'désactivé'}.`, 'API téléphone requise'))} />
              <ToggleCard icon={Flashlight} title="Lampe Torche" onToggle={(on) => executeOrQueue('Lampe Torche', 'phone', 'Toggle torche', 'Activer/désactiver la lampe torche',
                () => simulate('Lampe Torche', 'phone', `Fonction disponible sur App Mobile. Simulation: torche ${on ? 'allumée' : 'éteinte'}.`, 'API téléphone requise'))} />
              <BatteryCard onCheck={() => executeOrQueue('Batterie', 'phone', 'Lecture batterie', 'Vérifier la batterie',
                () => simulate('Batterie', 'phone', 'Fonction disponible sur App Mobile. Simulation: Batterie à 78%', 'Battery API non disponible'))} />
              <SliderCard icon={Volume2} title="Volume" onAction={(v) => executeOrQueue(`Volume → ${v}%`, 'phone', `Volume: ${v}%`, `Régler le volume à ${v}%`,
                () => simulate(`Volume → ${v}%`, 'phone', `Fonction disponible sur App Mobile. Simulation: volume réglé à ${v}%.`, 'API téléphone requise'))} />
              <ToggleCard icon={Play} title="Play/Pause Musique" onToggle={(on) => executeOrQueue('Play/Pause Musique', 'phone', 'Toggle lecture', 'Lecture/Pause de la musique',
                () => simulate('Play/Pause Musique', 'phone', `Fonction disponible sur App Mobile. Simulation: ${on ? 'lecture' : 'pause'}.`, 'Media Session API requise'))} />
            </div>

            {/* ===== Section D: Automatisation & IoT ===== */}
            <SectionTitle title="Automatisation & IoT" />
            <div className="mb-8 grid gap-4 sm:grid-cols-2">
              <RoutineBuilder onCreate={(rule) => executeOrQueue(`Routine: ${rule}`, 'automation', `Règle: ${rule}`, `Créer routine: ${rule}`,
                () => simulate(`Routine: ${rule}`, 'automation', `Fonction disponible sur App Mobile. Simulation: routine créée.`, 'Moteur d\'automatisation requis'))} />
              <IoTDevices />
            </div>
            <div className="h-8" />
          </>
        ) : (
          <JournalView rows={journal} onRefresh={refreshJournal} />
        )}
      </div>

      <ConfirmModal pending={pending} onCancel={() => setPending(null)} onConfirm={confirmPending} />
    </div>
  );
}

// ---- Toasts (top-right) ----

function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed right-4 top-4 z-[60] flex w-full max-w-xs flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, x: 40, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 40, scale: 0.95 }}
            className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs shadow-lg backdrop-blur-md ${toastStyle(t.kind)}`}>
            {t.kind === 'success' ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="flex-1 text-[#E0E0E0]">{t.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function toastStyle(kind: ToastKind): string {
  switch (kind) {
    case 'success': return 'border-emerald-400/30 bg-emerald-950/70';
    case 'sim': return 'border-[#00D4FF]/30 bg-[#0A1128]/80';
    default: return 'border-white/15 bg-slate-900/80';
  }
}

// ---- Ripple Button ----

function RippleButton({ children, onClick, disabled, round, className = '' }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; round?: boolean; className?: string }) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (disabled) return;
    const btn = btnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const id = Date.now();
      setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
      setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 600);
    }
    onClick();
  }

  return (
    <button
      ref={btnRef}
      onClick={handleClick}
      disabled={disabled}
      className={`relative overflow-hidden bg-[#00D4FF] font-semibold text-[#050A18] transition hover:shadow-[0_0_15px_rgba(0,212,255,0.5)] disabled:cursor-not-allowed disabled:opacity-50 ${round ? 'rounded-full' : 'w-full rounded-xl py-2.5'} ${className}`}
    >
      <span className="relative z-10 flex items-center justify-center gap-1.5">{children}</span>
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute z-0 animate-ping rounded-full bg-white/40"
          style={{ left: r.x - 8, top: r.y - 8, width: 16, height: 16 }}
        />
      ))}
    </button>
  );
}

// ---- Toggle Switch ----

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-[#00D4FF]' : 'bg-white/15'}`}>
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-md ${on ? 'right-1' : 'left-1'}`}
      />
    </button>
  );
}

// ---- Activation Gate ----

function ActivationGate({ onActivate }: { onActivate: (mode: ConfirmMode) => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#050A18] px-4">
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-[#00D4FF]/20 blur-[120px]" />
      </div>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-md rounded-2xl border border-[#00D4FF]/20 bg-gradient-to-b from-[#0A1128]/60 to-[#050A18] p-6 shadow-[0_0_40px_rgba(0,212,255,0.2)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#00D4FF]/15 ring-1 ring-[#00D4FF]/30">
            <Smartphone className="h-6 w-6 text-[#00D4FF]" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Bienvenue dans ACCESS</h1>
            <p className="text-xs" style={{ color: '#8A94A8' }}>Module de contrôle téléphone</p>
          </div>
        </div>
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Activer les confirmations ? Toutes les actions sensibles demanderont une confirmation avant exécution.</p>
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={() => onActivate('each')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00D4FF] to-cyan-400 px-4 py-2.5 text-sm font-semibold text-[#050A18] transition hover:shadow-[0_0_25px_rgba(0,212,255,0.5)]">
            <ShieldCheck className="h-4 w-4" /> Oui, activer les confirmations
          </button>
          <button onClick={() => onActivate('always')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10">
            <Check className="h-4 w-4" /> Autoriser toujours
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ---- Pill Tab ----

function PillTab({ active, onClick, icon: Icon, label, badge }: { active: boolean; onClick: () => void; icon: typeof ScrollText; label: string; badge?: number }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${active ? 'bg-[#00D4FF] text-[#050A18]' : 'bg-transparent text-slate-400 hover:text-slate-200'}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
      {badge !== undefined && badge > 0 && <span className={`grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold ${active ? 'bg-[#050A18] text-[#00D4FF]' : 'bg-[#00D4FF] text-[#050A18]'}`}>{badge}</span>}
    </button>
  );
}

// ---- Section Title with accent line ----

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-[#E0E0E0]">{title}</h2>
      <div className="mt-1.5 h-0.5 w-12 rounded-full bg-[#00D4FF]" />
    </div>
  );
}

// ---- Glass Card ----

function GlassCard({ icon: Icon, title, children, wide }: { icon: typeof AppWindow; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`group rounded-2xl border border-white/[0.08] bg-[#0A1128]/80 p-5 backdrop-blur-sm transition-all hover:border-[#00D4FF]/30 hover:shadow-[0_0_15px_rgba(0,212,255,0.4)] ${wide ? 'sm:col-span-2' : ''}`}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#00D4FF]/10 ring-1 ring-[#00D4FF]/20 transition group-hover:bg-[#00D4FF]/20">
          <Icon className="h-5 w-5 text-[#00D4FF]" />
        </div>
        <h3 className="text-sm font-bold text-[#E0E0E0]">{title}</h3>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

// ---- Card: App control ----

function AppControlCard({ icon: Icon, title, placeholder, actionLabel, onAction }: { icon: typeof AppWindow; title: string; placeholder: string; actionLabel: string; onAction: (name: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <GlassCard icon={Icon} title={title}>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-[#1F2937] bg-[#0A1128] px-3 py-2.5 text-sm text-[#E0E0E0] placeholder:text-slate-600 focus:border-[#00D4FF] focus:outline-none focus:ring-1 focus:ring-[#00D4FF]/30" />
      <RippleButton onClick={() => value.trim() && onAction(value.trim())} disabled={!value.trim()}>
        {actionLabel}
      </RippleButton>
    </GlassCard>
  );
}

// ---- Card: SMS ----

function SmsCard({ onConfirm }: { onConfirm: (num: string, msg: string) => void }) {
  const [num, setNum] = useState('');
  const [msg, setMsg] = useState('');
  const [phase, setPhase] = useState<'form' | 'preview' | 'sent'>('form');
  return (
    <GlassCard icon={MessageSquare} title="Envoyer SMS">
      {phase === 'form' && (
        <>
          <input value={num} onChange={(e) => setNum(e.target.value)} placeholder="Numéro"
            className="w-full rounded-xl border border-[#1F2937] bg-[#0A1128] px-3 py-2.5 text-sm text-[#E0E0E0] placeholder:text-slate-600 focus:border-[#00D4FF] focus:outline-none focus:ring-1 focus:ring-[#00D4FF]/30" />
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message" rows={2}
            className="w-full resize-none rounded-xl border border-[#1F2937] bg-[#0A1128] px-3 py-2.5 text-sm text-[#E0E0E0] placeholder:text-slate-600 focus:border-[#00D4FF] focus:outline-none focus:ring-1 focus:ring-[#00D4FF]/30" />
          <RippleButton onClick={() => setPhase('preview')} disabled={!num.trim() || !msg.trim()}>Aperçu</RippleButton>
        </>
      )}
      {phase === 'preview' && (
        <>
          <div className="rounded-xl border border-[#00D4FF]/20 bg-[#00D4FF]/5 p-3 text-xs text-slate-300">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#00D4FF]">Aperçu du message</p>
            <p><span className="text-slate-500">À:</span> {num}</p>
            <p><span className="text-slate-500">Message:</span> {msg}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPhase('form')} className="flex-1 rounded-xl bg-white/5 py-2.5 text-xs text-slate-400 transition hover:bg-white/10">Retour</button>
            <div className="flex-1">
              <RippleButton onClick={() => { onConfirm(num, msg); setPhase('sent'); }}>Confirmer</RippleButton>
            </div>
          </div>
        </>
      )}
      {phase === 'sent' && (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            <Check className="h-4 w-4 shrink-0" />
            Message envoyé à {num} — SIMULATION
          </div>
          <button onClick={() => { setNum(''); setMsg(''); setPhase('form'); }} className="w-full rounded-xl bg-white/5 py-2.5 text-xs text-slate-400 transition hover:bg-white/10">Nouveau SMS</button>
        </>
      )}
    </GlassCard>
  );
}

// ---- Card: Comms (generic) ----

function CommsCard({ icon: Icon, title, fields, onConfirm }: { icon: typeof MessageSquare; title: string; fields: string[]; onConfirm: (vals: string[]) => void }) {
  const [vals, setVals] = useState<string[]>(fields.map(() => ''));
  const [preview, setPreview] = useState(false);
  return (
    <GlassCard icon={Icon} title={title}>
      {!preview ? (
        <>
          {fields.map((f, i) => (
            <input key={i} value={vals[i]} onChange={(e) => setVals((v) => v.map((x, j) => (j === i ? e.target.value : x)))} placeholder={f}
              className="w-full rounded-xl border border-[#1F2937] bg-[#0A1128] px-3 py-2.5 text-sm text-[#E0E0E0] placeholder:text-slate-600 focus:border-[#00D4FF] focus:outline-none focus:ring-1 focus:ring-[#00D4FF]/30" />
          ))}
          <RippleButton onClick={() => setPreview(true)} disabled={vals.every((v) => !v.trim())}>Aperçu</RippleButton>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-[#00D4FF]/20 bg-[#00D4FF]/5 p-3 text-xs text-slate-300">
            {fields.map((f, i) => vals[i].trim() && <p key={i} className="mb-1"><span className="text-slate-500">{f}:</span> {vals[i]}</p>)}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPreview(false)} className="flex-1 rounded-xl bg-white/5 py-2.5 text-xs text-slate-400 transition hover:bg-white/10">Retour</button>
            <div className="flex-1">
              <RippleButton onClick={() => { onConfirm(vals); setPreview(false); setVals(fields.map(() => '')); }}>Confirmer</RippleButton>
            </div>
          </div>
        </>
      )}
    </GlassCard>
  );
}

// ---- Card: Toggle ----

function ToggleCard({ icon: Icon, title, onToggle }: { icon: typeof Wifi; title: string; onToggle: (on: boolean) => void }) {
  const [on, setOn] = useState(false);
  return (
    <GlassCard icon={Icon} title={title}>
      <button onClick={() => { const next = !on; setOn(next); onToggle(next); }} className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition ${on ? 'bg-[#00D4FF]/15 text-[#00D4FF]' : 'bg-white/5 text-slate-400'}`}>
        {on ? 'Activé' : 'Désactivé'}
        <ToggleSwitch on={on} onChange={() => { const next = !on; setOn(next); onToggle(next); }} />
      </button>
    </GlassCard>
  );
}

// ---- Card: Battery ----

function BatteryCard({ onCheck }: { onCheck: () => void }) {
  const [val, setVal] = useState<{ pct: string; detail: string } | null>(null);
  return (
    <GlassCard icon={Battery} title="Batterie">
      {val ? (
        <div className="text-center py-1">
          <p className="text-3xl font-bold text-[#00D4FF]">{val.pct}</p>
          <p className="text-xs" style={{ color: '#8A94A8' }}>{val.detail}</p>
        </div>
      ) : (
        <p className="py-2 text-sm" style={{ color: '#8A94A8' }}>Appuie sur « Vérifier » pour simuler la lecture.</p>
      )}
      <RippleButton onClick={() => { setVal({ pct: '78%', detail: 'Fonction disponible sur App Mobile. Simulation' }); onCheck(); }}>
        Vérifier la batterie
      </RippleButton>
    </GlassCard>
  );
}

// ---- Card: Slider ----

function SliderCard({ icon: Icon, title, onAction }: { icon: typeof Volume2; title: string; onAction: (v: number) => void }) {
  const [val, setVal] = useState(50);
  return (
    <GlassCard icon={Icon} title={title}>
      <div className="py-1 text-center">
        <p className="text-3xl font-bold text-[#00D4FF]">{val}%</p>
      </div>
      <input type="range" min={0} max={100} value={val} onChange={(e) => setVal(Number(e.target.value))} className="w-full accent-[#00D4FF]" />
      <RippleButton onClick={() => onAction(val)}>Appliquer</RippleButton>
    </GlassCard>
  );
}

// ---- Routine Builder ----

function RoutineBuilder({ onCreate }: { onCreate: (rule: string) => void }) {
  const [hour, setHour] = useState('07:00');
  const [action, setAction] = useState('Ouvrir Spotify + Volume 50%');
  const rule = `Si Heure = ${hour} Alors ${action}`;
  return (
    <GlassCard icon={CalendarClock} title="Créer Routine" wide>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>Si Heure =</span>
        <input type="time" value={hour} onChange={(e) => setHour(e.target.value)}
          className="rounded-xl border border-[#1F2937] bg-[#0A1128] px-2 py-2 text-sm text-[#E0E0E0] focus:border-[#00D4FF] focus:outline-none" />
        <span>Alors</span>
        <input value={action} onChange={(e) => setAction(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-[#1F2937] bg-[#0A1128] px-2 py-2 text-sm text-[#E0E0E0] focus:border-[#00D4FF] focus:outline-none" />
      </div>
      <div className="rounded-xl border border-[#00D4FF]/20 bg-[#00D4FF]/5 p-2.5 text-xs text-[#00D4FF]">{rule}</div>
      <RippleButton onClick={() => onCreate(rule)}>Créer la routine</RippleButton>
    </GlassCard>
  );
}

// ---- IoT Devices ----

function IoTDevices() {
  const devices = [
    { name: 'Salon — Lumière', icon: Lightbulb, on: false },
    { name: 'Salon — Thermostat', icon: Thermometer, on: true, val: '21°C' },
    { name: 'Entrée — Serrure', icon: Lock, on: true, val: 'Verrouillée' },
    { name: 'Cuisine — Prise', icon: Zap, on: false },
  ];
  return (
    <GlassCard icon={Home} title="Appareils Connectés" wide>
      <ul className="space-y-2">
        {devices.map((d) => (
          <li key={d.name} className="flex items-center gap-3 rounded-xl border border-[#1F2937] bg-[#050A18]/50 px-3 py-2.5">
            <d.icon className="h-4 w-4 text-[#00D4FF]" />
            <div className="flex-1">
              <p className="text-sm text-[#E0E0E0]">{d.name}</p>
              {d.val && <p className="text-xs" style={{ color: '#8A94A8' }}>{d.val}</p>}
            </div>
            <span className={`relative h-5 w-9 rounded-full transition ${d.on ? 'bg-[#00D4FF]' : 'bg-white/15'}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${d.on ? 'right-0.5' : 'left-0.5'}`} />
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[10px]" style={{ color: '#8A94A8' }}>Appareils simulés — connexion IoT réelle nécessite Home Assistant / Matter</p>
    </GlassCard>
  );
}

// ---- Confirm Modal ----

function ConfirmModal({ pending, onCancel, onConfirm }: { pending: PendingAction | null; onCancel: () => void; onConfirm: () => void }) {
  return (
    <AnimatePresence>
      {pending && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onCancel}>
          <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-[#00D4FF]/20 bg-gradient-to-b from-[#0A1128]/80 to-[#050A18] p-5 shadow-[0_0_30px_rgba(0,212,255,0.3)]">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#00D4FF]"><ShieldCheck className="h-5 w-5" /> Confirmation requise</div>
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-[#E0E0E0]">
              <p className="mb-1 text-xs" style={{ color: '#8A94A8' }}>Action</p><p>{pending.preview}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={onCancel} className="flex-1 rounded-xl bg-white/5 py-2.5 text-sm text-slate-400 transition hover:bg-white/10">Annuler</button>
              <div className="flex-1">
                <RippleButton onClick={onConfirm}>
                  <Send className="h-4 w-4" /> Confirmer
                </RippleButton>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---- Journal ----

function JournalView({ rows, onRefresh }: { rows: AccessJournalRow[]; onRefresh: () => void }) {
  const [clearing, setClearing] = useState(false);
  async function handleClear() {
    setClearing(true);
    await clearAllJournal();
    await onRefresh();
    setClearing(false);
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#E0E0E0]"><ScrollText className="h-4 w-4 text-[#00D4FF]" /> Journal des actions</p>
        <button onClick={onRefresh} className="rounded-xl bg-white/5 px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/10">Actualiser</button>
      </div>
      <p className="mb-4 text-xs" style={{ color: '#8A94A8' }}>Les actions sont supprimées automatiquement après 12h.</p>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0A1128]/80 p-10 text-center backdrop-blur-sm">
          <ScrollText className="mx-auto mb-3 h-8 w-8 text-slate-700" />
          <p className="text-sm" style={{ color: '#8A94A8' }}>Aucune action récente. Le journal est vide.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map((r) => {
              const expires = expiresLabel(r.created_at);
              return (
                <li key={r.id} className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-[#0A1128]/80 p-3 backdrop-blur-sm">
                  <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#00D4FF]/10">
                    <Clock className="h-4 w-4 text-[#00D4FF]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-[#E0E0E0]"><span className="text-slate-500">{formatTime(r.created_at)}</span> — {r.action}</p>
                      <StatusBadge status={r.status} />
                    </div>
                    {r.detail && <p className="mt-0.5 text-xs" style={{ color: '#8A94A8' }}>{r.detail}</p>}
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] text-slate-600">{formatDate(r.created_at)}</span>
                      {expires && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">{expires}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <button onClick={handleClear} disabled={clearing} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-500/10 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50">
            {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Vider le journal maintenant
          </button>
        </>
      )}
    </div>
  );
}

// ---- Helpers ----

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = { success: 'bg-emerald-500/15 text-emerald-300', denied: 'bg-rose-500/15 text-rose-300', mobile_only: 'bg-[#00D4FF]/15 text-[#00D4FF]', error: 'bg-amber-500/15 text-amber-300' };
  const labels: Record<string, string> = { success: 'Succès', denied: 'Refusé', mobile_only: 'Mobile', error: 'Erreur' };
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[status] ?? styles.error}`}>{labels[status] ?? status}</span>;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function expiresLabel(iso: string): string | null {
  const msLeft = new Date(iso).getTime() + 12 * 60 * 60 * 1000 - Date.now();
  if (msLeft <= 0) return null;
  const h = Math.floor(msLeft / 3_600_000);
  const m = Math.floor((msLeft % 3_600_000) / 60_000);
  return `Expire dans ${h}h ${m}m`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
