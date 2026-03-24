/**
 * PlayerBar — barra floating nella parte bassa dell'app
 * Mostra lo stato di mpv e i controlli base.
 * Il video vero e proprio gira in finestra mpv separata (o overlay nativo).
 */
import { useEffect, useRef } from "react";
import { usePlayer } from "../hooks/usePlayer";

export default function PlayerBar() {
  const { isOpen, title, paused, position, duration, volume,
          pause, resume, stop, seek, setVolume, syncState } = usePlayer();
  const syncInterval = useRef<ReturnType<typeof setInterval>>();

  // Poll stato mpv ogni 2 secondi
  useEffect(() => {
    if (isOpen) {
      syncInterval.current = setInterval(syncState, 2000);
    } else {
      clearInterval(syncInterval.current);
    }
    return () => clearInterval(syncInterval.current);
  }, [isOpen, syncState]);

  if (!isOpen) return null;

  const progress = duration > 0 ? (position / duration) * 100 : 0;
  const fmt = (s: number) =>
    `${Math.floor(s / 3600) > 0 ? Math.floor(s / 3600) + ":" : ""}${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-nuvio-surface/95 backdrop-blur-md
                    border-t border-nuvio-border px-4 py-3">
      {/* Progress bar */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 bg-nuvio-border cursor-pointer group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          seek(Math.round(pct * duration));
        }}
      >
        <div
          className="h-full bg-nuvio-accent group-hover:bg-nuvio-accent-hover transition-colors"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-4">
        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-nuvio-text text-sm font-medium truncate">{title}</p>
          <p className="text-nuvio-muted text-xs">
            {fmt(position)} / {fmt(duration)}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={() => (paused ? resume() : pause())}
            className="w-10 h-10 rounded-full bg-nuvio-accent hover:bg-nuvio-accent-hover
                       flex items-center justify-center transition-colors"
          >
            {paused ? (
              <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
          </button>

          {/* Stop */}
          <button
            onClick={stop}
            className="w-8 h-8 rounded-full bg-nuvio-card hover:bg-nuvio-border
                       flex items-center justify-center transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-nuvio-muted" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z" />
            </svg>
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-nuvio-muted flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
            </svg>
            <input
              type="range" min={0} max={100} value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-20 accent-nuvio-accent cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
