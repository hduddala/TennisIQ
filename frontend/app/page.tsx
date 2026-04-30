"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ingestURL, ingestUpload } from "@/lib/api";

const FEATURES = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
      </svg>
    ),
    title: "Live Court Tracking",
    desc: "Ball and player positions mapped to a 2D court view, animated in sync with your video — frame by frame.",
    color: "green",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
        <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/>
        <line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    ),
    title: "AI Coach Insights",
    desc: "Automatically surfaces your strengths, tactical patterns, top issues, and specific drill recommendations.",
    color: "blue",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
      </svg>
    ),
    title: "Player Heatmaps",
    desc: "Court coverage maps showing exactly where each player positions themselves throughout the match.",
    color: "orange",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: "Shot & Speed Analysis",
    desc: "Serve placement, shot type breakdown, and ball speed distribution per player — all visualized.",
    color: "violet",
  },
];

const STATS = [
  { value: "2–4 min", label: "per 5-min clip" },
  { value: "A10G GPU", label: "cloud processing" },
  { value: "4 views", label: "court + heatmaps" },
  { value: "AI coach", label: "data-backed tips" },
];

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmitURL = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { job_id } = await ingestURL(url.trim());
      router.push(`/results/${job_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start pipeline.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (file: File) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const { job_id } = await ingestUpload(file);
      router.push(`/results/${job_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileChange(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange(file);
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">

      {/* ── Background decoration ───────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden select-none" aria-hidden>
        {/* Faint court SVG far right */}
        <svg
          viewBox="0 0 1100 550"
          className="absolute right-[-200px] top-1/2 -translate-y-1/2 w-[800px] opacity-[0.05]"
          fill="none"
          stroke="white"
          strokeLinecap="round"
        >
          <rect x="80" y="40" width="940" height="470" strokeWidth="6"/>
          <line x1="80" y1="110" x2="1020" y2="110" strokeWidth="3"/>
          <line x1="80" y1="440" x2="1020" y2="440" strokeWidth="3"/>
          <line x1="550" y1="40" x2="550" y2="510" strokeWidth="10"/>
          <line x1="260" y1="110" x2="260" y2="440" strokeWidth="3"/>
          <line x1="840" y1="110" x2="840" y2="440" strokeWidth="3"/>
          <line x1="260" y1="275" x2="840" y2="275" strokeWidth="3"/>
        </svg>
        {/* Glow behind headline */}
        <div className="absolute left-1/2 top-52 -translate-x-1/2 w-[600px] h-[300px] bg-green-500/5 rounded-full blur-3xl" />
        {/* Fade edges */}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black"/>
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black"/>
      </div>

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-green-600 flex items-center justify-center font-black text-sm shadow-lg shadow-green-900/50">
            T
          </div>
          <span className="font-bold text-white">
            Tennis<span className="text-green-400">IQ</span>
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-900/60 border border-zinc-800 rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Cloud GPU · 2–4 min analysis
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 flex flex-col items-center text-center px-4 pt-12 pb-16 max-w-3xl mx-auto">

        {/* Badge */}
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-green-900/50 bg-green-950/30 px-4 py-1.5 text-xs text-green-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"/>
          AI-powered tennis analysis · no setup required
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-[62px] font-black leading-[1.08] tracking-tight mb-5">
          Every shot.<br/>
          Every point.<br/>
          <span
            className="text-green-400"
            style={{ textShadow: "0 0 60px rgba(74,222,128,0.25)" }}
          >
            Every insight.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-zinc-400 leading-relaxed max-w-lg mb-10">
          Upload any match video and get professional-grade court tracking,
          player heatmaps, and AI coaching in minutes.
        </p>

        {/* ── Upload card ── */}
        <div className="w-full max-w-md">
          <div
            className="rounded-2xl border border-zinc-800 bg-zinc-900/90 backdrop-blur-sm p-5 space-y-3 shadow-2xl"
            style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)" }}
          >
            <form onSubmit={handleSubmitURL} className="space-y-2.5">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                  </svg>
                </span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste a YouTube match URL..."
                  className="w-full bg-zinc-800/70 border border-zinc-700/60 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-green-500/60 focus:bg-zinc-800 transition-all"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 active:scale-[0.99] text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ boxShadow: "0 4px 24px rgba(22,163,74,0.35)" }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Starting analysis…
                  </span>
                ) : "Analyze Match →"}
              </button>
            </form>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-zinc-800"/>
              <span className="text-[11px] text-zinc-600 font-medium">or</span>
              <div className="flex-1 h-px bg-zinc-800"/>
            </div>

            {/* Drag-and-drop upload zone */}
            <button
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              disabled={loading}
              className={`w-full py-3.5 rounded-xl border-2 border-dashed text-sm transition-all flex items-center justify-center gap-2 ${
                dragOver
                  ? "border-green-500/60 bg-green-950/20 text-green-400"
                  : "border-zinc-700/50 hover:border-zinc-600 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {dragOver ? "Drop to start analysis" : "Upload MP4 or MOV file"}
            </button>
            <input ref={fileRef} type="file" accept=".mp4,.mov,.mkv,video/*" onChange={handleUpload} className="hidden"/>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3">
              <span className="text-red-500 mt-0.5 shrink-0 text-xs">✕</span>
              <p className="text-red-400 text-xs leading-relaxed">{error}</p>
            </div>
          )}

          <p className="text-[11px] text-zinc-600 mt-3 text-center">
            No account needed · results available at a shareable URL
          </p>
        </div>
      </section>

      {/* ── Stat bar ───────────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATS.map(({ value, label }) => (
            <div key={label} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 text-center">
              <p className="text-base font-bold text-white">{value}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 pb-16">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-white mb-2">What you get</h2>
          <p className="text-sm text-zinc-500">Professional analytics surfaced automatically from your footage</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ icon, title, desc, color }) => {
            const ring: Record<string, string> = {
              green: "border-green-900/50 bg-green-950/20 text-green-400",
              blue: "border-blue-900/50 bg-blue-950/20 text-blue-400",
              orange: "border-orange-900/50 bg-orange-950/20 text-orange-400",
              violet: "border-violet-900/50 bg-violet-950/20 text-violet-400",
            };
            return (
              <div
                key={title}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3 hover:border-zinc-700 hover:bg-zinc-900/80 transition-all group"
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${ring[color] ?? ring.green}`}>
                  {icon}
                </div>
                <h3 className="text-sm font-semibold text-white leading-snug group-hover:text-green-400 transition-colors">{title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-2xl mx-auto px-4 pb-28">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <p className="text-[11px] uppercase tracking-widest text-zinc-500 font-semibold mb-6">How it works</p>
          <div className="space-y-5">
            {[
              {
                n: "1",
                title: "Upload your match",
                body: "Paste a YouTube URL or drag and drop an MP4/MOV file. No account or login required.",
              },
              {
                n: "2",
                title: "Cloud GPU processes it",
                body: "Your video is split into segments and processed in parallel on A10G cloud GPUs. All segments run simultaneously for maximum speed.",
              },
              {
                n: "3",
                title: "Review your analysis",
                body: "Get a live court view, player heatmaps, AI coaching insights, serve placement, shot stats, and per-point breakdowns — all in one page.",
              },
            ].map(({ n, title, body }) => (
              <div key={n} className="flex gap-4 items-start">
                <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">
                  {n}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-0.5">{title}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-zinc-900 px-6 py-5 text-center text-[11px] text-zinc-700">
        TennisIQ · AI-powered tennis analysis
      </footer>

    </div>
  );
}
