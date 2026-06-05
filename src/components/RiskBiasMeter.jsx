import React from "react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const toneMap = {
  emerald: { text: "text-emerald-200", bar: "bg-emerald-300/80" },
  amber: { text: "text-amber-200", bar: "bg-amber-300/80" },
  rose: { text: "text-rose-200", bar: "bg-rose-300/80" },
  sky: { text: "text-sky-200", bar: "bg-sky-300/80" },
};

function levelLabel(value) {
  if (value >= 75) return "EXTREME";
  if (value >= 55) return "ELEVATED";
  if (value >= 35) return "NEUTRAL";
  return "LOW";
}

export default function RiskBiasMeter({ label = "Risk Bias", value = 50, tone = "sky", description = "Macro filter score" }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  const toneStyle = toneMap[tone] || toneMap.sky;

  return (
    <section className="rounded-[1.6rem] border border-slate-800 bg-slate-950/40 p-5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</p>
          <div className="mt-3 flex items-end gap-3">
            <span className="font-mono text-4xl font-black tracking-tight text-slate-50">{safeValue}</span>
            <span className={cn("mb-1 text-xs font-black uppercase tracking-[0.18em]", toneStyle.text)}>{levelLabel(safeValue)}</span>
          </div>
        </div>
        <div className={cn("rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 font-mono text-xs font-black", toneStyle.text)}>
          FILTER
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800/80">
        <div className={cn("h-full rounded-full", toneStyle.bar)} style={{ width: `${safeValue}%` }} />
      </div>

      <p className="mt-4 text-sm font-semibold leading-6 text-slate-400">{description}</p>
    </section>
  );
}
