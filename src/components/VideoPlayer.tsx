/// <reference types="vite/client" />
import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../lib/store';
import { upsertCW } from '../api/nuvio';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipForward, SkipBack, X, Settings2, Subtitles,
} from 'lucide-react';
import clsx from 'clsx';

export interface VideoPlayerProps {
  url: string;
  title?: string;
  contentId?: string;
  contentType?: string;
  poster?: string;
  season?: number;
  episode?: number;
  onClose: () => void;
  onEnded?: () => void;
  initialProgress?: number; // 0-1
}

function formatTime(s: number): string {
  if (!isFinite(s)) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function VideoPlayer({
  url, title, contentId, contentType, poster,
  season, episode, onClose, onEnded, initialProgress = 0,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { nuvioUser, upsertWatch } = useStore();

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Seek a progresso salvato ──────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => {
      if (initialProgress > 0.01 && initialProgress < 0.98) {
        v.currentTime = v.duration * initialProgress;
      }
    };
    v.addEventListener('loadedmetadata', onLoaded, { once: true });
    return () => v.removeEventListener('loadedmetadata', onLoaded);
  }, [url, initialProgress]);

  // ── Auto-hide controls ────────────────────────────────────────────────────
  function resetHideTimer() {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }

  // ── Sync progresso ────────────────────────────────────────────────────────
  const syncProgress = useCallback(() => {
    const v = videoRef.current;
    if (!v || !contentId || v.duration < 10) return;
    const progress = v.currentTime / v.duration;
    // Salva in locale
    upsertWatch({
      id: contentId, type: contentType ?? 'movie',
      name: title ?? '', poster,
      videoId: contentId, season, episode,
      progress, duration: v.duration,
    });
    // Salva su Nuvio cloud
    if (nuvioUser?.token && nuvioUser.id) {
      upsertCW(nuvioUser.id, {
        id: contentId, type: contentType ?? 'movie',
        name: title ?? '', poster,
        videoId: contentId, season, episode,
        progress, duration: v.duration,
      }).catch(() => {});
    }
  }, [contentId, contentType, title, poster, season, episode, nuvioUser]);

  // Sync ogni 15 secondi
  useEffect(() => {
    syncTimer.current = setInterval(syncProgress, 15000);
    return () => { if (syncTimer.current) clearInterval(syncTimer.current); };
  }, [syncProgress]);

  // ── Fullscreen ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const v = videoRef.current;
      if (!v) return;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); v.paused ? v.play() : v.pause(); break;
        case 'ArrowRight': v.currentTime = Math.min(v.duration, v.currentTime + 10); break;
        case 'ArrowLeft': v.currentTime = Math.max(0, v.currentTime - 10); break;
        case 'ArrowUp': v.volume = Math.min(1, v.volume + 0.1); break;
        case 'ArrowDown': v.volume = Math.max(0, v.volume - 0.1); break;
        case 'm': v.muted = !v.muted; break;
        case 'f': toggleFullscreen(); break;
        case 'Escape': if (!document.fullscreenElement) { syncProgress(); onClose(); } break;
      }
      resetHideTimer();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, syncProgress]);

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const v = videoRef.current;
    const bar = progressRef.current;
    if (!v || !bar || !v.duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    v.currentTime = ratio * v.duration;
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onClick={resetHideTimer}
      className="fixed inset-0 bg-black z-50 flex items-center justify-center"
      style={{ cursor: showControls ? 'default' : 'none' }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={url}
        poster={poster}
        className="w-full h-full object-contain"
        autoPlay
        onClick={() => { const v = videoRef.current; if (v) v.paused ? v.play() : v.pause(); }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
        onDurationChange={() => setDuration(videoRef.current?.duration ?? 0)}
        onVolumeChange={() => { setVolume(videoRef.current?.volume ?? 1); setMuted(videoRef.current?.muted ?? false); }}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onEnded={() => { syncProgress(); onEnded?.(); }}
        onError={() => setError('Impossibile riprodurre questo stream. Prova un altro.')}
      />

      {/* Buffering spinner */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 rounded-full border-4 border-white/20 border-t-white animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
          <p className="text-white/60 text-sm max-w-sm text-center">{error}</p>
          <button onClick={() => { syncProgress(); onClose(); }}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm">
            Chiudi
          </button>
        </div>
      )}

      {/* Controls overlay */}
      <div className={clsx(
        'absolute inset-0 flex flex-col justify-between transition-opacity duration-300',
        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-8"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)' }}>
          <div>
            {title && <p className="text-white font-semibold text-base drop-shadow">{title}</p>}
            {season && episode && (
              <p className="text-white/60 text-sm">Stagione {season} · Episodio {episode}</p>
            )}
          </div>
          <button onClick={() => { syncProgress(); onClose(); }}
            className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Bottom controls */}
        <div className="px-5 pb-5"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}>
          {/* Progress bar */}
          <div ref={progressRef} onClick={handleProgressClick}
            className="relative w-full h-1 bg-white/25 rounded-full mb-4 cursor-pointer group/progress hover:h-1.5 transition-all">
            <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, backgroundColor: 'var(--accent, #7c3aed)' }} />
            {/* Thumb */}
            <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity -translate-x-1/2"
              style={{ left: `${progressPct}%` }} />
          </div>

          {/* Buttons row */}
          <div className="flex items-center gap-3">
            {/* Skip back */}
            <button onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 10; }}
              className="p-2 text-white/80 hover:text-white transition-colors">
              <SkipBack size={20} />
            </button>

            {/* Play/Pause */}
            <button onClick={() => { const v = videoRef.current; if (v) v.paused ? v.play() : v.pause(); }}
              className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-black hover:bg-white/90 transition-colors">
              {playing ? <Pause size={20} className="fill-black" /> : <Play size={20} className="fill-black ml-0.5" />}
            </button>

            {/* Skip forward */}
            <button onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10; }}
              className="p-2 text-white/80 hover:text-white transition-colors">
              <SkipForward size={20} />
            </button>

            {/* Time */}
            <span className="text-white/60 text-xs font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button onClick={() => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; }}
                className="p-1.5 text-white/70 hover:text-white transition-colors">
                {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                onChange={e => { if (videoRef.current) { videoRef.current.volume = Number(e.target.value); videoRef.current.muted = false; } }}
                className="w-20 h-1 accent-white cursor-pointer" />
            </div>

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="p-1.5 text-white/70 hover:text-white transition-colors">
              {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
