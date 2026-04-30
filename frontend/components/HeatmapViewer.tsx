"use client";

import type { HeatmapData } from "@/lib/types";

// Court reference coordinates matching tennisiq/geometry/court_reference.py
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

const PAD = 80;
const VB_X = C.LEFT - PAD;
const VB_Y = C.TOP - PAD;
const VB_W = C.RIGHT - C.LEFT + PAD * 2;
const VB_H = C.BOTTOM - C.TOP + PAD * 2;

interface Props {
  errorHeatmap: HeatmapData | null;
  playerAHeatmap: HeatmapData | null;
  playerBHeatmap: HeatmapData | null;
  compact?: boolean;
}

/** Zero bins whose vertical center lies on the opponent's half (removes residual tracker bleed). */
function applyCourtHalfMask(data: HeatmapData): HeatmapData {
  const side = data.primary_side;
  if (!side || !data.grid?.length || !data.y_edges?.length) return data;
  const NET_Y = C.NET_Y;
  const SLACK = 55;
  const grid = data.grid.map((row) => [...row]);
  for (let xi = 0; xi < grid.length; xi++) {
    for (let yi = 0; yi < grid[xi].length; yi++) {
      const yLo = data.y_edges[yi];
      const yHi = data.y_edges[yi + 1];
      const yc = (yLo + yHi) / 2;
      if (side === "near" && yc < NET_Y - SLACK) grid[xi][yi] = 0;
      if (side === "far" && yc > NET_Y + SLACK) grid[xi][yi] = 0;
    }
  }
  return { ...data, grid };
}

function CourtHeatmap({
  data,
  title,
  colorFn,
}: {
  data: HeatmapData;
  title: string;
  colorFn: (v: number, max: number) => string;
}) {
  const masked = applyCourtHalfMask(data);
  const maxVal = Math.max(...masked.grid.flat(), 0);
  const hasData =
    maxVal > 0 &&
    masked.grid.length > 0 &&
    Array.isArray(masked.x_edges) &&
    masked.x_edges.length > 1 &&
    Array.isArray(masked.y_edges) &&
    masked.y_edges.length > 1;

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-2">
      <p className="text-xs font-semibold text-white">{title}</p>

      {!hasData ? (
        <div className="aspect-[46/100] flex items-center justify-center">
          <p className="text-zinc-600 text-[10px] text-center">
            No position data recorded
          </p>
        </div>
      ) : (
        <svg
          viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
          className="w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Court surface */}
          <rect
            x={C.LEFT}
            y={C.TOP}
            width={C.RIGHT - C.LEFT}
            height={C.BOTTOM - C.TOP}
            fill="#0f2d18"
          />

          {/* Heatmap cells — drawn using x_edges/y_edges from the data,
              which are already in the same court coordinate space */}
          {masked.grid.map((row, xi) =>
            row.map((val, yi) => {
              if (!val || val === 0) return null;
              const xe = masked.x_edges!;
              const ye = masked.y_edges!;
              const x = xe[xi];
              const y = ye[yi];
              const w = xe[xi + 1] - xe[xi];
              const h = ye[yi + 1] - ye[yi];
              return (
                <rect
                  key={`${xi}-${yi}`}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill={colorFn(val, maxVal)}
                  opacity={0.88}
                />
              );
            })
          )}

          {/* Court lines rendered on top of the heatmap */}
          {/* Outer doubles court */}
          <rect
            x={C.LEFT}
            y={C.TOP}
            width={C.RIGHT - C.LEFT}
            height={C.BOTTOM - C.TOP}
            fill="none"
            stroke="rgba(255,255,255,0.65)"
            strokeWidth={10}
          />

          {/* Singles sidelines */}
          <line
            x1={C.SINGLE_LEFT}
            y1={C.TOP}
            x2={C.SINGLE_LEFT}
            y2={C.BOTTOM}
            stroke="rgba(255,255,255,0.65)"
            strokeWidth={6}
          />
          <line
            x1={C.SINGLE_RIGHT}
            y1={C.TOP}
            x2={C.SINGLE_RIGHT}
            y2={C.BOTTOM}
            stroke="rgba(255,255,255,0.65)"
            strokeWidth={6}
          />

          {/* Net */}
          <line
            x1={C.LEFT}
            y1={C.NET_Y}
            x2={C.RIGHT}
            y2={C.NET_Y}
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={14}
          />

          {/* Service lines */}
          <line
            x1={C.SINGLE_LEFT}
            y1={C.SERVICE_TOP_Y}
            x2={C.SINGLE_RIGHT}
            y2={C.SERVICE_TOP_Y}
            stroke="rgba(255,255,255,0.65)"
            strokeWidth={6}
          />
          <line
            x1={C.SINGLE_LEFT}
            y1={C.SERVICE_BOTTOM_Y}
            x2={C.SINGLE_RIGHT}
            y2={C.SERVICE_BOTTOM_Y}
            stroke="rgba(255,255,255,0.65)"
            strokeWidth={6}
          />

          {/* Center service line */}
          <line
            x1={C.CENTER_X}
            y1={C.SERVICE_TOP_Y}
            x2={C.CENTER_X}
            y2={C.SERVICE_BOTTOM_Y}
            stroke="rgba(255,255,255,0.65)"
            strokeWidth={6}
          />

          {/* Net post dots */}
          <circle
            cx={C.LEFT}
            cy={C.NET_Y}
            r={16}
            fill="rgba(255,255,255,0.4)"
          />
          <circle
            cx={C.RIGHT}
            cy={C.NET_Y}
            r={16}
            fill="rgba(255,255,255,0.4)"
          />
        </svg>
      )}
    </div>
  );
}

function blueHeat(v: number, max: number): string {
  const t = max > 0 ? v / max : 0;
  const alpha = t * 0.88 + 0.12;
  return `rgba(59,130,246,${alpha.toFixed(2)})`;
}

function orangeHeat(v: number, max: number): string {
  const t = max > 0 ? v / max : 0;
  const alpha = t * 0.88 + 0.12;
  return `rgba(249,115,22,${alpha.toFixed(2)})`;
}

function redHeat(v: number, max: number): string {
  const t = max > 0 ? v / max : 0;
  const alpha = t * 0.88 + 0.12;
  return `rgba(239,68,68,${alpha.toFixed(2)})`;
}

export default function HeatmapViewer({
  errorHeatmap,
  playerAHeatmap,
  playerBHeatmap,
  compact,
}: Props) {
  const hasAny = errorHeatmap || playerAHeatmap || playerBHeatmap;
  if (!hasAny) return null;

  if (compact) {
    return (
      <>
        {playerAHeatmap && (
          <CourtHeatmap
            data={playerAHeatmap}
            title="Player A Movement"
            colorFn={blueHeat}
          />
        )}
        {playerBHeatmap && (
          <CourtHeatmap
            data={playerBHeatmap}
            title="Player B Movement"
            colorFn={orangeHeat}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-white px-1">Court Heatmaps</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {errorHeatmap && (
          <CourtHeatmap data={errorHeatmap} title="Errors" colorFn={redHeat} />
        )}
        {playerAHeatmap && (
          <CourtHeatmap
            data={playerAHeatmap}
            title="Player A"
            colorFn={blueHeat}
          />
        )}
        {playerBHeatmap && (
          <CourtHeatmap
            data={playerBHeatmap}
            title="Player B"
            colorFn={orangeHeat}
          />
        )}
      </div>
    </div>
  );
}
