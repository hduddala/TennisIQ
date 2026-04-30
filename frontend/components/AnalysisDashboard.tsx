"use client";

import { useEffect, useMemo, useRef } from "react";
import * as Plot from "@observablehq/plot";
import type { AnalysisData, StatSummary } from "@/lib/types";
import ShotsTable from "./ShotsTable";

type Props = { analysis: AnalysisData };

export default function AnalysisDashboard({ analysis }: Props) {
  const serve = analysis.serve ?? {};
  const rally = analysis.rally ?? {};
  const errors = analysis.errors ?? {};
  const players = analysis.players ?? {};
  const ball = analysis.ball ?? {};
  const shots = analysis.shots ?? {};
  const shotTimeline = shots.timeline ?? [];
  const shotMix = shots.mix ?? {};

  const ballSpeedKmH = useMemo(() => {
    const values = ball.speed_samples_m_s ?? [];
    return values.map((v) => v * 3.6).filter((v) => Number.isFinite(v));
  }, [ball.speed_samples_m_s]);

  const serveDepth = serve.depth_samples_m ?? [];
  const serveWidth = serve.width_samples_m ?? [];
  const rallyHits = rally.rally_hits ?? [];
  const rallyDurations = rally.rally_durations_sec ?? [];
  const rallyReasons = rally.end_reason_counts ?? {};
  const serveZones = serve.zone_counts ?? {};
  const serveSamples = serve.sample_count ?? 0;

  const hasServeData = serveSamples > 0 || Object.keys(serveZones).length > 0;
  const hasRallyData = rallyHits.length > 0 || Object.keys(rallyReasons).length > 0;
  const hasPlayerData =
    (players.player_a?.distance_m ?? 0) > 0 || (players.player_b?.distance_m ?? 0) > 0;
  const hasBallData = ballSpeedKmH.length > 0 || ball.speed_stats?.mean != null;
  const hasErrorData = (errors.out_count ?? 0) > 0;
  const hasShotData = shotTimeline.length > 0 || shotMix.player_a != null || shotMix.player_b != null;

  if (!hasServeData && !hasRallyData && !hasPlayerData && !hasBallData && !hasShotData) {
    return null;
  }

  return (
    <section className="space-y-6">
      <h2 className="text-base font-bold text-white">Match Stats</h2>

      {/* Serve Analysis */}
      {hasServeData && (
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white">Serve Analysis</h3>
              {serveSamples > 0 && (
                <p className="text-xs text-zinc-500 mt-0.5">
                  {serveSamples} serve{serveSamples !== 1 ? "s" : ""} tracked
                  {serve.fault_rate != null && serve.fault_rate > 0
                    ? ` · ${Math.round(serve.fault_rate * 100)}% fault rate`
                    : ""}
                </p>
              )}
            </div>
          </div>

          {Object.keys(serveZones).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(serveZones).map(([zone, count]) => (
                <span
                  key={zone}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 text-sm text-zinc-200"
                >
                  {zone.replace(/_/g, " ")} <span className="text-zinc-500 ml-1">{String(count)}</span>
                </span>
              ))}
            </div>
          )}

          {serveSamples >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <PlotHistogram values={serveDepth} title="Serve depth" xLabel="meters" />
              <PlotHistogram values={serveWidth} title="Serve width" xLabel="meters from center" />
            </div>
          )}
        </div>
      )}

      {/* Rally Breakdown */}
      {hasRallyData && (
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Rally Breakdown</h3>

          {rallyHits.length >= 5 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <PlotHistogram values={rallyHits} title="Shots per rally" xLabel="shots" />
              {Object.keys(rallyReasons).length > 0 && (
                <PlotBar
                  title="How points ended"
                  data={Object.entries(rallyReasons).map(([key, value]) => ({
                    key: key.replace(/_/g, " ").toLowerCase(),
                    value,
                  }))}
                />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {rally.tempo_stats?.mean_hits_per_sec != null && (
                <StatBubble
                  label="Shots per second"
                  value={formatNumber(rally.tempo_stats.mean_hits_per_sec)}
                />
              )}
              {rallyHits.length > 0 && (
                <StatBubble
                  label="Avg rally length"
                  value={`${formatNumber(rallyHits.reduce((a, b) => a + b, 0) / rallyHits.length)} shots`}
                />
              )}
              {rallyDurations.length > 0 && (
                <StatBubble
                  label="Avg rally time"
                  value={`${formatNumber(rallyDurations.reduce((a, b) => a + b, 0) / rallyDurations.length)}s`}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Shot Types */}
      {hasShotData && (
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Shot Types</h3>
            {shotTimeline.length > 0 && (
              <span className="text-xs text-zinc-500">{shotTimeline.length} shots logged</span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ShotMixCard title="Player A" data={shotMix.player_a} />
            <ShotMixCard title="Player B" data={shotMix.player_b} />
          </div>
          {shotTimeline.length > 0 && <ShotsTable shots={shotTimeline} />}
        </div>
      )}

      {/* Movement + Errors + Ball Speed */}
      {(hasErrorData || hasPlayerData || hasBallData) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {hasErrorData && (
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Errors</h3>
              <StatBubble label="Balls hit out" value={String(errors.out_count ?? 0)} />
            </div>
          )}

          {hasPlayerData && (
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Court Coverage</h3>
              <PlayerMovement label="Player A" stats={players.player_a ?? null} />
              <PlayerMovement label="Player B" stats={players.player_b ?? null} />
            </div>
          )}

          {hasBallData && (
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Ball Speed</h3>
              {ballSpeedKmH.length >= 5 ? (
                <PlotHistogram values={ballSpeedKmH} title="Speed distribution" xLabel="km/h" />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {ball.speed_stats?.mean != null && (
                    <StatBubble
                      label="Avg speed"
                      value={`${Math.round(ball.speed_stats.mean * 3.6)} km/h`}
                    />
                  )}
                  {ball.speed_stats?.p95 != null && (
                    <StatBubble
                      label="Top speed"
                      value={`${Math.round(ball.speed_stats.p95 * 3.6)} km/h`}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function StatBubble({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-800/60 border border-zinc-800 px-3 py-3">
      <div className="text-[11px] text-zinc-500 mb-1">{label}</div>
      <div className="text-lg font-bold text-white">{value}</div>
    </div>
  );
}

function PlayerMovement({
  label,
  stats,
}: {
  label: string;
  stats: { distance_m?: number; speed_stats?: StatSummary | null; zone_time_pct?: Record<string, number> | null } | null;
}) {
  if (!stats || !stats.distance_m) return null;
  const zones = stats.zone_time_pct;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-zinc-300">{label}</p>
      <p className="text-sm text-zinc-400">
        Covered <span className="text-white font-semibold">{Math.round(stats.distance_m)}m</span>
      </p>
      {zones && (
        <div className="flex gap-3 text-xs text-zinc-500">
          {Object.entries(zones).map(([zone, pct]) => (
            <span key={zone}>{zone}: {formatNumber(pct)}%</span>
          ))}
        </div>
      )}
    </div>
  );
}

function PlotHistogram({
  values,
  title,
  xLabel,
}: {
  values: number[];
  title: string;
  xLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    if (!values.length) return;
    const plot = Plot.plot({
      height: 160,
      marginLeft: 40,
      marginRight: 10,
      marginTop: 20,
      marginBottom: 30,
      x: { label: xLabel, tickFormat: (d) => String(d) },
      y: { label: "count", grid: true },
      style: plotStyle,
      marks: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Plot.rectY(values, Plot.binX({ y: "count" }, { x: (d: any) => d, fill: "#22c55e", fillOpacity: 0.7 } as any)),
        Plot.ruleY([0]),
      ],
    });
    ref.current.append(plot);
    return () => plot.remove();
  }, [values, xLabel]);

  return (
    <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3">
      <div className="text-xs text-zinc-400 mb-2">{title}</div>
      <div ref={ref} />
    </div>
  );
}

function PlotBar({
  data,
  title,
}: {
  data: { key: string; value: number }[];
  title: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    if (!data.length) return;
    const plot = Plot.plot({
      height: 160,
      marginLeft: 60,
      marginRight: 10,
      marginTop: 20,
      marginBottom: 30,
      y: { label: null },
      x: { label: "count", grid: true },
      style: plotStyle,
      marks: [
        Plot.barX(data, { x: "value", y: "key", fill: "#22c55e" }),
        Plot.ruleX([0]),
      ],
    });
    ref.current.append(plot);
    return () => plot.remove();
  }, [data]);

  return (
    <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3">
      <div className="text-xs text-zinc-400 mb-2">{title}</div>
      <div ref={ref} />
    </div>
  );
}

function ShotMixCard({
  title,
  data,
}: {
  title: string;
  data?: { counts?: Record<string, number>; pct?: Record<string, number> };
}) {
  const entries = data?.counts ? Object.entries(data.counts) : [];
  if (!entries.length) return null;
  const max = Math.max(...entries.map(([, v]) => v));
  return (
    <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-2">
      <div className="text-xs text-zinc-400 font-medium">{title}</div>
      <div className="space-y-1.5">
        {entries.map(([shot, count]) => {
          const pct = data?.pct?.[shot];
          const width = max > 0 ? Math.max(8, (count / max) * 100) : 0;
          return (
            <div key={shot} className="flex items-center gap-2 text-sm">
              <div className="w-24 capitalize text-zinc-300">{shot}</div>
              <div className="flex-1 h-2 rounded-full bg-zinc-800">
                <div className="h-2 rounded-full bg-green-500" style={{ width: `${width}%` }} />
              </div>
              <div className="w-6 text-right text-zinc-400 text-xs">{count}</div>
              {pct !== undefined && (
                <div className="w-10 text-right text-zinc-500 text-xs">{pct}%</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatNumber(value?: number | null, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return value.toFixed(decimals);
}

const plotStyle = {
  background: "transparent",
  color: "#e5e7eb",
  fontSize: "11px",
} as const;

function formatSpeedDelta(before?: number | null, after?: number | null) {
  if (before === null || after === null || before === undefined || after === undefined) return "-";
  const delta = after - before;
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(2)} m/s`;
}
