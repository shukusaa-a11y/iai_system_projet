import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODE_SYSTEM_PROMPTS: Record<string, string> = {
  discussion:
    "Tu es un assistant IA personnel amical et bienveillant nommé IAI System. Réponds en français de manière naturelle, concise et utile. Adapte ton ton pour être chaleureux mais professionnel. N'invente JAMAIS le prénom de l'utilisateur : ne l'utilise que s'il l'a explicitement donné via la mémoire.",
  code: "Tu es un développeur senior expert nommé IAI System. Réponds en français avec des explications techniques claires et des blocs de code bien formatés (triple backticks + langage). Sois précis, pédagogue et propose des bonnes pratiques. Pour les demandes de code complet, fournis un fichier unique auto-suffisant quand c'est possible.",
  musique:
    "Tu es un assistant créatif passionné de musique nommé IAI System. Réponds en français avec enthousiasme et inspiration. Aide avec la composition, les accords, les paroles, les styles musicaux et la créativité sonore.",
  design:
    "Tu es un designer UX/UI professionnel nommé IAI System. Réponds en français avec sens du détail, esthétique et clarté. Aide avec les principes de design, palettes, typographie, layouts et tendances.",
  analyse:
    "Tu es un analyste de données rigoureux nommé IAI System. Réponds en français de manière structurée et factuelle. Aide à interpréter, structurer et visualiser des données avec méthode et clarté.",
};

interface Memory {
  id: string;
  key: string;
  value: string;
}

interface ConversationRow {
  role: string;
  content: string;
  mode?: string | null;
}

function makeSupabase() {
  const url = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SUPABASE_API_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Detect memory intents in French.
function detectMemory(text: string): { key: string; value: string } | null {
  const t = text.trim();

  // Name: "Retiens que je m'appelle Boss" / "Je m'appelle Boss" / "Appelle-moi Boss"
  const namePatterns = [
    /retiens\s+que\s+je\s+m['’ ]appelle\s+(.+)/i,
    /je\s+m['’ ]appelle\s+(.+)/i,
    /appelle[- ]moi\s+(.+)/i,
    /mon\s+nom\s+(?:est|c['’ ]est)\s+(.+)/i,
    /retiens\s+(?:que\s+)?mon\s+nom\s+(?:est|c['’ ]est)\s+(.+)/i,
  ];
  for (const re of namePatterns) {
    const m = t.match(re);
    if (m) {
      const cleaned = m[1].replace(/[.!?]+$/, "").trim();
      if (cleaned.length > 0 && cleaned.length < 60) {
        return { key: "name", value: capitalize(cleaned) };
      }
    }
  }

  // Likes: "Retiens que j'aime le café" / "J'aime le café" / "J'aime les chats"
  const likePatterns = [
    /retiens\s+que\s+j['’ ]aime\s+(.+)/i,
    /j['’ ]aime\s+(.+)/i,
    /j['’ ]adore\s+(.+)/i,
    /retiens\s+que\s+j['’ ]adore\s+(.+)/i,
  ];
  for (const re of likePatterns) {
    const m = t.match(re);
    if (m) {
      const cleaned = m[1].replace(/[.!?]+$/, "").trim();
      if (cleaned.length > 0 && cleaned.length < 120) {
        return { key: "likes", value: cleaned };
      }
    }
  }

  // Generic "Retiens que ..." / "Souviens-toi que ..."
  const generic = t.match(/retiens\s+que\s+(.+)/i);
  if (generic) {
    const cleaned = generic[1].replace(/[.!?]+$/, "").trim();
    if (cleaned.length > 0 && cleaned.length < 200) {
      return { key: "fact", value: cleaned };
    }
  }
  const generic2 = t.match(/souviens[- ]toi\s+(?:de\s+|que\s+)(.+)/i);
  if (generic2) {
    const cleaned = generic2[1].replace(/[.!?]+$/, "").trim();
    if (cleaned.length > 0 && cleaned.length < 200) {
      return { key: "fact", value: cleaned };
    }
  }

  return null;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Detect web search intent in French user messages.
function detectSearchIntent(text: string): { query: string } | null {
  const t = text.trim();
  const patterns = [
    /^cherche(?:r)?\s+(?:sur\s+(?:le\s+)?web\s+)?(.+)/i,
    /^news\s+(.+)/i,
    /^recherche(?:r)?\s+(?:sur\s+)?(?:le\s+)?web\s+?:?\s*(.+)/i,
    /^actualit[eé]s\s+(?:sur\s+)?(.+)/i,
    /^qu['’ ]y a[- ]t[- ]il\s+(?:de\s+neuf\s+)?sur\s+(.+)/i,
    /^google\s+(.+)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const query = m[1].replace(/[.!?]+$/, "").trim();
      if (query.length > 2) return { query };
    }
  }
  return null;
}

// Build memory context block — only includes the name if the user has actually
// given one. The IA must NEVER invent a name.
function buildMemoryBlock(memories: Memory[]): string {
  if (!memories.length) return "";
  const lines = memories.map(
    (m) =>
      `- ${m.key === "name" ? "Prénom" : m.key === "likes" ? "Aime" : "Fait retenu"}: ${m.value}`,
  );
  const name = memories.find((m) => m.key === "name")?.value;
  const nameRule = name
    ? `\nL'utilisateur s'appelle ${name}. Salue-le par son prénom ("Bonjour ${name}") au début de ta première réponse.`
    : `\nIMPORTANT: Tu ne connais PAS le prénom de l'utilisateur. N'en invente JAMAIS un. Ne dis JAMAIS "Bonjour David" ou autre prénom inventé. Utilise simplement "Bonjour" sans prénom.`;
  return `\n\nMémoire récente sur l'utilisateur:\n${lines.join("\n")}${nameRule}`;
}

// Persist the user message + detected memory.
async function persistUserTurn(
  sb: ReturnType<typeof makeSupabase>,
  userId: string,
  content: string,
  mode: string,
  detected: { key: string; value: string } | null,
) {
  if (!sb) return;
  await sb.from("conversations").insert({
    user_id: userId,
    role: "user",
    content,
    mode,
  });
  if (!detected) return;
  if (detected.key === "name") {
    const existing = await sb
      .from("memories")
      .select("id")
      .eq("user_id", userId)
      .eq("key", "name")
      .maybeSingle();
    if (existing.data) {
      await sb
        .from("memories")
        .update({ value: detected.value })
        .eq("id", existing.data.id);
    } else {
      await sb.from("memories").insert({
        user_id: userId,
        key: "name",
        value: detected.value,
      });
    }
    await sb.from("users").update({ name: detected.value }).eq("id", userId);
  } else {
    await sb.from("memories").insert({
      user_id: userId,
      key: detected.key,
      value: detected.value,
    });
  }
}

async function persistAssistant(
  sb: ReturnType<typeof makeSupabase>,
  userId: string,
  content: string,
  mode: string,
) {
  if (!sb) return;
  await sb.from("conversations").insert({
    user_id: userId,
    role: "assistant",
    content,
    mode,
  });
}

async function loadContext(sb: ReturnType<typeof makeSupabase>, userId: string) {
  if (!sb) return { memories: [] as Memory[], history: [] as ConversationRow[] };
  const [memRes, histRes] = await Promise.all([
    sb
      .from("memories")
      .select("id, key, value")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    sb
      .from("conversations")
      .select("role, content, mode")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);
  return {
    memories: (memRes.data as Memory[]) ?? [],
    history: ((histRes.data as ConversationRow[]) ?? []).reverse(),
  };
}

// Generate an image via DALL-E 3.
async function generateImage(prompt: string): Promise<{ url: string } | { error: string }> {
  const key = Deno.env.get("DALL_E_API_KEY") ?? Deno.env.get("OPENAI_API_KEY");
  if (!key) {
    return { error: "La clé DALL_E_API_KEY (ou OPENAI_API_KEY) n'est pas configurée côté serveur." };
  }
  const resp = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    return { error: `Erreur DALL-E: ${resp.status} ${errText}` };
  }
  const data = await resp.json();
  const url = data?.data?.[0]?.url;
  if (!url) return { error: "DALL-E n'a pas renvoyé d'image." };
  return { url };
}

// Transcribe audio via OpenAI Whisper (whisper-1).
async function transcribeAudio(
  base64: string,
  mime: string,
): Promise<{ text: string } | { error: string }> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) {
    return { error: "La clé OPENAI_API_KEY n'est pas configurée pour Whisper." };
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const ext = mime.includes("mp4") ? "mp4" : mime.includes("wav") ? "wav" : "webm";
  const blob = new Blob([bytes], { type: mime });

  const form = new FormData();
  form.append("file", blob, `audio.${ext}`);
  form.append("model", "whisper-1");
  form.append("language", "fr");

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!resp.ok) {
    const errText = await resp.text();
    return { error: `Erreur Whisper: ${resp.status} ${errText}` };
  }
  const data = await resp.json();
  const text = data?.text;
  if (typeof text !== "string") {
    return { error: "Whisper n'a pas renvoyé de transcription." };
  }
  return { text };
}

// Analyze an image (base64 data URL) with GPT-4o vision.
async function analyzeImage(
  base64Image: string,
  question: string,
  openaiKey: string,
): Promise<string> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Tu es IAI System, un analyste. Réponds en français, de manière structurée et factuelle. Résume et analyse le contenu fourni.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: question || "Analyse et résume ce document." },
            { type: "image_url", image_url: { url: base64Image } },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Erreur analyse image: ${resp.status} ${errText}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content ?? "Analyse indisponible.";
}

// Analyze raw text (e.g. extracted from a PDF) with GPT-4o.
async function analyzeText(
  text: string,
  question: string,
  openaiKey: string,
): Promise<string> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Tu es IAI System, un analyste. Réponds en français, de manière structurée et factuelle. Résume et analyse le contenu fourni.",
        },
        {
          role: "user",
          content: `${question || "Analyse et résume ce document."}\n\n--- DOCUMENT ---\n${text.slice(0, 12000)}`,
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Erreur analyse texte: ${resp.status} ${errText}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content ?? "Analyse indisponible.";
}

// Web search via DuckDuckGo Instant Answer API (no API key needed).
async function webSearch(
  query: string,
): Promise<
  | { results: Array<{ title: string; url: string; content: string }> }
  | { error: string }
> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  let resp: Response;
  try {
    resp = await fetch(url, { headers: { "User-Agent": "IAI-System/1.0" } });
  } catch (err) {
    return { error: `Erreur réseau DuckDuckGo: ${(err as Error).message}` };
  }
  if (!resp.ok) {
    const errText = await resp.text();
    return { error: `Erreur DuckDuckGo: ${resp.status} ${errText}` };
  }
  const data = await resp.json();
  const results: Array<{ title: string; url: string; content: string }> = [];

  // Primary abstract (the main instant answer).
  if (data?.AbstractText && data?.AbstractURL) {
    results.push({
      title: data.Heading || data.AbstractSource || "DuckDuckGo",
      url: data.AbstractURL,
      content: String(data.AbstractText).slice(0, 400),
    });
  }

  // Related topics (can be nested arrays) — collect up to 4 more.
  const topics = Array.isArray(data?.RelatedTopics) ? data.RelatedTopics : [];
  for (const t of topics) {
    if (results.length >= 5) break;
    if (t?.Text && t?.FirstURL) {
      results.push({
        title: t.Text.split(" - ")[0].slice(0, 80),
        url: t.FirstURL,
        content: t.Text.slice(0, 300),
      });
    } else if (Array.isArray(t?.Topics)) {
      for (const sub of t.Topics) {
        if (results.length >= 5) break;
        if (sub?.Text && sub?.FirstURL) {
          results.push({
            title: sub.Text.split(" - ")[0].slice(0, 80),
            url: sub.FirstURL,
            content: sub.Text.slice(0, 300),
          });
        }
      }
    }
  }

  return { results };
}

// Send an email via Resend API.
async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: true; id: string } | { error: string }> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    return { error: "La clé RESEND_API_KEY n'est pas configurée côté serveur." };
  }
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      from: "IAI System <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    return { error: `Erreur Resend: ${resp.status} ${errText}` };
  }
  const data = await resp.json();
  return { ok: true, id: data?.id ?? "" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      messages = [],
      mode = "discussion",
      userId,
      persist = true,
      action,
      imagePrompt,
      fileDataUrl,
      fileMime,
      fileQuestion,
      audioBase64,
      audioMime,
      attachmentDataUrl,
      attachmentMime,
      searchQuery,
      emailTo,
      emailSubject,
      emailHtml,
    } = body as {
      messages: { role: string; content: string }[];
      mode: string;
      userId?: string;
      persist?: boolean;
      action?: "image" | "analyze" | "transcribe" | "tts" | "search" | "email";
      imagePrompt?: string;
      fileDataUrl?: string;
      fileMime?: string;
      fileQuestion?: string;
      audioBase64?: string;
      audioMime?: string;
      attachmentDataUrl?: string;
      attachmentMime?: string;
      searchQuery?: string;
      emailTo?: string;
      emailSubject?: string;
      emailHtml?: string;
      text?: string;
      voice?: string;
      format?: string;
    };

    const sb = makeSupabase();
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    // ---- ACTION: transcribe audio via Whisper ----
    if (action === "transcribe" && audioBase64) {
      const result = await transcribeAudio(audioBase64, audioMime ?? "audio/webm");
      if ("error" in result) {
        return new Response(
          JSON.stringify({ error: result.error }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ transcript: result.text }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- ACTION: text-to-speech via OpenAI TTS (tts-1) ----
    if (action === "tts" && text) {
      if (!openaiKey) {
        return new Response(
          JSON.stringify({ error: "OPENAI_API_KEY non configuré." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const ttsVoice = voice ?? "alloy";
      const ttsFormat = format ?? "mp3";
      try {
        const resp = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: "tts-1", input: text, voice: ttsVoice, format: ttsFormat }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          return new Response(
            JSON.stringify({ error: `TTS ${resp.status}: ${errText}` }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const audioBuffer = await resp.arrayBuffer();
        const contentType =
          ttsFormat === "opus" ? "audio/opus" :
          ttsFormat === "aac" ? "audio/aac" :
          ttsFormat === "flac" ? "audio/flac" :
          "audio/mpeg";
        return new Response(audioBuffer, {
          headers: { ...corsHeaders, "Content-Type": contentType },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: `TTS échec: ${(err as Error).message}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ---- ACTION: web search via DuckDuckGo ----
    if (action === "search" && searchQuery) {
      const result = await webSearch(searchQuery);
      if ("error" in result) {
        return new Response(
          JSON.stringify({ error: result.error }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // If DDG has no result, the AI will answer from its own knowledge.
      if (!result.results.length) {
        const aiFallback = await answerFromKnowledge(searchQuery, mode);
        return new Response(
          JSON.stringify({ reply: aiFallback, results: [], noResult: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // Build a markdown reply with sources to persist + display.
      const formatted = formatSearchResults(searchQuery, result.results);
      if (sb && persist && userId) {
        await persistAssistant(sb, userId, formatted, mode);
      }
      return new Response(
        JSON.stringify({ reply: formatted, results: result.results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- ACTION: send email via Resend ----
    if (action === "email" && emailTo) {
      const result = await sendEmail(
        emailTo,
        emailSubject ?? "(sans objet)",
        emailHtml ?? "",
      );
      if ("error" in result) {
        return new Response(
          JSON.stringify({ error: result.error }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (sb && persist && userId) {
        await persistAssistant(
          sb,
          userId,
          `Email envoyé à ${emailTo} — Objet : "${emailSubject}" (ID: ${result.id})`,
          mode,
        );
      }
      return new Response(
        JSON.stringify({ ok: true, id: result.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- ACTION: generate image (DALL-E 3) ----
    if (action === "image" && imagePrompt) {
      const result = await generateImage(imagePrompt);
      if ("error" in result) {
        return new Response(
          JSON.stringify({ error: result.error }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // Persist the assistant message describing the image.
      if (sb && persist && userId) {
        await persistAssistant(sb, userId, `Image générée pour : "${imagePrompt}"`, mode);
      }
      return new Response(
        JSON.stringify({ imageUrl: result.url, imagePrompt }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- ACTION: analyze file (image via vision / text via GPT) ----
    if (action === "analyze" && fileDataUrl) {
      if (!openaiKey) {
        return new Response(
          JSON.stringify({ error: "La clé OPENAI_API_KEY n'est pas configurée pour l'analyse." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const isImage = (fileMime ?? "").startsWith("image/");
      let analysis: string;
      if (isImage) {
        analysis = await analyzeImage(fileDataUrl, fileQuestion ?? "", openaiKey);
      } else {
        // fileDataUrl for text/pdf is the extracted text payload.
        analysis = await analyzeText(fileDataUrl, fileQuestion ?? "", openaiKey);
      }
      if (sb && persist && userId) {
        await persistAssistant(sb, userId, analysis, mode);
      }
      return new Response(
        JSON.stringify({ reply: analysis, memories: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Default: chat ----
    const { memories, history } = await loadContext(sb, userId ?? "");
    const resolvedUserId = userId;

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const detectedMemory = lastUser ? detectMemory(lastUser.content) : null;

    if (sb && persist && resolvedUserId && lastUser) {
      await persistUserTurn(sb, resolvedUserId, lastUser.content, mode, detectedMemory);
    }

    // Auto-detect web search intent: "cherche ...", "news ...", "recherche ..."
    const searchIntent = lastUser ? detectSearchIntent(lastUser.content) : null;
    let searchContext = "";
    if (searchIntent) {
      const ddgResult = await webSearch(searchIntent.query);
      if (!("error" in ddgResult) && ddgResult.results.length) {
        searchContext =
          `\n\nRésultats de recherche web (DuckDuckGo) pour « ${searchIntent.query} » (utilise-les et cite les sources avec leurs liens Markdown) :\n` +
          ddgResult.results
            .map(
              (r, i) =>
                `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.content}`,
            )
            .join("\n\n");
      } else {
        // DuckDuckGo has no instant answer — let the AI answer from its own
        // knowledge and tell the user the info is current up to 2026.
        searchContext =
          `\n\nLa recherche web DuckDuckGo pour « ${searchIntent.query} » n'a renvoyé aucun résultat. ` +
          `Réponds avec tes propres connaissances en indiquant clairement à la fin : ` +
          `« ℹ️ Info jusqu'à 2026 — données non vérifiées en temps réel. »`;
      }
    }

    const systemPrompt =
      (MODE_SYSTEM_PROMPTS[mode] ?? MODE_SYSTEM_PROMPTS.discussion) +
      buildMemoryBlock(memories) +
      searchContext;

    if (!openaiKey) {
      const fallback = buildFallbackReply(mode, memories, detectedMemory);
      if (sb && persist && resolvedUserId) {
        await persistAssistant(sb, resolvedUserId, fallback, mode);
      }
      return new Response(
        JSON.stringify({
          reply: fallback,
          offline: true,
          memorySaved: !!detectedMemory,
          memories,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contextMessages: ChatMessage[] = history.map((h) => ({ role: h.role, content: h.content }));
    let merged = mergeMessages(contextMessages, messages);

    // If an image attachment is present, attach it to the latest user message
    // so GPT-4o Vision can see it (works in any mode).
    if (attachmentDataUrl && (attachmentMime ?? "").startsWith("image/")) {
      merged = merged.map((m, i) => {
        if (i === merged.length - 1 && m.role === "user") {
          return {
            role: "user",
            content: [
              { type: "text", text: m.content || "Analyse et décris cette image." },
              { type: "image_url", image_url: { url: attachmentDataUrl } },
            ],
          };
        }
        return m;
      });
    }

    const payload = {
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }, ...merged],
      temperature: mode === "code" || mode === "analyse" ? 0.4 : 0.8,
      max_tokens: 1200,
    };

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(
        JSON.stringify({ error: `Erreur OpenAI: ${resp.status} ${errText}` }),
        {
          status: resp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content ?? "Désolé, je n'ai pas pu générer de réponse.";

    if (sb && persist && resolvedUserId) {
      await persistAssistant(sb, resolvedUserId, reply, mode);
    }

    return new Response(
      JSON.stringify({ reply, memorySaved: !!detectedMemory, memories }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Erreur serveur: ${(err as Error).message}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

type ChatMessage = {
  role: string;
  content: string | Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >;
};

function mergeMessages(
  persisted: { role: string; content: string }[],
  session: { role: string; content: string }[],
): ChatMessage[] {
  if (persisted.length === 0) return session;
  const lastPersisted = persisted[persisted.length - 1];
  const lastSession = session[session.length - 1];
  if (
    lastPersisted &&
    lastSession &&
    lastPersisted.role === lastSession.role &&
    lastPersisted.content === lastSession.content
  ) {
    return [...persisted, ...session.slice(0, -1)];
  }
  return [...persisted, ...session].filter(
    (m, i, arr) =>
      i === 0 ||
      !(m.role === arr[i - 1].role && m.content === arr[i - 1].content && i > persisted.length),
  );
}

function formatSearchResults(
  query: string,
  results: Array<{ title: string; url: string; content: string }>,
): string {
  if (!results.length) {
    return `Aucun résultat trouvé pour « ${query} ».`;
  }
  let out = `Résultats de recherche pour « ${query} » :\n\n`;
  results.forEach((r, i) => {
    out += `**${i + 1}. ${r.title}**\n${r.content}\n🔗 [Source](${r.url})\n\n`;
  });
  return out.trim();
}

// When DuckDuckGo returns no instant answer, ask GPT-4o to answer from its own
// knowledge and note that the info is current up to 2026.
async function answerFromKnowledge(query: string, mode: string): Promise<string> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) {
    return `DuckDuckGo n'a pas de résultat pour « ${query} » et la clé OPENAI_API_KEY n'est pas configurée pour un complément IA.`;
  }
  const sys = MODE_SYSTEM_PROMPTS[mode] ?? MODE_SYSTEM_PROMPTS.discussion;
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: query },
      ],
      temperature: 0.7,
      max_tokens: 900,
    }),
  });
  if (!resp.ok) {
    return `DuckDuckGo n'a pas de résultat pour « ${query} » et le complément IA a échoué.`;
  }
  const data = await resp.json();
  const reply = data?.choices?.[0]?.message?.content ?? "";
  if (!reply.trim()) {
    return `Aucun résultat trouvé pour « ${query} ».`;
  }
  return `${reply.trim()}\n\nℹ️ Info jusqu'à 2026 — données non vérifiées en temps réel.`;
}

function buildFallbackReply(
  mode: string,
  memories: Memory[],
  detected: { key: string; value: string } | null,
): string {
  const name = memories.find((m) => m.key === "name")?.value;
  if (detected?.key === "name") {
    return `Parfait, je retiens que tu t'appelles ${detected.value}. À partir de maintenant je te saluerai par ton prénom. (Note: connecte une clé OPENAI_API_KEY pour activer les réponses complètes de GPT-4o.)`;
  }
  if (detected) {
    return `C'est noté, je retiens : ${detected.value}. (Note: connecte une clé OPENAI_API_KEY pour activer les réponses complètes de GPT-4o.)`;
  }
  const greet = name ? `Bonjour ${name}` : "Bonjour";
  return `${greet} ! Je suis IAI System, en mode ${mode}. La clé OPENAI_API_KEY n'est pas encore configurée côté serveur. Une fois ajoutée, je pourrai te répondre pleinement avec GPT-4o. En attendant, ta conversation et tes souvenirs sont bien sauvegardés.`;
}
