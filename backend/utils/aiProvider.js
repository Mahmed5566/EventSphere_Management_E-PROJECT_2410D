// AI provider abstraction.
//
// The provider, base URL, model and key are read ONLY from backend environment
// variables. Nothing here is ever sent to, or read by, the browser. If no
// provider is configured, `isAiConfigured()` is false and callers must show a
// configuration message instead of inventing an answer.
//
// Supported providers use the OpenAI-compatible chat-completions shape, plus
// Google Gemini's native generateContent shape. The model id is never
// hardcoded — it must come from AI_MODEL so an unsupported id cannot be
// silently assumed.

const PROVIDERS = {
  openai: { baseUrl: "https://api.openai.com/v1", shape: "openai" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", shape: "openai" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", shape: "openai" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1", shape: "openai" },
  mistral: { baseUrl: "https://api.mistral.ai/v1", shape: "openai" },
  together: { baseUrl: "https://api.together.xyz/v1", shape: "openai" },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta", shape: "gemini" },
  custom: { baseUrl: "", shape: "openai" },
};

export function listSupportedProviders() {
  return Object.keys(PROVIDERS);
}

export function getAiConfig() {
  const provider = String(process.env.AI_PROVIDER || "").trim().toLowerCase();
  const meta = PROVIDERS[provider];
  const apiKey = String(process.env.AI_API_KEY || "").trim();
  const model = String(process.env.AI_MODEL || "").trim();
  const baseUrl = String(process.env.AI_BASE_URL || "").trim() || meta?.baseUrl || "";
  return { provider, meta, apiKey, model, baseUrl, timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 15000 };
}

export function isAiConfigured() {
  const { provider, meta, apiKey, model, baseUrl } = getAiConfig();
  if (!provider || !meta) return false;
  if (provider === "custom" && !baseUrl) return false;
  return Boolean(apiKey && model);
}

export function describeAiStatus() {
  const { provider, model, baseUrl, apiKey } = getAiConfig();
  if (!provider || !PROVIDERS[provider]) {
    return { configured: false, reason: "no_provider", message: "No AI provider is configured. Set AI_PROVIDER, AI_MODEL and AI_API_KEY in backend/.env." };
  }
  if (!model || !apiKey || (provider === "custom" && !baseUrl)) {
    return { configured: false, reason: "incomplete", message: "AI provider configuration is incomplete. AI_MODEL, AI_API_KEY" + (provider === "custom" ? " and AI_BASE_URL" : "") + " are required." };
  }
  return { configured: true, provider, model, baseUrl };
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send a chat request to the configured provider.
 * Returns { ok:true, text } or { ok:false, reason, message }.
 * reasons: not_configured, unsupported_provider, timeout, provider_error, empty
 */
export async function aiChat(messages, { temperature = 0.2, maxTokens = 700 } = {}) {
  const { provider, meta, apiKey, model, baseUrl, timeoutMs } = getAiConfig();
  if (!provider || !meta) return { ok: false, reason: "not_configured", message: "No supported AI provider is configured." };
  if (!apiKey || !model || (provider === "custom" && !baseUrl)) {
    return { ok: false, reason: "not_configured", message: "AI provider configuration is incomplete." };
  }

  try {
    if (meta.shape === "gemini") {
      const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
      const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          generationConfig: { temperature, maxOutputTokens: maxTokens },
        }),
      }, timeoutMs);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, reason: "provider_error", message: data?.error?.message || `Provider responded ${res.status}.` };
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
      return text ? { ok: true, text } : { ok: false, reason: "empty", message: "The provider returned an empty response." };
    }

    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    }, timeoutMs);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: "provider_error", message: data?.error?.message || `Provider responded ${res.status}.` };
    const text = data?.choices?.[0]?.message?.content || "";
    return text ? { ok: true, text } : { ok: false, reason: "empty", message: "The provider returned an empty response." };
  } catch (error) {
    if (error?.name === "AbortError") return { ok: false, reason: "timeout", message: "The AI provider timed out." };
    return { ok: false, reason: "provider_error", message: error?.message || "AI provider request failed." };
  }
}
