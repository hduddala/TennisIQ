"use client";

import type { AnalysisData, ResultsDataResponse } from "@/lib/types";

interface Props {
  data: ResultsDataResponse;
  analysis: AnalysisData | null;
}

interface Bullet {
  type: "strength" | "risk" | "focus";
  text: string;
}

const ICONS = { strength: "✓", risk: "⚠", focus: "→" };
const STYLES = {
  strength: "text-green-400 bg-green-500/8 border-green-500/15",
  risk: "text-yellow-400 bg-yellow-500/8 border-yellow-500/15",
  focus: "text-blue-400 bg-blue-500/8 border-blue-500/15",
};

function buildBullets(data: ResultsDataResponse, analysis: AnalysisData | null): Bullet[] {
  const bullets: Bullet[] = [];

  const q = analysis?.quality;
  const serve = analysis?.serve;
  const rally = analysis?.rally;
  const errors = analysis?.errors;
  const ball = analysis?.ball;
  const playerA = analysis?.players?.player_a;

  const points = data.points ?? [];
  const pointCount = points.length;
  const avgConf =
    pointCount > 0
      ? points.reduce((s, p) => s + (p.confidence ?? 0), 0) / pointCount
      : 0;
  const avgRallyHits = rally?.rally_hits?.length
    ? rally.rally_hits.reduce((a: number, b: number) => a + b, 0) / rally.rally_hits.length
    : null;

  // Use backend insights first (these are curated text from the pipeline)
  const rawInsights = (data.stats as Record<string, unknown> | null)?.insights;
  const insights: string[] = Array.isArray(rawInsights)
    ? rawInsights.filter((s): s is string => typeof s === "string")
    : [];

  // Court detection quality
  const homPct = q?.homography_reliable_pct ?? 0;
  if (homPct >= 90) {
    bullets.push({ type: "strength", text: `Court tracked with ${homPct.toFixed(0)}% reliability — geometry metrics are solid.` });
  } else if (homPct < 70) {
    bullets.push({ type: "risk", text: `Court homography is only ${homPct.toFixed(0)}% reliable — positional stats may be off.` });
  }

  // Ball coverage
  const ballPct = q?.ball_coverage_pct ?? 0;
  if (ballPct >= 60) {
    bullets.push({ type: "strength", text: `Ball detected in ${ballPct.toFixed(0)}% of frames — speed and trajectory data is available.` });
  } else if (ballPct < 30) {
    bullets.push({ type: "risk", text: `Ball was only tracked ${ballPct.toFixed(0)}% of the time — speed stats are estimates.` });
  }

  // Serve
  if (serve) {
    const faultRate = serve.fault_rate ?? 0;
    const zones = serve.zone_counts ?? {};
    const totalServes = Object.values(zones).reduce((a: number, b: number) => a + b, 0);
    if (totalServes > 0 && faultRate <= 0.1) {
      bullets.push({ type: "strength", text: `${Math.round((1 - faultRate) * 100)}% first-serve percentage across ${totalServes} detected serve(s).` });
    } else if (faultRate > 0.25) {
      bullets.push({ type: "risk", text: `High fault rate (${Math.round(faultRate * 100)}%) — focus on serve consistency.` });
    }
    const dominantZone = Object.entries(zones).sort((a, b) => b[1] - a[1])[0];
    if (dominantZone && totalServes >= 3) {
      bullets.push({
        type: "focus",
        text: `${Math.round((dominantZone[1] / totalServes) * 100)}% of serves land in the "${dominantZone[0].replace(/_/g, " ")}" zone — try varying placement.`,
      });
    }
  }

  // Rally length
  if (avgRallyHits != null && typeof avgRallyHits === "number") {
    if (avgRallyHits >= 5) {
      bullets.push({ type: "strength", text: `Average ${avgRallyHits.toFixed(1)} shots per rally — good baseline consistency.` });
    } else if (avgRallyHits < 3 && pointCount >= 3) {
      bullets.push({
        type: "focus",
        text: `Rallies average only ${avgRallyHits.toFixed(1)} shot(s) — many points end early. Work on extending exchanges.`,
      });
    }
  }

  // End reasons
  const endReasons = rally?.end_reason_counts ?? {};
  const outCount = endReasons["OUT"] ?? 0;
  const totalEnds = Object.values(endReasons).reduce((a: number, b: number) => a + b, 0);
  if (totalEnds > 0 && outCount / totalEnds > 0.4) {
    bullets.push({
      type: "risk",
      text: `${Math.round((outCount / totalEnds) * 100)}% of rallies end with a ball going out — depth and margin control is a priority.`,
    });
  }

  // Player movement
  if (playerA?.distance_m && playerA.distance_m > 0) {
    bullets.push({
      type: "strength",
      text: `Player A covered ~${playerA.distance_m.toFixed(0)} m during the tracked segment.`,
    });
  }

  // Ball speed headline (only if meaningful)
  const avgSpeedMs = ball?.speed_stats?.mean ?? null;
  if (typeof avgSpeedMs === "number" && avgSpeedMs > 2) {
    const km = (avgSpeedMs * 3.6).toFixed(0);
    const maxKm = ball?.speed_stats?.max ? (ball.speed_stats.max * 3.6).toFixed(0) : null;
    bullets.push({
      type: "strength",
      text: `Ball avg speed ~${km} km/h${maxKm ? ` (peak ${maxKm} km/h)` : ""} — CV estimate, verify on video.`,
    });
  }

  // Confidence note
  if (avgConf > 0 && avgConf < 0.5 && pointCount > 0) {
    bullets.push({
      type: "risk",
      text: `Average detection confidence ${Math.round(avgConf * 100)}% — confirm points marked as "low confidence" on video.`,
    });
  }

  // Fallback: surface backend insights as focus bullets
  if (bullets.length < 2 && insights.length > 0) {
    insights.slice(0, 3).forEach((text) => {
      bullets.push({ type: "focus", text });
    });
  }

  return bullets.slice(0, 6);
}

export default function SessionSummary({ data, analysis }: Props) {
  const bullets = buildBullets(data, analysis);
  if (!bullets.length) return null;

  const strengths = bullets.filter((b) => b.type === "strength");
  const risks = bullets.filter((b) => b.type === "risk");
  const focus = bullets.filter((b) => b.type === "focus");

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
      <h2 className="text-base font-bold text-white">Key Takeaways</h2>

      <div className="space-y-2">
        {[...strengths, ...risks, ...focus].map((b, i) => (
          <div
            key={i}
            className={`flex gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm leading-snug ${STYLES[b.type]}`}
          >
            <span className="text-xs font-bold mt-0.5 shrink-0 w-4 text-center">
              {ICONS[b.type]}
            </span>
            <span>{b.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
