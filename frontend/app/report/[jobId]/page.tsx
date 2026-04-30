"use client";

import { useEffect, useState, use } from "react";
import { getResultsData, getApiBaseUrl } from "@/lib/api";
import type { ResultsDataResponse, AnalysisData, HeatmapData, ServePlacement } from "@/lib/types";

// ── Court reference (matches tennisiq/geometry/court_reference.py) ────────────
const C = {
  LEFT: 286, RIGHT: 1379, TOP: 561, BOTTOM: 2935,
  NET_Y: 1748, SL: 423, SR: 1242,
  SVC_T: 1110, SVC_B: 2386, CTR: 832,
} as const;

// ── Tiny SVG court ─────────────────────────────────────────────────────────────
function CourtLines({ stroke = "rgba(0,0,0,0.55)", sw = 8 }: { stroke?: string; sw?: number }) {
  return (
    <>
      <rect x={C.LEFT} y={C.TOP} width={C.RIGHT - C.LEFT} height={C.BOTTOM - C.TOP} fill="none" stroke={stroke} strokeWidth={sw}/>
      <line x1={C.SL} y1={C.TOP} x2={C.SL} y2={C.BOTTOM} stroke={stroke} strokeWidth={sw * 0.6}/>
      <line x1={C.SR} y1={C.TOP} x2={C.SR} y2={C.BOTTOM} stroke={stroke} strokeWidth={sw * 0.6}/>
      <line x1={C.LEFT} y1={C.NET_Y} x2={C.RIGHT} y2={C.NET_Y} stroke={stroke} strokeWidth={sw * 1.4}/>
      <line x1={C.SL} y1={C.SVC_T} x2={C.SR} y2={C.SVC_T} stroke={stroke} strokeWidth={sw * 0.6}/>
      <line x1={C.SL} y1={C.SVC_B} x2={C.SR} y2={C.SVC_B} stroke={stroke} strokeWidth={sw * 0.6}/>
      <line x1={C.CTR} y1={C.SVC_T} x2={C.CTR} y2={C.SVC_B} stroke={stroke} strokeWidth={sw * 0.6}/>
    </>
  );
}

// ── Heatmap SVG ────────────────────────────────────────────────────────────────
function HeatmapSVG({ data, fillFn }: { data: HeatmapData; fillFn: (v: number, max: number) => string }) {
  const masked = maskHeatmapForReport(data);
  const PAD = 60;
  const vbX = C.LEFT - PAD, vbY = C.TOP - PAD;
  const vbW = C.RIGHT - C.LEFT + PAD * 2, vbH = C.BOTTOM - C.TOP + PAD * 2;

  if (!masked.grid?.length || !masked.x_edges?.length || !masked.y_edges?.length) {
    return <div className="text-xs text-zinc-500 text-center py-8 print:text-gray-500">No position data</div>;
  }
  const max = Math.max(...masked.grid.flat(), 1);

  return (
    <svg viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <rect x={C.LEFT} y={C.TOP} width={C.RIGHT - C.LEFT} height={C.BOTTOM - C.TOP} fill="#0f2d18"/>
      {masked.grid.map((row, xi) =>
        row.map((val, yi) => {
          if (!val || val === 0) return null;
          const x = masked.x_edges![xi], y = masked.y_edges![yi];
          const w = masked.x_edges![xi + 1] - x, h = masked.y_edges![yi + 1] - y;
          return <rect key={`${xi}-${yi}`} x={x} y={y} width={w} height={h} fill={fillFn(val, max)} opacity={0.85}/>;
        })
      )}
      <CourtLines stroke="rgba(255,255,255,0.55)" sw={8}/>
    </svg>
  );
}

// ── Serve placement SVG ────────────────────────────────────────────────────────
function ServeSVG({ data }: { data: ServePlacement }) {
  const serves = data.serves ?? [];
  if (!serves.length) return <div className="text-xs text-gray-400 text-center py-8">No serve data</div>;

  const PAD = 80;
  return (
    <svg viewBox={`${C.LEFT - PAD} ${C.TOP - PAD} ${C.RIGHT - C.LEFT + PAD * 2} ${C.BOTTOM - C.TOP + PAD * 2}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <rect x={C.LEFT} y={C.TOP} width={C.RIGHT - C.LEFT} height={C.BOTTOM - C.TOP} fill="#0f2d18"/>
      <CourtLines stroke="rgba(255,255,255,0.55)" sw={8}/>
      {serves.map((s, i) => {
        if (!s.court_x || !s.court_y) return null;
        return <circle key={i} cx={s.court_x} cy={s.court_y} r={30} fill={s.is_fault ? "#ef4444" : "#22c55e"} opacity={0.85}/>;
      })}
    </svg>
  );
}

// ── Insight section ────────────────────────────────────────────────────────────
interface InsightsData {
  strengths: { title: string; detail: string }[];
  issues: { title: string; detail: string; evidence?: string }[];
  patterns: { title: string; detail: string }[];
  drills: { name: string; description: string; targets: string }[];
  priority: string;
  coach_summary: string;
}

// ── Print / PDF chart helpers (no Observable Plot — vector-safe) ────────────────
function binFloatHistogram(values: number[], numBins: number) {
  const clean = values.filter((v) => Number.isFinite(v));
  if (!clean.length) return { bins: [] as { lo: number; hi: number; c: number }[], maxC: 0 };
  const lo = Math.min(...clean);
  const hi = Math.max(...clean);
  if (hi <= lo) return { bins: [{ lo, hi, c: clean.length }], maxC: clean.length };
  const step = (hi - lo) / numBins || 1;
  const bins = Array.from({ length: numBins }, (_, i) => ({
    lo: lo + i * step,
    hi: lo + (i + 1) * step,
    c: 0,
  }));
  for (const v of clean) {
    let i = Math.floor((v - lo) / step);
    if (i >= numBins) i = numBins - 1;
    if (i < 0) i = 0;
    bins[i].c++;
  }
  const maxC = Math.max(...bins.map((b) => b.c), 1);
  return { bins, maxC };
}

function discreteIntHistogram(ints: number[]) {
  const map = new Map<number, number>();
  for (const n of ints) {
    if (!Number.isFinite(n)) continue;
    const k = Math.max(1, Math.round(n));
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  const keys = [...map.keys()].sort((a, b) => a - b);
  const rows = keys.map((k) => ({ label: String(k), c: map.get(k)! }));
  const maxC = Math.max(...rows.map((r) => r.c), 1);
  return { rows, maxC };
}

function ReportBarColumn({
  title,
  xLabel,
  bins,
  maxC,
}: {
  title: string;
  xLabel: string;
  bins: { lo: number; hi: number; c: number }[];
  maxC: number;
}) {
  if (!bins.length) return null;
  const h = 120;
  const chartW = 280;
  const padL = 36;
  const padB = 22;
  const plotH = h - padB;
  const bw = chartW / bins.length - 2;
  return (
    <div className="report-card rounded-xl bg-zinc-900/80 border border-zinc-800 p-3 print:border-gray-200 print:bg-white">
      <div className="text-xs text-zinc-400 mb-2 print:text-gray-600">{title}</div>
      <svg width={chartW + padL} height={h} className="overflow-visible">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={padL}
            x2={padL + chartW}
            y1={t * plotH}
            y2={t * plotH}
            stroke="currentColor"
            className="text-zinc-800 print:text-gray-100"
            strokeWidth={1}
          />
        ))}
        {bins.map((b, i) => {
          const bh = (b.c / maxC) * (plotH - 4);
          const x = padL + i * (chartW / bins.length) + 1;
          return (
            <rect
              key={i}
              x={x}
              y={plotH - bh}
              width={Math.max(2, bw)}
              height={bh}
              fill="#22c55e"
              rx={1}
            />
          );
        })}
        <text x={padL} y={h - 2} className="fill-zinc-500 text-[9px] print:fill-gray-500">{xLabel}</text>
      </svg>
    </div>
  );
}

function ReportHBarList({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; value: number }[];
}) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="report-card rounded-xl bg-zinc-900/80 border border-zinc-800 p-3 print:border-gray-200 print:bg-white">
      <div className="text-xs text-zinc-400 mb-2 print:text-gray-600">{title}</div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 text-zinc-300 capitalize print:text-gray-800">{r.key}</span>
            <div className="flex-1 h-2 rounded-full bg-zinc-800 print:bg-gray-100">
              <div className="h-2 rounded-full bg-green-500 print:bg-green-600" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
            <span className="w-8 text-right text-zinc-400 tabular-nums print:text-gray-600">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportDiscreteHist({
  title,
  rows,
  maxC,
  xLabel,
}: {
  title: string;
  rows: { label: string; c: number }[];
  maxC: number;
  xLabel: string;
}) {
  if (!rows.length) return null;
  const h = 128;
  const chartW = 280;
  const padL = 36;
  const padB = 20;
  const plotH = h - padB;
  const n = rows.length;
  const bw = chartW / n - 2;
  return (
    <div className="report-card rounded-xl bg-zinc-900/80 border border-zinc-800 p-3 print:border-gray-200 print:bg-white">
      <div className="text-xs text-zinc-400 mb-2 print:text-gray-600">{title}</div>
      <svg width={chartW + padL} height={h} className="overflow-visible">
        {rows.map((r, i) => {
          const bh = (r.c / maxC) * (plotH - 8);
          const x = padL + i * (chartW / n) + 1;
          return (
            <g key={r.label}>
              <rect x={x} y={plotH - bh} width={Math.max(2, bw)} height={bh} fill="#22c55e" rx={1} />
              <text
                x={x + Math.max(2, bw) / 2}
                y={plotH + 12}
                textAnchor="middle"
                className="fill-zinc-500 text-[8px] print:fill-gray-500"
              >
                {r.label}
              </text>
            </g>
          );
        })}
        <text x={padL} y={h - 2} className="fill-zinc-500 text-[9px] print:fill-gray-500">{xLabel}</text>
      </svg>
    </div>
  );
}

function ReportShotMix({
  title,
  mix,
  accent,
}: {
  title: string;
  mix?: { counts?: Record<string, number>; pct?: Record<string, number> };
  accent: "blue" | "orange";
}) {
  const entries = mix?.counts ? Object.entries(mix.counts) : [];
  if (!entries.length) return null;
  const max = Math.max(...entries.map(([, v]) => v), 1);
  const bar = accent === "blue" ? "bg-blue-500 print:bg-blue-600" : "bg-orange-500 print:bg-orange-600";
  return (
    <div className="report-card rounded-xl bg-zinc-900/80 border border-zinc-800 p-3 space-y-2 print:border-gray-200 print:bg-white">
      <div className="text-xs text-zinc-400 font-medium print:text-gray-600">{title}</div>
      <div className="space-y-1.5">
        {entries.map(([shot, count]) => {
          const pct = mix?.pct?.[shot];
          const width = max > 0 ? Math.max(6, (count / max) * 100) : 0;
          return (
            <div key={shot} className="flex items-center gap-2 text-sm">
              <div className="w-24 capitalize text-zinc-300 print:text-gray-800">{shot}</div>
              <div className="flex-1 h-2 rounded-full bg-zinc-800 print:bg-gray-100">
                <div className={`h-2 rounded-full ${bar}`} style={{ width: `${width}%` }} />
              </div>
              <div className="w-7 text-right text-zinc-400 text-xs print:text-gray-600">{count}</div>
              {pct !== undefined && <div className="w-10 text-right text-zinc-500 text-xs print:text-gray-500">{pct}%</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function maskHeatmapForReport(data: HeatmapData): HeatmapData {
  const side = data.primary_side;
  if (!side || !data.grid?.length || !data.y_edges?.length) return data;
  const NET_Y = C.NET_Y;
  const SLACK = 55;
  const grid = data.grid.map((row) => [...row]);
  for (let xi = 0; xi < grid.length; xi++) {
    for (let yi = 0; yi < grid[xi].length; yi++) {
      const yc = (data.y_edges[yi] + data.y_edges[yi + 1]) / 2;
      if (side === "near" && yc < NET_Y - SLACK) grid[xi][yi] = 0;
      if (side === "far" && yc > NET_Y + SLACK) grid[xi][yi] = 0;
    }
  }
  return { ...data, grid };
}

function bucketBallSpeedKmh(values: number[]) {
  const b = [0, 0, 0, 0, 0];
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < 30) b[0]++;
    else if (v < 60) b[1]++;
    else if (v < 90) b[2]++;
    else if (v < 120) b[3]++;
    else b[4]++;
  }
  const labels = ["0–30", "30–60", "60–90", "90–120", "120+"];
  const maxC = Math.max(...b, 1);
  return { labels, counts: b, maxC };
}

// ── Main report ────────────────────────────────────────────────────────────────
export default function ReportPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const [data, setData] = useState<ResultsDataResponse | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [playerLabels] = useState({ a: "Player A", b: "Player B" });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const apiBase = await getApiBaseUrl();
      const d = await getResultsData(jobId);
      setData(d);
      try {
        const r = await fetch(`${apiBase}/insights/${jobId}`);
        if (r.ok) setInsights(await r.json());
      } catch { /* optional */ }
      setReady(true);
    })();
  }, [jobId]);

  const analysis = data?.analysis as AnalysisData | null | undefined;

  const handlePrint = () => window.print();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <p className="text-zinc-500 text-sm">Preparing report…</p>
      </div>
    );
  }

  const rally = (analysis as any)?.rally ?? {};
  const serve = (analysis as any)?.serve ?? {};
  const ball = (analysis as any)?.ball ?? {};
  const players = (analysis as any)?.players ?? {};
  const shots = (analysis as any)?.shots ?? {};
  const meta = (analysis as any)?.meta ?? {};

  const rallyHits: number[] = rally.rally_hits ?? [];
  const avgRally = rallyHits.length ? (rallyHits.reduce((a: number, b: number) => a + b, 0) / rallyHits.length).toFixed(1) : "—";
  const avgRallyDur: string = rally.duration_stats?.mean != null ? `${rally.duration_stats.mean.toFixed(1)}s` : "—";
  const duration = meta.duration_sec != null ? `${Math.round(meta.duration_sec)}s` : "—";
  const totalPoints = data?.points?.length ?? 0;
  const speedMean = ball.speed_stats?.mean != null ? `${Math.round(ball.speed_stats.mean * 3.6)} km/h` : "—";
  const speedPeak = ball.speed_stats?.p95 != null ? `${Math.round(ball.speed_stats.p95 * 3.6)} km/h` : "—";
  const outReasons = (data?.points ?? []).filter((p: any) => p.end_reason === "OUT").length;
  const outRate = totalPoints ? Math.round((outReasons / totalPoints) * 100) : 0;
  const paDistance = players.player_a?.distance_m != null ? `${Math.round(players.player_a.distance_m)} m` : "—";
  const pbDistance = players.player_b?.distance_m != null ? `${Math.round(players.player_b.distance_m)} m` : "—";

  const paShots = (shots.mix?.player_a?.counts ?? {}) as Record<string, number>;
  const pbShots = (shots.mix?.player_b?.counts ?? {}) as Record<string, number>;

  const shotTimeline = (shots.timeline ?? []) as Array<{
    player?: string | null;
    side?: string;
    speed_kmh?: number | null;
  }>;
  const serveDepth: number[] = serve.depth_samples_m ?? [];
  const serveWidth: number[] = serve.width_samples_m ?? [];
  const serveSamples = serve.sample_count ?? 0;
  const rallyReasons = rally.end_reason_counts ?? {};
  const rallyReasonRows = Object.entries(rallyReasons).map(([k, v]) => ({
    key: k.replace(/_/g, " ").toLowerCase(),
    value: Number(v),
  }));
  const depthHist = binFloatHistogram(serveDepth, 12);
  const widthHist = binFloatHistogram(serveWidth, 12);
  const rallyDisc = discreteIntHistogram(rallyHits);
  const ballSpeedKmh = ((ball.speed_samples_m_s ?? []) as number[]).map((v) => v * 3.6).filter(Number.isFinite);
  const speedBuckets = bucketBallSpeedKmh(ballSpeedKmh);

  const paNear = shotTimeline.filter((s) => s.player === "player_a" && s.side === "near").length;
  const paFar = shotTimeline.filter((s) => s.player === "player_a" && s.side === "far").length;
  const pbNear = shotTimeline.filter((s) => s.player === "player_b" && s.side === "near").length;
  const pbFar = shotTimeline.filter((s) => s.player === "player_b" && s.side === "far").length;

  const hasServeStats = serveSamples > 0 || Object.keys(serve.zone_counts ?? {}).length > 0;
  const hasRallyStats = rallyHits.length > 0 || rallyReasonRows.length > 0;
  const hasShotMix = Object.keys(paShots).length > 0 || Object.keys(pbShots).length > 0;

  const servePlacement = data?.serve_placement as ServePlacement | null ?? null;
  const paHeatmap = data?.player_a_heatmap as HeatmapData | null ?? null;
  const pbHeatmap = data?.player_b_heatmap as HeatmapData | null ?? null;

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <>
      {/* Print styles injected inline */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; }
          .report-root { background: #fff !important; color: #111827 !important; }
          .report-root .report-headline { color: #111827 !important; }
          .report-root .report-muted { color: #6b7280 !important; }
          .report-card { background: #fff !important; border-color: #e5e7eb !important; }
        }
        @page { size: A4; margin: 18mm 16mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      `}</style>

      <div className="report-root bg-zinc-950 min-h-screen text-zinc-100 max-w-4xl mx-auto px-8 py-8 text-sm">

        {/* ── Print button (hidden when printing) ── */}
        <div className="no-print mb-8 flex items-center gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="flex-1">
            <p className="font-semibold text-white">Match Analysis Report</p>
            <p className="text-xs text-zinc-500 mt-0.5">Print or Save as PDF. Vector charts stay sharp.</p>
          </div>
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition-colors"
          >
            Print / Save PDF
          </button>
          <a href={`/results/${jobId}`} className="px-4 py-2.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-sm transition-colors">
            ← Back
          </a>
        </div>

        {/* ── Cover header ── */}
        <div className="avoid-break border-b border-zinc-800 pb-6 mb-6 print:border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center text-white font-black text-base">T</div>
                <span className="text-xl font-black report-headline text-white">Tennis<span className="text-green-400">IQ</span></span>
              </div>
              <h1 className="text-2xl font-bold report-headline text-white mb-1">Match Analysis Report</h1>
              <p className="text-zinc-500">{playerLabels.a} vs {playerLabels.b}</p>
            </div>
            <div className="text-right text-xs text-zinc-500 space-y-1 mt-1">
              <p>{today}</p>
              <p className="font-mono">#{jobId.slice(0, 8)}</p>
            </div>
          </div>
        </div>

        {/* ── 1. Match Overview ── */}
        <div className="avoid-break mb-8">
          <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-2 mb-4 print:text-gray-900 print:border-gray-200">Match Overview</h2>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Duration", value: duration },
              { label: "Points tracked", value: String(totalPoints) },
              { label: "Avg rally", value: `${avgRally} shots` },
              { label: "Avg rally time", value: avgRallyDur },
              { label: "Ball speed (avg)", value: speedMean },
              { label: "Ball speed (peak 95th)", value: speedPeak },
              { label: "Error rate", value: `${outRate}%` },
              { label: "Serve zones used", value: String(Object.keys(serve.zone_counts ?? {}).length) },
            ].map(({ label, value }) => (
              <div key={label} className="report-card border border-zinc-800 rounded-lg p-3 bg-zinc-900/50 print:border-gray-200 print:bg-white">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1 print:text-gray-500">{label}</p>
                <p className="text-base font-bold text-white print:text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 1b. Match Stats (dashboard parity) ── */}
        {(hasServeStats || hasRallyStats || hasShotMix || ballSpeedKmh.length >= 3) && (
          <div className="avoid-break mb-8 space-y-6">
            <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-2 print:text-gray-900 print:border-gray-200">Match Stats</h2>

            {hasServeStats && (
              <div className="report-card rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 space-y-4 print:border-gray-200 print:bg-white">
                <div>
                  <h3 className="text-sm font-semibold text-white print:text-gray-900">Serve Analysis</h3>
                  {serveSamples > 0 && (
                    <p className="text-xs text-zinc-500 mt-0.5 print:text-gray-600">
                      {serveSamples} serve{serveSamples !== 1 ? "s" : ""} tracked
                      {serve.fault_rate != null && serve.fault_rate > 0
                        ? ` · ${Math.round(serve.fault_rate * 100)}% fault rate`
                        : ""}
                    </p>
                  )}
                </div>
                {Object.keys(serve.zone_counts ?? {}).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(serve.zone_counts).map(([zone, count]) => (
                      <span key={zone} className="px-3 py-1.5 rounded-xl bg-zinc-800 text-sm text-zinc-200 print:bg-gray-100 print:text-gray-800">
                        {zone.replace(/_/g, " ")} <span className="text-zinc-500 ml-1 print:text-gray-500">{String(count)}</span>
                      </span>
                    ))}
                  </div>
                )}
                {serveDepth.length >= 3 && serveWidth.length >= 3 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <ReportBarColumn
                      title="Serve depth"
                      xLabel="meters"
                      bins={depthHist.bins}
                      maxC={depthHist.maxC}
                    />
                    <ReportBarColumn
                      title="Serve width"
                      xLabel="meters from center"
                      bins={widthHist.bins}
                      maxC={widthHist.maxC}
                    />
                  </div>
                )}
              </div>
            )}

            {hasRallyStats && (
              <div className="report-card rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 space-y-4 print:border-gray-200 print:bg-white">
                <h3 className="text-sm font-semibold text-white print:text-gray-900">Rally Breakdown</h3>
                <div className={`grid grid-cols-1 gap-3 ${rallyHits.length >= 3 && rallyReasonRows.length > 0 ? "md:grid-cols-2" : ""}`}>
                  {rallyHits.length >= 3 && (
                    <ReportDiscreteHist
                      title="Shots per rally"
                      rows={rallyDisc.rows}
                      maxC={rallyDisc.maxC}
                      xLabel="shots"
                    />
                  )}
                  {rallyReasonRows.length > 0 && (
                    <ReportHBarList title="How points ended" rows={rallyReasonRows} />
                  )}
                </div>
              </div>
            )}

            {hasShotMix && (
              <div className="report-card rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 space-y-4 print:border-gray-200 print:bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white print:text-gray-900">Shot Types</h3>
                  {shotTimeline.length > 0 && (
                    <span className="text-xs text-zinc-500 print:text-gray-600">{shotTimeline.length} shots logged</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ReportShotMix title={playerLabels.a} mix={shots.mix?.player_a} accent="blue" />
                  <ReportShotMix title={playerLabels.b} mix={shots.mix?.player_b} accent="orange" />
                </div>
                {shotTimeline.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 text-xs">
                    <div className="rounded-xl bg-zinc-950/50 border border-zinc-800 p-3 print:bg-gray-50 print:border-gray-200">
                      <p className="text-zinc-400 mb-2 print:text-gray-600">Court side — {playerLabels.a}</p>
                      <p className="text-zinc-200 print:text-gray-800">Near: {paNear} · Far: {paFar}</p>
                    </div>
                    <div className="rounded-xl bg-zinc-950/50 border border-zinc-800 p-3 print:bg-gray-50 print:border-gray-200">
                      <p className="text-zinc-400 mb-2 print:text-gray-600">Court side — {playerLabels.b}</p>
                      <p className="text-zinc-200 print:text-gray-800">Near: {pbNear} · Far: {pbFar}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {ballSpeedKmh.length >= 3 && (
              <div className="report-card rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 print:border-gray-200 print:bg-white">
                <h3 className="text-sm font-semibold text-white mb-3 print:text-gray-900">Ball speed (km/h)</h3>
                <div className="flex items-end gap-1 h-24">
                  {speedBuckets.counts.map((c, i) => {
                    const hPx = speedBuckets.maxC > 0 ? Math.max(c > 0 ? 6 : 0, (c / speedBuckets.maxC) * 80) : 0;
                    return (
                      <div key={speedBuckets.labels[i]} className="flex-1 flex flex-col items-center gap-1 justify-end h-24">
                        <div
                          className="w-full rounded-t bg-green-500 print:bg-green-600 min-h-0"
                          style={{ height: `${hPx}px` }}
                        />
                        <span className="text-[9px] text-zinc-500 text-center print:text-gray-600">{speedBuckets.labels[i]}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-zinc-500 mt-2 print:text-gray-500">{ballSpeedKmh.length} samples</p>
              </div>
            )}
          </div>
        )}

        {/* ── 2. Player Movement ── */}
        <div className="avoid-break mb-8">
          <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-2 mb-4 print:text-gray-900 print:border-gray-200">Player Movement Summary</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: playerLabels.a, stats: players.player_a, color: "text-blue-400 print:text-blue-700" },
              { label: playerLabels.b, stats: players.player_b, color: "text-orange-400 print:text-orange-700" },
            ].map(({ label, stats, color }) => (
              <div key={label} className="report-card border border-zinc-800 rounded-lg p-4 bg-zinc-900/50 print:border-gray-200 print:bg-white">
                <p className={`font-semibold mb-3 ${color}`}>{label}</p>
                <div className="space-y-2 text-xs text-zinc-400 print:text-gray-700">
                  <div className="flex justify-between"><span>Distance covered</span><span className="font-medium text-zinc-200 print:text-gray-900">{stats?.distance_m != null ? `${Math.round(stats.distance_m)} m` : "—"}</span></div>
                  <div className="flex justify-between"><span>Baseline time</span><span className="font-medium text-zinc-200 print:text-gray-900">{stats?.zone_time_pct?.baseline != null ? `${Math.round(stats.zone_time_pct.baseline)}%` : "—"}</span></div>
                  <div className="flex justify-between"><span>Mid-court time</span><span className="font-medium text-zinc-200 print:text-gray-900">{stats?.zone_time_pct?.mid != null ? `${Math.round(stats.zone_time_pct.mid)}%` : "—"}</span></div>
                  <div className="flex justify-between"><span>Net time</span><span className="font-medium text-zinc-200 print:text-gray-900">{stats?.zone_time_pct?.net != null ? `${Math.round(stats.zone_time_pct.net)}%` : "—"}</span></div>
                  <div className="flex justify-between"><span>Avg speed</span><span className="font-medium text-zinc-200 print:text-gray-900">{stats?.avg_speed_m_s != null ? `${(stats.avg_speed_m_s * 3.6).toFixed(1)} km/h` : "—"}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 3. Serve summary & placement ── */}
        {(servePlacement || serve.fault_rate != null) && (
          <div className="avoid-break mb-8">
            <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-2 mb-4 print:text-gray-900 print:border-gray-200">Serve placement</h2>
            <div className="report-card grid grid-cols-2 gap-6 items-start border border-zinc-800 rounded-xl p-5 bg-zinc-900/50 print:border-gray-200 print:bg-white">
              <div className="space-y-2 text-xs text-zinc-400 print:text-gray-700">
                <div className="flex justify-between border-b border-zinc-800 pb-1 print:border-gray-100">
                  <span>First serve in</span>
                  <span className="font-semibold text-zinc-100 print:text-gray-900">{serve.fault_rate != null ? `${Math.round((1 - serve.fault_rate) * 100)}%` : "—"}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-1 print:border-gray-100">
                  <span>Fault rate</span>
                  <span className="font-semibold text-zinc-100 print:text-gray-900">{serve.fault_rate != null ? `${Math.round(serve.fault_rate * 100)}%` : "—"}</span>
                </div>
                {serve.depth_stats?.mean != null && (
                  <div className="flex justify-between border-b border-zinc-800 pb-1 print:border-gray-100">
                    <span>Avg depth (service line)</span>
                    <span className="font-semibold text-zinc-100 print:text-gray-900">{serve.depth_stats.mean.toFixed(1)} m</span>
                  </div>
                )}
              </div>
              {servePlacement && (
                <div className="w-36 mx-auto">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1 text-center">Landing map</p>
                  <ServeSVG data={servePlacement}/>
                  <div className="flex justify-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>In</span>
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Fault</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 5. Rally Statistics ── */}
        <div className="avoid-break mb-8">
          <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-2 mb-4 print:text-gray-900 print:border-gray-200">Rally Statistics</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Shots per rally (avg)", value: String(avgRally) },
              { label: "Rally duration (avg)", value: avgRallyDur },
              { label: "Shots per second", value: rally.tempo_stats?.mean != null ? `${rally.tempo_stats.mean.toFixed(1)}` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="report-card border border-zinc-800 rounded-lg p-3 text-center bg-zinc-900/50 print:border-gray-200 print:bg-white">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1 print:text-gray-500">{label}</p>
                <p className="text-xl font-bold text-white print:text-gray-900">{value}</p>
              </div>
            ))}
          </div>
          {/* Rally outcome breakdown */}
          {data?.points && data.points.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2 print:text-gray-500">Point outcomes (video)</p>
              <div className="space-y-1.5">
                {(["OUT", "DOUBLE_BOUNCE", "BALL_LOST"] as const).map((reason) => {
                  const count = (data.points as any[]).filter((p: any) => p.end_reason === reason).length;
                  const pct = totalPoints ? Math.round((count / totalPoints) * 100) : 0;
                  const labels: Record<string, string> = { OUT: "Ball out", DOUBLE_BOUNCE: "Winner (double bounce)", BALL_LOST: "Rally incomplete / tracking lost" };
                  const colors: Record<string, string> = { OUT: "bg-red-500", DOUBLE_BOUNCE: "bg-green-500", BALL_LOST: "bg-zinc-500" };
                  return (
                    <div key={reason} className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400 w-44 print:text-gray-700">{labels[reason]}</span>
                      <div className="flex-1 h-2 bg-zinc-800 rounded-full print:bg-gray-100">
                        <div className={`h-2 rounded-full ${colors[reason]}`} style={{ width: `${pct}%` }}/>
                      </div>
                      <span className="text-xs text-zinc-500 w-8 text-right print:text-gray-600">{count}</span>
                      <span className="text-xs text-zinc-600 w-8 text-right print:text-gray-500">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── PAGE BREAK ── */}
        <div className="page-break"/>

        {/* ── 6. Court Heatmaps ── */}
        <div className="avoid-break mb-8">
          <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-2 mb-4 print:text-gray-900 print:border-gray-200">Player Court Heatmaps</h2>
          <p className="text-xs text-zinc-500 mb-4 print:text-gray-600">Intensity shows time on court. Each player is masked to their side of the net to reduce tracker bleed.</p>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-blue-400 mb-2 text-center print:text-blue-700">{playerLabels.a} — Court Coverage</p>
              {paHeatmap ? (
                <HeatmapSVG
                  data={paHeatmap}
                  fillFn={(v, max) => `rgba(59,130,246,${(0.15 + (v / max) * 0.8).toFixed(2)})`}
                />
              ) : <div className="text-xs text-zinc-500 text-center py-8 print:text-gray-500">No data</div>}
            </div>
            <div>
              <p className="text-xs font-semibold text-orange-400 mb-2 text-center print:text-orange-700">{playerLabels.b} — Court Coverage</p>
              {pbHeatmap ? (
                <HeatmapSVG
                  data={pbHeatmap}
                  fillFn={(v, max) => `rgba(249,115,22,${(0.15 + (v / max) * 0.8).toFixed(2)})`}
                />
              ) : <div className="text-xs text-zinc-500 text-center py-8 print:text-gray-500">No data</div>}
            </div>
          </div>
        </div>

        {/* ── 7. AI Coach Insights ── */}
        {insights && (
          <div className="avoid-break mb-8">
            <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-2 mb-4 print:text-gray-900 print:border-gray-200">Coach Insights</h2>
            {insights.coach_summary && (
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 mb-4 print:bg-gray-50 print:border-gray-200">
                <p className="text-xs text-zinc-300 leading-relaxed italic print:text-gray-800">"{insights.coach_summary}"</p>
              </div>
            )}
            {insights.priority && (
              <div className="bg-amber-950/40 border border-amber-900/50 rounded-lg p-3 mb-4 print:bg-amber-50 print:border-amber-200">
                <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide mb-1 print:text-amber-700">Priority focus</p>
                <p className="text-xs text-amber-100 print:text-amber-900">{insights.priority}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-6">
              {insights.strengths.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wide mb-3 print:text-green-700">Strengths</p>
                  <div className="space-y-2">
                    {insights.strengths.map((s, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-green-400 shrink-0 mt-0.5 text-xs print:text-green-600">✓</span>
                        <div>
                          <p className="text-xs font-semibold text-zinc-100 print:text-gray-900">{s.title}</p>
                          <p className="text-[11px] text-zinc-500 leading-relaxed print:text-gray-600">{s.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {insights.issues.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wide mb-3 print:text-red-700">Areas to Improve</p>
                  <div className="space-y-2">
                    {insights.issues.map((s, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-red-400 shrink-0 mt-0.5 text-xs print:text-red-600">!</span>
                        <div>
                          <p className="text-xs font-semibold text-zinc-100 print:text-gray-900">{s.title}</p>
                          <p className="text-[11px] text-zinc-500 leading-relaxed print:text-gray-600">{s.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {insights.patterns.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide mb-3 print:text-blue-700">Tactical Patterns</p>
                <div className="grid grid-cols-2 gap-3">
                  {insights.patterns.map((p, i) => (
                    <div key={i} className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/40 print:border-gray-200 print:bg-white">
                      <p className="text-xs font-semibold text-zinc-100 mb-0.5 print:text-gray-900">{p.title}</p>
                      <p className="text-[11px] text-zinc-500 leading-relaxed print:text-gray-600">{p.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 8. Drill Recommendations ── */}
        {insights?.drills && insights.drills.length > 0 && (
          <div className="avoid-break mb-8">
            <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-2 mb-4 print:text-gray-900 print:border-gray-200">Recommended Drills</h2>
            <div className="space-y-3">
              {insights.drills.map((drill, i) => (
                <div key={i} className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40 print:border-gray-200 print:bg-white">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-violet-950 border border-violet-700 flex items-center justify-center text-xs font-bold text-violet-300 shrink-0 mt-0.5 print:bg-violet-100 print:text-violet-700 print:border-violet-200">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-zinc-100 mb-1 print:text-gray-900">{drill.name}</p>
                      <p className="text-[11px] text-zinc-500 leading-relaxed mb-1.5 print:text-gray-600">{drill.description}</p>
                      <p className="text-[10px] text-violet-400 font-medium print:text-violet-700">Goal: {drill.targets}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 9. Point-by-point summary table ── */}
        {data?.points && data.points.length > 0 && (
          <div className="avoid-break mb-8">
            <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-2 mb-4 print:text-gray-900 print:border-gray-200">
              Point Summary
              <span className="text-xs font-normal text-zinc-500 ml-2 print:text-gray-500">({data.points.length} points)</span>
            </h2>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-zinc-900 print:bg-gray-50">
                  {["#", "Shots", "Duration", "Serve zone", "Outcome", "Note"].map(h => (
                    <th key={h} className="text-left p-1.5 border border-zinc-800 font-semibold text-zinc-400 print:border-gray-200 print:text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.points as any[]).slice(0, 50).map((pt: any, i: number) => {
                  const dur = pt.end_sec != null && pt.start_sec != null ? `${(pt.end_sec - pt.start_sec).toFixed(1)}s` : "—";
                  const outcomeColors: Record<string, string> = { OUT: "text-red-400", DOUBLE_BOUNCE: "text-green-400" };
                  const outcomeLabels: Record<string, string> = { OUT: "Out", DOUBLE_BOUNCE: "Winner", BALL_LOST: "Incomplete" };
                  return (
                    <tr key={i} className="even:bg-zinc-900/50 print:even:bg-gray-50">
                      <td className="p-1.5 border border-zinc-800 text-zinc-500 print:border-gray-200">{i + 1}</td>
                      <td className="p-1.5 border border-zinc-800 text-zinc-300 print:border-gray-200 print:text-gray-900">{pt.rally_hit_count ?? "—"}</td>
                      <td className="p-1.5 border border-zinc-800 text-zinc-300 print:border-gray-200 print:text-gray-900">{dur}</td>
                      <td className="p-1.5 border border-zinc-800 text-zinc-300 capitalize print:border-gray-200 print:text-gray-900">{pt.serve_zone?.replace(/_/g, " ") ?? "—"}</td>
                      <td className={`p-1.5 border border-zinc-800 font-medium print:border-gray-200 ${outcomeColors[pt.end_reason] ?? "text-zinc-500"} print:text-gray-900`}>
                        {outcomeLabels[pt.end_reason] ?? pt.end_reason ?? "—"}
                      </td>
                      <td className="p-1.5 border border-zinc-800 text-zinc-600 max-w-[180px] truncate print:border-gray-200">
                        {pt.serve_fault_type ? `Fault: ${pt.serve_fault_type}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {data.points.length > 50 && (
              <p className="text-[10px] text-zinc-500 mt-1 print:text-gray-500">Showing first 50 of {data.points.length} points.</p>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="border-t border-zinc-800 pt-4 mt-8 flex justify-between text-[10px] text-zinc-500 print:border-gray-200 print:text-gray-500">
          <span>TennisIQ · AI-powered match analysis</span>
          <span>Generated {today} · #{jobId.slice(0, 8)}</span>
        </div>

      </div>
    </>
  );
}
