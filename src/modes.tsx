import {
  MessageCircle,
  Code2,
  Music,
  Palette,
  BarChart3,
  Rocket,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { ModeConfig } from './types';

export const MODES: (ModeConfig & { Icon: LucideIcon })[] = [
  {
    id: 'discussion',
    label: 'Discussion',
    Icon: MessageCircle,
    accent: 'text-neon-blue',
    gradient: 'from-sky-400 to-cyan-300',
    glow: 'shadow-neon',
    tagline: 'Conversation naturelle',
  },
  {
    id: 'code',
    label: 'Code',
    Icon: Code2,
    accent: 'text-neon-cyan',
    gradient: 'from-cyan-400 to-teal-300',
    glow: 'shadow-neon',
    tagline: 'Assistant développeur',
  },
  {
    id: 'musique',
    label: 'Musique',
    Icon: Music,
    accent: 'text-neon-pink',
    gradient: 'from-fuchsia-400 to-pink-300',
    glow: 'shadow-neon-pink',
    tagline: 'Créativité sonore',
  },
  {
    id: 'design',
    label: 'Design',
    Icon: Palette,
    accent: 'text-neon-violet',
    gradient: 'from-violet-400 to-indigo-300',
    glow: 'shadow-neon-violet',
    tagline: 'UX/UI & esthétique',
  },
  {
    id: 'analyse',
    label: 'Analyse',
    Icon: BarChart3,
    accent: 'text-emerald-300',
    gradient: 'from-emerald-400 to-teal-300',
    glow: 'shadow-neon',
    tagline: 'Données & insights',
  },
];

export const SUGGESTIONS = [
  {
    title: 'Créer une app',
    desc: 'Décris ton idée, je structure le projet et le code.',
    Icon: Rocket,
    prompt: 'Aide-moi à créer une application : je veux une todo list React avec sauvegarde locale. Par où commencer ?',
    gradient: 'from-sky-500/20 to-cyan-400/10',
    ring: 'hover:shadow-neon',
  },
  {
    title: 'Composer musique',
    desc: 'Accords, paroles, styles et arrangements originaux.',
    Icon: Music,
    prompt: 'Compose-moi une progression d\'accords douce et mélancolique en mi mineur, avec une idée de mélodie.',
    gradient: 'from-fuchsia-500/20 to-pink-400/10',
    ring: 'hover:shadow-neon-pink',
  },
  {
    title: 'Analyser mes données',
    desc: 'Interprète, structure et visualise tes données.',
    Icon: Sparkles,
    prompt: 'J\'ai un tableau de ventes mensuelles sur 12 mois. Comment structurer et visualiser ces données pour dégager des tendances ?',
    gradient: 'from-emerald-500/20 to-teal-400/10',
    ring: 'hover:shadow-neon',
  },
];
