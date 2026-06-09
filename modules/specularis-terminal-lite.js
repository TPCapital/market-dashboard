// modules/specularis-terminal-lite.js
// Main coordinator for Specularis Market Terminal Lite new modules.
// Loaded as a plain ES module (type="module") — runs after app.js / i18n.js.
//
// v1.4.2 runtime-safe hotfix:
// - Do not force refresh=1 on every module snapshot request.
// - Slow down module-level polling to reduce TwelveData 429 / Yahoo 401 pressure.
// - Translate English trend enum labels in Chinese UI at runtime.
// - Add Gemini auto-analysis button to the legacy prompt-export module without
//   rewriting the whole module.

import { renderStockIntelPro, getStockIntelState } from "./stock-intelligence-pro.js";
import { renderOptionsIntelLite, getOptionsLiteState } from "./options-intelligence-lite.js";
import { renderKolDistillation, getKolState } from "./kol-distillation.js";
import { renderAIDecisionLayer } from "./ai-decision-layer.js";
import { renderAIPromptExport } from "./ai-prompt-export.js";

const SNAPSHOT_ENDPOINT = "/api/snapshot?mode=fast";
const AUTO_REFRESH_MS = 300_000;

function injectTerminalUiStyles() {
  if (document.getElementById("specularis-terminal-ui-hotfix")) return;
  const style = document.createElement("style");
  style.id = "specularis-terminal-ui-hotfix";
  style.textContent = `
#sipContainer,#oilContainer,#adlContainer{--card-bg:rgba(15,18,24,.92);--card-bd:rgba(255,255,255,.09);--card-bd-strong:rgba(92,190,220,.28);--chip-bg:rgba(125,92,210,.18);--chip-bd:rgba(160,125,255,.28);--muted2:rgba(210,220,235,.62);--soft2:rgba(235,240,255,.78);--danger:#ff5b7a;--cyan:#5bdde8;--gold:#d8b45a;}
#sipContainer .sip-grid,#oilContainer .oil-grid,#adlContainer .adl-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(310px,1fr))!important;gap:14px!important;align-items:stretch!important;}
#sipContainer .sip-card,#oilContainer .oil-card,#adlContainer .adl-card{position:relative!important;overflow:hidden!important;background:radial-gradient(circle at 0 0,rgba(76,180,210,.10),transparent 32%),linear-gradient(180deg,rgba(21,24,31,.96),rgba(9,11,15,.97))!important;border:1px solid var(--card-bd)!important;border-radius:16px!important;padding:16px 18px!important;box-shadow:0 16px 36px rgba(0,0,0,.22)!important;min-height:auto!important;display:flex!important;flex-direction:column!important;gap:10px!important;}
#sipContainer .sip-card:hover,#oilContainer .oil-card:hover,#adlContainer .adl-card:hover{border-color:var(--card-bd-strong)!important;}
#sipContainer .sip-card-header,#oilContainer .oil-card-header,#adlContainer .adl-card-header{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:10px!important;margin:0!important;padding:0 0 8px!important;border-bottom:1px solid rgba(255,255,255,.07)!important;}
#sipContainer .sip-ticker,#oilContainer .oil-ticker,#adlContainer .adl-ticker{font-size:22px!important;letter-spacing:.08em!important;font-weight:850!important;line-height:1!important;color:var(--text,#f4f7fb)!important;}
#sipContainer .sip-company,#oilContainer .oil-company,#adlContainer .adl-company{font-size:12px!important;color:var(--muted2)!important;margin-top:4px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:220px!important;}
#sipContainer .sip-tag,#oilContainer .oil-tag,#sipContainer .sip-badge,#oilContainer .oil-badge,#adlContainer .adl-badge,#sipContainer .sip-relevance{font-size:11px!important;line-height:1!important;padding:5px 7px!important;border-radius:7px!important;background:var(--chip-bg)!important;border:1px solid var(--chip-bd)!important;color:#cdbdff!important;text-transform:none!important;letter-spacing:.02em!important;}
#sipContainer .sip-metrics-row,#oilContainer .oil-metrics-row,#adlContainer .adl-metrics-row{display:grid!important;grid-template-columns:1.25fr .9fr .95fr .95fr!important;gap:8px!important;margin:2px 0!important;}
#sipContainer .sip-metric-block,#oilContainer .oil-metric-block,#adlContainer .adl-metric-block{min-width:0!important;background:rgba(255,255,255,.035)!important;border:1px solid rgba(255,255,255,.065)!important;border-radius:10px!important;padding:9px 10px!important;display:flex!important;flex-direction:column!important;gap:5px!important;}
#sipContainer .sip-metric-label,#oilContainer .oil-metric-label,#adlContainer .adl-metric-label,#sipContainer .sip-meta-label{font-size:10px!important;color:var(--muted2)!important;text-transform:uppercase!important;letter-spacing:.08em!important;white-space:nowrap!important;}
#sipContainer .sip-price-val{font-size:25px!important;font-weight:850!important;letter-spacing:.01em!important;color:var(--text,#fff)!important;line-height:1!important;}
#sipContainer .sip-change-val,#sipContainer .sip-trend-val,#sipContainer .sip-vol-val,#oilContainer .oil-structure-val,#oilContainer .oil-bias-val,#adlContainer .adl-score-val{font-size:13px!important;font-weight:750!important;color:var(--soft2)!important;line-height:1.15!important;}
#sipContainer .sip-trend--down{color:var(--danger)!important;}#sipContainer .sip-trend--up{color:#60e8a2!important;}#sipContainer .sip-trend--flat{color:var(--gold)!important;}
#sipContainer .sip-levels-row,#oilContainer .oil-levels-row,#adlContainer .adl-levels-row{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:8px!important;margin:0!important;}
#sipContainer .sip-level-cell,#oilContainer .oil-level-cell,#adlContainer .adl-level-cell{background:rgba(0,0,0,.15)!important;border:1px solid rgba(255,255,255,.055)!important;border-radius:9px!important;padding:8px!important;min-height:auto!important;}
#sipContainer .sip-summary,#oilContainer .oil-summary,#adlContainer .adl-summary{margin:0!important;padding:10px 11px!important;border-left:3px solid rgba(91,221,232,.75)!important;background:rgba(91,221,232,.055)!important;border-radius:9px!important;color:rgba(235,240,255,.84)!important;font-size:13px!important;line-height:1.5!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;}
#sipContainer details,#oilContainer details,#adlContainer details{margin-top:auto!important;border-top:1px solid rgba(255,255,255,.07)!important;padding-top:8px!important;}#sipContainer summary,#oilContainer summary,#adlContainer summary{cursor:pointer!important;color:var(--cyan)!important;font-size:12px!important;letter-spacing:.04em!important;list-style:none!important;}
#sipContainer .sip-edit-btn,#oilContainer .oil-edit-btn,#adlContainer .adl-edit-btn{align-self:flex-end!important;font-size:11px!important;padding:6px 9px!important;border-radius:8px!important;opacity:.58!important;background:rgba(255,255,255,.055)!important;border:1px solid rgba(255,255,255,.10)!important;color:rgba(235,240,255,.68)!important;}
.ape-gemini-output{margin-top:12px;border:1px solid rgba(91,221,232,.22);background:rgba(91,221,232,.055);border-radius:12px;padding:12px}.ape-gemini-run{background:linear-gradient(135deg,#43d9ff,#7c5cff)!important;color:#fff!important;border:0!important}
@media (min-width:1500px){#sipContainer .sip-grid,#oilContainer .oil-grid,#adlContainer .adl-grid{grid-template-columns:repeat(4,minmax(290px,1fr))!important;}}@media (max-width:980px){#sipContainer .sip-grid,#oilContainer .oil-grid,#adlContainer .adl-grid{grid-template-columns:1fr!important;}#sipContainer .sip-metrics-row,#oilContainer .oil-metrics-row,#adlContainer .adl-metrics-row,#sipContainer .sip-levels-row,#oilContainer .oil-levels-row,#adlContainer .adl-levels-row{grid-template-columns:repeat(2,minmax(0,1fr))!important;}}
  `;
  document.head.appendChild(style);
}

const TREND_MAP_ZH = {
  strong_uptrend: "强上涨",
  uptrend: "上涨",
  sideways: "震荡",
  downtrend: "下跌",
  strong_downtrend: "强下跌",
  placeholder: "等待数据",
};

function replaceTextNodes(root, map) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    let text = node.nodeValue || "";
    for (const [k, v] of Object.entries(map)) {
      text = text.replaceAll(k, v);
    }
    node.nodeValue = text;
  }
}

function patchTrendLabels() {
  replaceTextNodes(document.getElementById("sipContainer"), TREND_MAP_ZH);
}

function getMarketRegime() {
  try {
    const d = window._specularisDashboard;
    if (!d) return {};
    const regime = d.risk || d.marketRegime || d.terminalLite?.marketRegimeSummary || {};
    return { score: regime.score ?? null, mode: regime.mode ?? regime.type ?? null, label: regime.label ?? regime.headline ?? null };
  } catch { return {}; }
}

function snapshotId(d = {}) {
  return d.generatedAt || d.asOf || d.updatedAt || d.terminalLite?.meta?.generatedAt || d.rawSnapshot?.generatedAt || null;
}

let sipModule = null;
let oilModule = null;
let kolModule = null;
let latestSnapshot = {};
let lastSnapshotAt = null;

function getLatestSnapshot() {
  try { return latestSnapshot || window._specularisDashboard || window._specularisRawSnapshot || {}; } catch { return {}; }
}

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
    const sep = SNAPSHOT_ENDPOINT.includes("?") ? "&" : "?";
    const url = `${SNAPSHOT_ENDPOINT}${sep}t=${Math.floor(Date.now() / 60000)}`;
    const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`snapshot_http_${res.status}`);
    const bridged = bridgeRawSnapshot(await res.json());
    if (!bridged) return null;
    document.dispatchEvent(new CustomEvent("specularis:snapshotReady", { detail: bridged }));
    console.log("[Specularis Terminal Lite] snapshot bridged", {
      reason, version: bridged.terminalLite?.meta?.version, generatedAt: bridged.generatedAt,
      stockIntel: bridged.terminalLite?.stockIntelligencePro?.length || 0,
      optionsLite: bridged.terminalLite?.optionsIntelligenceLite?.length || 0,
      aiDecision: bridged.terminalLite?.aiDecisionLayer?.length || 0,
    });
    queueMicrotask(patchTrendLabels);
    return bridged;
  } catch (err) {
    console.warn("[Specularis Terminal Lite] direct snapshot fetch failed:", err?.message || err);
    return null;
  }
}

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
  queueMicrotask(patchTrendLabels);
}

async function runGeminiAutoAnalysis(lang, prompt) {
  const res = await fetch("/api/ai-prompt-generate", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lang, prompt }),
  });
  return await res.json();
}

function renderGeminiPatchResult(result, lang) {
  const old = document.getElementById("apeGeminiOutput");
  if (old) old.remove();
  const analysis = result?.analysis || (lang === "en" ? "No Gemini analysis returned." : "Gemini 未返回分析结果。");
  const source = result?.source || "Gemini API";
  const status = result?.status || "unavailable";
  const html = `<div class="ape-output ape-gemini-output" id="apeGeminiOutput"><div class="ape-output-header"><span class="ape-output-label">Gemini Auto Analysis · ${status}</span><button class="ape-copy-btn" id="apeCopyGeminiBtn">📋 复制分析 Copy</button></div><p class="ape-note">${source}</p><textarea class="ape-textarea ape-textarea--analysis" id="apeGeminiText" readonly>${String(analysis).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}</textarea></div>`;
  document.getElementById("apePromptOutput")?.insertAdjacentHTML("afterend", html);
  document.getElementById("apeCopyGeminiBtn")?.addEventListener("click", () => {
    const text = document.getElementById("apeGeminiText")?.value || "";
    navigator.clipboard?.writeText(text);
  });
}

function patchPromptAutomation() {
  const output = document.getElementById("apePromptOutput");
  const textarea = document.getElementById("apePromptText");
  if (!output || !textarea || document.getElementById("apeGeminiRunBtn")) return;
  const lang = /English/i.test(output.textContent || "") ? "en" : "zh";
  const btn = document.createElement("button");
  btn.id = "apeGeminiRunBtn";
  btn.className = "ape-copy-btn ape-gemini-run";
  btn.textContent = "✨ Gemini 自动分析";
  output.querySelector(".ape-output-header")?.appendChild(btn);
  btn.addEventListener("click", async () => {
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ Gemini 分析中...";
    try {
      const result = await runGeminiAutoAnalysis(lang, textarea.value || "");
      renderGeminiPatchResult(result, lang);
    } catch (error) {
      renderGeminiPatchResult({ status: "unavailable", error: error?.message, analysis: lang === "en" ? "Gemini automatic analysis failed. Please use the copyable prompt manually." : "Gemini 自动分析失败，请先使用可复制提示词手动分析。" }, lang);
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  });
}

function initDomPatchers() {
  const observer = new MutationObserver(() => {
    patchTrendLabels();
    patchPromptAutomation();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(() => { patchTrendLabels(); patchPromptAutomation(); }, 2500);
}

function initModules() {
  injectTerminalUiStyles();
  initDomPatchers();
  latestSnapshot = getLatestSnapshot();
  sipModule = renderStockIntelPro("sipContainer", latestSnapshot);
  oilModule = renderOptionsIntelLite("oilContainer", latestSnapshot);
  kolModule = renderKolDistillation("kolContainer");
  renderAIDecisionLayer("adlContainer", getModuleStates, latestSnapshot);
  renderAIPromptExport("apeContainer", getModuleStates);
  emitSnapshotReady(latestSnapshot);
  fetchFreshSnapshot("initial-load");
  window.__specularisRefreshSnapshot = () => fetchFreshSnapshot("console");
  console.log("[Specularis Terminal Lite] All modules initialized with v1.4.2 runtime-safe bridge.");
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initModules);
else initModules();

setInterval(() => {
  const d = window._specularisDashboard;
  if (!d) return;
  const ts = snapshotId(d);
  if (ts && ts !== lastSnapshotAt) emitSnapshotReady(d);
}, 1500);

setInterval(() => fetchFreshSnapshot("interval"), AUTO_REFRESH_MS);
