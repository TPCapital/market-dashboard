const CONFIG = window.DASHBOARD_CONFIG || {};
const REFRESH_SECONDS = CONFIG.refreshSeconds || 90;
const CACHE_PREFIX = "ai-us-equity-dashboard:";
const FALLBACK_SNAPSHOT_LABEL = "备用快照 2026-05-15 盘前";

const sourceCatalog = {
  yahoo: "Yahoo Finance",
  tradingView: "TradingView Screener",
  xMacro: "Walter Bloomberg X / Kobeissi X",
  reddit: "WallStreetBets Reddit",
  finviz: "Finviz Heatmap",
  unusualWhales: "Unusual Whales",
  benzinga: "Benzinga"
};

const symbolMeta = {
  SPY: ["SPDR S&P 500 ETF", "指数 ETF"],
  QQQ: ["Invesco QQQ", "指数 ETF"],
  NVDA: ["Nvidia", "AI 半导体"],
  AMD: ["AMD", "AI 半导体"],
  AVGO: ["Broadcom", "AI 半导体"],
  MRVL: ["Marvell", "AI 半导体"],
  SMCI: ["Super Micro", "AI 服务器"],
  MSFT: ["Microsoft", "大型科技"],
  AAPL: ["Apple", "大型科技"],
  AMZN: ["Amazon", "大型科技"],
  GOOGL: ["Alphabet", "大型科技"],
  META: ["Meta", "大型科技"],
  TSLA: ["Tesla", "动量科技"],
  PLTR: ["Palantir", "AI 软件"],
  ORCL: ["Oracle", "AI 软件"],
  CRM: ["Salesforce", "云计算"],
  SNOW: ["Snowflake", "云计算"],
  CRWD: ["CrowdStrike", "网络安全"],
  PANW: ["Palo Alto", "网络安全"],
  COIN: ["Coinbase", "加密资产"],
  MSTR: ["MicroStrategy", "加密资产"],
  XOM: ["Exxon Mobil", "能源"],
  CVX: ["Chevron", "能源"],
  JPM: ["JPMorgan", "金融"],
  GS: ["Goldman Sachs", "金融"],
  LLY: ["Eli Lilly", "医疗"],
  UNH: ["UnitedHealth", "医疗"],
  DASH: ["DoorDash", "消费科技"],
  NFLX: ["Netflix", "消费科技"],
  CSCO: ["Cisco", "AI 网络"]
};

const fallback = {
  yahoo: {
    indices: [
      metric("SPY", "S&P 500 ETF", 689.12, 0.31, "SPY 走强，宽基风险资产仍有承接。"),
      metric("QQQ", "Nasdaq ETF", 612.4, 0.46, "QQQ 强于 SPY，科技权重占优。"),
      metric("NDX", "Nasdaq 100", 25172.18, 0.48, "纳指强于大盘，科技风险偏好占优。"),
      metric("VIX", "Volatility", 13.62, -2.01, "波动率下行，尾部风险定价降温。"),
      metric("TNX", "10Y Yield", 4.12, 0.87, "长端利率上行，限制高估值扩张。"),
      metric("DXY", "Dollar Index", 98.36, -0.11, "美元走弱，流动性环境边际友好。"),
      metric("GOLD", "Gold", 3378.4, -0.24, "避险需求偏弱，资金倾向风险资产。")
    ],
    quotes: [
      quote("CSCO", 79.9, 15.03, 3.6),
      quote("PLTR", 227.4, 4.82, 2.9),
      quote("NVDA", 188.2, 2.35, 2.1),
      quote("MRVL", 93.4, 2.08, 1.7),
      quote("DASH", 254.1, 1.92, 1.6),
      quote("MSTR", 462.5, 1.76, 1.8),
      quote("AMD", 238.3, 1.64, 1.5),
      quote("CRWD", 554.8, 1.28, 1.35),
      quote("SNOW", 284.2, 1.18, 1.25),
      quote("COIN", 358.9, 1.11, 1.4),
      quote("XOM", 117.3, -0.28, 0.9),
      quote("UNH", 312.4, -1.24, 1.3)
    ]
  },
  tradingView: [
    leader("CSCO", 92, "价格突破 + 量能扩张 + 趋势强度高。"),
    leader("PLTR", 88, "AI 软件主线延续，相对强弱保持领先。"),
    leader("NVDA", 86, "AI 芯片核心龙头，回撤后资金回补。"),
    leader("MRVL", 78, "数据中心 ASIC 预期支撑趋势。"),
    leader("DASH", 73, "消费科技中相对强势，利润率预期改善。"),
    leader("MSTR", 71, "高 beta 弹性标的，受风险偏好驱动。")
  ],
  xMacro: [
    feed("Walter Bloomberg", "美债收益率仍是盘前估值锚", "利率上行会压制高估值成长股，但 VIX 回落抵消部分压力。", "neutral"),
    feed("The Kobeissi Letter", "科技集中度继续抬升", "市场风险偏好依旧围绕 AI、半导体和大型科技展开。", "bullish")
  ],
  reddit: {
    score: 68,
    tone: "偏乐观",
    mentions: [
      ["NVDA", 18],
      ["TSLA", 14],
      ["PLTR", 11],
      ["MSTR", 8]
    ],
    summary: "WSB 讨论集中在 AI 与高 beta 科技，散户追涨意愿回升但未失控。"
  },
  finviz: [
    sector("AI 半导体", 92, 1.82, "NVDA / AMD / AVGO 扩散最强，主动资金继续追随 AI 基建。"),
    sector("AI 软件", 84, 1.34, "PLTR / ORCL 维持强势，资金偏好盈利可见度。"),
    sector("云计算", 81, 1.08, "CRM / SNOW / MSFT 获得企业 AI 支出预期支撑。"),
    sector("大型科技", 78, 0.88, "MSFT / META 承接稳定，是指数风险偏好的核心。"),
    sector("加密资产", 67, 0.62, "COIN / MSTR 跟随高 beta 风险偏好改善。"),
    sector("能源", 41, -0.22, "油价催化不足，资金相对流出。")
  ],
  unusualWhales: [
    optionFlow("NVDA", "Call Sweep", 2.8, "AI 芯片看涨资金回补，短线动能增强。"),
    optionFlow("PLTR", "Call Buying", 2.1, "AI 软件方向看涨成交集中。"),
    optionFlow("TSLA", "Put Hedge", 1.6, "高 beta 标的对冲需求抬升。"),
    optionFlow("SPY", "0DTE Call", 1.4, "指数日内进攻仓位增加。"),
    optionFlow("QQQ", "Call Spread", 1.2, "纳指 ETF 看涨价差活跃，科技主线仍有承接。"),
    optionFlow("AMD", "Call Buying", 0.9, "半导体二线资金跟随，观察开盘扩散强度。")
  ],
  benzinga: {
    movers: [
      mover("CSCO", 15.03, "AI 网络订单与业绩指引强于预期。", "利好"),
      mover("PLTR", 4.82, "AI 软件需求延续，机构观点继续偏正面。", "利好"),
      mover("NVDA", 2.35, "AI 芯片链资金回流，期权成交活跃。", "利好"),
      mover("DASH", 1.92, "订单增长和利润率预期改善。", "利好"),
      mover("MSTR", 1.76, "加密资产风险偏好改善，高 beta 资金回补。", "利好"),
      mover("AMD", 1.64, "AI GPU 需求预期改善，半导体板块扩散。", "利好"),
      mover("CRWD", 1.28, "网络安全软件资金回流，云安全支出预期稳定。", "利好"),
      mover("SNOW", 1.18, "云数据平台交易升温，AI 数据基础设施逻辑延续。", "利好"),
      mover("COIN", 1.11, "加密相关资产跟随风险偏好回升。", "利好"),
      mover("UNH", -1.24, "防御仓位降温，医疗板块相对承压。", "利空")
    ],
    news: [
      news("财报", "Cisco 指引强化 AI 网络交易", "AI 订单与企业网络支出改善，硬件链重新定价。", "利好", "07:42"),
      news("AI", "半导体与 AI 软件继续吸引买盘", "资金偏好具备收入兑现能力的 AI 龙头。", "利好", "07:28"),
      news("IPO", "AI 基础设施资产关注度升温", "资金继续寻找数据中心、网络和芯片链的增量标的。", "利好", "07:16"),
      news("评级", "卖方上修 AI 龙头目标价", "评级催化强化趋势资金的持仓信心。", "利好", "06:58"),
      news("政策", "利率路径仍压制高估值扩张", "若收益率继续上行，追高胜率下降。", "利空", "06:41")
    ]
  },
  sentiment: [
    metric("Fear & Greed", "CNN Proxy", 66, 0, "Greed 区间，乐观但未进入极端亢奋。"),
    metric("RSI", "SPX 14D", 61, 2.1, "动能偏强，尚未触及典型超买阈值。"),
    metric("Put/Call", "CBOE Proxy", 0.82, -0.04, "保护性需求偏低，追涨拥挤度上升。")
  ]
};

function metric(id, name, value, change, note) {
  return { id, name, value, change, note };
}

function quote(symbol, price, preMarketChange, volumeRatio = 1) {
  const [name, sector] = symbolMeta[symbol] || [symbol, "其他"];
  return { symbol, name, sector, price, preMarketChange, volumeRatio };
}

function feed(source, title, summary, tone = "neutral") {
  return { source, title, summary, tone };
}

function sector(name, score, change, summary) {
  return { sector: name, score, change, summary };
}

function optionFlow(symbol, type, premium, summary) {
  return { symbol, type, premium, summary };
}

function mover(symbol, change, reason, bias) {
  const [name, sectorName] = symbolMeta[symbol] || [symbol, "其他"];
  return { symbol, name, sector: sectorName, change, reason, bias };
}

function leader(symbol, score, logic) {
  const [name, sectorName] = symbolMeta[symbol] || [symbol, "其他"];
  return { symbol, name, sector: sectorName, score, logic };
}

function news(category, title, summary, bias, time = "--:--") {
  return { category, title, summary, bias, time };
}

function endpoint(name) {
  return CONFIG.endpoints?.[name] || "";
}

async function fetchJson(url) {
  if (!url) throw new Error("missing endpoint");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`request failed ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function withFallback(sourceKey, loader, fallbackValue) {
  try {
    const data = await loader();
    const updatedAt = Date.now();
    writeSourceCache(sourceKey, data, updatedAt);
    window.__dashboardErrors = window.__dashboardErrors || {};
    delete window.__dashboardErrors[sourceKey];
    return {
      data,
      status: "live",
      label: sourceCatalog[sourceKey],
      updatedAt,
      timestamp: formatClock(updatedAt)
    };
  } catch (error) {
    console.warn(`${sourceKey} fallback`, error);
    window.__dashboardErrors = window.__dashboardErrors || {};
    window.__dashboardErrors[sourceKey] = error.message || String(error);
    const cached = readSourceCache(sourceKey);
    if (cached) {
      return {
        data: cached.data,
        status: "cached",
        label: sourceCatalog[sourceKey],
        updatedAt: cached.updatedAt,
        timestamp: `最后成功 ${formatDateTime(cached.updatedAt)}`
      };
    }
    return {
      data: fallbackValue,
      status: "fallback",
      label: sourceCatalog[sourceKey],
      updatedAt: null,
      timestamp: FALLBACK_SNAPSHOT_LABEL
    };
  }
}

function writeSourceCache(sourceKey, data, updatedAt) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${sourceKey}`, JSON.stringify({ data, updatedAt }));
  } catch (error) {
    console.warn("cache write skipped", sourceKey, error);
  }
}

function readSourceCache(sourceKey) {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${sourceKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !Number.isFinite(parsed.updatedAt)) return null;
    return parsed;
  } catch (error) {
    console.warn("cache read skipped", sourceKey, error);
    return null;
  }
}

async function loadYahoo() {
  const symbols = (CONFIG.yahooSymbols || []).map(encodeURIComponent).join(",");
  const url = endpoint("yahoo")
    ? `${endpoint("yahoo")}?symbols=${symbols}`
    : `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;
  const json = await fetchJson(url);
  const rows = json.quoteResponse?.result || [];
  const bySymbol = new Map(rows.map((row) => [row.symbol, row]));

  const mapIndex = (id, symbol, fallbackMetric) => {
    const row = bySymbol.get(symbol);
    if (!row?.regularMarketPrice) return fallbackMetric;
    return {
      ...fallbackMetric,
      value: row.regularMarketPrice,
      change: row.regularMarketChangePercent ?? fallbackMetric.change
    };
  };

  const indices = [
    mapIndex("SPY", "SPY", fallback.yahoo.indices[0]),
    mapIndex("QQQ", "QQQ", fallback.yahoo.indices[1]),
    mapIndex("NDX", "^NDX", fallback.yahoo.indices[2]),
    mapIndex("VIX", "^VIX", fallback.yahoo.indices[3]),
    mapIndex("TNX", "^TNX", fallback.yahoo.indices[4]),
    mapIndex("DXY", "DX-Y.NYB", fallback.yahoo.indices[5]),
    mapIndex("GOLD", "GC=F", fallback.yahoo.indices[6])
  ];

  const quoteRows = Object.keys(symbolMeta).map((symbol) => {
    const row = bySymbol.get(symbol);
    const seed = fallback.yahoo.quotes.find((item) => item.symbol === symbol);
    return quote(
      symbol,
      row?.preMarketPrice ?? row?.regularMarketPrice ?? seed?.price ?? 0,
      row?.preMarketChangePercent ?? row?.regularMarketChangePercent ?? seed?.preMarketChange ?? 0,
      row?.regularMarketVolume && row?.averageDailyVolume3Month
        ? row.regularMarketVolume / row.averageDailyVolume3Month
        : seed?.volumeRatio ?? 1
    );
  });

  return { indices, quotes: quoteRows };
}

async function loadReddit() {
  const json = await fetchJson(endpoint("reddit") || "https://www.reddit.com/r/wallstreetbets/hot.json?limit=50");
  const posts = json.data?.children?.map((item) => item.data) || [];
  const tickers = {};
  const positiveWords = ["call", "calls", "moon", "bull", "buy", "yolo", "beat"];
  const negativeWords = ["put", "puts", "bear", "sell", "short", "miss"];
  let toneScore = 50;

  for (const post of posts) {
    const text = `${post.title || ""}`.toUpperCase();
    for (const symbol of Object.keys(symbolMeta)) {
      if (text.includes(symbol)) tickers[symbol] = (tickers[symbol] || 0) + 1;
    }
    const lower = text.toLowerCase();
    toneScore += positiveWords.some((word) => lower.includes(word)) ? 1.6 : 0;
    toneScore -= negativeWords.some((word) => lower.includes(word)) ? 1.4 : 0;
  }

  const score = clamp(Math.round(toneScore));
  const mentions = Object.entries(tickers).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return {
    score,
    tone: score >= 62 ? "偏乐观" : score <= 42 ? "偏谨慎" : "中性",
    mentions: mentions.length ? mentions : fallback.reddit.mentions,
    summary: score >= 62 ? "WSB 风险偏好回升，AI 与高 beta 讨论更活跃。" : "WSB 情绪未形成一致追涨，短线更偏观望。"
  };
}

async function loadConfiguredArray(key, fallbackValue) {
  const json = await fetchJson(endpoint(key));
  return Array.isArray(json) ? json : json.items || json.data || fallbackValue;
}

async function loadBenzinga() {
  const json = await fetchJson(endpoint("benzinga"));
  return {
    movers: json.movers || fallback.benzinga.movers,
    news: json.news || fallback.benzinga.news
  };
}

async function loadServerSnapshot() {
  const url = endpoint("snapshot");
  if (!url) return null;
  const joiner = url.includes("?") ? "&" : "?";
  const json = await fetchJson(`${url}${joiner}ts=${Date.now()}`);
  const sources = fallbackSources();
  for (const [key, value] of Object.entries(json.sources || {})) {
    if (!sources[key] || !["live", "cached"].includes(value?.status) || !hasSnapshotData(value.data)) continue;
    const updatedAt = Number(value.updatedAt || json.generatedAt || Date.now());
    const status = json.servedFrom === "last-success" || value.status === "cached" ? "cached" : "live";
    sources[key] = {
      data: value.data,
      status,
      label: value.label || sourceCatalog[key],
      updatedAt,
      timestamp: status === "live" ? formatClock(updatedAt) : `最后成功 ${formatDateTime(updatedAt)}`
    };
    writeSourceCache(key, value.data, updatedAt);
  }
  return sources;
}

function hasSnapshotData(data) {
  if (!data) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === "object") return Object.keys(data).length > 0;
  return true;
}

async function loadAllSources() {
  const [yahoo, tradingView, xMacro, reddit, finviz, unusualWhales, benzinga] = await Promise.all([
    withFallback("yahoo", loadYahoo, fallback.yahoo),
    withFallback("tradingView", () => loadConfiguredArray("tradingViewScreener", fallback.tradingView), fallback.tradingView),
    withFallback("xMacro", () => loadConfiguredArray("xMacro", fallback.xMacro), fallback.xMacro),
    withFallback("reddit", loadReddit, fallback.reddit),
    withFallback("finviz", () => loadConfiguredArray("finvizHeatmap", fallback.finviz), fallback.finviz),
    withFallback("unusualWhales", () => loadConfiguredArray("unusualWhales", fallback.unusualWhales), fallback.unusualWhales),
    withFallback("benzinga", loadBenzinga, fallback.benzinga)
  ]);

  return {
    yahoo,
    tradingView,
    xMacro,
    reddit,
    finviz,
    unusualWhales,
    benzinga,
    sentiment: fallback.sentiment
  };
}

async function refreshSequentially() {
  const sources = (await loadServerSnapshot().catch((error) => {
    console.warn("server snapshot fallback", error);
    return null;
  })) || loadCachedSources() || fallbackSources();
  render(buildDashboard(sources));
}

function loadCachedSources() {
  const sources = fallbackSources();
  let hasCached = false;
  for (const key of Object.keys(sourceCatalog)) {
    const cached = readSourceCache(key);
    if (!cached) continue;
    sources[key] = {
      data: cached.data,
      status: "cached",
      label: sourceCatalog[key],
      updatedAt: cached.updatedAt,
      timestamp: `最后成功 ${formatDateTime(cached.updatedAt)}`
    };
    hasCached = true;
  }
  return hasCached ? sources : null;
}

function fallbackSources() {
  return {
    yahoo: fallbackSource("yahoo", fallback.yahoo),
    tradingView: fallbackSource("tradingView", fallback.tradingView),
    xMacro: fallbackSource("xMacro", fallback.xMacro),
    reddit: fallbackSource("reddit", fallback.reddit),
    finviz: fallbackSource("finviz", fallback.finviz),
    unusualWhales: fallbackSource("unusualWhales", fallback.unusualWhales),
    benzinga: fallbackSource("benzinga", fallback.benzinga),
    sentiment: fallback.sentiment
  };
}

function fallbackSource(key, data) {
  return {
    data,
    status: "fallback",
    label: sourceCatalog[key],
    updatedAt: null,
    timestamp: FALLBACK_SNAPSHOT_LABEL
  };
}

function buildDashboard(sources) {
  const quoteMap = new Map(sources.yahoo.data.quotes.map((item) => [item.symbol, item]));
  const flows = normalizeSectors(sources.finviz.data);
  const movers = normalizeMovers(sources.benzinga.data.movers, quoteMap);
  const stars = normalizeStars(sources.tradingView.data, quoteMap);
  const retail = sources.reddit.data;
  const options = sources.unusualWhales.data;
  const risk = calculateRisk(sources.yahoo.data.indices, sources.sentiment, retail);
  const [strategy, strategyContext] = strategyFrom(risk, flows, retail, options);
  const strategyBasis = statusGroup([sources.finviz, sources.unusualWhales, sources.benzinga]);
  const sourceBasis = statusGroup(Object.values(sources).filter((source) => source?.status));

  return {
    asOf: `数据生成 ${sourceBasis.fullTimestamp || sourceBasis.timestamp} · 页面刷新 ${formatDateTime(Date.now())}`,
    sourceMode: sourceModeLabel(sources),
    sourceStatus: Object.entries(sources)
      .filter(([key]) => key !== "sentiment")
      .map(([key, value]) => ({
        key,
        label: value.label,
        status: value.status,
        timestamp: value.timestamp || "备用快照"
      })),
    moduleStatus: {
      risk: statusGroup([sources.yahoo]),
      index: statusGroup([sources.yahoo]),
      sentiment: { status: "fallback", timestamp: FALLBACK_SNAPSHOT_LABEL },
      flow: statusGroup([sources.finviz]),
      mover: statusGroup([sources.benzinga]),
      star: statusGroup([sources.tradingView]),
      news: statusGroup([sources.benzinga]),
      macro: statusGroup([sources.xMacro]),
      retail: statusGroup([sources.reddit]),
      options: statusGroup([sources.unusualWhales]),
      source: sourceBasis
    },
    indices: sources.yahoo.data.indices,
    sentiment: sources.sentiment,
    macro: sources.xMacro.data,
    retail,
    options,
    flows,
    movers,
    stars,
    news: normalizeNews(sources.benzinga.data.news),
    risk,
    marketSummary: marketSummary(sources.yahoo.data.indices),
    strategy,
    strategyContext: `${dataBasisLabel(strategyBasis)}。${strategyContext}`,
    tape: tapeRead(movers, flows)
  };
}

function sourceModeLabel(sources) {
  const statuses = Object.values(sources).map((source) => source?.status).filter(Boolean);
  if (statuses.some((status) => status === "live")) return "Live + stored intelligence";
  if (statuses.some((status) => status === "cached")) return "Last successful intelligence";
  return "Fallback snapshot intelligence";
}

function dataBasisLabel(item) {
  if (item.status === "live") return `资金流基于 LIVE 数据 ${item.timestamp}`;
  if (item.status === "cached") return `资金流基于最后成功数据 ${item.timestamp}`;
  return `资金流基于${FALLBACK_SNAPSHOT_LABEL}`;
}

function formatClock(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "medium",
    hour12: false
  }).format(new Date(value));
}

function statusGroup(sourceItems) {
  const liveItems = sourceItems.filter((source) => source?.status === "live" && source.updatedAt);
  const cachedItems = sourceItems.filter((source) => source?.status === "cached" && source.updatedAt);
  const latestLiveAt = liveItems.length ? Math.max(...liveItems.map((source) => source.updatedAt)) : null;
  const latestCachedAt = cachedItems.length ? Math.max(...cachedItems.map((source) => source.updatedAt)) : null;
  if (latestLiveAt) {
    return {
      status: "live",
      timestamp: formatClock(latestLiveAt),
      fullTimestamp: formatDateTime(latestLiveAt)
    };
  }
  if (latestCachedAt) {
    return {
      status: "cached",
      timestamp: formatDateTime(latestCachedAt),
      fullTimestamp: formatDateTime(latestCachedAt)
    };
  }
  return {
    status: "fallback",
    timestamp: FALLBACK_SNAPSHOT_LABEL
  };
}

function normalizeSectors(items) {
  return items
    .map((item) => ({
      sector: item.sector || item.name,
      score: clamp(Math.round(item.score ?? 50 + (item.change || 0) * 15)),
      change: item.change ?? 0,
      summary: item.summary || item.note || "板块热度来自 Finviz Heatmap。"
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function normalizeMovers(items, quoteMap) {
  return items
    .map((item) => {
      const live = quoteMap.get(item.symbol);
      const [name, sectorName] = symbolMeta[item.symbol] || [item.name || item.symbol, item.sector || "其他"];
      const change = live?.preMarketChange ?? item.change ?? 0;
      return {
        symbol: item.symbol,
        name: item.name || name,
        sector: item.sector || sectorName,
        change,
        reason: item.reason || item.summary || "Benzinga 异动新闻待确认。",
        bias: item.bias || (change >= 0 ? "利好" : "利空"),
        durability: durability(live, change)
      };
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 10);
}

function normalizeStars(items, quoteMap) {
  return items
    .map((item) => {
      const live = quoteMap.get(item.symbol);
      const [name, sectorName] = symbolMeta[item.symbol] || [item.name || item.symbol, item.sector || "其他"];
      const heat = clamp(Math.round((item.score || 55) + (live?.preMarketChange || 0) * 3 + (live?.volumeRatio || 1) * 4));
      return {
        symbol: item.symbol,
        name: item.name || name,
        sector: item.sector || sectorName,
        heat,
        logic: item.logic || "TradingView 趋势强度与 Yahoo 盘前动量共振。",
        persistence: heat >= 84 ? "高" : heat >= 70 ? "中高" : "中性"
      };
    })
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 6);
}

function normalizeNews(items) {
  return items.map((item, index) => ({
    category: item.category || "新闻",
    title: item.title,
    summary: item.summary || item.reason,
    bias: item.bias || "中性",
    time: item.time || item.publishedAt || `0${7 - Math.min(index, 5)}:${(50 - index * 7).toString().padStart(2, "0")}`
  }));
}

function marketSummary(indices) {
  const byId = Object.fromEntries(indices.map((item) => [item.id, item]));
  const techLead = (byId.QQQ?.change || 0) > (byId.SPY?.change || 0);
  const ratesPressure = (byId.TNX?.change || 0) > 0.5;
  const volRelief = (byId.VIX?.change || 0) < 0;
  if (techLead && volRelief && !ratesPressure) return "QQQ 强于 SPY 且 VIX 回落，科技风险偏好占优。";
  if (techLead && ratesPressure) return "科技强于大盘，但美债收益率上行限制追高空间。";
  if (!volRelief) return "波动率抬升压制风险资产，开盘优先观察防御需求。";
  return "宽基指数温和修复，风险偏好中性偏多。";
}

function durability(live, change) {
  const volumeRatio = live?.volumeRatio || 1;
  if (Math.abs(change) >= 4 && volumeRatio >= 1.8) return "持续性高，量价确认。";
  if (Math.abs(change) >= 2 && volumeRatio >= 1.2) return "持续性中高，开盘承接关键。";
  if (Math.abs(change) >= 3) return "弹性强，需成交量确认。";
  return "偏事件交易，持续性待验证。";
}

function calculateRisk(indices, sentiment, retail) {
  const byId = Object.fromEntries(indices.map((item) => [item.id, item]));
  const fearGreed = sentiment.find((item) => item.id === "Fear & Greed")?.value || 50;
  let score = 50;

  score += (byId.SPX?.change || 0) * 5.5;
  score += (byId.SPY?.change || 0) * 5.5;
  score += (byId.QQQ?.change || 0) * 7.5;
  score += (byId.NDX?.change || 0) * 8.5;
  score -= (byId.VIX?.change || 0) * 3.2;
  score -= Math.max(0, byId.TNX?.change || 0) * 2.4;
  score -= Math.max(0, byId.DXY?.change || 0) * 1.3;
  score += (fearGreed - 50) * 0.3;
  score += ((retail.score || 50) - 50) * 0.15;

  const bounded = clamp(Math.round(score));
  return {
    score: bounded,
    mode: bounded >= 56 ? "Risk-On" : bounded <= 44 ? "Risk-Off" : "Neutral",
    conclusion:
      bounded >= 56
        ? "纳指强于大盘、VIX 回落，盘前风险偏好处于进攻区。"
        : bounded <= 44
          ? "波动率与利率压力抬升，市场进入防御交易。"
          : "风险信号分化，等待开盘后资金方向确认。",
    inputs: [
      ["VIX", signed(byId.VIX?.change || 0)],
      ["Fear & Greed", fearGreed],
      ["TNX", signed(byId.TNX?.change || 0)],
      ["QQQ", signed(byId.QQQ?.change || byId.NDX?.change || 0)]
    ]
  };
}

function sentimentVerdict(sentiment, retail) {
  const fng = sentiment.find((item) => item.id === "Fear & Greed")?.value || 50;
  const rsi = sentiment.find((item) => item.id === "RSI")?.value || 50;
  const pc = sentiment.find((item) => item.id === "Put/Call")?.value || 1;
  if (fng >= 75 || rsi >= 70 || pc <= 0.65 || retail.score >= 78) return ["不宜追高", "情绪接近过热，等待回踩确认。"];
  if (fng <= 30 || pc >= 1.2 || retail.score <= 35) return ["恐慌可观察", "保护性需求高，等卖压衰竭。"];
  return ["可进攻但控仓", "乐观未极端，适合顺势不适合重仓追价。"];
}

function strategyFrom(risk, flows, retail, options) {
  const leader = flows[0]?.sector || "科技";
  const callBias = options.filter((item) => String(item.type).toLowerCase().includes("call")).length;
  if (risk.mode === "Risk-On" && callBias >= 2) {
    return [`科技风险偏好增强，${leader}继续主导市场，谨慎追高，回踩优先。`, "热钱与期权资金同向时顺势，非主线只做低吸。"];
  }
  if (risk.mode === "Risk-Off") {
    return ["风险偏好转弱，降低高 beta 暴露，等待 VIX 回落与纳指转强。", "防御、现金与事件驱动优先于追涨交易。"];
  }
  if (retail.score >= 72) {
    return ["散户情绪升温但主线分化，保留仓位弹性，避免开盘无量追价。", "只交易高热度、高成交确认的龙头股。"];
  }
  return ["市场处于确认区，等待开盘 30 分钟量价方向后再加仓。", "仓位节奏比方向判断更重要。"];
}

function tapeRead(movers, flows) {
  const leader = flows[0];
  const positive = movers.filter((item) => item.change > 0).length;
  if (leader?.score >= 78 && positive >= 4) {
    return { title: `${leader.sector}主导风险偏好`, reason: "异动与热钱方向一致，盘前主线清晰。" };
  }
  if (positive <= 2) return { title: "资金偏防御", reason: "异动扩散不足，追涨胜率下降。" };
  return { title: "结构性机会", reason: "热钱集中在少数板块，避免无差别追高。" };
}

function render(dashboard) {
  const [chaseVerdict, chaseReason] = sentimentVerdict(dashboard.sentiment, dashboard.retail);

  document.body.dataset.risk = dashboard.risk.mode.toLowerCase();
  text("#riskMode", dashboard.risk.mode);
  text("#riskScore", dashboard.risk.score);
  text("#riskConclusion", dashboard.risk.conclusion);
  text("#strategyText", dashboard.strategy);
  text("#strategyContext", dashboard.strategyContext);
  text("#chaseVerdict", chaseVerdict);
  text("#chaseReason", chaseReason);
  text("#asOf", dashboard.asOf);
  text("#dataStatus", dashboard.sourceMode);
  text("#tapeRead", dashboard.tape.title);
  text("#tapeReason", dashboard.tape.reason);
  text("#starSummary", dashboard.tape.title);
  text("#marketSummary", dashboard.marketSummary);
  document.querySelector("#gaugeFill").style.width = `${dashboard.risk.score}%`;
  document.querySelector("#statusDot").style.color = dashboard.sourceMode.startsWith("Live") ? "var(--green)" : "var(--gold)";
  document.querySelector("#statusDot").style.background = dashboard.sourceMode.startsWith("Live") ? "var(--green)" : "var(--gold)";

  renderModuleStatus(dashboard.moduleStatus);
  renderSources(dashboard.sourceStatus);
  renderRiskInputs(dashboard.risk);
  renderMetricGrid("#indexGrid", dashboard.indices);
  renderMacro(dashboard.macro);
  renderRetail(dashboard.retail);
  renderOptions(dashboard.options);
  renderMetricGrid("#sentimentGrid", dashboard.sentiment, "sentiment");
  renderMoverTable(dashboard.movers);
  renderFlows(dashboard.flows);
  renderStars(dashboard.stars);
  renderNews(dashboard.news);
  setLoading(false);
}

function renderModuleStatus(statusMap) {
  const mapping = {
    risk: ["#riskModuleMeta"],
    index: ["#indexModuleMeta"],
    sentiment: ["#sentimentModuleMeta"],
    flow: ["#flowModuleMeta"],
    mover: ["#moverModuleMeta"],
    star: ["#starModuleMeta"],
    news: ["#newsModuleMeta"],
    macro: ["#macroModuleMeta"],
    retail: ["#retailModuleMeta"],
    options: ["#optionsModuleMeta"],
    source: ["#sourceModuleMeta"]
  };

  for (const [key, selectors] of Object.entries(mapping)) {
    const item = statusMap[key] || { status: "fallback", timestamp: "--" };
    selectors.forEach((selector) => {
      const node = document.querySelector(selector);
      if (!node) return;
      node.classList.toggle("module-live", item.status === "live");
      node.classList.toggle("module-cached", item.status === "cached");
      node.classList.toggle("module-fallback", item.status === "fallback");
      node.textContent = `${statusLabel(item.status)} · ${item.timestamp}`;
    });
  }
}

function statusLabel(status) {
  return status === "live" ? "LIVE" : status === "cached" ? "LAST" : "FALLBACK";
}

function renderSources(items) {
  html("#sourceGrid", items.map((item) => `
    <article class="source-card">
      <span class="source-state ${item.status}">${statusLabel(item.status)}</span>
      <strong>${escapeHtml(item.label)}</strong>
      <p>${sourceRole(item.key)} · ${escapeHtml(item.timestamp)}</p>
    </article>
  `).join(""));
}

function sourceRole(key) {
  return {
    yahoo: "指数、价格、盘前涨跌基础数据。",
    tradingView: "趋势筛选与强势股池。",
    xMacro: "宏观快讯，不参与个股新闻。",
    reddit: "散户情绪，只读取 WSB。",
    finviz: "热钱板块：Finviz 适配器或 Yahoo 板块代理。",
    unusualWhales: "期权资金流：真实适配器或动量代理。",
    benzinga: "异动新闻：Benzinga 适配器或 Yahoo 新闻代理。"
  }[key];
}

function renderMetricGrid(selector, items, type = "index") {
  html(selector, items.map((item) => {
    const inverse = ["VIX", "TNX", "GOLD", "DXY", "Put/Call"].includes(item.id);
    return `
      <article class="metric-card">
        <div class="metric-head"><span>${escapeHtml(item.id)}</span><span>${escapeHtml(item.name || "")}</span></div>
        <div class="metric-value">${formatNumber(item.value)}</div>
        <div class="metric-change ${changeClass(item.change, inverse)}">${type === "sentiment" && item.id !== "Put/Call" ? signedRaw(item.change) : signed(item.change)}</div>
        <p>${escapeHtml(item.note)}</p>
      </article>
    `;
  }).join(""));
}

function renderRiskInputs(risk) {
  html("#riskInputs", risk.inputs.map(([label, value]) => `
    <div class="factor-pill"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
  `).join(""));
}

function renderMacro(items) {
  html("#macroFeed", items.map((item) => `
    <div class="feed-item">
      <div class="row-head"><span>${escapeHtml(item.source)}</span><span class="${toneClass(item.tone)}">${escapeHtml(item.tone || "neutral")}</span></div>
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.summary)}</p>
    </div>
  `).join(""));
}

function renderRetail(retail) {
  const score = clamp(retail.score || 50);
  const angle = -90 + score * 1.8;
  const fearLabel = score >= 72 ? "贪婪" : score <= 35 ? "恐慌" : score >= 56 ? "偏乐观" : "中性";
  html("#retailPanel", `
    <div class="sentiment-gauge-card">
      <div class="dial" style="--needle:${angle}deg">
        <div class="dial-arc"></div>
        <div class="dial-needle"></div>
        <div class="dial-hub"></div>
        <div class="dial-score">${score}</div>
        <div class="dial-label">${escapeHtml(fearLabel)}</div>
      </div>
      <div class="dial-copy">
        <strong>${escapeHtml(retail.tone)}</strong>
        <p>${escapeHtml(retail.summary)}</p>
        <div class="dial-scale">
          <span>Fear</span>
          <span>Neutral</span>
          <span>Greed</span>
        </div>
      </div>
    </div>
    <div class="mention-grid">
      ${retail.mentions.map(([symbol, count]) => `<span>${escapeHtml(symbol)} <b>${count}</b></span>`).join("")}
    </div>
  `);
}

function renderOptions(items) {
  html("#optionsFlow", items.map((item) => `
    <div class="feed-item">
      <div class="row-head"><span>${escapeHtml(item.symbol)}</span><span>${escapeHtml(item.type)}</span></div>
      <strong>$${Number(item.premium).toFixed(1)}M premium</strong>
      <p>${escapeHtml(item.summary)}</p>
    </div>
  `).join(""));
}

function renderMoverTable(items) {
  html("#moverTable", `
    <div class="table-row table-head"><span>股票</span><span>涨跌幅</span><span>板块</span><span>Benzinga 异动原因</span></div>
    ${items.map((item) => `
      <div class="table-row">
        <div><div class="symbol">${escapeHtml(item.symbol)}</div><div class="subtle">${escapeHtml(item.name)}</div></div>
        <strong class="${item.change >= 0 ? "up" : "down"}">${signed(item.change)}</strong>
        <span class="tag">${escapeHtml(item.sector)}</span>
        <div><div>${escapeHtml(item.reason)}</div><div class="subtle">${escapeHtml(item.bias)} / ${escapeHtml(item.durability)}</div></div>
      </div>
    `).join("")}
  `);
}

function renderFlows(items) {
  html("#flowGrid", items.map((item, index) => `
    <article class="flow-card" title="${escapeHtml(item.summary)}">
      <div class="flow-rank"><span class="rank-num">#${index + 1}</span><span class="heat-score ${item.score >= 70 ? "up" : item.score <= 45 ? "down" : "flat"}">${item.score}</span></div>
      <h3>${escapeHtml(item.sector)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      <div class="subtle">Finviz heatmap ${signed(item.change)}</div>
      <div class="flow-bar"><span style="width:${item.score}%"></span></div>
    </article>
  `).join(""));
}

function renderStars(items) {
  html("#starGrid", items.map((item) => `
    <article class="star-card">
      <div class="star-head"><span>${escapeHtml(item.sector)}</span><span class="heat-score ${item.heat >= 72 ? "up" : "flat"}">${item.heat}</span></div>
      <h3>${escapeHtml(item.symbol)} <small>${escapeHtml(item.name)}</small></h3>
      <p>${escapeHtml(item.logic)}</p>
      <div class="tag">持续性：${escapeHtml(item.persistence)}</div>
      <div class="heat-bar"><span style="width:${item.heat}%"></span></div>
    </article>
  `).join(""));
}

function renderNews(items) {
  html("#newsGrid", items.map((item) => `
    <article class="news-card ${item.bias === "利空" ? "bearish-card" : item.bias === "利好" ? "bullish-card" : ""}">
      <details>
        <summary>
          <span class="news-head"><span class="tag">${escapeHtml(item.category)}</span><span class="${item.bias === "利空" ? "down" : item.bias === "利好" ? "up" : "flat"}">${escapeHtml(item.bias)} · ${escapeHtml(item.time)}</span></span>
          <strong>${escapeHtml(item.title)}</strong>
        </summary>
        <p>${escapeHtml(item.summary)}</p>
      </details>
    </article>
  `).join(""));
}

function startCountdown() {
  let next = REFRESH_SECONDS;
  setInterval(() => {
    text("#refreshTimer", `Auto refresh ${next}s`);
    next -= 1;
    if (next < 0) next = REFRESH_SECONDS;
  }, 1000);
}

async function refresh() {
  setLoading(true);
  await refreshSequentially();
}

function setLoading(isLoading) {
  document.querySelectorAll(".loading-zone").forEach((node) => {
    node.classList.toggle("is-loading", isLoading);
  });
}

function text(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function html(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.innerHTML = value;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: Math.abs(value) >= 100 ? 2 : 3 });
}

function signed(value) {
  return `${value > 0 ? "+" : ""}${Number(value || 0).toFixed(2)}%`;
}

function signedRaw(value) {
  return `${value > 0 ? "+" : ""}${Number(value || 0).toFixed(1)}`;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function changeClass(value, inverse = false) {
  const adjusted = inverse ? -value : value;
  if (adjusted > 0.05) return "up";
  if (adjusted < -0.05) return "down";
  return "flat";
}

function toneClass(tone) {
  if (tone === "bullish") return "up";
  if (tone === "bearish") return "down";
  return "flat";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

refresh();
startCountdown();
setInterval(refresh, REFRESH_SECONDS * 1000);
