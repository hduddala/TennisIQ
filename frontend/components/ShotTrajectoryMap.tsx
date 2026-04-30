"use client";

import { useState, useMemo } from "react";
import type { AnalysisData } from "@/lib/types";

// Court reference coordinates (matches tennisiq/geometry/court_reference.py)
const C = {
  LEFT: 286,
  RIGHT: 1379,
  TOP: 561,
  BOTTOM: 2935,
  NET_Y: 1748,
  SINGLE_LEFT: 423,
  SINGLE_RIGHT: 1242,
  SERVICE_TOP_Y: 1110,
  SERVICE_BOTTOM_Y: 2386,
  CENTER_X: 832,
} as const;

const PAD = 100;
const VB_X = C.LEFT - PAD;
const VB_Y = C.TOP - PAD;
const VB_W = C.RIGHT - C.LEFT + PAD * 2;
const VB_H = C.BOTTOM - C.TOP + PAD * 2;

interface EventItem {
  event_type: string;
  court_xy?: [number, number] | null;
  player?: string | null;
  court_side?: string;
  in_out?: string | null;
  speed_after_m_s?: number | null;
  timestamp_sec?: number;
  _segment?: number;
}

interface Props {
  analysis: AnalysisData;
}

// Build shot segments: array of { from, to, player, speed } connecting hit→bounce→hit
function buildSegments(events: EventItem[]) {
  const segments: {
    from: [number, number];
    to: [number, number];
    player: string | null;
    speedKmh: number | null;
    isBounce: boolean;
  }[] = [];

  const relevant = events.filter(
    (e) => (e.event_type === "hit" || e.event_type === "bounce") && e.court_xy
  );

  for (let i = 0; i < relevant.length - 1; i++) {
    const cur = relevant[i];
    const nxt = relevant[i + 1];
    if (!cur.court_xy || !nxt.court_xy) continue;
    // Only connect events in the same segment to avoid jumps between separate rallies
    if (
      cur._segment !== undefined &&
      nxt._segment !== undefined &&
      cur._segment !== nxt._segment
    )
      continue;

    const from: [number, number] = [cur.court_xy[0], cur.court_xy[1]];
    const to: [number, number] = [nxt.court_xy[0], nxt.court_xy[1]];
    const player = cur.player ?? null;
    const speed = cur.speed_after_m_s;
    const speedKmh = speed != null ? Math.round(speed * 3.6) : null;
    const isBounce = nxt.event_type === "bounce";

    segments.push({ from, to, player, speedKmh, isBounce });
  }

  return segments;
}

function hitColor(player: string | null): string {
  if (player === "player_a") return "#3b82f6"; // blue
  if (player === "player_b") return "#f97316"; // orange
  return "#a1a1aa"; // gray for unknown
}

export default function ShotTrajectoryMap({ analysis }: Props) {
  const [filter, setFilter] = useState<"all" | "player_a" | "player_b">("all");

  const eventTimeline: EventItem[] = useMemo(() => {
    const evts = (analysis as any)?.events?.timeline ?? [];
    // Attach court_xy from the events — timeline already has position data
    return evts;
  }, [analysis]);

  // events.timeline doesn't carry court_xy; pull from raw analysis shots timeline
  // which is structured differently. Use the shots.timeline which has t + player + side.
  // For court_xy we need the raw events — check what the API returns.
  const shotTimeline = useMemo(() => {
    const shots = (analysis as any)?.shots?.timeline ?? [];
    return shots as Array<{
      t: number | null;
      player: string | null;
      shot_type: string;
      side: string;
      speed_kmh: number | null;
      point_idx: number | null;
    }>;
  }, [analysis]);

  // The events.timeline we receive from /results/{id}/data contains the processed events
  // BUT without court_xy (it's stripped for payload size). We need to fetch events.json.
  // For now render a stats-based view + message if trajectory isn't available.
  const hasTrajectory = eventTimeline.some((e) => e.court_xy != null);

  // Even without court_xy, we can show a useful shot distribution breakdown
  const paShots = shotTimeline.filter((s) => s.player === "player_a");
  const pbShots = shotTimeline.filter((s) => s.player === "player_b");
  const shotTypes = ["serve", "groundstroke", "volley"] as const;

  const countByType = (shots: typeof paShots, type: string) =>
    shots.filter((s) => s.shot_type === type).length;

  const allShots = shotTimeline.length;
  const avgSpeedA =
    paShots.filter((s) => s.speed_kmh != null).length > 0
      ? Math.round(
          paShots.reduce((s, x) => s + (x.speed_kmh ?? 0), 0) /
            paShots.filter((s) => s.speed_kmh != null).length
        )
      : null;
  const avgSpeedB =
    pbShots.filter((s) => s.speed_kmh != null).length > 0
      ? Math.round(
          pbShots.reduce((s, x) => s + (x.speed_kmh ?? 0), 0) /
            pbShots.filter((s) => s.speed_kmh != null).length
        )
      : null;

  if (shotTimeline.length === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-white">Shot Breakdown</h3>
        <p className="text-xs text-zinc-500 mt-0.5">{allShots} shots logged across all rallies</p>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Player A shot mix */}
        <PlayerShotCard
          label="Player A"
          color="#3b82f6"
          shots={paShots}
          avgSpeedKmh={avgSpeedA}
          shotTypes={shotTypes}
          countByType={countByType}
        />

        {/* Player B shot mix */}
        <PlayerShotCard
          label="Player B"
          color="#f97316"
          shots={pbShots}
          avgSpeedKmh={avgSpeedB}
          shotTypes={shotTypes}
          countByType={countByType}
        />
      </div>

      {/* Court zone distribution using side (near/far) */}
      <div className="px-5 pb-5">
        <CourtSideChart shotTimeline={shotTimeline} />
      </div>

      {/* Speed distribution */}
      <div className="px-5 pb-5">
        <ShotSpeedBars shotTimeline={shotTimeline} />
      </div>
    </div>
  );
}

function PlayerShotCard({
  label,
  color,
  shots,
  avgSpeedKmh,
  shotTypes,
  countByType,
}: {
  label: string;
  color: string;
  shots: Array<{ shot_type: string; speed_kmh: number | null; side: string }>;
  avgSpeedKmh: number | null;
  shotTypes: readonly string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  countByType: (s: any[], type: string) => number;
}) {
  const total = shots.length;
  if (total === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-sm font-medium text-white">{label}</span>
        <span className="ml-auto text-xs text-zinc-500">{total} shots</span>
        {avgSpeedKmh != null && (
          <span className="text-xs text-zinc-400">{avgSpeedKmh} km/h avg</span>
        )}
      </div>

      <div className="space-y-1.5">
        {shotTypes.map((type) => {
          const count = countByType(shots, type);
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={type} className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 w-24 capitalize">{type}</span>
              <div className="flex-1 h-2 rounded-full bg-zinc-800">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <span className="text-xs text-zinc-400 w-8 text-right">{count}</span>
              <span className="text-xs text-zinc-600 w-8 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CourtSideChart({
  shotTimeline,
}: {
  shotTimeline: Array<{ player: string | null; side: string }>;
}) {
  const nearA = shotTimeline.filter(
    (s) => s.player === "player_a" && s.side === "near"
  ).length;
  const farA = shotTimeline.filter(
    (s) => s.player === "player_a" && s.side === "far"
  ).length;
  const nearB = shotTimeline.filter(
    (s) => s.player === "player_b" && s.side === "near"
  ).length;
  const farB = shotTimeline.filter(
    (s) => s.player === "player_b" && s.side === "far"
  ).length;

  const total = nearA + farA + nearB + farB;
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Court zone — Near vs Far</p>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { label: "Player A — Near", val: nearA, color: "#3b82f6", total: nearA + farA },
            { label: "Player A — Far", val: farA, color: "#93c5fd", total: nearA + farA },
            { label: "Player B — Near", val: nearB, color: "#f97316", total: nearB + farB },
            { label: "Player B — Far", val: farB, color: "#fdba74", total: nearB + farB },
          ] as const
        ).map(({ label, val, color, total: t }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
            <span className="text-xs text-zinc-400 flex-1">{label}</span>
            <span className="text-xs font-medium text-zinc-300">{val}</span>
            <span className="text-xs text-zinc-600">
              {t > 0 ? `${Math.round((val / t) * 100)}%` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShotSpeedBars({
  shotTimeline,
}: {
  shotTimeline: Array<{ player: string | null; speed_kmh: number | null }>;
}) {
  const speeds = shotTimeline
    .filter((s) => s.speed_kmh != null && (s.speed_kmh as number) > 0 && (s.speed_kmh as number) < 300)
    .map((s) => s.speed_kmh as number);

  if (speeds.length < 3) return null;

  // Bucket into bands: 0-30, 30-60, 60-90, 90-120, 120+
  const bands = [
    { label: "0–30", min: 0, max: 30 },
    { label: "30–60", min: 30, max: 60 },
    { label: "60–90", min: 60, max: 90 },
    { label: "90–120", min: 90, max: 120 },
    { label: "120+", min: 120, max: Infinity },
  ];

  const counts = bands.map(({ min, max }) =>
    speeds.filter((s) => s >= min && s < max).length
  );
  const maxCount = Math.max(...counts, 1);

  return (
    <div className="space-y-2 mt-2">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Ball speed distribution (km/h)</p>
      <div className="flex items-end gap-2 h-16">
        {bands.map(({ label }, i) => (
          <div key={label} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center" style={{ height: 48 }}>
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.round((counts[i] / maxCount) * 100)}%`,
                  background: "#22c55e",
                  minHeight: counts[i] > 0 ? 4 : 0,
                }}
              />
            </div>
            <span className="text-[10px] text-zinc-500 text-center leading-tight">{label}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-zinc-600 text-right">{speeds.length} shots with speed data</p>
    </div>
  );
}
