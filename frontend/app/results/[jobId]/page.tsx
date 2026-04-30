"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { getStatus, getResultsData, getApiBaseUrl } from "@/lib/api";
import type {
  StatusResponse,
  ResultsDataResponse,
  DetectedPoint,
  CoachingCard,
  ServePlacement,
  HeatmapData,
  AnalysisData,
} from "@/lib/types";
import ProgressTracker from "@/components/ProgressTracker";
import CheckpointReview from "@/components/CheckpointReview";
import OverlayPlayer from "@/components/OverlayPlayer";
import PointDeck from "@/components/PointDeck";
import ServePlacementChart from "@/components/ServePlacementChart";
import HeatmapViewer from "@/components/HeatmapViewer";
import CourtMiniMap from "@/components/CourtMiniMap";
import AnalysisDashboard from "@/components/AnalysisDashboard";
import ResultsHeader from "@/components/ResultsHeader";
import SessionSummary from "@/components/SessionSummary";
import AICoach from "@/components/AICoach";
import ShotTrajectoryMap from "@/components/ShotTrajectoryMap";

const POLL_INTERVAL = 5000;

export default function ResultsPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [data, setData] = useState<ResultsDataResponse | null>(null);
  const [seekTo, setSeekTo] = useState<number | null>(null);
  const [playerLabels, setPlayerLabels] = useState<{ a: string; b: string }>({
    a: "Player A",
    b: "Player B",
  });
  const [editingLabels, setEditingLabels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    getApiBaseUrl()
      .then((url) => { if (active) setApiUrl(url); })
      .catch(() => { if (active) setApiUrl(""); });
    return () => { active = false; };
  }, []);

  const withApi = useCallback(
    (path: string | null | undefined): string | undefined => {
      if (!path) return undefined;
      if (/^https?:\/\//i.test(path)) return path;
      if (!path.startsWith("/")) return path;
      return apiUrl ? `${apiUrl}${path}` : path;
    },
    [apiUrl],
  );

  const fetchStatus = useCallback(async () => {
    try {
      const s = await getStatus(jobId);
      setStatus(s);
      if (s.status === "complete" || s.status === "error") {
        if (s.status === "complete") {
          const d = await getResultsData(jobId);
          setData(d);
        }
        return false;
      }
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, [jobId]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let active = true;

    async function poll() {
      const shouldContinue = await fetchStatus();
      if (shouldContinue && active) {
        timer = setTimeout(poll, POLL_INTERVAL);
      }
    }

    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fetchStatus]);

  const handleSeekToPoint = (sec: number) => {
    setSeekTo(sec);
    setTimeout(() => setSeekTo(null), 100);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-red-950 border border-red-800 rounded-2xl p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-red-300 text-sm">{error}</p>
          <Link
            href="/"
            className="mt-6 inline-block px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-white text-sm transition-colors"
          >
            Start over
          </Link>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Loading...</div>
      </div>
    );
  }

  const isComplete = status.status === "complete" && data !== null;
  const isReview = status.status === "awaiting_point_review";
  const isError = status.status === "error";
  const isRunning = !isComplete && !isReview && !isError;

  const overlayVideoUrl = withApi(data?.overlay_video_url);
  const points: DetectedPoint[] = data?.points ?? [];
  const coachingCards: CoachingCard[] = data?.coaching_cards ?? [];
  const servePlacement: ServePlacement | null = data?.serve_placement ?? null;
  const errorHeatmap: HeatmapData | null = data?.error_heatmap ?? null;
  const playerAHeatmap: HeatmapData | null = data?.player_a_heatmap ?? null;
  const playerBHeatmap: HeatmapData | null = data?.player_b_heatmap ?? null;
  const clipBaseUrl = withApi(`/outputs/${jobId}/clips`) ?? `/outputs/${jobId}/clips`;
  const analysis: AnalysisData | null = (data?.analysis as AnalysisData | null | undefined) ?? null;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-green-600 flex items-center justify-center text-sm font-black text-white">
            T
          </div>
          <span className="text-white font-bold">
            Tennis<span className="text-green-400">IQ</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <StatusBadge status={status.status} />
          <span className="text-zinc-600 font-mono text-xs">{jobId.slice(0, 8)}</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {isError && (
          <div className="bg-red-950 border border-red-800 rounded-2xl p-6">
            <h2 className="text-red-300 font-bold mb-2">Analysis failed</h2>
            <p className="text-red-400 text-sm">{status.error_message || "An unexpected error occurred."}</p>
          </div>
        )}

        {isRunning && <ProgressTracker status={status} />}
        {isReview && <CheckpointReview jobId={jobId} onComplete={fetchStatus} />}

        {isComplete && (
          <div className="space-y-8">

            {/* ── 1. Match summary stats + report button ── */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <ResultsHeader data={data!} analysis={analysis} />
              </div>
              <a
                href={`/report/${jobId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-green-500/40 text-sm text-white font-medium transition-all"
              >
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                </svg>
                Download Report
              </a>
            </div>

            {/* ── 2. Video + live court mini-map + heatmaps ── */}
            <VideoCourtSection
              overlayVideoUrl={overlayVideoUrl}
              seekTo={seekTo}
              jobId={jobId}
              apiBase={apiUrl}
              servePlacement={servePlacement}
              errorHeatmap={errorHeatmap}
              playerAHeatmap={playerAHeatmap}
              playerBHeatmap={playerBHeatmap}
              playerLabels={playerLabels}
            />

            {/* ── 3. Player names ── */}
            <div className="flex items-center gap-4">
              {editingLabels ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => { e.preventDefault(); setEditingLabels(false); }}
                >
                  <input
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white w-32 focus:outline-none focus:border-green-500/50"
                    value={playerLabels.a}
                    onChange={(e) => setPlayerLabels((l) => ({ ...l, a: e.target.value }))}
                    placeholder="Player A"
                  />
                  <span className="text-zinc-600 text-sm">vs</span>
                  <input
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white w-32 focus:outline-none focus:border-green-500/50"
                    value={playerLabels.b}
                    onChange={(e) => setPlayerLabels((l) => ({ ...l, b: e.target.value }))}
                    placeholder="Player B"
                  />
                  <button type="submit" className="text-sm text-green-400 hover:text-green-300 px-2">
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingLabels(false)}
                    className="text-sm text-zinc-500 hover:text-zinc-300 px-2"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span className="text-sm text-white font-semibold">{playerLabels.a}</span>
                  <span className="text-zinc-600 text-sm">vs</span>
                  <span className="text-sm text-white font-semibold">{playerLabels.b}</span>
                  <button
                    onClick={() => setEditingLabels(true)}
                    className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors ml-1"
                  >
                    Rename
                  </button>
                </>
              )}
            </div>

            {/* ── 4. AI coaching insights ── */}
            {apiUrl && <AICoach jobId={jobId} apiBase={apiUrl} />}

            {/* ── 5. Coaching summary (key takeaways) ── */}
            <SessionSummary data={data!} analysis={analysis} />

            {/* ── 6. Shot breakdown + speed analysis ── */}
            {analysis && <ShotTrajectoryMap analysis={analysis} />}

            {/* ── 7. Detailed analytics (shots, movement, pace) ── */}
            {analysis && <AnalysisDashboard analysis={analysis} />}

            {/* ── 8. Point-by-point — collapsible, closed by default ── */}
            <CollapsiblePoints
              points={points}
              coachingCards={coachingCards}
              clipBaseUrl={clipBaseUrl}
              onSeekToPoint={handleSeekToPoint}
              playerLabels={playerLabels}
            />

          </div>
        )}

      </div>
    </div>
  );
}

// Collapsible wrapper for the point-by-point deck.
// Closed by default so the detailed analytics appear first without scrolling past 100+ point cards.
function CollapsiblePoints({
  points,
  coachingCards,
  clipBaseUrl,
  onSeekToPoint,
  playerLabels,
}: {
  points: DetectedPoint[];
  coachingCards: CoachingCard[];
  clipBaseUrl: string;
  onSeekToPoint: (sec: number) => void;
  playerLabels: { a: string; b: string };
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-white">Points</h2>
          {points.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400">
              {points.length}
            </span>
          )}
        </div>
        <span className="text-zinc-500 text-sm select-none">
          {open ? "▲ Hide" : "▼ Show all points"}
        </span>
      </button>
      {open && (
        <div className="border-t border-zinc-800 p-4">
          <PointDeck
            points={points}
            coachingCards={coachingCards}
            clipBaseUrl={clipBaseUrl}
            onSeekToPoint={onSeekToPoint}
            playerLabels={playerLabels}
          />
        </div>
      )}
    </div>
  );
}


// Isolated sub-component so that currentVideoTime state updates (60 fps from
// video timeupdate) only re-render this section, not the entire results page.
function VideoCourtSection({
  overlayVideoUrl,
  seekTo,
  jobId,
  apiBase,
  servePlacement,
  errorHeatmap,
  playerAHeatmap,
  playerBHeatmap,
  playerLabels,
}: {
  overlayVideoUrl: string | undefined;
  seekTo: number | null;
  jobId: string;
  apiBase: string;
  servePlacement: ServePlacement | null;
  errorHeatmap: HeatmapData | null;
  playerAHeatmap: HeatmapData | null;
  playerBHeatmap: HeatmapData | null;
  playerLabels: { a: string; b: string };
}) {
  const [currentTime, setCurrentTime] = useState(0);

  return (
    <div className="space-y-4">
      {/* Video player */}
      <OverlayPlayer
        overlayVideoUrl={overlayVideoUrl}
        seekTo={seekTo}
        onTimeUpdate={setCurrentTime}
      />

      {/* Live court tracking mini-map — full width, landscape orientation */}
      {apiBase && (
        <CourtMiniMap
          jobId={jobId}
          apiBase={apiBase}
          currentTime={currentTime}
          playerALabel={playerLabels.a}
          playerBLabel={playerLabels.b}
        />
      )}

      {/* Serve placement + heatmaps */}
      {(servePlacement || playerAHeatmap || playerBHeatmap || errorHeatmap) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ServePlacementChart data={servePlacement} />
          <HeatmapViewer
            errorHeatmap={errorHeatmap}
            playerAHeatmap={playerAHeatmap}
            playerBHeatmap={playerBHeatmap}
            compact
          />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued:                 "bg-zinc-800 text-zinc-400",
    running:                "bg-blue-950 text-blue-400",
    awaiting_point_review:  "bg-yellow-950 text-yellow-400",
    finalizing:             "bg-blue-950 text-blue-400",
    complete:               "bg-green-950 text-green-400",
    error:                  "bg-red-950 text-red-400",
  };
  return (
    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${colors[status] ?? "bg-zinc-800 text-zinc-400"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ")}
    </span>
  );
}
