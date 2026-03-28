/// <reference types="vite/client" />
/**
 * VideoPlayer — Player ibrido:
 * - Tenta prima con il tag <video> HTML5 (funziona per direct HTTP links con CORS aperto)
 * - Fallback a mpv bundled via Tauri invoke
 * - Tracking progresso ogni 10s su Nuvio cloud + locale
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../lib/store';
import { upsertCW } from '../api/nuvio';
import { Play, Pause, Volume2, VolumeX, Maximize, X, SkipForward, SkipBack, Loader2, AlertCircle, MonitorPlay } from 'lucide-react';
import clsx from 'clsx';

export interface VideoPlayerProps {
  url: string;
  title?: string;
  subtitle?: string;          // es. "Stagione 2 · Episodio 5"
  contentId?: string;
  contentType?: string;
  poster?: string;
  season?: number;
  episode?: number;
  nextEpisode?: { id: string; title: string; thumbnail?: string } | null;
  onClose: () => void;
  onNext?: () => void;
  initialProgress?: number;   // 0-1
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

export default function VideoPlayer({
  url, title, subtitle, contentId, contentType, poster,
  season, episode, nextEpisode, onClose, onNext, initialProgress = 0,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const syncTimer = useRef<ReturnType<typeof setInterval>>();

  const { nuvioUser, upsertWatch } = useStore();

  const [mode, setMode] = useState<'loading' | 'html5' | 'mpv' | 'error'>('loading');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showNextEp, setShowNextEp] = useState(false);

  // ── Progress sync ─────────────────────────────────────────────────────────
  const syncProgress = useCallback((time?: number, dur?: number) => {
    const v = videoRef.current;
    const t = time ?? v?.currentTime ?? 0;
    const d = dur ?? v?.duration ?? 0;
    if (!contentId || d < 10) return;
    const progress = d > 0 ? t / d : 0;
    upsertWatch({ id: contentId, type: contentType ?? 'movie', name: title ?? '', poster, videoId: contentId, season, episode, progress, duration: d });
    if (nuvioUser?.token && nuvioUser.id) {
      upsertCW(nuvioUser.id, { id: contentId, type: contentType ?? 'movie', name: title ?? '', poster, videoId: contentId, season, episode, progress, duration: d }).catch(() => {});
    }
  }, [contentId, contentType, title, poster, season, episode, nuvioUser]);

  useEffect(() => {
    syncTimer.current = setInterval(() => syncProgress(), 10000);
    return () => clearInterval(syncTimer.current);
  }, [syncProgress]);

  // ── HTML5 player setup ────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    v.src = url;
    v.load();

    const onLoaded = () => {
      setMode('html5');
      setBuffering(false);
      if (initialProgress > 0.01 && initialProgress < 0.97) {
        v.currentTime = v.duration * initialProgress;
      }
      v.play().catch(() => {});
    };

    const onError = async () => {
      // Fallback a mpv
      try {
        await invoke('launch_mpv', { url, title: title ?? null });
        setMode('mpv');
        setPlaying(true);
      } catch (e: any) {
        setErrorMsg(`Impossibile riprodurre: ${e?.message ?? 'errore sconosciuto'}`);
        setMode('error');
      }
    };

    v.addEventListener('loadedmetadata', onLoaded, { once: true });
    v.addEventListener('error', onError, { once: true });

    // Timeout: se dopo 8s non ha caricato, prova mpv
    const timeout = setTimeout(onError, 8000);

    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('error', onError);
      clearTimeout(timeout);
    };
  }, [url]);

  // ── Near end → show next episode ─────────────────────────────────────────
  useEffect(() => {
    if (duration > 0 && currentTime > 0 && (duration - currentTime) < 30 && nextEpisode) {
      setShowNextEp(true);
    }
  }, [currentTime, duration, nextEpisode]);

  // ── Fullscreen ────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  function toggleFS() {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  }

  // ── Controls auto-hide ────────────────────────────────────────────────────
  function resetHide() {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { if (playing) setShowControls(false); }, 3500);
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const v = videoRef.current;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); v?.paused ? v.play() : v?.pause(); break;
        case 'ArrowRight': if (v) v.currentTime = Math.min(v.duration, v.currentTime + 10); break;
        case 'ArrowLeft': if (v) v.currentTime = Math.max(0, v.currentTime - 10); break;
        case 'ArrowUp': if (v) v.volume = Math.min(1, v.volume + 0.1); break;
        case 'ArrowDown': if (v) v.volume = Math.max(0, v.volume - 0.1); break;
        case 'm': if (v) v.muted = !v.muted; break;
        case 'f': toggleFS(); break;
        case 'Escape': if (!document.fullscreenElement) { syncProgress(); onClose(); } break;
        case 'n': if (nextEpisode && onNext) { syncProgress(); onNext(); } break;
      }
      resetHide();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, syncProgress, nextEpisode, onNext, playing]);

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const v = videoRef.current;
    const bar = progressBarRef.current;
    if (!v || !bar || !v.duration) return;
    const ratio = (e.clientX - bar.getBoundingClientRect().left) / bar.clientWidth;
    v.currentTime = Math.max(0, Math.min(v.duration, ratio * v.duration));
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHide}
      className="fixed inset-0 bg-black z-[100] flex items-center justify-center select-none"
      style={{ cursor: showControls ? 'default' : 'none' }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain"
        onClick={() => { const v = videoRef.current; v?.paused ? v.play() : v?.pause(); resetHide(); }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => { setCurrentTime(videoRef.current?.currentTime ?? 0); }}
        onDurationChange={() => setDuration(videoRef.current?.duration ?? 0)}
        onVolumeChange={() => { setVolume(videoRef.current?.volume ?? 1); setMuted(videoRef.current?.muted ?? false); }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onEnded={() => { syncProgress(); if (nextEpisode && onNext) onNext(); else onClose(); }}
        crossOrigin="anonymous"
      />

      {/* Buffering */}
      {(mode === 'loading' || buffering) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 rounded-full border-4 border-white/20 border-t-white/80 animate-spin" />
        </div>
      )}

      {/* MPV mode message */}
      {mode === 'mpv' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
          <MonitorPlay size={48} className="text-white/40" />
          <p className="text-white/60 text-sm">Riproduzione con mpv in corso...</p>
          <p className="text-white/30 text-xs">Il player esterno è aperto</p>
        </div>
      )}

      {/* Error */}
      {mode === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/90">
          <AlertCircle size={40} className="text-red-400" />
          <p className="text-white/60 text-sm text-center max-w-sm px-4">{errorMsg}</p>
          <button onClick={() => { syncProgress(); onClose(); }}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm transition-colors">
            Chiudi
          </button>
        </div>
      )}

      {/* Controls overlay */}
      {mode === 'html5' && (
        <div className={clsx('absolute inset-0 flex flex-col justify-between transition-opacity duration-300 pointer-events-none', showControls ? 'opacity-100' : 'opacity-0')}>
          {/* Top gradient + title */}
          <div className="pointer-events-auto flex items-start justify-between px-6 pt-5 pb-16" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)' }}>
            <div>
              {title && <p className="text-white font-semibold text-lg drop-shadow-lg">{title}</p>}
              {subtitle && <p className="text-white/50 text-sm">{subtitle}</p>}
            </div>
            <button onClick={() => { syncProgress(); onClose(); }}
              className="p-2 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white transition-colors mt-1">
              <X size={20} />
            </button>
          </div>

          {/* Bottom controls */}
          <div className="pointer-events-auto px-6 pb-6" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }}>
            {/* Progress bar */}
            <div ref={progressBarRef} onClick={handleProgressClick}
              className="relative w-full h-1 bg-white/20 rounded-full mb-5 cursor-pointer group/prog hover:h-1.5 transition-all">
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: 'var(--accent, #7c3aed)' }} />
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow opacity-0 group-hover/prog:opacity-100 transition-opacity"
                style={{ left: `${progress}%` }} />
            </div>

            <div className="flex items-center gap-4">
              {/* Skip -10 */}
              <button onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 10; }} className="text-white/70 hover:text-white transition-colors p-2">
                <SkipBack size={22} />
              </button>

              {/* Play/Pause */}
              <button onClick={() => { const v = videoRef.current; v?.paused ? v.play() : v?.pause(); }}
                className="w-12 h-12 rounded-full bg-white flex items-center justify-center hover:bg-white/90 transition-colors shadow-xl">
                {playing
                  ? <Pause size={22} className="fill-black text-black" />
                  : <Play size={22} className="fill-black text-black ml-1" />}
              </button>

              {/* Skip +10 */}
              <button onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10; }} className="text-white/70 hover:text-white transition-colors p-2">
                <SkipForward size={22} />
              </button>

              {/* Time */}
              <span className="text-white/50 text-xs font-mono tabular-nums">{formatTime(currentTime)} / {formatTime(duration)}</span>

              <div className="flex-1" />

              {/* Volume */}
              <div className="flex items-center gap-2">
                <button onClick={() => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; }} className="text-white/60 hover:text-white transition-colors">
                  {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input type="range" min={0} max={1} step={0.02} value={muted ? 0 : volume}
                  onChange={e => { if (videoRef.current) { videoRef.current.volume = +e.target.value; videoRef.current.muted = false; } }}
                  className="w-20 h-1 cursor-pointer accent-white" />
              </div>

              {/* Fullscreen */}
              <button onClick={toggleFS} className="text-white/60 hover:text-white transition-colors p-1.5">
                <Maximize size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Next episode card */}
      {showNextEp && nextEpisode && (
        <div className="absolute bottom-28 right-6 bg-[#1a1a1f]/95 border border-white/10 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl w-64">
          <div className="px-4 pt-3 pb-2">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Prossimo episodio</p>
            <p className="text-sm font-semibold text-white line-clamp-1">{nextEpisode.title}</p>
          </div>
          {nextEpisode.thumbnail && (
            <img src={nextEpisode.thumbnail} alt="" className="w-full h-32 object-cover" />
          )}
          <div className="flex gap-2 px-3 py-3">
            <button onClick={() => { syncProgress(); setShowNextEp(false); onNext?.(); }}
              className="flex-1 py-2 text-sm text-white rounded-xl font-medium transition-colors" style={{ backgroundColor: 'var(--accent)' }}>
              Guarda ora
            </button>
            <button onClick={() => setShowNextEp(false)}
              className="px-3 py-2 text-sm text-white/50 hover:text-white bg-white/5 rounded-xl transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
