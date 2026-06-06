/**
 * /api/trump-trades
 * ─────────────────
 * Thin Vercel serverless handler for the Political Insider Trades layer.
 * All logic lives in lib/political-trades.js (importable from any context).
 *
 * Vercel Hobby plan: no cron support.
 * This endpoint can be called manually or via an external scheduler
 * (e.g. GitHub Actions free tier, UptimeRobot ping, etc.)
 *
 * Usage:
 *   GET /api/trump-trades          → returns current data (cache or live)
 *   GET /api/trump-trades?refresh=1 → forces cache bypass
 */

import { buildPoliticalTradesLayer } from "../lib/political-trades.js";
import { noStoreJson } from "../lib/utils.js";

export default async function handler(req, res) {
  try {
    const data = await buildPoliticalTradesLayer();
    noStoreJson(res, 200, data);
  } catch (err) {
    noStoreJson(res, 200, {
      status: "snapshot",
      source: "Political Insider Layer (Error Fallback)",
      confidence: "LOW",
      fallback: true,
      signals: [],
      bullishTickers: [],
      bearishTickers: [],
      narrative: "数据源暂时不可用，等待恢复。",
      resonanceItems: [],
      error: err?.message || String(err),
      updatedAt: null
    });
  }
}
