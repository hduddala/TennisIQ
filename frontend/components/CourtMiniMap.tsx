"use client";

import { useEffect, useRef, useState } from "react";

// Court reference coordinates from tennisiq/geometry/court_reference.py
// All values are in the same 2D coordinate space as the timeseries JSON files.
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

// Rendered in LANDSCAPE orientation: court_y → svgX, court_x → svgY
// This gives a wide short shape that fits full-width without excessive height.
const COURT_LEN = C.BOTTOM - C.TOP; // 2374 (becomes SVG width)
const COURT_WID = C.RIGHT - C.LEFT; // 1093 (becomes SVG height)
const PAD = 120;

// Helper: court (x, y) → landscape SVG (svgX, svgY)
function toSVG(cx: number, cy: number) {
  return { sx: cy - C.TOP, sy: cx - C.LEFT };
}

type Frame = { t: number; x?: number; y?: number };

function binarySearch(track: Frame[], targetT: number): Frame | null {
  if (!track.length) return null;
  let lo = 0,
    hi = track.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (track[mid].t <= targetT) lo = mid;
    else hi = mid - 1;
  }
  return track[lo];
}

interface Props {
  jobId: string;
  apiBase: string;
  currentTime: number;
  playerALabel?: string;
  playerBLabel?: string;
}

export default function CourtMiniMap({
  jobId,
  apiBase,
  currentTime,
  playerALabel = "Player A",
  playerBLabel = "Player B",
}: Props) {
  const [ballTrack, setBallTrack] = useState<Frame[]>([]);
  const [paTrack, setPaTrack] = useState<Frame[]>([]);
  const [pbTrack, setPbTrack] = useState<Frame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const startTRef = useRef(0);

  useEffect(() => {
    const base = `${apiBase}/outputs/${jobId}`;
    Promise.all([
      fetch(`${base}/timeseries/ball_court.json`).then((r) => r.json()),
      fetch(`${base}/timeseries/player_a_court.json`).then((r) => r.json()),
      fetch(`${base}/timeseries/player_b_court.json`).then((r) => r.json()),
    ])
      .then(([ball, pa, pb]: [Frame[], Frame[], Frame[]]) => {
        startTRef.current = ball[0]?.t ?? 0;
        // Downsample to every 3rd frame (~18fps) for performance
        setBallTrack(ball.filter((_, i) => i % 3 === 0));
        setPaTrack(pa.filter((_, i) => i % 3 === 0));
        setPbTrack(pb.filter((_, i) => i % 3 === 0));
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [jobId, apiBase]);

  const targetT = startTRef.current + currentTime;
  const ball = binarySearch(ballTrack, targetT);
  const pa = binarySearch(paTrack, targetT);
  const pb = binarySearch(pbTrack, targetT);

  if (error) return null;

  // Court lines in landscape SVG space (court_y → svgX, court_x → svgY)
  const netX = C.NET_Y - C.TOP; // 1187
  const singleTopY = C.SINGLE_LEFT - C.LEFT; // 137
  const singleBotY = C.SINGLE_RIGHT - C.LEFT; // 956
  const serviceFarX = C.SERVICE_TOP_Y - C.TOP; // 549
  const serviceNearX = C.SERVICE_BOTTOM_Y - C.TOP; // 1825
  const centerY = C.CENTER_X - C.LEFT; // 546

  const viewBox = `${-PAD} ${-PAD} ${COURT_LEN + PAD * 2} ${COURT_WID + PAD * 2}`;

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Live Court View</h3>
        {loading && (
          <span className="text-xs text-zinc-500 animate-pulse">Loading…</span>
        )}
      </div>

      <svg
        viewBox={viewBox}
        className="w-full rounded-lg"
        style={{ background: "#166534" }}
      >
        {/* Court surface */}
        <rect
          x={0}
          y={0}
          width={COURT_LEN}
          height={COURT_WID}
          fill="#1d6b37"
        />

        {/* Outer doubles court boundary */}
        <rect
          x={0}
          y={0}
          width={COURT_LEN}
          height={COURT_WID}
          fill="none"
          stroke="white"
          strokeWidth={10}
        />

        {/* Singles sidelines */}
        <line
          x1={0}
          y1={singleTopY}
          x2={COURT_LEN}
          y2={singleTopY}
          stroke="white"
          strokeWidth={6}
        />
        <line
          x1={0}
          y1={singleBotY}
          x2={COURT_LEN}
          y2={singleBotY}
          stroke="white"
          strokeWidth={6}
        />

        {/* Net */}
        <line
          x1={netX}
          y1={0}
          x2={netX}
          y2={COURT_WID}
          stroke="white"
          strokeWidth={14}
        />

        {/* Service lines */}
        <line
          x1={serviceFarX}
          y1={singleTopY}
          x2={serviceFarX}
          y2={singleBotY}
          stroke="white"
          strokeWidth={6}
        />
        <line
          x1={serviceNearX}
          y1={singleTopY}
          x2={serviceNearX}
          y2={singleBotY}
          stroke="white"
          strokeWidth={6}
        />

        {/* Center service line */}
        <line
          x1={serviceFarX}
          y1={centerY}
          x2={serviceNearX}
          y2={centerY}
          stroke="white"
          strokeWidth={6}
        />

        {/* "Far" / "Near" labels */}
        <text
          x={40}
          y={COURT_WID / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.3)"
          fontSize={60}
          transform={`rotate(-90, 40, ${COURT_WID / 2})`}
        >
          FAR
        </text>
        <text
          x={COURT_LEN - 40}
          y={COURT_WID / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.3)"
          fontSize={60}
          transform={`rotate(90, ${COURT_LEN - 40}, ${COURT_WID / 2})`}
        >
          NEAR
        </text>

        {/* Player A (blue) */}
        {pa?.x != null && pa?.y != null && (() => {
          const { sx, sy } = toSVG(pa.x!, pa.y!);
          return (
            <>
              <circle
                cx={sx}
                cy={sy}
                r={44}
                fill="#3b82f6"
                stroke="white"
                strokeWidth={6}
              />
              <text
                x={sx}
                y={sy}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={36}
                fontWeight="bold"
              >
                A
              </text>
            </>
          );
        })()}

        {/* Player B (orange) */}
        {pb?.x != null && pb?.y != null && (() => {
          const { sx, sy } = toSVG(pb.x!, pb.y!);
          return (
            <>
              <circle
                cx={sx}
                cy={sy}
                r={44}
                fill="#f97316"
                stroke="white"
                strokeWidth={6}
              />
              <text
                x={sx}
                y={sy}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={36}
                fontWeight="bold"
              >
                B
              </text>
            </>
          );
        })()}

        {/* Ball (green) */}
        {ball?.x != null && ball?.y != null && (() => {
          const { sx, sy } = toSVG(ball.x!, ball.y!);
          return (
            <circle
              cx={sx}
              cy={sy}
              r={26}
              fill="#22c55e"
              stroke="white"
              strokeWidth={5}
            />
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="flex justify-center gap-5 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
          {playerALabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
          {playerBLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
          Ball
        </span>
      </div>
    </div>
  );
}
