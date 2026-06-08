// modules/specularis-terminal-lite.js
// Main coordinator for Specularis Market Terminal Lite new modules.
// Loaded as a plain ES module (type="module") — runs after app.js / i18n.js.
//
// v1.3.5-hotfix: fetch /api/snapshot directly from this module and bridge the
// raw snapshot into the new Terminal Lite modules. This avoids the legacy
// app.js buildDashboard() stripping terminalLite / marketData / generatedAt.
// v1.3.6-ui-hotfix: inject a compact terminal-style visual overlay for the
// new Stock Intel / Options Lite / AI Decision cards without touching API logic.

import { renderStockIntelPro, getStockIntelState } from "./stock-intelligence-pro.js";
import { renderOptionsIntelLite, getOptionsLiteState } from "./options-intelligence-lite.js";
import { renderKolDistillation, getKolState } from "./kol-distillation.js";
import { renderAIDecisionLayer } from "./ai-decision-layer.js";
import { renderAIPromptExport } from "./ai-prompt-export.js";

const SNAPSHOT_ENDPOINT = "/api/snapshot?mode=fast&refresh=1";
const AUTO_REFRESH_MS = 60_000;

function injectTerminalUiStyles() {
  if (document.getElementById("specularis-terminal-ui-hotfix")) return;
  const style = document.createElement("style");
  style.id = "specularis-terminal-ui-hotfix";
  style.textContent = `
/* Specularis v1.3.6 UI hotfix: compact terminal cards */
#sipContainer,#oilContainer,#adlContainer{--card-bg:rgba(15,18,24,.92);--card-bd:rgba(255,255,255,.09);--card-bd-strong:rgba(92,190,220,.28);--chip-bg:rgba(125,92,210,.18);--chip-bd:rgba(160,125,255,.28);--muted2:rgba(210,220,235,.62);--soft2:rgba(235,240,255,.78);--danger:#ff5b7a;--cyan:#5bdde8;--gold:#d8b45a;}
#sipContainer .sip-grid,#oilContainer .oil-grid,#adlContainer .adl-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(310px,1fr))!important;gap:14px!important;align-items:stretch!important;}
#sipContainer .sip-card,#oilContainer .oil-card,#adlContainer .adl-card{position:relative!important;overflow:hidden!important;background:radial-gradient(circle at 0 0,rgba(76,180,210,.10),transparent 32%),linear-gradient(180deg,rgba(21,24,31,.96),rgba(9,11,15,.97))!important;border:1px solid var(--card-bd)!important;border-radius:16px!important;padding:16px 18px!important;box-shadow:0 16px 36px rgba(0,0,0,.22)!important;min-height:auto!important;display:flex!important;flex-direction:column!important;gap:10px!important;}
#sipContainer .sip-card:hover,#oilContainer .oil-card:hover,#adlContainer .adl-card:hover{border-color:var(--card-bd-strong)!important;background:radial-gradient(circle at 0 0,rgba(76,180,210,.14),transparent 34%),linear-gradient(180deg,rgba(24,27,35,.98),rgba(10,12,16,.98))!important;}
#sipContainer .sip-card-header,#oilContainer .oil-card-header,#adlContainer .adl-card-header{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:10px!important;margin:0!important;padding:0 0 8px!important;border-bottom:1px solid rgba(255,255,255,.07)!important;}
#sipContainer .sip-ticker,#oilContainer .oil-ticker,#adlContainer .adl-ticker{font-size:22px!important;letter-spacing:.08em!important;font-weight:850!important;line-height:1!important;color:var(--text,#f4f7fb)!important;}
#sipContainer .sip-company,#oilContainer .oil-company,#adlContainer .adl-company{font-size:12px!important;color:var(--muted2)!important;margin-top:4px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:220px!important;}
#sipContainer .sip-tags,#oilContainer .oil-tags{display:flex!important;flex-wrap:wrap!important;gap:5px!important;margin-top:7px!important;}
#sipContainer .sip-tag,#oilContainer .oil-tag,#sipContainer .sip-badge,#oilContainer .oil-badge,#adlContainer .adl-badge,#sipContainer .sip-relevance{font-size:11px!important;line-height:1!important;padding:5px 7px!important;border-radius:7px!important;background:var(--chip-bg)!important;border:1px solid var(--chip-bd)!important;color:#cdbdff!important;text-transform:none!important;letter-spacing:.02em!important;}
#sipContainer .sip-relevance--avoid,#oilContainer .oil-risk--high,#adlContainer .adl-rating--avoid{color:#ff8ca0!important;background:rgba(255,75,110,.10)!important;border-color:rgba(255,75,110,.28)!important;}
#sipContainer .sip-relevance--watch,#oilContainer .oil-risk--medium,#adlContainer .adl-rating--watch{color:var(--gold)!important;background:rgba(216,180,90,.12)!important;border-color:rgba(216,180,90,.30)!important;}
#sipContainer .sip-relevance--tradable,#oilContainer .oil-risk--low{color:#6af1b1!important;background:rgba(74,220,145,.10)!important;border-color:rgba(74,220,145,.26)!important;}
#sipContainer .sip-badge-row,#oilContainer .oil-badge-row,#adlContainer .adl-badge-row{display:flex!important;gap:6px!important;align-items:center!important;flex-wrap:wrap!important;justify-content:flex-end!important;}
#sipContainer .sip-metrics-row,#oilContainer .oil-metrics-row,#adlContainer .adl-metrics-row{display:grid!important;grid-template-columns:1.25fr .9fr .95fr .95fr!important;gap:8px!important;margin:2px 0!important;}
#sipContainer .sip-metric-block,#oilContainer .oil-metric-block,#adlContainer .adl-metric-block{min-width:0!important;background:rgba(255,255,255,.035)!important;border:1px solid rgba(255,255,255,.065)!important;border-radius:10px!important;padding:9px 10px!important;display:flex!important;flex-direction:column!important;gap:5px!important;}
#sipContainer .sip-metric-label,#oilContainer .oil-metric-label,#adlContainer .adl-metric-label,#sipContainer .sip-meta-label{font-size:10px!important;color:var(--muted2)!important;text-transform:uppercase!important;letter-spacing:.08em!important;white-space:nowrap!important;}
#sipContainer .sip-price-val{font-size:25px!important;font-weight:850!important;letter-spacing:.01em!important;color:var(--text,#fff)!important;line-height:1!important;}
#sipContainer .sip-change-val,#sipContainer .sip-trend-val,#sipContainer .sip-vol-val,#oilContainer .oil-structure-val,#oilContainer .oil-bias-val,#adlContainer .adl-score-val{font-size:13px!important;font-weight:750!important;color:var(--soft2)!important;line-height:1.15!important;}
#sipContainer .sip-pos,#adlContainer .adl-positive{color:#60e8a2!important;}#sipContainer .sip-neg,#adlContainer .adl-negative{color:var(--danger)!important;}#sipContainer .sip-trend--down{color:var(--danger)!important;}#sipContainer .sip-trend--up{color:#60e8a2!important;}#sipContainer .sip-trend--flat{color:var(--gold)!important;}
#sipContainer .sip-levels-row,#oilContainer .oil-levels-row,#adlContainer .adl-levels-row{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:8px!important;margin:0!important;}
#sipContainer .sip-level-cell,#oilContainer .oil-level-cell,#adlContainer .adl-level-cell{background:rgba(0,0,0,.15)!important;border:1px solid rgba(255,255,255,.055)!important;border-radius:9px!important;padding:8px!important;min-height:auto!important;}
#sipContainer .sip-level-cell span:last-child,#oilContainer .oil-level-cell span:last-child,#adlContainer .adl-level-cell span:last-child{display:block!important;margin-top:4px!important;font-size:12px!important;color:var(--soft2)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
#sipContainer .sip-summary,#oilContainer .oil-summary,#adlContainer .adl-summary{margin:0!important;padding:10px 11px!important;border-left:3px solid rgba(91,221,232,.75)!important;background:rgba(91,221,232,.055)!important;border-radius:9px!important;color:rgba(235,240,255,.84)!important;font-size:13px!important;line-height:1.5!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;}
#sipContainer .sip-news-item,#oilContainer .oil-reason,#adlContainer .adl-reason{margin:0!important;color:rgba(235,240,255,.72)!important;font-size:12px!important;line-height:1.45!important;display:-webkit-box!important;-webkit-line-clamp:1!important;-webkit-box-orient:vertical!important;overflow:hidden!important;}
#sipContainer .sip-risk-row{display:flex!important;flex-wrap:wrap!important;gap:6px!important;margin-top:0!important;}#sipContainer .sip-risk-chip{font-size:11px!important;color:#ff8ca0!important;background:rgba(255,75,110,.10)!important;border:1px solid rgba(255,75,110,.22)!important;border-radius:8px!important;padding:5px 7px!important;}
#sipContainer details,#oilContainer details,#adlContainer details{margin-top:auto!important;border-top:1px solid rgba(255,255,255,.07)!important;padding-top:8px!important;}#sipContainer summary,#oilContainer summary,#adlContainer summary{cursor:pointer!important;color:var(--cyan)!important;font-size:12px!important;letter-spacing:.04em!important;list-style:none!important;}#sipContainer summary::-webkit-details-marker,#oilContainer summary::-webkit-details-marker,#adlContainer summary::-webkit-details-marker{display:none!important;}
#sipContainer .sip-edit-btn,#oilContainer .oil-edit-btn,#adlContainer .adl-edit-btn{align-self:flex-end!important;font-size:11px!important;padding:6px 9px!important;border-radius:8px!important;opacity:.58!important;background:rgba(255,255,255,.055)!important;border:1px solid rgba(255,255,255,.10)!important;color:rgba(235,240,255,.68)!important;}#sipContainer .sip-edit-btn:hover,#oilContainer .oil-edit-btn:hover,#adlContainer .adl-edit-btn:hover{opacity:1!important;}
@media (min-width:1500px){#sipContainer .sip-grid,#oilContainer .oil-grid,#adlContainer .adl-grid{grid-template-columns:repeat(4,minmax(290px,1fr))!important;}}@media (max-width:980px){#sipContainer .sip-grid,#oilContainer .oil-grid,#adlContainer .adl-grid{grid-template-columns:1fr!important;}#sipContainer .sip-metrics-row,#oilContainer .oil-metrics-row,#adlContainer .adl-metrics-row,#sipContainer .sip-levels-row,#oilContainer .oil-levels-row,#adlContainer .adl-levels-row{grid-template-columns:repeat(2,minmax(0,1fr))!important;}}
  `;
  document.head.appendChild(style);
}

// Retrieve current market regime from the existing app global state.
// app.js stores lastDashboard on window as window._specularisDashboard.
function getMarketRegime() {
  try {
    const d = window._specularisDashboard;
    if (!d) return {};
    const regime = d.risk || d.marketRegime || d.terminalLite?.marketRegimeSummary || {};
    return {
      score: regime.score ?? null,
      mode: regime.mode ?? regime.type ?? null,
      label: regime.label ?? regime.headline ?? null,
    };
  } catch {
    return {};
  }
}

function snapshotId(d = {}) {
  return d.generatedAt || d.asOf || d.updatedAt || d.terminalLite?.meta?.generatedAt || d.rawSnapshot?.generatedAt || null;
}

// Return latest snapshot for SIP snapshot merge.
function getLatestSnapshot() {
  try {
    return latestSnapshot || window._specularisDashboard || window._specularisRawSnapshot || {};
  } catch {
    return {};
  }
}

// Merge raw /api/snapshot response into the legacy dashboard object so all new
// modules can hydrate from terminalLite and marketData without waiting for app.js
// to expose these fields.
function bridgeRawSnapshot(raw = {}) {
  if (!raw || typeof raw !== "object") return null;

  const current = window._specularisDashboard || {};
  const bridged = {
    ...current,
    generatedAt: raw.generatedAt || current.generatedAt || Date.now(),
    runtimeMode: raw.runtimeMode || current.runtimeMode || null,
    runtimeBudgetMs: raw.runtimeBudgetMs || current.runtimeBudgetMs || null,
    envDebug: raw.envDebug || current.envDebug || {},
    marketData: raw.marketData || current.marketData || raw.lastKnownGood?.marketData || null,
    sources: raw.sources || current.sources || raw.lastKnownGood?.sources || {},
    terminalLite: raw.terminalLite || current.terminalLite || raw.lastKnownGood?.terminalLite || null,
    rawSnapshot: raw,
  };

  window._specularisRawSnapshot = raw;
  window._specularisDashboard = bridged;
  latestSnapshot = bridged;
  return bridged;
}

async function fetchFreshSnapshot(reason = "manual") {
  try {
    const url = `${SNAPSHOT_ENDPOINT}&t=${Date.now()}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`snapshot_http_${res.status}`);
    const raw = await res.json();
    const bridged = bridgeRawSnapshot(raw);
    if (!bridged) return null;

    document.dispatchEvent(new CustomEvent("specularis:snapshotReady", {
      detail: bridged,
    }));

    console.log("[Specularis Terminal Lite] snapshot bridged", {
      reason,
      version: bridged.terminalLite?.meta?.version,
      generatedAt: bridged.generatedAt,
      stockIntel: bridged.terminalLite?.stockIntelligencePro?.length || 0,
      optionsLite: bridged.terminalLite?.optionsIntelligenceLite?.length || 0,
      aiDecision: bridged.terminalLite?.aiDecisionLayer?.length || 0,
    });
    return bridged;
  } catch (err) {
    console.warn("[Specularis Terminal Lite] direct snapshot fetch failed:", err?.message || err);
    return null;
  }
}

// Keep live module handles so AI Decision / Prompt Export read the rendered
// in-memory state instead of stale localStorage placeholders.
let sipModule = null;
let oilModule = null;
let kolModule = null;
let latestSnapshot = {};
let lastSnapshotAt = null;

// Provide current state to all modules that need cross-module data.
function getModuleStates() {
  return {
    sipState: sipModule?.getState?.() || getStockIntelState(),
    oilState: oilModule?.getState?.() || getOptionsLiteState(),
    kolState: kolModule?.getState?.() || getKolState(),
    marketRegime: getMarketRegime(),
    snapshot: latestSnapshot || getLatestSnapshot(),
  };
}

function emitSnapshotReady(d) {
  if (!d) return;
  const ts = snapshotId(d);
  if (ts && ts === lastSnapshotAt) return;
  lastSnapshotAt = ts || Date.now();
  latestSnapshot = d;
  document.dispatchEvent(new CustomEvent("specularis:snapshotReady", { detail: d }));
}

function initModules() {
  injectTerminalUiStyles();
  latestSnapshot = getLatestSnapshot();

  // Stock Intelligence Pro.
  sipModule = renderStockIntelPro("sipContainer", latestSnapshot);

  // Options Intelligence Lite.
  oilModule = renderOptionsIntelLite("oilContainer", latestSnapshot);

  // KOL Distillation.
  kolModule = renderKolDistillation("kolContainer");

  // AI Decision Layer — prefers server-side terminalLite.aiDecisionLayer when present.
  renderAIDecisionLayer("adlContainer", getModuleStates, latestSnapshot);

  // AI Prompt Export — generates copyable prompts.
  renderAIPromptExport("apeContainer", getModuleStates);

  // Immediately hydrate from any dashboard object that already exists.
  emitSnapshotReady(latestSnapshot);

  // Critical fix: fetch the raw snapshot directly. This supplies terminalLite,
  // marketData.quotes, generatedAt and raw source metadata even if the legacy
  // app.js dashboard transformer omits them.
  fetchFreshSnapshot("initial-load");

  // Make manual debugging easy in the browser console.
  window.__specularisRefreshSnapshot = () => fetchFreshSnapshot("console");

  console.log("[Specularis Terminal Lite] All modules initialized with direct snapshot bridge + UI hotfix.");
}

// Wait for DOM to be ready.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initModules);
} else {
  initModules();
}

// app.js doesn't fire events natively, so poll and detect snapshot changes.
setInterval(() => {
  const d = window._specularisDashboard;
  if (!d) return;
  const ts = snapshotId(d);
  if (ts && ts !== lastSnapshotAt) {
    emitSnapshotReady(d);
  }
}, 1000);

// Periodically refresh raw snapshot for the new modules only. The cadence is
// intentionally conservative to avoid API limits.
setInterval(() => fetchFreshSnapshot("interval"), AUTO_REFRESH_MS);
