"use client";

type ShotRow = {
  t?: number | null;
  frame_idx?: number;
  point_idx?: number | null;
  player?: string | null;
  side?: string | null;
  shot_type?: string | null;
  speed_kmh?: number | null;
};

export default function ShotsTable({ shots }: { shots: ShotRow[] }) {
  if (!shots.length) {
    return (
      <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 text-xs text-zinc-500">
        No shot events detected.
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-zinc-950 border border-zinc-800 overflow-x-auto">
      <table className="w-full text-xs text-zinc-300">
        <thead className="text-[11px] uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="py-2 px-2 text-left">Time</th>
            <th className="py-2 px-2 text-left">Shot</th>
            <th className="py-2 px-2 text-left">Player</th>
            <th className="py-2 px-2 text-left">Side</th>
            <th className="py-2 px-2 text-left">Point</th>
            <th className="py-2 px-2 text-left">Speed (km/h)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {shots.slice(0, 80).map((s, idx) => (
            <tr key={`${s.frame_idx ?? idx}-${idx}`} className="hover:bg-zinc-900/70">
              <td className="py-2 px-2 text-zinc-400">{format(s.t, 3)}s</td>
              <td className="py-2 px-2 capitalize">{s.shot_type ?? "unknown"}</td>
              <td className="py-2 px-2">{formatPlayer(s.player)}</td>
              <td className="py-2 px-2">{s.side ?? "-"}</td>
              <td className="py-2 px-2">{s.point_idx ?? "-"}</td>
              <td className="py-2 px-2">{format(s.speed_kmh, 1)}</td>
            </tr>
          ))}
          {shots.length > 80 && (
            <tr>
              <td colSpan={6} className="py-2 px-2 text-[11px] text-zinc-500">
                + {shots.length - 80} more shots (not shown)
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function format(val?: number | null, d: number = 1) {
  if (val === null || val === undefined || Number.isNaN(val)) return "-";
  return val.toFixed(d);
}

function formatPlayer(p?: string | null): string {
  if (p === "player_a") return "Player A";
  if (p === "player_b") return "Player B";
  if (p === "unknown" || !p) return "—";
  return p;
}
