"use client";

import type { StatusResponse } from "@/lib/types";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/types";

interface Props {
  status: StatusResponse;
}

function pipelineProgressPercent(status: StatusResponse): number {
  if (status.status === "complete") {
    return 100;
  }

  const denom = STAGE_ORDER.length - 1;
  const idx = STAGE_ORDER.indexOf(status.stage);
  const stageProgress = idx >= 0 ? (idx / denom) * 100 : 0;

  const total = status.segments_total ?? 0;
  const complete = status.segments_complete ?? 0;
  const current = status.segment_current;

  // During Modal segment inference, stage index stays on "inference" for dozens of segments.
  // Drive the bar primarily by 1-based segment position so it visibly advances (e.g. 7/50 ≈ 22%).
  if (status.stage === "inference" && total > 0 && current != null && current >= 1) {
    const t = Math.max(total, 1);
    const byIndex = 14 + ((current - 0.35) / t) * 62;
    const byComplete = 14 + (complete / t) * 62;
    return Math.round(Math.min(92, Math.max(stageProgress, byIndex, byComplete)));
  }

  if (total > 0) {
    let frac = complete / total;
    const segmentMapped = 15 + frac * 55;
    return Math.round(Math.min(99, Math.max(stageProgress, segmentMapped)));
  }

  return Math.round(stageProgress);
}

export default function ProgressTracker({ status }: Props) {
  const currentIdx = STAGE_ORDER.indexOf(status.stage);
  const progress = pipelineProgressPercent(status);
  const segTotal = status.segments_total ?? 0;
  const segDone = status.segments_complete ?? 0;

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Pipeline Progress</h2>
        <span className="text-sm text-zinc-400 font-mono">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Current stage description */}
      <div className="flex items-start gap-3">
        <div className="mt-1">
          {status.status === "error" ? (
            <div className="w-3 h-3 rounded-full bg-red-500" />
          ) : status.status === "complete" ? (
            <div className="w-3 h-3 rounded-full bg-green-500" />
          ) : (
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-white">
            {STAGE_LABELS[status.stage] ?? status.stage}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">{status.stage_description}</p>
          {status.stage === "inference" && segTotal > 0 && (
            <p className="text-xs text-zinc-600 mt-1">
              {status.gpu_backend === "modal" && (
                <span className="text-zinc-500 block mb-0.5">
                  Running on Modal A10G — all {segTotal} segment{segTotal !== 1 ? "s" : ""} dispatched in parallel.
                </span>
              )}
              {segDone}/{segTotal} complete. All segments run simultaneously — total expected ~2–4 min for a 5-min clip.
            </p>
          )}
        </div>
      </div>

      {/* Stage list */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {STAGE_ORDER.slice(0, -1).map((stage, i) => {
          const isDone = i < currentIdx;
          const isCurrent = stage === status.stage;
          return (
            <div
              key={stage}
              className={`text-[10px] px-2 py-1.5 rounded-lg border text-center ${
                isDone
                  ? "bg-green-500/10 border-green-500/20 text-green-400"
                  : isCurrent
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                  : "bg-zinc-900 border-zinc-800 text-zinc-600"
              }`}
            >
              {STAGE_LABELS[stage] ?? stage}
            </div>
          );
        })}
      </div>

      {status.error_message && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-4">
          <p className="text-red-400 text-sm">{status.error_message}</p>
        </div>
      )}
    </div>
  );
}
