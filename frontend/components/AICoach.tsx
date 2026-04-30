"use client";

import { useEffect, useState } from "react";

interface Insight {
  title: string;
  detail: string;
  evidence?: string;
}

interface Drill {
  name: string;
  description: string;
  targets: string;
}

interface DataPoints {
  points_analyzed?: number;
  avg_rally?: number;
  out_rate_pct?: number;
  long_rally_error_rate_pct?: number | null;
  serve_zones_used?: number;
}

interface InsightsData {
  strengths: Insight[];
  issues: Insight[];
  patterns: Insight[];
  drills: Drill[];
  priority: string;
  coach_summary: string;
  data_points?: DataPoints;
  _source?: "rule_based" | "gpt";
}

interface Props {
  jobId: string;
  apiBase: string;
}

export default function AICoach({ jobId, apiBase }: Props) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openDrillIdx, setOpenDrillIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!jobId || !apiBase) return;
    fetch(`${apiBase}/insights/${jobId}`)
      .then((r) => {
        if (r.status === 202) return null; // still processing
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d) => {
        if (d) setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [jobId, apiBase]);

  if (error) return null;
  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-white">Coach Insights</span>
          <span className="text-xs text-zinc-500 animate-pulse">Analyzing…</span>
        </div>
        <div className="space-y-2">
          {[90, 70, 80].map((w, i) => (
            <div key={i} className={`h-4 rounded bg-zinc-800 animate-pulse`} style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }
  if (!data) return null;

  const hasAny =
    data.strengths.length > 0 ||
    data.issues.length > 0 ||
    data.patterns.length > 0 ||
    data.drills.length > 0;
  if (!hasAny) return null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-semibold text-white">Coach Insights</h2>
            {data._source === "gpt" && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-violet-900/60 text-violet-300 border border-violet-800">
                AI
              </span>
            )}
          </div>
          {data.coach_summary && (
            <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">{data.coach_summary}</p>
          )}
        </div>
        {data.data_points && (
          <div className="hidden sm:flex flex-col items-end text-right shrink-0">
            <span className="text-xs text-zinc-500">Based on</span>
            <span className="text-sm font-medium text-zinc-300">
              {data.data_points.points_analyzed ?? "—"} points
            </span>
          </div>
        )}
      </div>

      {/* Priority callout */}
      {data.priority && (
        <div className="px-5 py-3 bg-amber-950/40 border-b border-amber-900/40 flex items-start gap-3">
          <span className="text-amber-400 mt-0.5 shrink-0 text-base">◎</span>
          <div>
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Priority focus</span>
            <p className="text-sm text-amber-200 mt-0.5">{data.priority}</p>
          </div>
        </div>
      )}

      <div className="divide-y divide-zinc-800">
        {/* Strengths */}
        {data.strengths.length > 0 && (
          <section className="px-5 py-4">
            <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">
              What's Working
            </h3>
            <div className="space-y-3">
              {data.strengths.map((s, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                  <div>
                    <p className="text-sm font-medium text-white">{s.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{s.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Issues */}
        {data.issues.length > 0 && (
          <section className="px-5 py-4">
            <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">
              Areas to Improve
            </h3>
            <div className="space-y-3">
              {data.issues.map((issue, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-red-500 mt-0.5 shrink-0">!</span>
                  <div>
                    <p className="text-sm font-medium text-white">{issue.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{issue.detail}</p>
                    {issue.evidence && (
                      <p className="text-xs text-zinc-600 mt-1 italic">{issue.evidence}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Patterns */}
        {data.patterns.length > 0 && (
          <section className="px-5 py-4">
            <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">
              Tactical Patterns
            </h3>
            <div className="space-y-3">
              {data.patterns.map((p, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-blue-400 mt-0.5 shrink-0">→</span>
                  <div>
                    <p className="text-sm font-medium text-white">{p.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{p.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Drills */}
        {data.drills.length > 0 && (
          <section className="px-5 py-4">
            <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-3">
              Recommended Drills
            </h3>
            <div className="space-y-2">
              {data.drills.map((drill, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-zinc-700 bg-zinc-800/50 overflow-hidden"
                >
                  <button
                    onClick={() => setOpenDrillIdx(openDrillIdx === i ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-violet-900/60 border border-violet-700 text-violet-300 text-xs font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-white truncate">{drill.name}</span>
                    </div>
                    <span className="text-zinc-500 text-xs ml-2 shrink-0">
                      {openDrillIdx === i ? "▲" : "▼"}
                    </span>
                  </button>
                  {openDrillIdx === i && (
                    <div className="px-4 pb-4 space-y-2 border-t border-zinc-700">
                      <p className="text-xs text-zinc-300 leading-relaxed pt-3">{drill.description}</p>
                      <div className="flex items-start gap-1.5">
                        <span className="text-violet-400 text-[10px] font-semibold uppercase tracking-wide shrink-0 mt-0.5">
                          Goal:
                        </span>
                        <p className="text-[11px] text-zinc-400">{drill.targets}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
