/// <reference types="vite/client" />
/**
 * VideoPlayer v5 — Stremio-like instant playback
 * 
 * Flusso:
 * 1. URL HTTP/HTTPS con RealDebrid → HTML5 <video> istantaneo (2s come Stremio)
 * 2. magnet: → WebTorrent streaming P2P progressivo
 * 3. Fallback → mpv esterno
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../lib/store';
import { upsertCW } from '../api/nuvio';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, X,
  SkipForward, SkipBack, AlertCircle, ArrowLeft,
  Download, Users, ExternalLink, Settings2,
} from 'lucide-react';
import clsx from 'clsx';
import { removeTorrent } from '../lib/torrent';

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

type Mode = 'starting' | 'playing' | 'mpv' | 'error';

export default function VideoPlayer(props: VideoPlayerProps) {
  const { url, title, subtitle, contentId, contentType, poster, backdrop, season, episode, nextEpisode, onClose, onNext, initialProgress = 0 } = props;

  const vidRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progBarRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const cwTimer = useRef<ReturnType<typeof setInterval>>();
  const mpvTimer = useRef<ReturnType<typeof setInterval>>();
  const torrentHash = useRef<string | null>(null);

  const { nuvioUser, upsertWatch, settings } = useStore();
  const [mode, setMode] = useState<Mode>('starting');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showNextEp, setShowNextEp] = useState(false);
  const [mpvTime, setMpvTime] = useState(0);
  const [mpvDur, setMpvDur] = useState(0);

  // ── CW sync ──────────────────────────────────────────────────────────────
  const syncCW = useCallback((t: number, d: number) => {
    if (!contentId || d < 5) return;
    const progress = t / d;
    upsertWatch({ id: contentId, type: contentType ?? 'movie', name: title ?? '', poster, videoId: contentId, season, episode, progress, duration: d });
    if (nuvioUser?.token && nuvioUser.id) {
      upsertCW(nuvioUser.id, { id: contentId, type: contentType ?? 'movie', name: title ?? '', poster, videoId: contentId, season, episode, progress, duration: d }).catch(() => {});
    }
  }, [contentId, contentType, title, poster, season, episode, nuvioUser]);

  // CW sync ogni 15s
  useEffect(() => {
    cwTimer.current = setInterval(() => {
      if (mode === 'playing') syncCW(vidRef.current?.currentTime ?? 0, vidRef.current?.duration ?? 0);
    }, 5000);
    return () => clearInterval(cwTimer.current);
  }, [mode, syncCW]);

  // MPV position poll
  useEffect(() => {
    if (mode !== 'mpv') return;
    mpvTimer.current = setInterval(async () => {
      try {
        const pos = await invoke<number>('mpv_get_position');
        const dur = await invoke<number>('mpv_get_duration');
        setMpvTime(pos); setMpvDur(dur);
        if (dur > 5) syncCW(pos, dur);
      } catch { }
    }, 5000);
    return () => clearInterval(mpvTimer.current);
  }, [mode, syncCW]);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const isMagnet = url.startsWith('magnet:');
    if (isMagnet) {
      initTorrent(url);
    } else {
      // HTTP/HTTPS: carica subito nel <video> - nessun timeout,
      // l'evento loadedmetadata parte in 1-3s con RealDebrid
      initHTML5(url);
    }
    return () => {
      clearTimeout(hideTimer.current);
      if (torrentHash.current) removeTorrent(torrentHash.current).catch(() => {});
    };
  }, [url]);

  function initHTML5(streamUrl: string) {
    const v = vidRef.current;
    if (!v) return;

    // Imposta headers per compatibilità CDN
    v.src = streamUrl;
    v.preload = 'auto';
    v.load();
    v.play().catch(() => {});
    setMode('playing');

    // Se non riesce dopo 20s → mpv
    const t = setTimeout(() => {
      if (v.readyState < 2) tryMpv(streamUrl);
    }, 20000);

    v.addEventListener('loadeddata', () => clearTimeout(t), { once: true });
    v.addEventListener('error', () => { clearTimeout(t); tryMpv(streamUrl); }, { once: true });
  }

  async function initTorrent(magnetUri: string) {
    // I magnet link vengono gestiti da mpv (supporto nativo se c'è un client torrent)
    // oppure dall'utente che configura Real-Debrid in Torrentio per avere stream HTTP diretti
    await tryMpv(magnetUri, undefined);
  }

  async function tryMpv(streamUrl: string, reason?: string) {
    try {
      const custom = (settings as any).customPlayerPath?.trim();
      if (custom) {
        await invoke('launch_custom_player', { playerPath: custom, url: streamUrl, title: title ?? null });
      } else {
        await invoke('launch_mpv', { url: streamUrl, title: title ?? null });
      }
      setMode('mpv');
    } catch (e: any) {
      setErrorMsg(`Impossibile riprodurre.\n${reason ? reason + '\n' : ''}Installa mpv nella cartella dell'app oppure usa Real-Debrid con Torrentio per stream diretti.`);
      setMode('error');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  useEffect(() => {
    const t = mode === 'playing' ? currentTime : mpvTime;
    const d = mode === 'playing' ? duration : mpvDur;
    if (d > 30 && (d - t) < 40 && nextEpisode) setShowNextEp(true);
  }, [currentTime, duration, mpvTime, mpvDur, mode, nextEpisode]);

  function resetHide() {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    if (playing) hideTimer.current = setTimeout(() => setShowControls(false), 3500);
  }

  function handleClose() {
    const t = vidRef.current?.currentTime ?? mpvTime;
    const d = vidRef.current?.duration ?? mpvDur;
    syncCW(t, d);
    if (mode === 'mpv') invoke('mpv_stop').catch(() => {});
    if (torrentHash.current) removeTorrent(torrentHash.current).catch(() => {});
    onClose();
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const v = vidRef.current; const b = progBarRef.current;
    if (!v || !b || !v.duration) return;
    v.currentTime = ((e.clientX - b.getBoundingClientRect().left) / b.clientWidth) * v.duration;
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const v = vidRef.current;
      if (mode === 'mpv') {
        if (e.key === 'Escape') handleClose();
        return;
      }
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
  }, [mode, mpvTime, mpvDur, playing]);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bgImg = backdrop || poster;

  return (
    <div ref={containerRef} onMouseMove={resetHide}
      className="fixed inset-0 bg-black z-[100] flex items-center justify-center select-none"
      style={{ cursor: mode === 'playing' && !showControls ? 'none' : 'default' }}>

      {/* Poster BG (torrent/mpv/starting) */}
      {mode !== 'playing' && bgImg && (
        <>
          <img src={bgImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15 blur-2xl scale-110" />
          <div className="absolute inset-0 bg-black/75" />
        </>
      )}

      {/* VIDEO — sempre presente, visibile solo in playing */}
      <video ref={vidRef}
        className={clsx('absolute inset-0 w-full h-full object-contain', mode !== 'playing' && 'invisible')}
        onClick={() => { vidRef.current?.paused ? vidRef.current.play() : vidRef.current?.pause(); resetHide(); }}
        onPlay={() => {
          setPlaying(true); setBuffering(false);
          // Sync subito all'avvio per registrare che si sta guardando
          setTimeout(() => syncCW(vidRef.current?.currentTime ?? 0, vidRef.current?.duration ?? 0), 2000);
        }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onTimeUpdate={() => setCurrentTime(vidRef.current?.currentTime ?? 0)}
        onDurationChange={() => setDuration(vidRef.current?.duration ?? 0)}
        onVolumeChange={() => { setVolume(vidRef.current?.volume ?? 1); setMuted(vidRef.current?.muted ?? false); }}
        onEnded={() => { syncCW(vidRef.current?.currentTime??0, vidRef.current?.duration??0); if (nextEpisode && onNext) onNext(); else handleClose(); }}
        playsInline preload="auto"
      />

      {/* ── Starting (HTTP: quasi istantaneo) ─────────────────────────── */}
      {mode === 'starting' && (
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Avvio stream...</p>
        </div>
      )}

      {/* ── Torrent loading ───────────────────────────────────────────── */}


      {/* ── MPV mode ─────────────────────────────────────────────────── */}
      {mode === 'mpv' && (
        <div className="relative z-10 flex flex-col items-center gap-5">
          {poster && <img src={poster} alt={title} className="h-36 rounded-xl shadow-2xl object-cover" />}
          <div className="text-center">
            {title && <p className="text-white font-semibold text-lg">{title}</p>}
            <p className="text-white/50 text-sm">Riproduzione con mpv</p>
            {mpvDur > 0 && <p className="text-white/30 text-xs mt-1 font-mono">{fmt(mpvTime)} / {fmt(mpvDur)}</p>}
          </div>
          {mpvDur > 0 && (
            <div className="w-52 h-1 bg-white/15 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${(mpvTime/mpvDur)*100}%`, backgroundColor: 'var(--accent)' }} />
            </div>
          )}
          <div className="flex items-center gap-2 text-green-400/70 text-xs">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />In riproduzione
          </div>
          <button onClick={handleClose} className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm flex items-center gap-2">
            <ArrowLeft size={14} />Torna indietro
          </button>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────── */}
      {mode === 'error' && (
        <div className="flex flex-col items-center gap-5 max-w-sm text-center px-6">
          <AlertCircle size={36} className="text-red-400" />
          <p className="text-white/60 text-sm whitespace-pre-line leading-relaxed">{errorMsg}</p>
          <div className="flex flex-col gap-2 w-full">
            <button onClick={() => invoke('open_url', { url: 'https://torrentio.strem.fun/configure' })}
              className="w-full flex items-center gap-2 justify-center px-4 py-2.5 bg-[color:var(--accent)] text-white rounded-full text-sm font-medium">
              <ExternalLink size={13} />Configura Torrentio + Real-Debrid
            </button>
            <button onClick={() => invoke('open_url', { url: 'https://mpv.io/installation/' })}
              className="w-full flex items-center gap-2 justify-center px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white/70 rounded-full text-sm">
              <Download size={13} />Scarica mpv
            </button>
            <button onClick={handleClose} className="text-white/40 text-sm hover:text-white">Indietro</button>
          </div>
        </div>
      )}

      {/* ── Buffering spinner (HTML5) ─────────────────────────────────── */}
      {mode === 'playing' && buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white/80 animate-spin" />
        </div>
      )}

      {/* ── Controls (HTML5) ─────────────────────────────────────────── */}
      {mode === 'playing' && (
        <div className={clsx('absolute inset-0 flex flex-col justify-between transition-opacity duration-300 pointer-events-none', showControls ? 'opacity-100' : 'opacity-0')}>

          {/* Top bar */}
          <div className="pointer-events-auto flex items-center justify-between px-5 pt-4 pb-16"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)' }}>
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

          {/* Bottom controls */}
          <div className="pointer-events-auto px-5 pb-5"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}>

            {/* Progress bar */}
            <div ref={progBarRef} onClick={seek}
              className="relative w-full h-1 bg-white/25 rounded-full mb-4 cursor-pointer group/prog"
              style={{ paddingTop: 8, paddingBottom: 8, marginBottom: 12 }}
              onMouseEnter={e => (e.currentTarget.style.paddingTop = '6px')}
              onMouseLeave={e => (e.currentTarget.style.paddingTop = '8px')}>
              <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                <div className="w-full h-1 bg-white/20 rounded-full group-hover/prog:h-1.5 transition-all overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: 'var(--accent,#7c3aed)' }} />
                </div>
              </div>
              {/* Thumb */}
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-lg opacity-0 group-hover/prog:opacity-100 transition-opacity pointer-events-none"
                style={{ left: `${pct}%` }} />
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3">
              <button onClick={() => { if (vidRef.current) vidRef.current.currentTime -= 10; }} className="text-white/70 hover:text-white p-1.5 transition-colors">
                <SkipBack size={22} />
              </button>
              <button onClick={() => { const v = vidRef.current; v?.paused ? v.play() : v?.pause(); }}
                className="w-11 h-11 rounded-full bg-white flex items-center justify-center hover:bg-white/90 shadow-lg transition-colors flex-shrink-0">
                {playing
                  ? <Pause size={20} className="fill-black text-black" />
                  : <Play size={20} className="fill-black text-black ml-0.5" />}
              </button>
              <button onClick={() => { if (vidRef.current) vidRef.current.currentTime += 10; }} className="text-white/70 hover:text-white p-1.5 transition-colors">
                <SkipForward size={22} />
              </button>

              <span className="text-white/50 text-xs font-mono tabular-nums ml-1">
                {fmt(currentTime)} / {fmt(duration)}
              </span>

              <div className="flex-1" />

              {/* Volume */}
              <div className="flex items-center gap-2">
                <button onClick={() => { if (vidRef.current) vidRef.current.muted = !vidRef.current.muted; }} className="text-white/60 hover:text-white transition-colors">
                  {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input type="range" min={0} max={1} step={0.02} value={muted ? 0 : volume}
                  onChange={e => { if (vidRef.current) { vidRef.current.volume = +e.target.value; vidRef.current.muted = false; } }}
                  className="w-20 h-1 cursor-pointer accent-white" />
              </div>

              {/* Fullscreen */}
              <button
                onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen().catch(()=>{}); else document.exitFullscreen(); }}
                className="text-white/60 hover:text-white p-1.5 transition-colors">
                {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Next episode card ─────────────────────────────────────────── */}
      {showNextEp && nextEpisode && (
        <div className="absolute bottom-24 right-5 bg-[#18181d]/95 border border-white/10 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl w-60 z-20">
          <div className="px-4 pt-3 pb-2">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">Prossimo episodio</p>
            <p className="text-sm font-semibold text-white line-clamp-2">{nextEpisode.title}</p>
          </div>
          {nextEpisode.thumbnail && <img src={nextEpisode.thumbnail} alt="" className="w-full h-28 object-cover" />}
          <div className="flex gap-2 p-3">
            <button onClick={() => { syncCW(vidRef.current?.currentTime??0, vidRef.current?.duration??0); setShowNextEp(false); onNext?.(); }}
              className="flex-1 py-2 text-sm text-white rounded-xl font-medium transition-colors" style={{ backgroundColor: 'var(--accent)' }}>
              Guarda ora
            </button>
            <button onClick={() => setShowNextEp(false)} className="px-3 py-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
