// modules/ai-prompt-export.js
// Specularis Market Terminal Lite — AI Prompt Export Module.
// Supports both copyable GPT / Claude prompts and Gemini automatic analysis.

function escHtml(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const STRUCTURE_LABELS = {
  stock: "正股 Stock", long_call: "买入 Call", call_spread: "Call 价差",
  put_spread: "Put 价差", wait: "等待 Wait", avoid: "回避 Avoid",
};

function buildPrompt(lang, { sipState, oilState, kolState, marketRegime, decisions }) {
  const now = new Date().toLocaleString("zh-CN", { timeZone: "America/New_York", hour12: false });
  const regimeStr = marketRegime?.label || marketRegime?.mode || "未知";
  const regimeScore = marketRegime?.score ?? "--";

  const tickers = ["MU","MRVL","NVDA","AVGO","AMD","TSM","ASML","PLTR","ORCL","SMCI"];
  const kolEntries = kolState?.entries || [];

  const sipLines = tickers.map((t) => {
    const s = sipState?.[t] || {};
    const price = s.currentPrice ? `$${s.currentPrice}` : "N/A";
    const change = s.dailyChangePercent != null ? `${s.dailyChangePercent}%` : "N/A";
    const news = Array.isArray(s.recentNews) && s.recentNews.length > 0
      ? (typeof s.recentNews[0] === "object" ? s.recentNews[0].title : s.recentNews[0])
      : "无";
    return `  ${t}: 价格${price} 涨跌${change} 趋势${s.trendStatus || "N/A"} 分析师${s.analystTone || "N/A"} 财报${s.earningsDate || "未知"} 新闻:${news}`;
  }).join("\n");

  const oilLines = tickers.map((t) => {
    const o = oilState?.[t] || {};
    return `  ${t}: 结构${STRUCTURE_LABELS[o.preferredStructure] || o.preferredStructure || "wait"} IV${o.ivStatus || "N/A"} 财报风险${o.earningsVolRisk ? "是" : "否"} 风险${o.riskLevel || "N/A"}`;
  }).join("\n");

  const kolLines = kolEntries.length > 0
    ? kolEntries.slice(0, 6).map((k) =>
        `  @${k.kolHandle}: ${k.stance} (${k.convictionLevel}信心) [${k.signalType}] 涉及:${(k.mentionedTickers || []).join(",")} — ${(k.keyArguments || [k.aiDistillationSummary || "无论点"])[0]}`
      ).join("\n")
    : "  暂无 KOL 输入";

  const decisionLines = decisions && decisions.length > 0
    ? decisions.filter((d) => d.score !== null).slice(0, 5).map((d) =>
        `  ${d.ticker}: ${d.score}/10 [${d.rating}] 动作:${d.action} 工具:${d.preferredVehicle} 进场:${d.keyEntryZone || "N/A"} 止损:${d.invalidationLevel || "N/A"} 目标:${d.targetZone || "N/A"}`
      ).join("\n") || "  暂无有效评分（需先在个股情报中输入数据）"
    : "  暂无有效评分";

  if (lang === "en") {
    return `
=== SPECULARIS MARKET TERMINAL LITE — AI ANALYSIS PROMPT ===
Generated: ${now} EST | Mode: Human-in-the-Loop

MARKET REGIME: ${regimeStr} (Score: ${regimeScore}/100)

STOCK INTELLIGENCE PRO:
${sipLines}

OPTIONS INTELLIGENCE LITE:
${oilLines}

KOL DISTILLATION:
${kolLines}

AI DECISION LAYER (Scored):
${decisionLines}

─── ANALYSIS REQUESTS ───
1. Assess current market regime for AI/semiconductor stocks (MU, MRVL, NVDA, AVGO, AMD, TSM, ASML, PLTR, ORCL, SMCI). Is this a risk-on or risk-off environment?
2. Which 3 tickers are most tradable today? Why?
3. For the top 2 tickers: stock vs. option? Is IV or earnings event risk too high? What is the preferred structure?
4. Provide an A+ score (0-10) with full breakdown for the #1 opportunity. Give specific entry zone, invalidation level, and target.
5. Are there any mandatory no-trade conditions right now?
6. Top 3 risk factors to monitor today.

Rules: Be conservative when data is mixed or placeholder. No fabricated GEX or insider data. Research only.
`.trim();
  }

  return `
=== SPECULARIS 市场终端 LITE — AI 分析提示词 ===
生成时间：${now} 美东时间 | 模式：人工智能协同分析

当前市场状态：${regimeStr}（评分 ${regimeScore}/100）

【个股情报 Pro】
${sipLines}

【期权情报 Lite】
${oilLines}

【KOL 观点蒸馏】
${kolLines}

【AI 决策层评分】
${decisionLines}

─── 分析请求 ───
1. 当前市场状态对 AI / 半导体板块（MU、MRVL、NVDA、AVGO、AMD、TSM、ASML、PLTR、ORCL、SMCI）意味着什么？风险偏好如何？
2. 今日最具交易性的 3 个标的是什么？理由是什么？
3. 针对前 2 个标的：选择正股还是期权？当前 IV / 财报事件风险是否过高？建议哪种期权结构？
4. 最强机会的完整 A+ 评分（0-10 分，含各项分解）。请给出具体进场区间、止损位和目标位。
5. 今日有无必须遵守的不可交易条件？
6. 今日最需关注的 3 大风险因素。

规则：数据混合或占位符时请保守。请勿编造 GEX、内部人或异常大单数据。仅供研究。
`.trim();
}


function getGeminiSummaryHtml() {
  try {
    const gemini = window._specularisDashboard?.terminalLite?.geminiSummary;
    if (!gemini) return "";
    const status = gemini.status || gemini.dataStatus || "unavailable";
    const summary = gemini.summary || {};
    const zh = summary.zhSummary || summary.rawText || "Gemini AI 摘要暂不可用。";
    const risks = Array.isArray(summary.topRisks) ? summary.topRisks.slice(0, 3).join(" / ") : "";
    const focus = Array.isArray(summary.watchlistFocus) ? summary.watchlistFocus.slice(0, 5).join(" / ") : "";
    const source = gemini.source || "Gemini API";
    return `
  <div class="ape-gemini-card">
    <div class="ape-output-header">
      <span class="ape-output-label">Gemini AI Summary · ${escHtml(status)}</span>
      <span class="ape-note">${escHtml(source)}</span>
    </div>
    <p class="ape-desc">${escHtml(zh)}</p>
    ${risks ? `<p class="ape-note"><strong>Top risks:</strong> ${escHtml(risks)}</p>` : ""}
    ${focus ? `<p class="ape-note"><strong>Focus:</strong> ${escHtml(focus)}</p>` : ""}
  </div>`;
  } catch {
    return "";
  }
}

export function renderAIPromptExport(containerId, getModuleStates) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let latestDecisions = [];

  document.addEventListener("specularis:decisionsReady", (e) => {
    latestDecisions = e.detail?.decisions || [];
  });

  function buildCurrentPrompt(lang) {
    const { sipState, oilState, kolState, marketRegime } = getModuleStates();
    return buildPrompt(lang, {
      sipState, oilState, kolState, marketRegime, decisions: latestDecisions
    });
  }

  function copyText(text, btn, idleText) {
    const write = navigator.clipboard?.writeText
      ? navigator.clipboard.writeText(text)
      : Promise.reject(new Error("clipboard_unavailable"));
    write.then(() => {
      if (btn) {
        btn.textContent = "✅ 已复制！Copied!";
        setTimeout(() => { btn.textContent = idleText; }, 2000);
      }
    }).catch(() => {
      const fallback = document.createElement("textarea");
      fallback.value = text;
      fallback.style.position = "fixed";
      fallback.style.opacity = "0";
      document.body.appendChild(fallback);
      fallback.select();
      document.execCommand("copy");
      fallback.remove();
    });
  }

  function removeOutputs() {
    document.getElementById("apePromptOutput")?.remove();
    document.getElementById("apeGeminiOutput")?.remove();
  }

  function generateAndShow(lang) {
    const prompt = buildCurrentPrompt(lang);

    removeOutputs();

    const outputHtml = `
<div class="ape-output" id="apePromptOutput">
  <div class="ape-output-header">
    <span class="ape-output-label">Generated Prompt — ${lang === "en" ? "English" : "中文"}</span>
    <button class="ape-copy-btn" id="apeCopyBtn">📋 复制 Copy</button>
  </div>
  <textarea class="ape-textarea" id="apePromptText" readonly>${escHtml(prompt)}</textarea>
  <p class="ape-note">将以上文本粘贴至 GPT Plus 或 Claude Pro 以进行完整分析。
  Paste the above into GPT Plus or Claude Pro for full analysis.</p>
</div>`;
    container.insertAdjacentHTML("beforeend", outputHtml);

    document.getElementById("apeCopyBtn").addEventListener("click", () => {
      copyText(prompt, document.getElementById("apeCopyBtn"), "📋 复制 Copy");
    });
  }

  function renderGeminiResult(result, lang, prompt, title = "Gemini Auto Analysis") {
    document.getElementById("apeGeminiOutput")?.remove();
    const status = result?.status || "unavailable";
    const source = result?.source || "Gemini API";
    const error = result?.error || "";
    const latency = Number.isFinite(result?.latencyMs) ? `${result.latencyMs}ms` : "--";
    const analysis = result?.analysis || (lang === "en"
      ? "No Gemini analysis returned. The generated prompt is preserved below."
      : "Gemini 未返回分析结果。下方保留本次生成的提示词。");
    const outputHtml = `
<div class="ape-output ape-gemini-output" id="apeGeminiOutput">
  <div class="ape-output-header">
    <span class="ape-output-label">${escHtml(title)} · ${escHtml(status)}</span>
    <button class="ape-copy-btn" id="apeCopyGeminiBtn">📋 复制分析 Copy</button>
  </div>
  <p class="ape-note">${escHtml(source)} · ${escHtml(latency)}${error ? " · " + escHtml(error) : ""}</p>
  <textarea class="ape-textarea ape-textarea--analysis" id="apeGeminiText" readonly>${escHtml(analysis)}</textarea>
  <details class="ape-note">
    <summary>查看本次发送给 Gemini 的提示词</summary>
    <textarea class="ape-textarea" readonly>${escHtml(prompt)}</textarea>
  </details>
</div>`;
    container.insertAdjacentHTML("beforeend", outputHtml);
    document.getElementById("apeCopyGeminiBtn")?.addEventListener("click", () => {
      copyText(analysis, document.getElementById("apeCopyGeminiBtn"), "📋 复制分析 Copy");
    });
  }

  async function runGeminiAutoAnalysis(lang) {
    const btn = document.getElementById(lang === "en" ? "apeBtnGeminiEn" : "apeBtnGeminiZh");
    const idle = btn?.textContent || "";
    const prompt = buildCurrentPrompt(lang);
    removeOutputs();
    if (btn) {
      btn.disabled = true;
      btn.textContent = lang === "en" ? "⏳ Gemini analyzing..." : "⏳ Gemini 分析中...";
    }
    try {
      const response = await fetch("/api/ai-prompt-generate", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, prompt })
      });
      let result = null;
      try { result = await response.json(); } catch { result = null; }
      renderGeminiResult(result || {
        status: "unavailable",
        source: "Gemini API",
        error: `http_${response.status}`,
        analysis: lang === "en" ? "Gemini automatic analysis failed." : "Gemini 自动分析失败。"
      }, lang, prompt);
    } catch (error) {
      renderGeminiResult({
        status: "unavailable",
        source: "Gemini API",
        error: error?.message || "request_failed",
        analysis: lang === "en"
          ? "Gemini automatic analysis failed. You can still copy the generated prompt and analyze it manually."
          : "Gemini 自动分析失败。你仍然可以复制生成的提示词进行手动分析。"
      }, lang, prompt);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = idle;
      }
    }
  }

  function buildQuestionPrompt(question, lang) {
    const context = buildCurrentPrompt(lang);
    return [
      "=== SPECULARIS WEB AI Q&A ===",
      "User question:",
      question,
      "",
      "Current dashboard context:",
      context,
      "",
      "Instructions:",
      "1. Answer the user's question directly in Chinese unless the user asks for English.",
      "2. Use only the dashboard context and visible market data. Do not invent missing flow, GEX, insider, or options-chain data.",
      "3. Separate conclusion, reasons, risk points, and data that still needs confirmation.",
      "4. If the data is stale, delayed, unavailable, or mixed, say so clearly and keep the answer conservative.",
      "5. Research only. This is not financial advice."
    ].join("\n");
  }

  async function runGeminiQuestion(lang = "zh") {
    const input = document.getElementById("apeQuestionInput");
    const btn = document.getElementById("apeBtnAskGemini");
    const question = (input?.value || "").trim();
    const idle = btn?.textContent || "";

    if (!question) {
      renderGeminiResult({
        status: "unavailable",
        source: "Web AI Q&A",
        error: "missing_question",
        analysis: "请先在网页内输入你要分析的问题。"
      }, lang, buildCurrentPrompt(lang), "Gemini Web Q&A");
      input?.focus();
      return;
    }

    const prompt = buildQuestionPrompt(question, lang);
    removeOutputs();
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Gemini analyzing...";
    }
    try {
      const response = await fetch("/api/ai-prompt-generate", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, prompt, question })
      });
      let result = null;
      try { result = await response.json(); } catch { result = null; }
      renderGeminiResult(result || {
        status: "unavailable",
        source: "Gemini API",
        error: `http_${response.status}`,
        analysis: "网页内 Gemini 问答请求失败。"
      }, lang, prompt, "Gemini Web Q&A");
    } catch (error) {
      renderGeminiResult({
        status: "unavailable",
        source: "Gemini API",
        error: error?.message || "request_failed",
        analysis: "网页内 Gemini 问答请求失败。请检查 Vercel Function logs 或 Gemini 配额状态。"
      }, lang, prompt, "Gemini Web Q&A");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = idle;
      }
    }
  }

  container.classList.remove("is-loading");
  container.innerHTML = `
<div class="ape-panel">
  <div class="ape-header">
    <div class="ape-header-text">
      <span class="ape-badge">🤝 Human-in-the-Loop AI Workflow</span>
      <h3 class="ape-title">生成 GPT / Claude 分析提示词</h3>
      <p class="ape-desc">
        将当前市场快照 + 个股情报 + 期权信号 + KOL 数据 + AI 评分汇总为可粘贴的分析提示词。
        可手动复制到 GPT / Claude，也可直接调用 Gemini 生成网页内自动分析。
      </p>
    </div>
  </div>
  ${getGeminiSummaryHtml()}
  <div class="ape-output" id="apeQuestionPanel">
    <div class="ape-output-header">
      <span class="ape-output-label">Web AI Q&amp;A / 网页内问答</span>
      <span class="ape-note">Gemini API · /api/ai-prompt-generate</span>
    </div>
    <textarea class="ape-textarea" id="apeQuestionInput" rows="4" placeholder="输入你的问题，例如：今天 AMD 和 NVDA 哪个更适合做 0DTE？风险点是什么？"></textarea>
    <div class="ape-btn-row">
      <button class="ape-gen-btn" id="apeBtnAskGemini">💬 网页内提问 Gemini</button>
      <button class="ape-copy-btn" id="apeClearQuestionBtn">清空</button>
    </div>
    <p class="ape-note">输入问题后，页面会自动携带当前快照、个股情报、期权信号和评分上下文调用 Gemini。</p>
  </div>
  <div class="ape-btn-row">
    <button class="ape-gen-btn" id="apeBtnGeminiZh">✨ Gemini 自动分析</button>
    <button class="ape-gen-btn ape-gen-btn--en" id="apeBtnGeminiEn">✨ Gemini English Analysis</button>
  </div>
  <div class="ape-btn-row">
    <button class="ape-gen-btn" id="apeBtnZh">🇨🇳 生成中文提示词</button>
    <button class="ape-gen-btn ape-gen-btn--en" id="apeBtnEn">🇺🇸 Generate English Prompt</button>
  </div>
  <div class="ape-workflow">
    <div class="ape-step">
      <span class="ape-step-num">1</span>
      <span>在各模块填入数据（价格、新闻、KOL）</span>
    </div>
    <div class="ape-step-arrow">→</div>
    <div class="ape-step">
      <span class="ape-step-num">2</span>
      <span>点击「Gemini 自动分析」或生成提示词</span>
    </div>
    <div class="ape-step-arrow">→</div>
    <div class="ape-step">
      <span class="ape-step-num">3</span>
      <span>网页内查看自动分析，或手动粘贴至 GPT / Claude</span>
    </div>
    <div class="ape-step-arrow">→</div>
    <div class="ape-step">
      <span class="ape-step-num">4</span>
      <span>将 AI 摘要粘回「AI 摘要」字段</span>
    </div>
  </div>
  <p class="ape-api-note">
    💡 Gemini 自动分析使用 /api/ai-prompt-generate。若 API 配额受限，仍可使用手动复制提示词流程。
  </p>
</div>`;

  document.getElementById("apeBtnGeminiZh").addEventListener("click", () => runGeminiAutoAnalysis("zh"));
  document.getElementById("apeBtnGeminiEn").addEventListener("click", () => runGeminiAutoAnalysis("en"));
  document.getElementById("apeBtnAskGemini").addEventListener("click", () => runGeminiQuestion("zh"));
  document.getElementById("apeClearQuestionBtn").addEventListener("click", () => {
    const input = document.getElementById("apeQuestionInput");
    if (input) {
      input.value = "";
      input.focus();
    }
  });
  document.getElementById("apeBtnZh").addEventListener("click", () => generateAndShow("zh"));
  document.getElementById("apeBtnEn").addEventListener("click", () => generateAndShow("en"));

  document.addEventListener("specularis:snapshotReady", () => {
    // Re-render only the panel when a new server-side Gemini summary arrives.
    renderAIPromptExport(containerId, getModuleStates);
  }, { once: true });
}
