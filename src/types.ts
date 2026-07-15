export type Mode = 'discussion' | 'code' | 'musique' | 'design' | 'analyse';

export type MessageKind = 'text' | 'image' | 'music';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: Mode;
  createdAt: number;
  kind?: MessageKind;
  imageUrl?: string;
  imagePrompt?: string;
  pending?: boolean;
  attachmentUrl?: string;
  attachmentName?: string;
}

export interface ModeConfig {
  id: Mode;
  label: string;
  accent: string;
  gradient: string;
  glow: string;
  tagline: string;
}
