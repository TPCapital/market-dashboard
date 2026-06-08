// lib/ai-market-search.js
// Specularis Market Terminal Lite v1.4 — Gemini Search grounding helper

export const AI_MARKET_SEARCH_VERSION = "v1.4";

function envValue(name) {
  const v = process.env[name];
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

function parseGeminiText(payload) {
  return payload?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("\n").trim() || "";
}

export async function runAIMarketSearch(tickers = [], opts = {}) {
  const key = envValue("GEMINI_API_KEY");
  if (!key) return { status: "unavailable", error: "missing_gemini_api_key", data: {} };
  const model = envValue("GEMINI_SEARCH_MODEL") || envValue("GEMINI_MODEL") || "gemini-2.5-flash-lite";
  const unique = [...new Set(tickers.map((t) => String(t).toUpperCase()).filter(Boolean))].slice(0, 10);
  const prompt = `You are a research-only US equity intelligence agent. Use Google Search grounding when available.\n\nTickers: ${unique.join(", ")}\n\nReturn JSON only with shape: {"items":[{"ticker":"NVDA","summary":"...","catalysts":["..."],"risks":["..."],"sentiment":"bullish|neutral|bearish","confidence":"HIGH|MEDIUM|LOW","sources":[{"title":"...","url":"..."}]}]}\n\nRules: no financial advice, no price targets unless sourced, mark uncertainty, focus on latest news/catalysts/analyst commentary/earnings/regulatory issues.`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 8000);
  try {
    const res = await fetch(url, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1600, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) throw new Error(`gemini_${res.status}`);
    const payload = await res.json();
    const text = parseGeminiText(payload);
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { rawText: text }; }
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return {
      status: "live",
      source: `Gemini Search · ${model}`,
      version: AI_MARKET_SEARCH_VERSION,
      generatedAt: Date.now(),
      items,
      data: Object.fromEntries(items.map((item) => [String(item.ticker || "").toUpperCase(), item])),
      groundingMetadata: payload?.candidates?.[0]?.groundingMetadata || null,
    };
  } catch (error) {
    return { status: "unavailable", source: `Gemini Search · ${model}`, version: AI_MARKET_SEARCH_VERSION, error: error?.message || "ai_market_search_failed", generatedAt: Date.now(), items: [], data: {} };
  } finally {
    clearTimeout(timer);
  }
}
