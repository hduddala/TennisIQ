"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface Props {
  overlayVideoUrl?: string;
  onTimeUpdate?: (sec: number) => void;
  seekTo?: number | null;
}

export default function OverlayPlayer({ overlayVideoUrl, onTimeUpdate, seekTo }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (seekTo != null && seekTo >= 0 && videoRef.current) {
      videoRef.current.currentTime = seekTo;
      setCurrentTime(seekTo);
      onTimeUpdate?.(seekTo);
    }
  }, [seekTo, onTimeUpdate]);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);
    onTimeUpdate?.(t);
  }, [onTimeUpdate]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (videoRef.current) videoRef.current.currentTime = t;
    setCurrentTime(t);
    onTimeUpdate?.(t);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!overlayVideoUrl) {
    return (
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center aspect-video">
        <span className="text-zinc-600 text-sm">Video not available</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-black border border-zinc-800">
      <video
        ref={videoRef}
        src={overlayVideoUrl}
        className="w-full aspect-video"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        playsInline
      />
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-950">
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white transition-colors shrink-0"
        >
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="1.5" y="1" width="3" height="10" rx="1" />
              <rect x="7.5" y="1" width="3" height="10" rx="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M2 1.5v9l8-4.5z" />
            </svg>
          )}
        </button>
        <span className="text-xs text-zinc-500 font-mono w-9 shrink-0">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.01}
          value={currentTime}
          onChange={handleScrub}
          className="flex-1 h-1 rounded-full appearance-none bg-zinc-700 accent-green-500 cursor-pointer"
        />
        <span className="text-xs text-zinc-500 font-mono w-9 shrink-0 text-right">{formatTime(duration)}</span>
      </div>
    </div>
  );
}
