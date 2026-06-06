/**
 * Political Insider Trades Layer
 * ───────────────────────────────
 * Tracks congressional / insider trading data as an Alpha signal.
 *
 * Architecture (Vercel Hobby compatible):
 *   - In-memory module-level cache (no Redis required)
 *   - Falls back gracefully to structural snapshot
 *   - Optional Upstash Redis if env vars are set
 *
 * Data source: QuiverQuant public congressional trading endpoint
 * TTL: 15 minutes (medium-freq tier per data matrix)
 */

// ── In-memory cache (survives within a single warm serverless instance) ────
let _memCache = null;
let _memCacheAt = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min

// ── Structural fallback snapshot ───────────────────────────────────────────
const STRUCTURAL_FALLBACK = {
  status: "snapshot",
  source: "Political Insider Layer (Structural Reference)",
  confidence: "LOW",
  fallback: true,
  signals: [
    {
      ticker: "NVDA",
      action: "BUY",
      amount_range: "$1M–$5M",
      date: "2025-05",
      disclosed_at: null,
      description: "AI infrastructure theme — legislative AI committee member disclosed purchase.",
      signalWeight: 0.72
    },
    {
      ticker: "PLTR",
      action: "BUY",
      amount_range: "$250K–$500K",
      date: "2025-04",
      disclosed_at: null,
      description: "Defense & intelligence software — aligns with defense-spending policy trajectory.",
      signalWeight: 0.65
    },
    {
      ticker: "LMT",
      action: "BUY",
      amount_range: "$100K–$250K",
      date: "2025-03",
      disclosed_at: null,
      description: "Defense sector — consistent with increased NATO spending posture.",
      signalWeight: 0.60
    }
  ],
  bullishTickers: ["NVDA", "PLTR", "LMT"],
  bearishTickers: [],
  narrative:
    "政治内部交易数据处于快照模式。AI 基建、国防、能源等与政策倾向高度相关的板块，" +
    "历史上获得知情人士买入信号偏多。若微观交易行为与宏观政策方向同时指向同一板块，" +
    "视为高价值投研线索。",
  resonanceItems: [],
  updatedAt: null
};

// ── Helpers ────────────────────────────────────────────────────────────────
function envValue(name) {
  const v = typeof process !== "undefined" ? process.env[name] : undefined;
  return typeof v === "string" && v.length ? v : "";
}

async function readUpstashCache(key) {
  const base = envValue("UPSTASH_REDIS_REST_URL").replace(/\/$/, "");
  const token = envValue("UPSTASH_REDIS_REST_TOKEN");
  if (!base || !token) return null;
  try {
    const res = await fetch(`${base}/get/${encodeURIComponent(key)}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return payload?.result ? JSON.parse(payload.result) : null;
  } catch {
    return null;
  }
}

async function writeUpstashCache(key, value, ttlSeconds = 900) {
  const base = envValue("UPSTASH_REDIS_REST_URL").replace(/\/$/, "");
  const token = envValue("UPSTASH_REDIS_REST_TOKEN");
  if (!base || !token) return false;
  try {
    const res = await fetch(`${base}/pipeline`, {
      method: "POST",
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["SET", key, JSON.stringify(value), "EX", ttlSeconds]])
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Normalise QuiverQuant row → standard signal ────────────────────────────
function normaliseRow(row = {}) {
  const ticker = String(row.Ticker || row.ticker || "").toUpperCase().trim();
  if (!ticker || ticker.length > 6) return null;
  const actionRaw = String(row.Transaction || row.action || "").toUpperCase();
  const action = actionRaw.includes("SALE") || actionRaw.includes("SELL") ? "SELL" : "BUY";
  const date = row.TransactionDate || row.Date || row.date || null;
  const range = row.Range || row.amount_range || row.Amount || "N/A";
  const disclosed = row.ReportDate || row.disclosed_at || null;
  const name = row.Representative || row.Name || "Congress Member";
  const party = row.Party || "";

  let weight = 0.5;
  if (action === "BUY") weight += 0.15;
  if (range && /\$[1-9][Mm]|\$[5-9]\d{2}[Kk]/.test(range)) weight += 0.15;
  if (date) {
    const daysOld = (Date.now() - new Date(date).getTime()) / 86400000;
    if (daysOld < 14) weight += 0.15;
    else if (daysOld < 60) weight += 0.05;
  }

  return {
    ticker,
    action,
    amount_range: range,
    date: date ? String(date).slice(0, 10) : null,
    disclosed_at: disclosed ? String(disclosed).slice(0, 10) : null,
    description: `${party ? party + " — " : ""}${name}. ${range} ${action.toLowerCase()} disclosed.`,
    signalWeight: Math.min(0.95, Math.round(weight * 100) / 100)
  };
}

// ── Narrative builder ──────────────────────────────────────────────────────
function buildTradeNarrative(signals = [], bullish = [], bearish = []) {
  if (!signals.length) return "暂无最新政治内部交易数据，等待下次刷新。";
  const topBuy = signals.filter((s) => s.action === "BUY").slice(0, 3);
  const topSell = signals.filter((s) => s.action === "SELL").slice(0, 2);
  const parts = [];
  if (topBuy.length) {
    parts.push(
      `近期国会内部人士重点增持 ${topBuy.map((s) => s.ticker).join(" / ")}，` +
      `与当前政策叙事（AI 基建、国防采购、能源主权）存在强相关性。`
    );
  }
  if (topSell.length) {
    parts.push(`同期对 ${topSell.map((s) => s.ticker).join(" / ")} 存在减持动作，需关注对应板块政策风险。`);
  }
  parts.push(
    "内部人士交易信号需结合宏观产业政策方向进行二次验证：" +
    "若微观买入行为与宏观政策倾斜同时指向某板块，视为高价值叠加信号。"
  );
  return parts.join(" ");
}

// ── Scrape congressional trading data ─────────────────────────────────────
async function fetchCongressionalTrades(timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      "https://api.quiverquant.com/beta/live/congresstrading?pageSize=50",
      {
        cache: "no-store",
        signal: controller.signal,
        headers: { "User-Agent": "MarketDashboard/4.0 (Institutional Research Terminal)" }
      }
    );
    clearTimeout(timer);
    if (!res.ok) throw new Error(`quiverquant_${res.status}`);
    const raw = await res.json();
    const rows = Array.isArray(raw) ? raw : (raw?.data || raw?.trades || []);
    if (!rows.length) throw new Error("empty_response");

    const signals = rows
      .map(normaliseRow)
      .filter(Boolean)
      .sort((a, b) => (b.signalWeight || 0) - (a.signalWeight || 0))
      .slice(0, 20);

    const bullishTickers = [...new Set(signals.filter((s) => s.action === "BUY").map((s) => s.ticker))].slice(0, 5);
    const bearishTickers = [...new Set(signals.filter((s) => s.action === "SELL").map((s) => s.ticker))].slice(0, 3);
    const narrative = buildTradeNarrative(signals, bullishTickers, bearishTickers);

    return { status: "delayed", source: "QuiverQuant Congressional Trading", confidence: signals.length >= 5 ? "MEDIUM" : "LOW", fallback: false, signals, bullishTickers, bearishTickers, narrative, resonanceItems: [], updatedAt: Date.now() };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────
/**
 * Main entry point — call from snapshot.js
 * Priority: in-memory → Upstash Redis → live fetch → structural fallback
 */
export async function buildPoliticalTradesLayer() {
  const startedAt = Date.now();

  // 1. In-memory cache (fastest, works even on Hobby)
  if (_memCache && (Date.now() - _memCacheAt) < CACHE_TTL_MS) {
    return { ..._memCache, servedFromCache: true, cacheAge: Math.round((Date.now() - _memCacheAt) / 1000), latency: Date.now() - startedAt };
  }

  // 2. Upstash Redis (optional, if env vars set)
  const cached = await readUpstashCache("narrative:trump_trades");
  if (cached?.updatedAt) {
    const ageSeconds = (Date.now() - cached.updatedAt) / 1000;
    if (ageSeconds < CACHE_TTL_MS / 1000) {
      _memCache = cached;
      _memCacheAt = cached.updatedAt;
      return { ...cached, servedFromCache: true, cacheAge: Math.round(ageSeconds), latency: Date.now() - startedAt };
    }
  }

  // 3. Live fetch
  try {
    const fresh = await fetchCongressionalTrades();
    _memCache = fresh;
    _memCacheAt = fresh.updatedAt || Date.now();
    await writeUpstashCache("narrative:trump_trades", fresh, 900).catch(() => {});
    return { ...fresh, servedFromCache: false, latency: Date.now() - startedAt };
  } catch (err) {
    console.error("[political-trades] fetch failed:", err?.message || String(err));
    // 4. Structural fallback
    return { ...STRUCTURAL_FALLBACK, latency: Date.now() - startedAt, error: err?.message || "source_unavailable" };
  }
}
