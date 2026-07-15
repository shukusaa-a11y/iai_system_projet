/**
 * Centralized model configuration for IAI System Projet.
 *
 * The frontend imports these names for labels/tooltips; the `chat` edge
 * function reads the same identifiers to pick the OpenAI model for each
 * capability. Keeping them in one place makes it easy to upgrade models
 * without hunting through the codebase.
 */
export const MODELS = {
  /** Chat & vision model — used for text replies and image analysis. */
  chat: 'gpt-4o',
  /** Image generation model — used in Design mode. */
  image: 'dall-e-3',
  /** Speech-to-text model — used by the microphone input. */
  transcription: 'whisper-1',
  /** Text-to-speech model — used so IAI can reply by voice. */
  tts: 'tts-1',
  /** Voice output format for OpenAI TTS. */
  ttsVoice: 'alloy',
  ttsFormat: 'mp3' as const,
} as const;

/** TTS payload sent to the edge function. */
export interface TtsRequest {
  action: 'tts';
  text: string;
  voice?: string;
  format?: string;
}

export interface TtsResult {
  ok: boolean;
  audioUrl?: string;
  error?: string;
}

/**
 * Request speech audio for `text` from the chat edge function.
 * Returns an object URL ready to play in an <audio> element.
 */
export async function synthesizeSpeech(
  text: string,
  voice: string = MODELS.ttsVoice,
  format: string = MODELS.ttsFormat,
): Promise<TtsResult> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: false, error: 'Supabase non configuré.' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ action: 'tts', text, voice, format } satisfies TtsRequest),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `TTS ${res.status}: ${errText}` };
    }
    const blob = await res.blob();
    return { ok: true, audioUrl: URL.createObjectURL(blob) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
