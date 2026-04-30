"use client";

import type { AnalysisData, ResultsDataResponse } from "@/lib/types";

interface Props {
  data: ResultsDataResponse;
  analysis: AnalysisData | null;
}

function fmtDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "–";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtSpeed(mps: number | null | undefined): string {
  if (!mps || mps <= 0) return "–";
  return `${Math.round(mps * 3.6)} km/h`;
}

export default function ResultsHeader({ data, analysis }: Props) {
  const q = analysis?.quality;
  const durationSec = analysis?.meta?.duration_sec ?? null;
  const pointCount = (data.points?.length ?? q?.points_total ?? 0) as number;

  // Average rally length from points
  const points = data.points ?? [];
  const avgRally =
    points.length > 0
      ? Math.round(points.reduce((s, p) => s + (p.rally_hit_count ?? 0), 0) / points.length)
      : null;

  // Top ball speed from analysis
  const topSpeed = (analysis as Record<string, unknown> | null)?.ball_speed_p95_ms as number | null ?? null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatTile label="Duration" value={fmtDuration(durationSec)} />
      <StatTile label="Points played" value={pointCount > 0 ? String(pointCount) : "–"} />
      <StatTile label="Avg rally" value={avgRally != null ? `${avgRally} shots` : "–"} />
      <StatTile label="Top ball speed" value={fmtSpeed(topSpeed)} />
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-4">
      <div className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-white leading-none">{value}</div>
    </div>
  );
}
