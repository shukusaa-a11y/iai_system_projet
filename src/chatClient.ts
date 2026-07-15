import { createClient } from '@supabase/supabase-js';
import type { Message, Mode } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export interface ChatClientResult {
  reply: string;
  ok: boolean;
  offline?: boolean;
  memorySaved?: boolean;
  error?: string;
}

export interface ImageResult {
  ok: boolean;
  url?: string;
  prompt?: string;
  error?: string;
}

export interface TranscribeResult {
  ok: boolean;
  transcript?: string;
  error?: string;
}

export interface SearchResultItem {
  title: string;
  url: string;
  content: string;
}

export interface SearchResults {
  ok: boolean;
  results?: SearchResultItem[];
  reply?: string;
  error?: string;
}

export interface EmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export interface AnalyzeResult {
  ok: boolean;
  reply?: string;
  error?: string;
}

/** Calls the `chat` edge function with an `action` payload instead of chat. */
async function invokeAction(body: Record<string, unknown>) {
  if (!supabase) {
    return {
      ok: false,
      error:
        'Supabase n\'est pas configuré. Vérifiez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.',
    };
  }
  try {
    const { data, error } = await supabase.functions.invoke('chat', { body });
    if (error) return { ok: false, error: String(error.message ?? error) };
    if (data?.error) return { ok: false, error: data.error };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Generate an image via DALL-E 3 through the edge function. */
export async function generateImage(
  prompt: string,
  mode: Mode,
  userId?: string,
): Promise<ImageResult> {
  const res = await invokeAction({
    action: 'image',
    imagePrompt: prompt,
    mode,
    userId,
    persist: true,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    url: res.data?.imageUrl,
    prompt: res.data?.imagePrompt,
  };
}

/** Analyze an uploaded file (image data URL or extracted text) via GPT-4o. */
export async function analyzeFile(
  payload: string,
  mime: string,
  question: string,
  mode: Mode,
  userId?: string,
): Promise<AnalyzeResult> {
  const res = await invokeAction({
    action: 'analyze',
    fileDataUrl: payload,
    fileMime: mime,
    fileQuestion: question,
    mode,
    userId,
    persist: true,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, reply: res.data?.reply };
}

/** Transcribe audio via OpenAI Whisper through the edge function. */
export async function transcribeAudio(
  base64: string,
  mime: string,
): Promise<TranscribeResult> {
  const res = await invokeAction({
    action: 'transcribe',
    audioBase64: base64,
    audioMime: mime,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, transcript: res.data?.transcript };
}

/** Web search via Tavily through the edge function. */
export async function webSearch(query: string): Promise<SearchResults> {
  const res = await invokeAction({ action: 'search', searchQuery: query });
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    results: res.data?.results,
    reply: res.data?.reply,
  };
}

/** Send an email via Resend through the edge function. */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<EmailResult> {
  const res = await invokeAction({
    action: 'email',
    emailTo: to,
    emailSubject: subject,
    emailHtml: html,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, id: res.data?.id };
}

/** Standard chat call: loads context + persists turns server-side. */
export async function sendChat(
  history: Message[],
  mode: Mode,
  userId?: string,
  attachment?: { dataUrl: string; mime: string },
): Promise<ChatClientResult> {
  if (!supabase) {
    return {
      ok: false,
      reply: '',
      error:
        'Supabase n\'est pas configuré. Vérifiez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.',
    };
  }

  const messages = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    const { data, error } = await supabase.functions.invoke('chat', {
      body: {
        messages,
        mode,
        userId,
        persist: true,
        attachmentDataUrl: attachment?.dataUrl,
        attachmentMime: attachment?.mime,
      },
    });

    if (error) {
      return { ok: false, reply: '', error: String(error.message ?? error) };
    }
    if (data?.error) {
      return { ok: false, reply: '', error: data.error };
    }

    return {
      ok: true,
      reply: data?.reply ?? '',
      offline: data?.offline,
      memorySaved: data?.memorySaved,
    };
  } catch (err) {
    return {
      ok: false,
      reply: '',
      error: (err as Error).message,
    };
  }
}
