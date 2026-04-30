"use client";

import { useState, useMemo } from "react";
import type { CoachingCard, DetectedPoint } from "@/lib/types";

type Props = {
  points: DetectedPoint[];
  coachingCards: CoachingCard[];
  clipBaseUrl: string;
  onSeekToPoint: (sec: number) => void;
  playerLabels?: { a: string; b: string };
};

type FilterKey = "all" | "long_rally" | "errors" | "serve";

const END_LABEL: Record<string, { text: string; cls: string }> = {
  OUT:           { text: "Out",         cls: "text-red-400" },
  NET:           { text: "Net",         cls: "text-orange-400" },
  DOUBLE_BOUNCE: { text: "Winner",      cls: "text-green-400" },
  BALL_LOST:     { text: "Unfinished",  cls: "text-zinc-500" },
};

function endLabel(reason: string | null | undefined) {
  if (!reason) return { text: "–", cls: "text-zinc-500" };
  return END_LABEL[reason] ?? { text: reason.replace(/_/g, " ").toLowerCase(), cls: "text-zinc-400" };
}

function findCard(pointIdx: number, cards: CoachingCard[]) {
  return cards.find((c) => c.point_idx === pointIdx);
}

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "All",
  long_rally: "Long rallies",
  errors: "Errors",
  serve: "Serve points",
};

export default function PointDeck({ points, coachingCards, clipBaseUrl, onSeekToPoint, playerLabels }: Props) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const labels = playerLabels ?? { a: "Player A", b: "Player B" };

  const filtered = useMemo(() => {
    switch (filter) {
      case "long_rally": return points.filter((p) => p.rally_hit_count >= 4);
      case "errors":     return points.filter((p) => p.end_reason === "OUT" || p.end_reason === "NET");
      case "serve":      return points.filter((p) => p.serve_zone != null);
      default:           return points;
    }
  }, [points, filter]);

  if (!points.length) return null;

  const filterCount: Record<FilterKey, number> = {
    all:        points.length,
    long_rally: points.filter((p) => p.rally_hit_count >= 4).length,
    errors:     points.filter((p) => p.end_reason === "OUT" || p.end_reason === "NET").length,
    serve:      points.filter((p) => p.serve_zone != null).length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold text-white mr-2">Points</h3>
        {(Object.entries(FILTER_LABELS) as [FilterKey, string][]).map(([key, label]) => {
          if (key !== "all" && filterCount[key] === 0) return null;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === key
                  ? "bg-green-600 border-green-600 text-white font-medium"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }`}
            >
              {label}
              {key !== "all" && (
                <span className="ml-1.5 opacity-60">{filterCount[key]}</span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-zinc-600 py-6 text-center">No points match this filter.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((pt) => {
            const dur = (pt.end_sec - pt.start_sec).toFixed(1);
            const card = findCard(pt.point_idx, coachingCards);
            const clipUrl = `${clipBaseUrl}/point_${pt.point_idx}.mp4`;
            const end = endLabel(pt.end_reason);
            const serveZone = pt.serve_zone?.replace(/_/g, " ") ?? null;
            const server =
              pt.serve_player === "player_a" ? labels.a
              : pt.serve_player === "player_b" ? labels.b
              : null;

            return (
              <div
                key={pt.point_idx}
                className="rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors overflow-hidden flex flex-col"
              >
                {/* Clip video - top of card */}
                <div className="bg-black">
                  <video
                    className="w-full aspect-video object-cover cursor-pointer"
                    muted
                    controls
                    preload="none"
                    onPlay={() => onSeekToPoint(pt.start_sec)}
                    src={clipUrl}
                  />
                </div>

                {/* Point info */}
                <div className="p-4 space-y-3 flex-1 flex flex-col">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-bold text-white">Point {pt.point_idx + 1}</span>
                    <span className={`text-sm font-semibold ${end.cls}`}>{end.text}</span>
                  </div>

                  {/* Key stats */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
                    <span>{pt.rally_hit_count} shot{pt.rally_hit_count !== 1 ? "s" : ""}</span>
                    <span>{dur}s</span>
                    {serveZone && <span>Serve · {serveZone}</span>}
                    {server && <span className="text-zinc-500">{server} serving</span>}
                  </div>

                  {/* Coaching tip */}
                  {card && (
                    <div className="mt-auto pt-3 border-t border-zinc-800 space-y-1.5">
                      <p className="text-sm text-zinc-300 leading-snug">{card.summary}</p>
                      {card.suggestion && (
                        <p className="text-sm text-green-400 leading-snug">{card.suggestion}</p>
                      )}
                    </div>
                  )}

                  {/* Jump to point in overlay */}
                  <button
                    onClick={() => onSeekToPoint(pt.start_sec)}
                    className="mt-2 text-xs text-zinc-500 hover:text-green-400 transition-colors text-left"
                  >
                    Jump in match video →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
