// api/ai-market-search.js
// Specularis Market Terminal Lite v1.4 — AI search/catalyst context endpoint
// GET /api/ai-market-search?tickers=NVDA,AMD,MU

import { runAIMarketSearch } from "../lib/ai-market-search.js";

const DEFAULT_TICKERS = ["MU","MRVL","NVDA","AVGO","AMD","TSM","ASML","PLTR","ORCL","SMCI"];

function noStoreJson(res, status, data) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(status).json(data);
}

function parseTickers(req) {
  const raw = String(req.query?.tickers || "").toUpperCase().replace(/[^A-Z,]/g, "");
  return raw ? [...new Set(raw.split(",").filter((t) => /^[A-Z]{1,6}$/.test(t)))].slice(0, 10) : DEFAULT_TICKERS;
}

export default async function handler(req, res) {
  const started = Date.now();
  const tickers = parseTickers(req);
  const result = await runAIMarketSearch(tickers, { timeoutMs: 8500 });
  noStoreJson(res, 200, {
    status: result.status,
    version: "v1.4",
    generatedAt: Date.now(),
    latencyMs: Date.now() - started,
    tickers,
    ...result,
    note: "AI Search is a context layer for news/catalyst explanation. It must not replace real market/option data.",
  });
}
