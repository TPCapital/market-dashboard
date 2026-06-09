// api/ai-prompt-generate.js
// Specularis Market Terminal Lite v1.4.3 - Gemini rate-limit guarded prompt automation.
// POST { lang, prompt, question }

import { createHash } from "node:crypto";

const PROMPT_CACHE_TTL_MS = 20 * 60 * 1000;
const MAX_PROMPT_CHARS = 9000;
const promptCache = globalThis.__SPECULARIS_PROMPT_CACHE__ || new Map();
globalThis.__SPECULARIS_PROMPT_CACHE__ = promptCache;

function envValue(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function noStoreJson(res, status, data) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(status).json(data);
}

function promptResponse({
  status = "unavailable",
  source = "Gemini API",
  analysis = "",
  error = null,
  started = Date.now(),
  cacheHit = false,
  promptHash = null,
  retryAfterSeconds = null,
}) {
  return {
    status,
    source,
    analysis,
    error,
    cacheHit,
    promptHash,
    retryAfterSeconds,
    generatedAt: Date.now(),
    latencyMs: Date.now() - started,
  };
}

function hashPrompt({ prompt, lang, model }) {
  return createHash("sha256")
    .update(JSON.stringify({ prompt, lang, model }))
    .digest("hex");
}

function getCachedPrompt(promptHash) {
  const cached = promptCache.get(promptHash);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > PROMPT_CACHE_TTL_MS) {
    promptCache.delete(promptHash);
    return null;
  }
  return cached.response;
}

function setCachedPrompt(promptHash, response) {
  promptCache.set(promptHash, { cachedAt: Date.now(), response });
  if (promptCache.size > 80) {
    const oldest = promptCache.keys().next().value;
    if (oldest) promptCache.delete(oldest);
  }
}

function retryAfterSeconds(response) {
  const raw = response?.headers?.get?.("retry-after");
  const value = Number(raw);
  if (Number.isFinite(value) && value > 0) return Math.min(Math.ceil(value), 600);
  const dateMs = raw ? Date.parse(raw) : NaN;
  if (Number.isFinite(dateMs)) return Math.min(Math.max(Math.ceil((dateMs - Date.now()) / 1000), 1), 600);
  return 60;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  if (typeof req.on !== "function") return {};
  return await new Promise((resolve) => {
    let raw = "";
    req.on?.("data", (chunk) => { raw += chunk; });
    req.on?.("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
    req.on?.("error", () => resolve({}));
  });
}

function parseText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => part?.text || "").join("\n").trim();
}

function fallbackAnalysis(lang, prompt, reason) {
  const clipped = String(prompt || "").slice(0, 8000);
  if (lang === "en") {
    return `Gemini automatic analysis is temporarily unavailable (${reason}).\n\nThe copyable prompt is preserved below. Paste it into GPT Plus / Claude Pro / Gemini for full analysis.\n\n--- Original Prompt ---\n${clipped}`;
  }
  return `Gemini 自动分析暂不可用（${reason}）。\n\n已保留可复制提示词，请先手动粘贴至 GPT Plus / Claude Pro / Gemini 进行完整分析。\n\n--- 原始提示词 ---\n${clipped}`;
}

export default async function handler(req, res) {
  const started = Date.now();
  if (req.method === "OPTIONS") {
    return noStoreJson(res, 200, promptResponse({ status: "ok", source: "preflight", analysis: "", error: null, started }));
  }
  if (req.method !== "POST") {
    return noStoreJson(res, 405, promptResponse({ status: "error", source: "Gemini API", analysis: "", error: "method_not_allowed", started }));
  }

  const body = await readBody(req);
  const lang = body.lang === "en" ? "en" : "zh";
  const prompt = String(body.prompt || "").slice(0, MAX_PROMPT_CHARS);
  const key = envValue("GEMINI_API_KEY");
  const model = envValue("GEMINI_PROMPT_MODEL") || envValue("GEMINI_MODEL") || "gemini-2.5-flash-lite";
  const source = `Gemini API · ${model}`;
  const promptHash = hashPrompt({ prompt, lang, model });

  if (!prompt.trim()) {
    return noStoreJson(res, 200, promptResponse({
      source,
      error: "missing_prompt",
      analysis: fallbackAnalysis(lang, prompt, "missing_prompt"),
      started,
      promptHash,
    }));
  }

  const cached = getCachedPrompt(promptHash);
  if (cached) {
    return noStoreJson(res, 200, {
      ...cached,
      cacheHit: true,
      generatedAt: Date.now(),
      latencyMs: Date.now() - started,
    });
  }

  if (!key) {
    return noStoreJson(res, 200, promptResponse({
      source,
      error: "missing_gemini_api_key",
      analysis: fallbackAnalysis(lang, prompt, "missing_gemini_api_key"),
      started,
      promptHash,
    }));
  }

  const systemInstruction = lang === "en"
    ? "You are a conservative market research assistant. Produce structured research only, not financial advice. Do not fabricate data. Clearly mark uncertainty and no-trade conditions."
    : "你是保守型美股信息流交易研究助手。只输出研究分析，不构成投资建议。不要编造数据，数据不足时明确说明，并突出不可交易条件。";
  const userText = `${systemInstruction}\n\n请基于以下 Specularis 终端上下文直接生成完整分析结果，不要要求用户再次粘贴。\n\n${prompt}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1800 },
      }),
    });

    if (response.status === 429) {
      const retryAfter = retryAfterSeconds(response);
      const rateLimited = promptResponse({
        status: "rate_limited",
        source,
        error: "gemini_http_429",
        analysis: lang === "en"
          ? `Gemini is temporarily rate limited. Please wait ${retryAfter} seconds and try again, or copy the prompt into GPT / Claude for manual analysis.`
          : `Gemini 当前额度暂时受限，请等待 ${retryAfter} 秒后再试，或复制提示词到 GPT / Claude 手动分析。`,
        started,
        promptHash,
        retryAfterSeconds: retryAfter,
      });
      setCachedPrompt(promptHash, rateLimited);
      return noStoreJson(res, 200, rateLimited);
    }

    if (!response.ok) throw new Error(`gemini_http_${response.status}`);

    const payload = await response.json();
    const analysis = parseText(payload);
    const result = promptResponse({
      status: analysis ? "live" : "unavailable",
      source,
      analysis: analysis || fallbackAnalysis(lang, prompt, "empty_gemini_response"),
      error: analysis ? null : "empty_gemini_response",
      started,
      promptHash,
    });
    if (analysis) setCachedPrompt(promptHash, result);
    return noStoreJson(res, 200, result);
  } catch (error) {
    return noStoreJson(res, 200, promptResponse({
      status: "unavailable",
      source,
      error: error?.message || "gemini_prompt_generation_failed",
      analysis: fallbackAnalysis(lang, prompt, error?.message || "gemini_prompt_generation_failed"),
      started,
      promptHash,
    }));
  } finally {
    clearTimeout(timer);
  }
}
