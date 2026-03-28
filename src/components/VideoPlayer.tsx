/// <reference types="vite/client" />
/**
 * VideoPlayer v3
 * - HTML5 nativo per stream diretti HTTP
 * - mpv per tutto il resto (formato non supportato, CORS, ecc.)
 * - CW sync ogni 10s via IPC per mpv, nativo per HTML5
 * - Poster del contenuto come sfondo durante loading/mpv mode
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../lib/store';
import { upsertCW } from '../api/nuvio';
import { Play, Pause, Volume2, VolumeX, Maximize, X, SkipForward, SkipBack, AlertCircle, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

export interface VideoPlayerProps {
  url: string;
  title?: string;
  subtitle?: string;
  contentId?: string;
  contentType?: string;
  poster?: string;
  backdrop?: string;
  season?: number;
  episode?: number;
  nextEpisode?: { id: string; title: string; thumbnail?: string } | null;
  onClose: () => void;
  onNext?: () => void;
  initialProgress?: number;
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

export default function VideoPlayer(props: VideoPlayerProps) {
  const { url, title, subtitle, contentId, contentType, poster, backdrop, season, episode, nextEpisode, onClose, onNext, initialProgress = 0 } = props;

  const vidRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const syncTimer = useRef<ReturnType<typeof setInterval>>();
  const fallbackTimer = useRef<ReturnType<typeof setTimeout>>();
  const mpvSyncTimer = useRef<ReturnType<typeof setInterval>>();

  const { nuvioUser, upsertWatch } = useStore();
  const [mode, setMode] = useState<'loading' | 'html5' | 'mpv' | 'error'>('loading');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string|null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showNextEp, setShowNextEp] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [mpvTime, setMpvTime] = useState(0);
  const [mpvDuration, setMpvDuration] = useState(0);

  // ── Sync CW ────────────────────────────────────────────────────────────────
  const doSync = useCallback((time: number, dur: number) => {
    if (!contentId || dur < 5) return;
    const progress = time / dur;
    upsertWatch({ id: contentId, type: contentType ?? 'movie', name: title ?? '', poster, videoId: contentId, season, episode, progress, duration: dur });
    if (nuvioUser?.token && nuvioUser.id) {
      upsertCW(nuvioUser.id, { id: contentId, type: contentType ?? 'movie', name: title ?? '', poster, videoId: contentId, season, episode, progress, duration: dur }).catch(() => {});
    }
  }, [contentId, contentType, title, poster, season, episode, nuvioUser]);

  // Sync HTML5 ogni 10s
  useEffect(() => {
    syncTimer.current = setInterval(() => {
      if (mode === 'html5') doSync(vidRef.current?.currentTime ?? 0, vidRef.current?.duration ?? 0);
    }, 10000);
    return () => clearInterval(syncTimer.current);
  }, [mode, doSync]);

  // Sync MPV ogni 10s via IPC
  useEffect(() => {
    if (mode !== 'mpv') return;
    mpvSyncTimer.current = setInterval(async () => {
      try {
        const pos: number = await invoke('mpv_get_position');
        const dur: number = await invoke('mpv_get_duration');
        setMpvTime(pos || 0);
        setMpvDuration(dur || 0);
        if (dur > 5) doSync(pos, dur);
      } catch { /* mpv potrebbe essersi chiuso */ }
    }, 5000);
    return () => clearInterval(mpvSyncTimer.current);
  }, [mode, doSync]);

  // Fake loading bar
  useEffect(() => {
    if (mode !== 'loading') return;
    const t = setInterval(() => setLoadProgress(p => Math.min(p + (90 - p) * 0.06, 90)), 300);
    return () => clearInterval(t);
  }, [mode]);

  // ── Inizializza player ─────────────────────────────────────────────────────
  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    v.src = url;
    v.load();

    const onLoaded = () => {
      clearTimeout(fallbackTimer.current);
      setLoadProgress(100);
      setMode('html5');
      setBuffering(false);
      if (initialProgress > 0.01 && initialProgress < 0.97 && v.duration) {
        v.currentTime = v.duration * initialProgress;
      }
      v.play().catch(() => {});
    };

    const tryMpv = async () => {
      clearTimeout(fallbackTimer.current);
      v.removeEventListener('error', tryMpv);
      try {
        await invoke('launch_mpv', { url, title: title ?? null });
        setMode('mpv');
        setPlaying(true);
      } catch (e: any) {
        setErrorMsg(`Impossibile riprodurre: ${e?.message ?? 'errore'}`);
        setMode('error');
      }
    };

    v.addEventListener('loadedmetadata', onLoaded, { once: true });
    v.addEventListener('error', tryMpv, { once: true });
    fallbackTimer.current = setTimeout(tryMpv, 10000);

    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('error', tryMpv);
      clearTimeout(fallbackTimer.current);
    };
  }, [url]);

  // ── Fullscreen ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  // ── Near end → next episode ────────────────────────────────────────────────
  useEffect(() => {
    const t = mode === 'html5' ? currentTime : mpvTime;
    const d = mode === 'html5' ? duration : mpvDuration;
    if (d > 30 && (d - t) < 45 && nextEpisode) setShowNextEp(true);
  }, [currentTime, duration, mpvTime, mpvDuration, mode, nextEpisode]);

  function resetHide() {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    if (playing) hideTimer.current = setTimeout(() => setShowControls(false), 3500);
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const v = vidRef.current;
      if (mode === 'mpv') {
        if (e.key === 'Escape') { doSync(mpvTime, mpvDuration); invoke('mpv_stop').catch(()=>{}); onClose(); }
        return;
      }
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); v?.paused ? v.play() : v?.pause(); break;
        case 'ArrowRight': if (v) v.currentTime = Math.min(v.duration||0, v.currentTime + 10); break;
        case 'ArrowLeft':  if (v) v.currentTime = Math.max(0, v.currentTime - 10); break;
        case 'ArrowUp':    if (v) v.volume = Math.min(1, v.volume + 0.1); break;
        case 'ArrowDown':  if (v) v.volume = Math.max(0, v.volume - 0.1); break;
        case 'm': if (v) v.muted = !v.muted; break;
        case 'f': if (!document.fullscreenElement) containerRef.current?.requestFullscreen(); else document.exitFullscreen(); break;
        case 'Escape': if (!document.fullscreenElement) { doSync(v?.currentTime??0, v?.duration??0); onClose(); } break;
        case 'n': if (nextEpisode && onNext) { doSync(v?.currentTime??0, v?.duration??0); onNext(); } break;
      }
      resetHide();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [mode, mpvTime, mpvDuration, onClose, doSync, nextEpisode, onNext, playing]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bgImage = backdrop || poster;

  return (
    <div ref={containerRef} onMouseMove={resetHide}
      className="fixed inset-0 bg-black z-[100] flex items-center justify-center select-none"
      style={{ cursor: mode === 'html5' && !showControls ? 'none' : 'default' }}>

      {/* Poster BG per loading/mpv mode */}
      {(mode === 'loading' || mode === 'mpv') && bgImage && (
        <>
          <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-xl scale-110" />
          <div className="absolute inset-0 bg-black/70" />
        </>
      )}

      {/* Video element */}
      <video ref={vidRef}
        className={clsx('absolute inset-0 w-full h-full object-contain', mode !== 'html5' && 'invisible')}
        onClick={() => { vidRef.current?.paused ? vidRef.current.play() : vidRef.current?.pause(); resetHide(); }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => setCurrentTime(vidRef.current?.currentTime ?? 0)}
        onDurationChange={() => setDuration(vidRef.current?.duration ?? 0)}
        onVolumeChange={() => { setVolume(vidRef.current?.volume ?? 1); setMuted(vidRef.current?.muted ?? false); }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onEnded={() => { doSync(vidRef.current?.currentTime??0, vidRef.current?.duration??0); if (nextEpisode && onNext) onNext(); else onClose(); }}
        playsInline preload="auto"
      />

      {/* Loading overlay */}
      {mode === 'loading' && (
        <div className="relative z-10 flex flex-col items-center gap-5">
          {poster && <img src={poster} alt={title} className="h-44 rounded-2xl shadow-2xl object-cover" />}
          <div className="text-center">
            {title && <p className="text-white font-semibold text-lg">{title}</p>}
            {subtitle && <p className="text-white/50 text-sm mt-0.5">{subtitle}</p>}
          </div>
          <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white/80 rounded-full transition-all duration-300" style={{ width: `${loadProgress}%` }} />
          </div>
          <p className="text-white/30 text-xs">Caricamento stream...</p>
          <button onClick={() => { clearTimeout(fallbackTimer.current); onClose(); }}
            className="mt-1 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white text-sm transition-colors flex items-center gap-2">
            <X size={13} />Annulla
          </button>
        </div>
      )}

      {/* MPV mode */}
      {mode === 'mpv' && (
        <div className="relative z-10 flex flex-col items-center gap-5">
          {poster && <img src={poster} alt={title} className="h-40 rounded-2xl shadow-2xl object-cover" />}
          <div className="text-center">
            {title && <p className="text-white font-semibold text-lg">{title}</p>}
            <p className="text-white/50 text-sm mt-0.5">Riproduzione in corso con mpv</p>
            {mpvDuration > 0 && (
              <p className="text-white/30 text-xs mt-1">{fmt(mpvTime)} / {fmt(mpvDuration)}</p>
            )}
          </div>
          <div className="flex items-center gap-2 text-white/40 text-xs">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />Player esterno aperto
          </div>
          <button onClick={() => { doSync(mpvTime, mpvDuration); invoke('mpv_stop').catch(()=>{}); onClose(); }}
            className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm flex items-center gap-2 transition-colors">
            <ArrowLeft size={14} />Torna indietro
          </button>
        </div>
      )}

      {/* Error */}
      {mode === 'error' && (
        <div className="flex flex-col items-center gap-5">
          <AlertCircle size={40} className="text-red-400" />
          <p className="text-white/60 text-sm text-center max-w-sm px-4">{errorMsg}</p>
          <button onClick={() => onClose()} className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm">Indietro</button>
        </div>
      )}

      {/* HTML5 buffering */}
      {mode === 'html5' && buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white/80 animate-spin" />
        </div>
      )}

      {/* HTML5 Controls */}
      {mode === 'html5' && (
        <div className={clsx('absolute inset-0 flex flex-col justify-between transition-opacity duration-300 pointer-events-none', showControls ? 'opacity-100' : 'opacity-0')}>
          <div className="pointer-events-auto flex items-start justify-between px-6 pt-5 pb-16"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)' }}>
            <div>
              {title && <p className="text-white font-semibold text-lg">{title}</p>}
              {subtitle && <p className="text-white/50 text-sm">{subtitle}</p>}
            </div>
            <button onClick={() => { doSync(vidRef.current?.currentTime??0, vidRef.current?.duration??0); onClose(); }}
              className="p-2 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="pointer-events-auto px-6 pb-6"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }}>
            {/* Progress bar */}
            <div ref={progRef} onClick={e => {
              const v = vidRef.current; const b = progRef.current;
              if (!v || !b || !v.duration) return;
              v.currentTime = ((e.clientX - b.getBoundingClientRect().left) / b.clientWidth) * v.duration;
            }} className="relative w-full h-1 bg-white/20 rounded-full mb-5 cursor-pointer group/p hover:h-1.5 transition-all">
              <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: 'var(--accent,#7c3aed)' }} />
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow opacity-0 group-hover/p:opacity-100 transition-opacity"
                style={{ left: `${progress}%` }} />
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => { if (vidRef.current) vidRef.current.currentTime -= 10; }} className="text-white/70 hover:text-white p-2"><SkipBack size={22} /></button>
              <button onClick={() => { const v = vidRef.current; v?.paused ? v.play() : v?.pause(); }}
                className="w-12 h-12 rounded-full bg-white flex items-center justify-center hover:bg-white/90 transition-colors">
                {playing ? <Pause size={22} className="fill-black text-black" /> : <Play size={22} className="fill-black text-black ml-0.5" />}
              </button>
              <button onClick={() => { if (vidRef.current) vidRef.current.currentTime += 10; }} className="text-white/70 hover:text-white p-2"><SkipForward size={22} /></button>
              <span className="text-white/50 text-xs font-mono tabular-nums">{fmt(currentTime)} / {fmt(duration)}</span>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <button onClick={() => { if (vidRef.current) vidRef.current.muted = !vidRef.current.muted; }} className="text-white/60 hover:text-white">
                  {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input type="range" min={0} max={1} step={0.02} value={muted ? 0 : volume}
                  onChange={e => { if (vidRef.current) { vidRef.current.volume = +e.target.value; vidRef.current.muted = false; } }}
                  className="w-20 h-1 cursor-pointer accent-white" />
              </div>
              <button onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen(); else document.exitFullscreen(); }}
                className="text-white/60 hover:text-white p-1.5"><Maximize size={18} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Next episode card */}
      {showNextEp && nextEpisode && (
        <div className="absolute bottom-28 right-6 bg-[#1a1a1f]/95 border border-white/10 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl w-64 z-20">
          <div className="px-4 pt-3 pb-2">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Prossimo episodio</p>
            <p className="text-sm font-semibold text-white line-clamp-1">{nextEpisode.title}</p>
          </div>
          {nextEpisode.thumbnail && <img src={nextEpisode.thumbnail} alt="" className="w-full h-32 object-cover" />}
          <div className="flex gap-2 px-3 py-3">
            <button onClick={() => { doSync(vidRef.current?.currentTime??0, vidRef.current?.duration??0); setShowNextEp(false); onNext?.(); }}
              className="flex-1 py-2 text-sm text-white rounded-xl font-medium" style={{ backgroundColor: 'var(--accent)' }}>
              Guarda ora
            </button>
            <button onClick={() => setShowNextEp(false)} className="px-3 py-2 text-white/50 hover:text-white bg-white/5 rounded-xl"><X size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
