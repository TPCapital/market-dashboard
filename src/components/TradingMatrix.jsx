import React from "react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatPct(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "--";
  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(2)}%`;
}

function toneFromChange(value) {
  const numeric = Number(value || 0);
  if (numeric > 0.3) return "text-emerald-300";
  if (numeric < -0.3) return "text-rose-300";
  return "text-slate-300";
}

function resolveRows({ tradeDecision, snapshot }) {
  const targets = Array.isArray(tradeDecision?.targets) ? tradeDecision.targets : [];
  if (targets.length) {
    return targets.slice(0, 8).map((item) => ({
      symbol: item.symbol || item.ticker || "--",
      direction: item.direction || item.grade || "WAIT",
      score: item.score ?? item.probability ?? null,
      setup: item.entryTrigger || item.setup || item.reason || "Wait for micro confirmation.",
      change: item.change ?? item.premarketChange ?? null,
      sector: item.sector || "Execution candidate",
    }));
  }

  const momentum = snapshot?.premarket?.momentum?.leaders || snapshot?.layers?.premarketMomentum?.leaders || [];
  if (Array.isArray(momentum) && momentum.length) {
    return momentum.slice(0, 8).map((item) => ({
      symbol: item.symbol || item.ticker || "--",
      direction: item.signal || item.grade || "WATCH",
      score: item.momentumScore ?? item.score ?? null,
      setup: item.catalyst || item.reason || "Relative strength with pre-market momentum.",
      change: item.premarketPercent ?? item.change ?? null,
      sector: item.sector || item.theme || "Momentum",
    }));
  }

  const movers = snapshot?.premarket?.movers || [];
  return (Array.isArray(movers) ? movers : []).slice(0, 8).map((item) => ({
    symbol: item.symbol || "--",
    direction: item.bias || "WATCH",
    score: item.score ?? null,
    setup: item.reason || item.summary || "Price move entered the scanner.",
    change: item.change ?? item.preMarketChange ?? null,
    sector: item.sector || "Mover",
  }));
}

export default function TradingMatrix({ snapshot }) {
  const tradeDecision = snapshot?.tradeDecision || snapshot?.layers?.tradeDecision || snapshot?.sources?.tradeDecision?.data || {};
  const rows = resolveRows({ tradeDecision, snapshot });
  const headline = tradeDecision?.title || tradeDecision?.actionBias || "WAIT FOR CONFIRMATION";
  const summary = tradeDecision?.summary || "Macro is the filter; micro confirmation decides execution.";

  return (
    <section className="rounded-[1.8rem] border border-slate-800 bg-slate-950/40 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur-md">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Micro Execution Grid</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-50">Trading Matrix</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-slate-400">{summary}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-right">
          <div className="font-mono text-xs font-black uppercase tracking-[0.18em] text-slate-500">Decision</div>
          <div className="mt-1 text-sm font-black text-sky-200">{headline}</div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-[1.3rem] border border-slate-800">
        <div className="grid grid-cols-[1.05fr_.75fr_.7fr_1.7fr] gap-0 border-b border-slate-800 bg-slate-950/70 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
          <div>Symbol</div>
          <div>Bias</div>
          <div>Score</div>
          <div>Micro Trigger</div>
        </div>
        <div className="divide-y divide-slate-800/80">
          {rows.length ? rows.map((row) => (
            <div key={`${row.symbol}-${row.setup}`} className="grid grid-cols-[1.05fr_.75fr_.7fr_1.7fr] gap-0 bg-slate-950/30 px-4 py-4 transition hover:bg-slate-900/45">
              <div>
                <div className="font-mono text-lg font-black text-slate-50">{row.symbol}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{row.sector}</div>
              </div>
              <div className="flex items-center">
                <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs font-black text-slate-200">{row.direction}</span>
              </div>
              <div className="flex flex-col justify-center">
                <span className="font-mono text-sm font-black text-slate-200">{row.score ?? "--"}</span>
                {row.change !== null && <span className={cn("mt-1 font-mono text-xs font-bold", toneFromChange(row.change))}>{formatPct(row.change)}</span>}
              </div>
              <div className="flex items-center text-sm font-semibold leading-6 text-slate-400">{row.setup}</div>
            </div>
          )) : (
            <div className="bg-slate-950/30 px-4 py-8 text-sm font-semibold text-slate-500">No executable micro signal yet. Wait for live or delayed data.</div>
          )}
        </div>
      </div>
    </section>
  );
}
