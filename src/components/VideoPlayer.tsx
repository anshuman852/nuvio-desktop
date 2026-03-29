/// <reference types="vite/client" />
/**
 * VideoPlayer v7 — 100% interno, nessun player esterno
 * HTTP/HTTPS → HTML5 <video> diretto (istantaneo con RealDebrid)
 * Magnet → errore con istruzioni per configurare Debrid
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../lib/store';
import { upsertCW } from '../api/nuvio';
import { stopTorrent } from '../lib/torrent';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, X,
  SkipForward, SkipBack, AlertCircle, ArrowLeft, ExternalLink, Settings,
} from 'lucide-react';
import clsx from 'clsx';
import { invoke } from '@tauri-apps/api/core';

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

type Mode = 'playing' | 'magnet_error' | 'load_error';

export default function VideoPlayer(props: VideoPlayerProps) {
  const { url, title, subtitle, contentId, contentType, poster, backdrop, season, episode, nextEpisode, onClose, onNext, initialProgress = 0 } = props;

  const vidRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const cwTimer = useRef<ReturnType<typeof setInterval>>();
  const torrentHash = useRef<string | null>(null);

  const { nuvioUser, upsertWatch } = useStore();
  const [mode, setMode] = useState<Mode>('playing');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [showNextEp, setShowNextEp] = useState(false);
  const [errorDetail, setErrorDetail] = useState('');

  // ── CW Sync ───────────────────────────────────────────────────────────────
  const syncCW = useCallback((t: number, d: number) => {
    if (!contentId || d < 5) return;
    const progress = t / d;
    upsertWatch({ id: contentId, type: contentType ?? 'movie', name: title ?? '', poster, videoId: contentId, season, episode, progress, duration: d });
    if (nuvioUser?.token && nuvioUser.id)
      upsertCW(nuvioUser.id, { id: contentId, type: contentType ?? 'movie', name: title ?? '', poster, videoId: contentId, season, episode, progress, duration: d }).catch(() => {});
  }, [contentId, contentType, title, poster, season, episode, nuvioUser]);

  useEffect(() => {
    cwTimer.current = setInterval(() => {
      if (mode === 'playing') syncCW(vidRef.current?.currentTime ?? 0, vidRef.current?.duration ?? 0);
    }, 5000);
    return () => clearInterval(cwTimer.current);
  }, [mode, syncCW]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const isMagnet = url.startsWith('magnet:');
    if (isMagnet) {
      setMode('magnet_error');
      return;
    }

    // HTTP/HTTPS → HTML5 diretto
    const v = vidRef.current;
    if (!v) return;
    v.src = url;
    v.preload = 'auto';
    v.load();
    // Tenta play — il browser inizia il buffering subito
    v.play().catch(() => setBuffering(true));

    if (initialProgress > 0.01 && initialProgress < 0.97) {
      const onMeta = () => {
        if (v.duration) v.currentTime = v.duration * initialProgress;
      };
      v.addEventListener('loadedmetadata', onMeta, { once: true });
    }

    v.addEventListener('error', () => {
      const err = v.error;
      setErrorDetail(err ? `Codice ${err.code}: ${err.message}` : 'Formato non supportato');
      setMode('load_error');
    }, { once: true });

    return () => {
      clearTimeout(hideTimer.current);
    };
  }, [url]);

  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  useEffect(() => {
    if (duration > 30 && (duration - currentTime) < 40 && nextEpisode) setShowNextEp(true);
  }, [currentTime, duration, nextEpisode]);

  function resetHide() {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    if (playing) hideTimer.current = setTimeout(() => setShowControls(false), 3500);
  }

  function handleClose() {
    syncCW(vidRef.current?.currentTime ?? 0, vidRef.current?.duration ?? 0);
    if (torrentHash.current) stopTorrent(torrentHash.current).catch(() => {});
    onClose();
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const v = vidRef.current;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); v?.paused ? v.play() : v?.pause(); break;
        case 'ArrowRight': if (v) v.currentTime = Math.min(v.duration || 0, v.currentTime + 10); break;
        case 'ArrowLeft':  if (v) v.currentTime = Math.max(0, v.currentTime - 10); break;
        case 'ArrowUp':    if (v) v.volume = Math.min(1, v.volume + 0.1); break;
        case 'ArrowDown':  if (v) v.volume = Math.max(0, v.volume - 0.1); break;
        case 'm': if (v) v.muted = !v.muted; break;
        case 'f': if (!document.fullscreenElement) containerRef.current?.requestFullscreen(); else document.exitFullscreen(); break;
        case 'Escape': if (!document.fullscreenElement) handleClose(); break;
        case 'n': if (nextEpisode && onNext) { syncCW(v?.currentTime??0, v?.duration??0); onNext(); } break;
      }
      resetHide();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [playing, nextEpisode, onNext]);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bgImg = backdrop || poster;

  // ── Magnet error ──────────────────────────────────────────────────────────
  if (mode === 'magnet_error') {
    return (
      <div className="fixed inset-0 bg-[#0c0c10] z-[100] flex items-center justify-center">
        {bgImg && <><img src={bgImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10 blur-2xl scale-110" /><div className="absolute inset-0 bg-black/80" /></>}
        <div className="relative z-10 flex flex-col items-center gap-6 max-w-md text-center px-8">
          {poster && <img src={poster} alt={title} className="h-32 rounded-xl shadow-2xl object-cover" />}
          {title && <p className="text-white font-bold text-xl">{title}</p>}
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-5 space-y-3 text-left">
            <p className="text-amber-300 font-semibold text-sm">🧲 Stream torrent rilevato</p>
            <p className="text-white/60 text-sm leading-relaxed">
              Questo stream è un magnet link. Per riprodurlo <strong className="text-white">istantaneamente nel player interno</strong>, configura <strong className="text-white">Real-Debrid</strong> o <strong className="text-white">AllDebrid</strong> nell'addon Torrentio — convertirà automaticamente i torrent in stream HTTP diretti.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button onClick={() => invoke('open_url', { url: 'https://torrentio.strem.fun/configure' })}
                className="flex items-center gap-2 justify-center w-full py-2.5 text-sm font-medium text-white rounded-xl" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
                <Settings size={14} />Configura Torrentio + Real-Debrid
              </button>
              <button onClick={() => invoke('open_url', { url: 'https://real-debrid.com' })}
                className="flex items-center gap-2 justify-center w-full py-2 text-sm text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                <ExternalLink size={13} />Ottieni Real-Debrid
              </button>
            </div>
          </div>
          <button onClick={handleClose} className="text-white/40 hover:text-white text-sm flex items-center gap-1.5 transition-colors">
            <ArrowLeft size={14} />Torna agli stream
          </button>
        </div>
      </div>
    );
  }

  // ── Load error ────────────────────────────────────────────────────────────
  if (mode === 'load_error') {
    return (
      <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center">
        {bgImg && <><img src={bgImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10 blur-2xl scale-110" /><div className="absolute inset-0 bg-black/80" /></>}
        <div className="relative z-10 flex flex-col items-center gap-5 max-w-sm text-center px-6">
          <AlertCircle size={40} className="text-red-400" />
          <div>
            <p className="text-white font-semibold mb-1">Impossibile riprodurre lo stream</p>
            <p className="text-white/40 text-sm">{errorDetail}</p>
          </div>
          <p className="text-white/50 text-xs leading-relaxed">
            Prova un altro stream oppure configura Real-Debrid in Torrentio per stream diretti ad alta qualità.
          </p>
          <div className="flex gap-2">
            <button onClick={() => invoke('open_url', { url: 'https://torrentio.strem.fun/configure' })}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white rounded-full" style={{ backgroundColor: 'var(--accent)' }}>
              <Settings size={13} />Configura Torrentio
            </button>
            <button onClick={handleClose} className="px-4 py-2 text-sm text-white/60 bg-white/10 hover:bg-white/20 rounded-full">Indietro</button>
          </div>
        </div>
      </div>
    );
  }

  // ── HTML5 Player ──────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} onMouseMove={resetHide}
      className="fixed inset-0 bg-black z-[100] flex items-center justify-center select-none"
      style={{ cursor: !showControls ? 'none' : 'default' }}>

      <video ref={vidRef}
        className="absolute inset-0 w-full h-full object-contain"
        onClick={() => { vidRef.current?.paused ? vidRef.current.play() : vidRef.current?.pause(); resetHide(); }}
        onPlay={() => { setPlaying(true); setBuffering(false); setTimeout(() => syncCW(vidRef.current?.currentTime??0, vidRef.current?.duration??0), 2000); }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onTimeUpdate={() => setCurrentTime(vidRef.current?.currentTime ?? 0)}
        onDurationChange={() => setDuration(vidRef.current?.duration ?? 0)}
        onVolumeChange={() => { setVolume(vidRef.current?.volume ?? 1); setMuted(vidRef.current?.muted ?? false); }}
        onEnded={() => { syncCW(vidRef.current?.currentTime??0, vidRef.current?.duration??0); if (nextEpisode && onNext) onNext(); else handleClose(); }}
        playsInline preload="auto"
      />

      {/* Buffering */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white/80 animate-spin" />
        </div>
      )}

      {/* Controls */}
      <div className={clsx('absolute inset-0 flex flex-col justify-between transition-opacity duration-300 pointer-events-none', showControls ? 'opacity-100' : 'opacity-0')}>
        {/* Top */}
        <div className="pointer-events-auto flex items-center justify-between px-5 pt-4 pb-16"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)' }}>
          <div className="flex items-center gap-3">
            <button onClick={handleClose} className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              {title && <p className="text-white font-semibold leading-tight">{title}</p>}
              {subtitle && <p className="text-white/50 text-xs">{subtitle}</p>}
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Bottom */}
        <div className="pointer-events-auto px-5 pb-5"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}>
          {/* Progress */}
          <div ref={progRef} onClick={e => {
            const v = vidRef.current; const b = progRef.current;
            if (!v || !b || !v.duration) return;
            v.currentTime = ((e.clientX - b.getBoundingClientRect().left) / b.clientWidth) * v.duration;
          }} className="relative w-full h-1 bg-white/25 rounded-full mb-4 cursor-pointer group/prog hover:h-1.5 transition-all">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: 'var(--accent,#7c3aed)' }} />
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow opacity-0 group-hover/prog:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `${pct}%` }} />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3">
            <button onClick={() => { if (vidRef.current) vidRef.current.currentTime -= 10; }} className="text-white/70 hover:text-white p-1.5"><SkipBack size={22} /></button>
            <button onClick={() => { const v = vidRef.current; v?.paused ? v.play() : v?.pause(); }}
              className="w-11 h-11 rounded-full bg-white flex items-center justify-center hover:bg-white/90 shadow-lg">
              {playing ? <Pause size={20} className="fill-black text-black" /> : <Play size={20} className="fill-black text-black ml-0.5" />}
            </button>
            <button onClick={() => { if (vidRef.current) vidRef.current.currentTime += 10; }} className="text-white/70 hover:text-white p-1.5"><SkipForward size={22} /></button>
            <span className="text-white/50 text-xs font-mono tabular-nums">{fmt(currentTime)} / {fmt(duration)}</span>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <button onClick={() => { if (vidRef.current) vidRef.current.muted = !vidRef.current.muted; }} className="text-white/60 hover:text-white transition-colors">
                {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input type="range" min={0} max={1} step={0.02} value={muted ? 0 : volume}
                onChange={e => { if (vidRef.current) { vidRef.current.volume = +e.target.value; vidRef.current.muted = false; } }}
                className="w-20 h-1 cursor-pointer accent-white" />
            </div>
            <button onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen(); else document.exitFullscreen(); }}
              className="text-white/60 hover:text-white p-1.5">
              {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Next episode */}
      {showNextEp && nextEpisode && (
        <div className="absolute bottom-24 right-5 bg-[#18181d]/95 border border-white/10 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl w-60 z-20">
          <div className="px-4 pt-3 pb-2">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">Prossimo episodio</p>
            <p className="text-sm font-semibold text-white line-clamp-2">{nextEpisode.title}</p>
          </div>
          {nextEpisode.thumbnail && <img src={nextEpisode.thumbnail} alt="" className="w-full h-28 object-cover" />}
          <div className="flex gap-2 p-3">
            <button onClick={() => { syncCW(vidRef.current?.currentTime??0, vidRef.current?.duration??0); setShowNextEp(false); onNext?.(); }}
              className="flex-1 py-2 text-sm text-white rounded-xl font-medium" style={{ backgroundColor: 'var(--accent)' }}>Guarda ora</button>
            <button onClick={() => setShowNextEp(false)} className="px-3 py-2 text-white/50 bg-white/5 rounded-xl"><X size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
