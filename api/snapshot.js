import { cleanSymbols, fetchJson, noStoreJson } from "./_utils.js";

const sourceCatalog = {
  yahoo: "Yahoo Finance",
  tradingView: "TradingView Screener",
  xMacro: "Macro Feed",
  reddit: "WallStreetBets Reddit",
  finviz: "Yahoo Sector Proxy",
  unusualWhales: "Options Flow Proxy",
  benzinga: "Yahoo News / Movers Proxy"
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
  CRWD: ["CrowdStrike", "网络安全"],
  PANW: ["Palo Alto", "网络安全"],
  COIN: ["Coinbase", "加密资产"],
  MSTR: ["MicroStrategy", "加密资产"],
  XOM: ["Exxon Mobil", "能源"],
  CVX: ["Chevron", "能源"],
  JPM: ["JPMorgan", "金融"],
  LLY: ["Eli Lilly", "医疗"],
  DASH: ["DoorDash", "消费科技"],
  CSCO: ["Cisco", "AI 网络"]
};

const fallbackIndices = [
  metric("SPY", "S&P 500 ETF", 0, 0, "等待 Yahoo Finance 实时行情。"),
  metric("QQQ", "Nasdaq ETF", 0, 0, "等待 Yahoo Finance 实时行情。"),
  metric("NDX", "Nasdaq 100", 0, 0, "等待 Yahoo Finance 实时行情。"),
  metric("VIX", "Volatility", 0, 0, "等待 Yahoo Finance 实时行情。"),
  metric("TNX", "10Y Yield", 0, 0, "等待 Yahoo Finance 实时行情。"),
  metric("DXY", "Dollar Index", 0, 0, "等待 Yahoo Finance 实时行情。"),
  metric("GOLD", "Gold", 0, 0, "等待 Yahoo Finance 实时行情。")
];

const tvSymbols = [
  "NASDAQ:NVDA",
  "NASDAQ:AMD",
  "NASDAQ:AVGO",
  "NASDAQ:MRVL",
  "NASDAQ:MSFT",
  "NASDAQ:AMZN",
  "NASDAQ:META",
  "NASDAQ:TSLA",
  "NASDAQ:PLTR",
  "NYSE:ORCL",
  "NASDAQ:CRWD",
  "NASDAQ:COIN",
  "NASDAQ:MSTR",
  "NASDAQ:DASH",
  "NASDAQ:CSCO"
];

const stooqSymbol = (symbol) => {
  const clean = symbol.replaceAll("%5E", "^").replaceAll("%3D", "=").toUpperCase();
  if (clean.startsWith("^") || clean.includes("=") || clean.includes(".")) return null;
  return `${clean.toLowerCase()}.us`;
};

let lastGoodSources = {};
let lastGoodSnapshot = null;

function metric(id, name, value, change, note) {
  return { id, name, value, change, note };
}

function quote(symbol, price, preMarketChange, volumeRatio = 1, extra = {}) {
  const [name, sector] = symbolMeta[symbol] || [symbol, "其他"];
  return { symbol, name, sector, price, preMarketChange, volumeRatio, ...extra };
}

function nowIso(value) {
  return new Date(value).toISOString();
}

function liveSource(key, data, generatedAt, label = sourceCatalog[key], status = "live") {
  return { data, status, label, updatedAt: generatedAt, timestamp: nowIso(generatedAt) };
}

function cachedSource(key, cached) {
  return { ...cached, status: "cached", timestamp: cached.timestamp || nowIso(cached.updatedAt || Date.now()) };
}

function fallbackSource(key, data = null) {
  return { data, status: "fallback", label: sourceCatalog[key], updatedAt: null, timestamp: "fallback only" };
}

function keepLastGood(key, source) {
  if (["live", "proxy"].includes(source.status) && source.data) lastGoodSources[key] = source;
  return source;
}

function lastOrFallback(key, fallbackData = null) {
  return lastGoodSources[key] ? cachedSource(key, lastGoodSources[key]) : fallbackSource(key, fallbackData);
}

async function settleSource(key, loader, generatedAt, fallbackData = null, label) {
  try {
    return keepLastGood(key, liveSource(key, await loader(), generatedAt, label));
  } catch (error) {
    if (lastGoodSources[key]) return cachedSource(key, lastGoodSources[key]);
    return fallbackSource(key, fallbackData);
  }
}

async function loadYahoo(symbols) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols).replaceAll("%2C", ",")}`;
  let payload;
  try {
    payload = await fetchJson(url, { timeoutMs: 10000 });
  } catch {
    return loadStooq(symbols);
  }
  const rows = payload.quoteResponse?.result || [];
  if (!rows.length) throw new Error("Yahoo empty quote response");
  const bySymbol = new Map(rows.map((row) => [row.symbol, row]));

  const mapIndex = (fallbackMetric, symbol) => {
    const row = bySymbol.get(symbol);
    if (!row?.regularMarketPrice) return fallbackMetric;
    return {
      ...fallbackMetric,
      value: row.regularMarketPrice,
      change: row.regularMarketChangePercent ?? fallbackMetric.change,
      note: "Yahoo Finance 实时行情。"
    };
  };

  const indices = [
    mapIndex(fallbackIndices[0], "SPY"),
    mapIndex(fallbackIndices[1], "QQQ"),
    mapIndex(fallbackIndices[2], "^NDX"),
    mapIndex(fallbackIndices[3], "^VIX"),
    mapIndex(fallbackIndices[4], "^TNX"),
    mapIndex(fallbackIndices[5], "DX-Y.NYB"),
    mapIndex(fallbackIndices[6], "GC=F")
  ];

  const quotes = Object.keys(symbolMeta).map((symbol) => {
    const row = bySymbol.get(symbol);
    return quote(
      symbol,
      row?.preMarketPrice ?? row?.regularMarketPrice ?? 0,
      row?.preMarketChangePercent ?? row?.regularMarketChangePercent ?? 0,
      row?.regularMarketVolume && row?.averageDailyVolume3Month
        ? row.regularMarketVolume / row.averageDailyVolume3Month
        : 1,
      {
        regularMarketChangePercent: row?.regularMarketChangePercent ?? 0,
        preMarketChangePercent: row?.preMarketChangePercent ?? row?.regularMarketChangePercent ?? 0,
        volume: row?.regularMarketVolume ?? 0,
        averageVolume: row?.averageDailyVolume3Month ?? 0
      }
    );
  }).filter((item) => item.price > 0);

  return { indices, quotes };
}

async function loadStooq(symbols) {
  const requested = symbols.split(",").map((symbol) => decodeURIComponent(symbol).trim()).filter(Boolean);
  const mapped = requested.map((symbol) => [symbol, stooqSymbol(symbol)]).filter(([, stooq]) => stooq);
  if (!mapped.length) throw new Error("Stooq symbols empty");
  const stooqToOriginal = new Map(mapped.map(([original, stooq]) => [stooq.toUpperCase(), original.toUpperCase()]));
  const url = `https://stooq.com/q/l/?s=${mapped.map(([, stooq]) => stooq).join("+")}&f=sd2t2ohlcvp&h&e=csv`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AI-Equity-Dashboard/1.0)" }
  });
  if (!response.ok) throw new Error(`Stooq upstream ${response.status}`);
  const text = await response.text();
  const rows = text.trim().split(/\r?\n/).slice(1).flatMap((line) => {
    const [symbol, date, time, open, high, low, close, volume, prev] = line.split(",");
    const price = Number(close);
    const previous = Number(prev);
    if (!Number.isFinite(price) || !Number.isFinite(previous) || price <= 0 || previous <= 0) return [];
    return [{
      symbol: stooqToOriginal.get(symbol.toUpperCase()) || symbol.replace(".US", ""),
      regularMarketPrice: price,
      regularMarketChangePercent: ((price - previous) / previous) * 100,
      regularMarketVolume: Number(volume) || undefined,
      averageDailyVolume3Month: Number(volume) || undefined,
      regularMarketTime: Date.parse(`${date}T${time}Z`) || Date.now(),
      shortName: symbol
    }];
  });

  if (!rows.length) throw new Error("Stooq fallback empty");
  const bySymbol = new Map(rows.map((row) => [row.symbol, row]));
  const indices = [
    mapStooqIndex(fallbackIndices[0], bySymbol.get("SPY")),
    mapStooqIndex(fallbackIndices[1], bySymbol.get("QQQ")),
    fallbackIndices[2],
    fallbackIndices[3],
    fallbackIndices[4],
    fallbackIndices[5],
    fallbackIndices[6]
  ];
  const quotes = Object.keys(symbolMeta).map((symbol) => {
    const row = bySymbol.get(symbol);
    return quote(
      symbol,
      row?.regularMarketPrice ?? 0,
      row?.regularMarketChangePercent ?? 0,
      row?.regularMarketVolume && row?.averageDailyVolume3Month
        ? row.regularMarketVolume / row.averageDailyVolume3Month
        : 1,
      {
        regularMarketChangePercent: row?.regularMarketChangePercent ?? 0,
        preMarketChangePercent: row?.regularMarketChangePercent ?? 0,
        volume: row?.regularMarketVolume ?? 0,
        averageVolume: row?.averageDailyVolume3Month ?? 0
      }
    );
  }).filter((item) => item.price > 0);

  return { indices, quotes };
}

function mapStooqIndex(fallbackMetric, row) {
  if (!row?.regularMarketPrice) return fallbackMetric;
  return {
    ...fallbackMetric,
    value: row.regularMarketPrice,
    change: row.regularMarketChangePercent ?? fallbackMetric.change,
    note: "Stooq 备用行情。"
  };
}

async function loadTradingView() {
  const payload = await fetchJson("https://scanner.tradingview.com/america/scan", {
    timeoutMs: 10000,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbols: { tickers: tvSymbols, query: { types: [] } },
      columns: ["name", "close", "change", "volume", "Recommend.All", "RSI"],
      range: [0, 50]
    })
  });

  const rows = (payload.data || []).map((row) => {
    const [symbol, _close, change, volume, recommendation, rsi] = row.d || [];
    const [, sector] = symbolMeta[symbol] || [symbol, "强势股"];
    const score = Math.max(0, Math.min(100, Math.round(55 + (change || 0) * 4 + (recommendation || 0) * 18 + ((rsi || 50) - 50) * 0.35)));
    return {
      symbol,
      score,
      sector,
      change: change || 0,
      volume: volume || 0,
      rsi: rsi || 50,
      recommendation: recommendation || 0,
      logic: `TradingView 动量 ${Number(change || 0).toFixed(2)}%，RSI ${Number(rsi || 0).toFixed(1)}，量能 ${Number(volume || 0).toLocaleString("en-US")}。`
    };
  }).filter((item) => item.symbol);

  if (!rows.length) throw new Error("TradingView empty scan");
  return rows.sort((a, b) => b.score - a.score).slice(0, 8);
}

async function loadReddit() {
  const payload = await fetchJson("https://www.reddit.com/r/wallstreetbets/hot.json?limit=50", {
    timeoutMs: 10000,
    headers: { "User-Agent": "AIEquityDashboard/1.0 by dashboard" }
  });
  const posts = payload.data?.children?.map((item) => item.data) || [];
  if (!posts.length) throw new Error("Reddit empty feed");
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

  const score = Math.max(0, Math.min(100, Math.round(toneScore)));
  return {
    score,
    tone: score >= 62 ? "偏乐观" : score <= 42 ? "偏谨慎" : "中性",
    mentions: Object.entries(tickers).sort((a, b) => b[1] - a[1]).slice(0, 5),
    summary: score >= 62 ? "WSB 风险偏好回升，AI 与高 beta 讨论更活跃。" : "WSB 情绪未形成一致追涨，短线更偏观望。"
  };
}

async function loadYahooNews() {
  const rss = await fetchText("https://feeds.finance.yahoo.com/rss/2.0/headline?s=SPY,QQQ,NVDA,AMD,MSFT,TSLA,PLTR&region=US&lang=en-US");
  const items = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8).map((match, index) => {
    const block = match[1];
    const title = stripXml(block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/)?.[1] || block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "Market headline");
    const description = stripXml(block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/)?.[1] || "");
    return {
      category: classifyNews(title),
      title,
      summary: description || "Yahoo Finance 最新市场新闻。",
      bias: classifyBias(title),
      time: new Date(Date.now() - index * 8 * 60 * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
    };
  });
  if (!items.length) throw new Error("Yahoo news empty");
  return items;
}

async function fetchText(url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AI-Equity-Dashboard/1.0)", Accept: "application/rss+xml,text/xml,text/plain,*/*" }
  });
  if (!response.ok) throw new Error(`upstream ${response.status}`);
  return response.text();
}

function stripXml(value) {
  return String(value).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").trim();
}

function classifyNews(title) {
  const lower = title.toLowerCase();
  if (lower.includes("earnings") || lower.includes("revenue")) return "财报";
  if (lower.includes("upgrade") || lower.includes("price target")) return "评级";
  if (lower.includes("ai") || lower.includes("chip") || lower.includes("nvidia")) return "AI";
  if (lower.includes("fed") || lower.includes("yield") || lower.includes("inflation")) return "宏观";
  return "新闻";
}

function classifyBias(title) {
  const lower = title.toLowerCase();
  if (/(beat|raise|upgrade|partnership|contract|\bai\b|launch|demand|growth|guidance raise|buy rating|surge|jump|record|rally|bull)/.test(lower)) return "利好";
  if (/(miss|cut|downgrade|lawsuit|investigation|war|tariff|delay|weak demand|warning|loss|fall|drop|probe|bear)/.test(lower)) return "利空";
  return "中性";
}

function deriveSectors(quotes) {
  const grouped = new Map();
  for (const item of quotes || []) {
    if (!grouped.has(item.sector)) grouped.set(item.sector, []);
    grouped.get(item.sector).push(item);
  }
  return [...grouped.entries()].map(([sector, items]) => {
    const change = items.reduce((sum, item) => sum + (item.preMarketChange || 0), 0) / Math.max(1, items.length);
    const leaders = items.sort((a, b) => b.preMarketChange - a.preMarketChange).slice(0, 3).map((item) => item.symbol).join(" / ");
    return {
      sector,
      score: Math.max(0, Math.min(100, Math.round(50 + change * 10))),
      change,
      summary: `${leaders} 领涨，板块强弱由 Yahoo 实时行情聚合。`
    };
  }).sort((a, b) => b.score - a.score).slice(0, 6);
}

function deriveMovers(quotes, news = []) {
  const newsTitles = news.map((item) => item.title).join(" / ");
  return [...(quotes || [])].sort((a, b) => Math.abs(b.preMarketChange) - Math.abs(a.preMarketChange)).slice(0, 10).map((item) => ({
    symbol: item.symbol,
    name: item.name,
    sector: item.sector,
    change: item.preMarketChange,
    reason: `${item.symbol} 价格异动 ${Number(item.preMarketChange || 0).toFixed(2)}%，${newsTitles.includes(item.symbol) ? "相关新闻出现催化。" : "等待新闻催化确认。"}`,
    bias: item.preMarketChange >= 0 ? "利好" : "利空"
  }));
}

function deriveOptionsProxy(quotes, context = {}) {
  return [...(quotes || [])]
    .map((stock) => calculateOptionsProxyScore(stock, context))
    .filter((item) => item.direction !== "IGNORE" || item.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function calculateOptionsProxyScore(stock, context = {}) {
  const sectorMap = new Map((context.sectors || []).map((item) => [item.sector, item]));
  const tvMap = new Map((context.tradingView || []).map((item) => [item.symbol, item]));
  const mentionMap = new Map(context.reddit?.mentions || []);
  const newsText = (context.news || []).map((item) => `${item.title || ""} ${item.summary || ""}`).join(" ").toLowerCase();
  const stockNews = newsText.includes(stock.symbol.toLowerCase()) ? newsText : "";
  const sector = stock.sector || "其他";
  const sectorHeat = sectorMap.get(sector)?.score ?? sectorThemeScore(sector);
  const tv = tvMap.get(stock.symbol);
  const preChange = Number(stock.preMarketChangePercent ?? stock.preMarketChange ?? 0);
  const dayChange = Number(stock.regularMarketChangePercent ?? tv?.change ?? preChange);
  const volumeRatio = Number(stock.volumeRatio || (stock.volume && stock.averageVolume ? stock.volume / stock.averageVolume : 1));
  const mentions = Number(mentionMap.get(stock.symbol) || 0);

  const momentumRaw = preChange >= 0
    ? Math.max(preChange / 4, dayChange / 3)
    : Math.max(Math.abs(preChange) / 3.5, Math.abs(dayChange) / 3);
  const momentumScore = clamp01(momentumRaw) * 25;
  const volumeScore = clamp01((volumeRatio - 0.8) / 2.2) * 20;
  const sectorScore = clamp01(sectorHeat / 100) * 20;
  const catalystScore = newsCatalystScore(stockNews || newsText, stock.symbol) * 20;
  const retailScore = clamp01(mentions / 18) * 15;
  const total = Math.round(Math.min(100, momentumScore + volumeScore + sectorScore + catalystScore + retailScore));
  const bearish = preChange < -0.75 || dayChange < -1.2 || newsBearish(stockNews);
  const bullish = preChange > 0.5 || dayChange > 0.8;
  const direction = classifyOptionsProxyDirection(total, bullish, bearish, sectorHeat);
  const risk = proxyRiskLabel(total, mentions, preChange, direction);

  return {
    symbol: stock.symbol,
    name: stock.name,
    sector,
    score: total,
    direction,
    type: direction,
    summary: proxySummary(stock, direction, sectorHeat, volumeRatio, mentions),
    risk,
    components: {
      priceMomentum: Math.round(momentumScore),
      volumeExpansion: Math.round(volumeScore),
      sectorHeat: Math.round(sectorScore),
      newsCatalyst: Math.round(catalystScore),
      retailAttention: Math.round(retailScore)
    }
  };
}

function sectorThemeScore(sector) {
  if (/AI 半导体|AI 软件|AI 服务器|云计算|加密资产|大型科技|网络安全/.test(sector)) return 78;
  if (/国防|军工/.test(sector)) return 66;
  if (/能源|医疗|金融/.test(sector)) return 48;
  return 56;
}

function newsCatalystScore(text, symbol) {
  const scoped = text.includes(symbol.toLowerCase()) ? text : text.slice(0, 1200);
  const bullish = /(beat|raise|upgrade|partnership|contract|\bai\b|launch|demand|growth|guidance raise|buy rating|order|product)/i.test(scoped);
  const bearish = /(miss|cut|downgrade|lawsuit|investigation|war|tariff|delay|weak demand|warning|loss|probe)/i.test(scoped);
  if (bullish && !bearish) return 0.9;
  if (bearish && !bullish) return 0.28;
  if (bullish && bearish) return 0.55;
  return 0.45;
}

function newsBearish(text) {
  return /(miss|cut|downgrade|lawsuit|investigation|war|tariff|delay|weak demand|warning|loss|probe)/i.test(text);
}

function classifyOptionsProxyDirection(score, bullish, bearish, sectorHeat) {
  if (score >= 70 && bullish && !bearish && sectorHeat >= 55) return "CALL MOMENTUM PROXY";
  if ((score >= 62 && bearish) || (bearish && sectorHeat < 50)) return "PUT / HEDGE PROXY";
  if (score >= 50) return "WATCHLIST ONLY";
  return "IGNORE";
}

function proxyRiskLabel(score, mentions, preChange, direction) {
  if (direction === "IGNORE") return "风险：信号不足，暂不纳入交易。";
  if (mentions >= 12 && preChange >= 3) return "风险：散户拥挤且涨幅较大，避免开盘追单。";
  if (score >= 82 && preChange >= 2) return "风险：追高风险中等，等待回踩更优。";
  if (direction.includes("HEDGE")) return "风险：若开盘快速修复，空头对冲可能失效。";
  return "风险：需等待开盘量价确认。";
}

function proxySummary(stock, direction, sectorHeat, volumeRatio, mentions) {
  const sector = stock.sector || "该板块";
  if (direction === "CALL MOMENTUM PROXY") {
    return `${sector}热度较强，价格动量与量能扩张共振，短线看涨期权需求可能升温。`;
  }
  if (direction === "PUT / HEDGE PROXY") {
    return `${sector}承压或价格走弱，短线保护性对冲需求可能上升。`;
  }
  if (mentions >= 8) {
    return `散户关注度较高，但价格与板块确认不足，适合观察不适合重仓追高。`;
  }
  if (volumeRatio >= 1.5 || sectorHeat >= 65) {
    return `${sector}有一定热度，但方向信号尚未充分确认。`;
  }
  return `价格、板块与新闻催化未形成清晰共振。`;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export async function buildSnapshot(req) {
  const generatedAt = Date.now();
  const symbols = cleanSymbols(req?.query?.symbols || "SPY,QQQ,%5EGSPC,%5ENDX,%5EVIX,%5ETNX,GC%3DF,DX-Y.NYB,NVDA,AMD,AVGO,MRVL,MSFT,AMZN,META,TSLA,PLTR,ORCL,CRWD,COIN,MSTR,DASH,CSCO");
  const yahoo = await settleSource("yahoo", () => loadYahoo(symbols), generatedAt);
  const [reddit, tradingView, newsSource] = await Promise.all([
    settleSource("reddit", loadReddit, generatedAt),
    settleSource("tradingView", loadTradingView, generatedAt),
    settleSource("benzinga", loadYahooNews, generatedAt, null, "Yahoo Finance News")
  ]);

  const quotes = yahoo.data?.quotes || [];
  const news = newsSource.data || [];
  const sectorData = quotes.length ? deriveSectors(quotes) : [];
  const moverData = quotes.length ? deriveMovers(quotes, news) : [];
  const optionProxyData = quotes.length ? deriveOptionsProxy(quotes, {
    sectors: sectorData,
    tradingView: tradingView.data || [],
    reddit: reddit.data || {},
    news
  }) : [];
  const finviz = sectorData.length
    ? keepLastGood("finviz", liveSource("finviz", sectorData, generatedAt, "Yahoo Sector Proxy"))
    : lastOrFallback("finviz");
  const benzinga = moverData.length || news.length
    ? keepLastGood("benzinga", liveSource("benzinga", { movers: moverData, news }, generatedAt, newsSource.label || "Yahoo News / Movers Proxy"))
    : lastOrFallback("benzinga");
  const unusualWhales = optionProxyData.length
    ? keepLastGood("unusualWhales", liveSource("unusualWhales", optionProxyData, generatedAt, "Options Flow Proxy", "proxy"))
    : lastOrFallback("unusualWhales");

  const snapshot = {
    generatedAt,
    sources: {
      yahoo,
      reddit,
      tradingView,
      xMacro: fallbackSource("xMacro"),
      finviz,
      unusualWhales,
      benzinga
    }
  };
  lastGoodSnapshot = snapshot;
  return snapshot;
}

export default async function handler(req, res) {
  try {
    noStoreJson(res, 200, await buildSnapshot(req));
  } catch (error) {
    if (lastGoodSnapshot) {
      noStoreJson(res, 200, { ...lastGoodSnapshot, servedFrom: "last-success", error: error.message });
      return;
    }
    noStoreJson(res, 502, { error: "Snapshot unavailable", detail: error.message });
  }
}
