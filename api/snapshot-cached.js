import { buildSnapshot } from "./_lib/engines/snapshot-engine.js";
import { CACHE_TTL, fetchWithSWR } from "./_lib/cache.js";

function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(status).json(payload);
}

function buildCacheKey(req) {
  const mode = String(req?.query?.mode || req?.query?.deep || "fast").toLowerCase();
  const symbols = String(req?.query?.symbols || "default").replace(/\s+/g, "").toUpperCase();
  return `snapshot:${mode}:${symbols}`;
}

export default async function handler(req, res) {
  const cacheKey = buildCacheKey(req);

  try {
    const result = await fetchWithSWR(
      cacheKey,
      CACHE_TTL.MICRO,
      () => buildSnapshot(req),
      {
        source: "snapshot-engine",
        layer: "micro-signals",
        staleTtlSeconds: CACHE_TTL.MICRO * 2,
      },
    );

    json(res, 200, {
      ...result.data,
      swrCache: result.cache,
    });
  } catch (error) {
    json(res, 200, {
      generatedAt: Date.now(),
      servedFrom: "snapshot-cached-error",
      error: error?.message || "snapshot cache wrapper failed",
      swrCache: {
        status: "error",
        key: cacheKey,
      },
      marketData: { indices: [], quotes: [], provider: "SWR Emergency Fallback" },
      summary: {
        status: "unavailable",
        provider: "SWR Emergency Fallback",
        headline: "Snapshot unavailable",
        strategy: "The cached snapshot wrapper failed and no fallback cache was available.",
        riskMode: "DATA_UNAVAILABLE",
        riskScore: null,
        marketRegime: "UNAVAILABLE",
        confidence: "LOW",
        updatedAt: Date.now(),
      },
      indices: [],
      breadth: {},
      sectors: [],
      premarket: { movers: [], momentum: { leaders: [] }, scanner: [] },
      risk: { mode: "DATA_UNAVAILABLE", score: null, reason: "snapshot_cached_failed" },
      strategySummary: null,
      marketRegime: null,
      tradePlan: null,
      tradeDecision: null,
      watchlist: { strong: [], watch: [], avoid: [] },
      confidenceScore: { dataConfidence: "LOW", signalConfidence: "LOW", tradeConfidence: "LOW", score: 0 },
      sources: {},
    });
  }
}
