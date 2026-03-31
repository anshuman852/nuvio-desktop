/// <reference types="vite/client" />
/**
 * NuvioPlayer v9 — Player intelligente completo
 * - Auto-hide controlli dopo 5s
 * - Sottotitoli + tracce audio
 * - Film: play/pausa/stop; Serie: prev/next episodio
 * - Selezione qualità in-player
 * - Pause screen con poster + cast
 * - Player personalizzabile via opzioni
 * - Next episode popup a 35s dalla fine
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../lib/store';
import { upsertCW, traktScrobble } from '../api/nuvio';
import { invoke } from '@tauri-apps/api/core';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, X,
  SkipForward, SkipBack, AlertCircle, ArrowLeft, ExternalLink,
  Settings, ChevronLeft, ChevronRight, Subtitles, Music2,
  Sliders, Check, ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';

export interface VideoPlayerProps {
  url: string;
  title?: string;
  subtitle?: string;                  // es. "S1E3 · Titolo"
  contentId?: string;
  contentType?: string;
  poster?: string;
  backdrop?: string;
  cast?: { name: string; character?: string; photo?: string }[];
  season?: number;
  episode?: number;
  episodeTitle?: string;
  nextEpisode?: { id: string; title: string; thumbnail?: string; streamUrl?: string } | null;
  prevEpisode?: { id: string; title: string } | null;
  availableQualities?: { label: string; url: string }[];
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  initialProgress?: number;
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

type Panel = null | 'subtitles' | 'audio' | 'quality' | 'settings';

interface PlayerPrefs {
  autoHideDelay: number;   // ms
  autoNextEpDelay: number; // secondi dalla fine
  showCastOnPause: boolean;
  showNextEpPopup: boolean;
  autoNextEp: boolean;
}

const DEFAULT_PREFS: PlayerPrefs = {
  autoHideDelay: 5000,
  autoNextEpDelay: 35,
  showCastOnPause: true,
  showNextEpPopup: true,
  autoNextEp: false,
};

export default function VideoPlayer(props: VideoPlayerProps) {
  const {
    url, title, subtitle, contentId, contentType, poster, backdrop, cast = [],
    season, episode, episodeTitle, nextEpisode, prevEpisode,
    availableQualities = [], onClose, onNext, onPrev, initialProgress = 0,
  } = props;

  const isSeries = contentType === 'series' || (season != null && episode != null);
  const isMagnet = url.startsWith('magnet:');

  const vidRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const cwTimer = useRef<ReturnType<typeof setInterval>>();
  const nextEpTimer = useRef<ReturnType<typeof setTimeout>>();

  const { nuvioUser, upsertWatch, settings: appSettings, traktAuth } = useStore();

  // Player prefs (personalizzabili in-player)
  const [prefs, setPrefs] = useState<PlayerPrefs>({
    ...DEFAULT_PREFS,
    autoHideDelay: ((appSettings as any).playerAutoHideMs ?? 5000),
    autoNextEpDelay: ((appSettings as any).nextEpDelay ?? 35),
  });

  // Stato video
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI
  const [showControls, setShowControls] = useState(true);
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [showNextEpCard, setShowNextEpCard] = useState(false);
  const [nextEpTriggered, setNextEpTriggered] = useState(false);
  const [currentQuality, setCurrentQuality] = useState(availableQualities[0]?.label ?? 'Auto');

  // Tracks
  const [audioTracks, setAudioTracks] = useState<{ id: number; label: string; lang: string }[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<{ id: number; label: string; lang: string }[]>([]);
  const [activeAudio, setActiveAudio] = useState<number>(-1);
  const [activeSubtitle, setActiveSubtitle] = useState<number>(-1);

  // ── CW Sync ────────────────────────────────────────────────────────────────
  const syncCW = useCallback((t: number, d: number) => {
    if (!contentId || d < 5) return;
    const progress = t / d;
    upsertWatch({ id: contentId, type: contentType ?? 'movie', name: title ?? '', poster, videoId: contentId, season, episode, progress, duration: d });
    if (nuvioUser?.token && nuvioUser.id)
      upsertCW(nuvioUser.id, { id: contentId, type: contentType ?? 'movie', name: title ?? '', poster, videoId: contentId, season, episode, progress, duration: d }).catch(() => {});
    // Trakt scrobble
    if ((traktAuth as any)?.token) {
      const isEp = contentType === 'series' && season != null;
      traktScrobble(
        (traktAuth as any).token,
        progress >= 0.9 ? 'stop' : progress < 0.02 ? 'start' : 'pause',
        { type: isEp ? 'episode' : 'movie', imdbId: contentId?.startsWith('tt') ? contentId : undefined, title, season, episode },
        progress
      ).catch(() => {});
    }
  }, [contentId, contentType, title, poster, season, episode, nuvioUser, traktAuth]);

  useEffect(() => {
    cwTimer.current = setInterval(() => {
      const v = vidRef.current;
      if (v && !v.paused && v.duration > 0) syncCW(v.currentTime, v.duration);
    }, 5000);
    return () => clearInterval(cwTimer.current);
  }, [syncCW]);

  // ── Init video ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isMagnet) return;
    const v = vidRef.current;
    if (!v) return;

    setReady(false); setError(null); setBuffering(true);
    setShowNextEpCard(false); setNextEpTriggered(false);
    v.src = url;
    v.load();

    const onCanPlay = () => {
      setBuffering(false); setReady(true);
      if (initialProgress > 0.01 && initialProgress < 0.97 && v.duration)
        v.currentTime = v.duration * initialProgress;
      v.play().catch(() => {});

      // Leggi tracce
      const at: typeof audioTracks = [];
      if ((v as any).audioTracks) {
        for (let i = 0; i < (v as any).audioTracks.length; i++) {
          const t = (v as any).audioTracks[i];
          at.push({ id: i, label: t.label || `Traccia ${i+1}`, lang: t.language || '' });
        }
      }
      setAudioTracks(at);

      const st: typeof subtitleTracks = [];
      for (let i = 0; i < v.textTracks.length; i++) {
        const t = v.textTracks[i];
        st.push({ id: i, label: t.label || `Sub ${i+1}`, lang: t.language || '' });
      }
      setSubtitleTracks(st);
    };

    const onError = () => {
      const code = v.error?.code;
      const msgs: Record<number, string> = { 1: 'Interrotto', 2: 'Errore di rete', 3: 'Errore decodifica', 4: 'Formato non supportato' };
      setError(msgs[code ?? 0] ?? `Errore (${code})`);
    };

    v.addEventListener('canplay', onCanPlay, { once: true });
    v.addEventListener('error', onError, { once: true });
    return () => { v.removeEventListener('canplay', onCanPlay); v.removeEventListener('error', onError); };
  }, [url]);

  // ── Next episode auto-trigger ──────────────────────────────────────────────
  useEffect(() => {
    if (!duration || nextEpTriggered) return;
    const remaining = duration - currentTime;

    // Mostra popup a X secondi dalla fine
    if (prefs.showNextEpPopup && nextEpisode && remaining <= prefs.autoNextEpDelay && remaining > 0) {
      setShowNextEpCard(true);
    }

    // Auto-next se abilitato a 5s dalla fine
    if (prefs.autoNextEp && nextEpisode && onNext && remaining <= 5 && remaining > 0) {
      setNextEpTriggered(true);
      syncCW(currentTime, duration);
      onNext();
    }

    // Auto-chiudi alla fine se non c'è next
    if (!nextEpisode && currentTime >= duration && duration > 0) {
      syncCW(currentTime, duration);
      handleClose();
    }
  }, [currentTime, duration, nextEpisode, prefs, nextEpTriggered]);

  // ── Auto-hide controls ─────────────────────────────────────────────────────
  function resetHide() {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    // NON chiudere il panel attivo — l'utente ci sta interagendo
    if (playing && !paused && !activePanel) {
      hideTimer.current = setTimeout(() => {
        setShowControls(false);
      }, prefs.autoHideDelay);
    }
  }

  // ── Fullscreen ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (activePanel) { if (e.key === 'Escape') setActivePanel(null); return; }
      const v = vidRef.current;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); v?.paused ? v.play() : v?.pause(); break;
        case 'ArrowRight': if (v) v.currentTime = Math.min(v.duration||0, v.currentTime+10); break;
        case 'ArrowLeft':  if (v) v.currentTime = Math.max(0, v.currentTime-10); break;
        case 'ArrowUp':    if (v) v.volume = Math.min(1, v.volume+0.1); break;
        case 'ArrowDown':  if (v) v.volume = Math.max(0, v.volume-0.1); break;
        case 'm': if (v) v.muted = !v.muted; break;
        case 'f': if (!document.fullscreenElement) containerRef.current?.requestFullscreen(); else document.exitFullscreen(); break;
        case 'Escape': if (!document.fullscreenElement) handleClose(); break;
        case 'n': if (nextEpisode && onNext) { syncCW(v?.currentTime??0, v?.duration??0); onNext(); } break;
        case 'p': if (prevEpisode && onPrev) { syncCW(v?.currentTime??0, v?.duration??0); onPrev(); } break;
      }
      resetHide();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [playing, nextEpisode, prevEpisode, activePanel]);

  function handleClose() {
    const v = vidRef.current;
    syncCW(v?.currentTime??0, v?.duration??0);
    if (v) { v.pause(); v.src = ''; }
    onClose();
  }

  function togglePanel(p: Panel) {
    setActivePanel(prev => prev === p ? null : p);
    setShowControls(true);
    clearTimeout(hideTimer.current);
  }

  function changeQuality(q: { label: string; url: string }) {
    const v = vidRef.current;
    if (!v) return;
    const wasPlaying = !v.paused;
    const ct = v.currentTime;
    v.src = q.url;
    v.load();
    v.addEventListener('canplay', () => {
      v.currentTime = ct;
      if (wasPlaying) v.play().catch(() => {});
    }, { once: true });
    setCurrentQuality(q.label);
    setActivePanel(null);
  }

  function setAudioTrack(id: number) {
    const v = vidRef.current;
    if (!v || !(v as any).audioTracks) return;
    for (let i = 0; i < (v as any).audioTracks.length; i++) {
      (v as any).audioTracks[i].enabled = (i === id);
    }
    setActiveAudio(id);
    setActivePanel(null);
  }

  function setSubtitle(id: number) {
    const v = vidRef.current;
    if (!v) return;
    for (let i = 0; i < v.textTracks.length; i++) {
      v.textTracks[i].mode = (i === id) ? 'showing' : 'hidden';
    }
    setActiveSubtitle(id);
    setActivePanel(null);
  }

  function disableSubtitles() {
    const v = vidRef.current;
    if (!v) return;
    for (let i = 0; i < v.textTracks.length; i++) v.textTracks[i].mode = 'hidden';
    setActiveSubtitle(-1);
    setActivePanel(null);
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bgImg = backdrop || poster;

  // ── Magnet ─────────────────────────────────────────────────────────────────
  if (isMagnet) return (
    <div className="fixed inset-0 bg-[#0c0c10] z-[100] flex items-center justify-center">
      {bgImg && <><img src={bgImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10 blur-2xl scale-110" /><div className="absolute inset-0 bg-black/80" /></>}
      <div className="relative z-10 flex flex-col items-center gap-6 max-w-md text-center px-8">
        {poster && <img src={poster} alt={title} className="h-28 rounded-xl shadow-2xl" />}
        {title && <p className="text-white font-bold text-xl">{title}</p>}
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-5 text-left space-y-3">
          <p className="text-amber-300 font-semibold text-sm">🧲 Configura Real-Debrid in Torrentio per stream diretti</p>
          <button onClick={() => invoke('open_url', { url: 'https://torrentio.strem.fun/configure' })}
            className="w-full flex items-center gap-2 justify-center py-2.5 text-sm font-medium text-white rounded-xl" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
            <ExternalLink size={14} />Configura Torrentio
          </button>
        </div>
        <button onClick={handleClose} className="text-white/40 hover:text-white text-sm flex items-center gap-1.5"><ArrowLeft size={14} />Indietro</button>
      </div>
    </div>
  );

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center">
      {bgImg && <><img src={bgImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10 blur-2xl scale-110" /><div className="absolute inset-0 bg-black/80" /></>}
      <div className="relative z-10 flex flex-col items-center gap-4 max-w-sm text-center px-6">
        <AlertCircle size={36} className="text-red-400" />
        <p className="text-white font-semibold">Impossibile riprodurre</p>
        <p className="text-white/50 text-sm">{error}</p>
        <button onClick={handleClose} className="px-5 py-2 text-sm text-white/70 bg-white/10 rounded-full hover:bg-white/20">Indietro</button>
      </div>
    </div>
  );

  const isPaused = !playing || paused;

  return (
    <div ref={containerRef}
      className="fixed inset-0 bg-black z-[100] select-none overflow-hidden"
      style={{ cursor: ready && !showControls && !isPaused ? 'none' : 'default' }}
      onMouseMove={resetHide}
      onClick={() => { if (!showControls) { resetHide(); return; } }}>

      {/* Loading overlay */}
      {!ready && bgImg && (
        <><img src={bgImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-xl scale-110" /><div className="absolute inset-0 bg-black/70" /></>
      )}
      {(!ready || buffering) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white/80 animate-spin" />
        </div>
      )}

      {/* Video */}
      <video ref={vidRef}
        className="absolute inset-0 w-full h-full object-contain"
        onClick={(e) => { e.stopPropagation(); if (activePanel) { setActivePanel(null); return; } vidRef.current?.paused ? vidRef.current.play() : vidRef.current?.pause(); resetHide(); }}
        onPlay={() => {
          setPlaying(true); setPaused(false); setBuffering(false); setReady(true);
          setTimeout(() => {
            syncCW(vidRef.current?.currentTime??0, vidRef.current?.duration??0);
            // Trakt start scrobble
            if ((traktAuth as any)?.token) {
              traktScrobble((traktAuth as any).token, 'start',
                { type: contentType === 'series' ? 'episode' : 'movie', imdbId: contentId?.startsWith('tt') ? contentId : undefined, title, season, episode },
                0.01
              ).catch(() => {});
            }
          }, 3000);
          hideTimer.current = setTimeout(() => setShowControls(false), prefs.autoHideDelay);
        }}
        onPause={() => { setPlaying(false); setPaused(true); setShowControls(true); clearTimeout(hideTimer.current); }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onTimeUpdate={() => setCurrentTime(vidRef.current?.currentTime ?? 0)}
        onDurationChange={() => setDuration(vidRef.current?.duration ?? 0)}
        onVolumeChange={() => { setVolume(vidRef.current?.volume ?? 1); setMuted(vidRef.current?.muted ?? false); }}
        onEnded={() => { syncCW(vidRef.current?.currentTime??0, vidRef.current?.duration??0); if (nextEpisode && onNext) onNext(); else handleClose(); }}
        playsInline preload="auto"
      />

      {/* ── PAUSE SCREEN ─────────────────────────────────────────────────── */}
      {isPaused && ready && prefs.showCastOnPause && (
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-end"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)' }}>
          {/* Cast strip */}
          {cast.length > 0 && (
            <div className="pb-28 px-6">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Cast</p>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                {cast.slice(0, 15).map((p, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-white/10 border border-white/10">
                      {p.photo
                        ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-white/30 text-xl font-bold">{p.name.charAt(0)}</div>}
                    </div>
                    <p className="text-xs text-white/70 text-center leading-tight line-clamp-2">{p.name}</p>
                    {p.character && <p className="text-[10px] text-white/30 text-center line-clamp-1">{p.character}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PANELS (sottotitoli / audio / qualità / impostazioni) ─────────── */}
      {activePanel && (
        <div
          className="absolute bottom-24 right-5 z-30 bg-[#1a1a20]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl min-w-52 overflow-hidden"
          onMouseEnter={() => clearTimeout(hideTimer.current)}
          onMouseLeave={() => { if (playing && !paused) hideTimer.current = setTimeout(() => setShowControls(false), prefs.autoHideDelay); }}
          onClick={e => e.stopPropagation()}>
          {activePanel === 'subtitles' && (
            <PanelList title="Sottotitoli" items={[
              { id: -1, label: 'Disattivati', active: activeSubtitle === -1, onClick: disableSubtitles },
              ...subtitleTracks.map(t => ({ id: t.id, label: `${t.label}${t.lang ? ` (${t.lang})` : ''}`, active: activeSubtitle === t.id, onClick: () => setSubtitle(t.id) })),
            ]} emptyMsg="Nessun sottotitolo disponibile" />
          )}
          {activePanel === 'audio' && (
            <PanelList title="Traccia audio" items={[
              ...audioTracks.map(t => ({ id: t.id, label: `${t.label}${t.lang ? ` (${t.lang})` : ''}`, active: activeAudio === t.id, onClick: () => setAudioTrack(t.id) })),
            ]} emptyMsg="Traccia audio automatica" />
          )}
          {activePanel === 'quality' && (
            <PanelList title="Qualità" items={[
              { id: -1, label: 'Auto', active: currentQuality === 'Auto' && availableQualities.length === 0, onClick: () => setActivePanel(null) },
              ...availableQualities.map(q => ({ id: q.label, label: q.label, active: currentQuality === q.label, onClick: () => changeQuality(q) })),
            ]} emptyMsg="Solo qualità disponibile" />
          )}
          {activePanel === 'settings' && (
            <div className="p-4 space-y-4 min-w-64">
              <p className="text-xs font-bold text-white/60 uppercase tracking-wider">Impostazioni player</p>
              <div className="space-y-3">
                <SettingRow label="Auto-hide controlli (s)"
                  value={prefs.autoHideDelay / 1000}
                  onChange={v => setPrefs(p => ({ ...p, autoHideDelay: v * 1000 }))}
                  min={1} max={15} step={1} />
                <SettingRow label="Next ep popup (s dalla fine)"
                  value={prefs.autoNextEpDelay}
                  onChange={v => setPrefs(p => ({ ...p, autoNextEpDelay: v }))}
                  min={5} max={120} step={5} />
                <ToggleRow label="Cast in pausa" value={prefs.showCastOnPause} onChange={v => setPrefs(p => ({ ...p, showCastOnPause: v }))} />
                <ToggleRow label="Popup next episode" value={prefs.showNextEpPopup} onChange={v => setPrefs(p => ({ ...p, showNextEpPopup: v }))} />
                <ToggleRow label="Avanza episodio auto" value={prefs.autoNextEp} onChange={v => setPrefs(p => ({ ...p, autoNextEp: v }))} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CONTROLS ─────────────────────────────────────────────────────── */}
      <div className={clsx('absolute inset-0 z-20 flex flex-col justify-between transition-opacity duration-500 pointer-events-none',
        showControls ? 'opacity-100' : 'opacity-0')}>

        {/* Top bar */}
        <div className="pointer-events-auto flex items-center gap-3 px-5 pt-4 pb-20"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.75), transparent)' }}>
          <button onClick={handleClose}
            className="p-2 rounded-full bg-black/30 hover:bg-black/60 text-white/80 hover:text-white transition-colors backdrop-blur-sm">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            {title && <p className="text-white font-semibold text-sm leading-tight truncate">{title}</p>}
            {subtitle && <p className="text-white/50 text-xs truncate">{subtitle}</p>}
          </div>
          {/* Top-right: pannello settings */}
          <button onClick={() => togglePanel('settings')}
            className={clsx('p-2 rounded-full backdrop-blur-sm transition-colors', activePanel === 'settings' ? 'bg-white/20 text-white' : 'bg-black/30 hover:bg-black/60 text-white/70 hover:text-white')}>
            <Settings size={16} />
          </button>
        </div>

        {/* Bottom */}
        <div className="pointer-events-auto px-5 pb-5"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}>

          {/* Progress bar */}
          <div ref={progRef}
            onClick={e => {
              const v = vidRef.current; const b = progRef.current;
              if (!v || !b || !v.duration) return;
              v.currentTime = ((e.clientX - b.getBoundingClientRect().left) / b.clientWidth) * v.duration;
              resetHide();
            }}
            className="relative w-full h-1 bg-white/20 rounded-full mb-4 cursor-pointer group/prog hover:h-1.5 transition-all">
            {/* Buffer bar */}
            <div className="absolute inset-0 rounded-full bg-white/10" />
            {/* Progress */}
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, backgroundColor: 'var(--accent,#7c3aed)' }} />
            {/* Thumb */}
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg opacity-0 group-hover/prog:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `${pct}%` }} />
            {/* Time tooltip on hover */}
            <div className="absolute -top-8 pointer-events-none opacity-0 group-hover/prog:opacity-100 transition-opacity text-xs text-white bg-black/70 px-2 py-0.5 rounded"
              style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}>
              {fmt(currentTime)}
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2">
            {/* Serie: prev episode */}
            {isSeries && prevEpisode && (
              <button onClick={() => { syncCW(vidRef.current?.currentTime??0, vidRef.current?.duration??0); onPrev?.(); resetHide(); }}
                className="p-2 text-white/60 hover:text-white transition-colors" title={`Ep precedente: ${prevEpisode.title}`}>
                <ChevronLeft size={22} />
              </button>
            )}

            {/* -10s */}
            <button onClick={() => { if (vidRef.current) vidRef.current.currentTime -= 10; resetHide(); }}
              className="p-2 text-white/60 hover:text-white transition-colors">
              <SkipBack size={20} />
            </button>

            {/* Play/Pause */}
            <button onClick={() => { const v = vidRef.current; v?.paused ? v.play() : v?.pause(); resetHide(); }}
              className="w-12 h-12 rounded-full bg-white flex items-center justify-center hover:bg-white/90 shadow-xl transition-all hover:scale-105 flex-shrink-0">
              {isPaused
                ? <Play size={20} className="fill-black text-black ml-0.5" />
                : <Pause size={20} className="fill-black text-black" />}
            </button>

            {/* +10s */}
            <button onClick={() => { if (vidRef.current) vidRef.current.currentTime += 10; resetHide(); }}
              className="p-2 text-white/60 hover:text-white transition-colors">
              <SkipForward size={20} />
            </button>

            {/* Serie: next episode */}
            {isSeries && nextEpisode && (
              <button onClick={() => { syncCW(vidRef.current?.currentTime??0, vidRef.current?.duration??0); onNext?.(); resetHide(); }}
                className="p-2 text-white/60 hover:text-white transition-colors" title={`Ep successivo: ${nextEpisode.title}`}>
                <ChevronRight size={22} />
              </button>
            )}

            {/* Time */}
            <span className="text-white/50 text-xs font-mono tabular-nums ml-1">
              {fmt(currentTime)} <span className="text-white/25">/</span> {fmt(duration)}
            </span>

            <div className="flex-1" />

            {/* Sottotitoli */}
            <button onClick={() => togglePanel('subtitles')}
              className={clsx('p-2 rounded-lg transition-colors text-sm', activePanel === 'subtitles' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10')}
              title="Sottotitoli">
              <Subtitles size={18} />
            </button>

            {/* Audio */}
            <button onClick={() => togglePanel('audio')}
              className={clsx('p-2 rounded-lg transition-colors', activePanel === 'audio' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10')}
              title="Traccia audio">
              <Music2 size={18} />
            </button>

            {/* Qualità */}
            {(availableQualities.length > 0) && (
              <button onClick={() => togglePanel('quality')}
                className={clsx('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors', activePanel === 'quality' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10')}>
                {currentQuality} <ChevronDown size={12} />
              </button>
            )}

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button onClick={() => { if (vidRef.current) vidRef.current.muted = !vidRef.current.muted; }} className="text-white/60 hover:text-white p-1">
                {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input type="range" min={0} max={1} step={0.02} value={muted ? 0 : volume}
                onChange={e => { if (vidRef.current) { vidRef.current.volume = +e.target.value; vidRef.current.muted = false; } }}
                className="w-20 h-1 cursor-pointer accent-white" />
            </div>

            {/* Fullscreen */}
            <button onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen(); else document.exitFullscreen(); }}
              className="p-2 text-white/60 hover:text-white transition-colors">
              {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>

            {/* X / stop */}
            <button onClick={handleClose} className="p-2 text-white/40 hover:text-white transition-colors ml-1"><X size={18} /></button>
          </div>
        </div>
      </div>

      {/* ── NEXT EPISODE CARD ─────────────────────────────────────────────── */}
      {showNextEpCard && nextEpisode && prefs.showNextEpPopup && (
        <div className="absolute bottom-28 right-5 z-30 bg-[#18181d]/95 border border-white/10 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl w-64"
          onClick={e => e.stopPropagation()}>
          <div className="px-4 pt-3 pb-2">
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Prossimo episodio</p>
            <p className="text-sm font-semibold text-white line-clamp-2">{nextEpisode.title}</p>
          </div>
          {nextEpisode.thumbnail && <img src={nextEpisode.thumbnail} alt="" className="w-full h-28 object-cover" />}
          <div className="flex gap-2 p-3">
            <button onClick={() => { syncCW(vidRef.current?.currentTime??0, vidRef.current?.duration??0); setShowNextEpCard(false); onNext?.(); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm text-white rounded-xl font-medium" style={{ backgroundColor: 'var(--accent)' }}>
              <ChevronRight size={15} />Guarda ora
            </button>
            <button onClick={() => setShowNextEpCard(false)} className="px-3 py-2 text-white/50 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"><X size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PanelList({ title, items, emptyMsg }: {
  title: string;
  items: { id: any; label: string; active: boolean; onClick: () => void }[];
  emptyMsg: string;
}) {
  return (
    <div className="py-2 min-w-48">
      <p className="text-[10px] text-white/40 uppercase tracking-wider px-4 pb-2 font-bold">{title}</p>
      {items.length === 0
        ? <p className="text-xs text-white/30 px-4 pb-3 italic">{emptyMsg}</p>
        : items.map(item => (
          <button key={String(item.id)} onClick={item.onClick}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/8 transition-colors text-left">
            <span className={item.active ? 'text-white font-medium' : 'text-white/60'}>{item.label}</span>
            {item.active && <Check size={13} className="text-[color:var(--accent)] flex-shrink-0" />}
          </button>
        ))
      }
    </div>
  );
}

function SettingRow({ label, value, onChange, min, max, step }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-white/60">{label}</span>
        <span className="text-white/40 font-mono">{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 cursor-pointer accent-white" />
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/60">{label}</span>
      <button onClick={() => onChange(!value)}
        className={clsx('relative w-10 h-5 rounded-full transition-colors flex-shrink-0', value ? 'bg-[color:var(--accent,#7c3aed)]' : 'bg-white/20')}>
        <span className={clsx('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', value ? 'translate-x-5' : '')} />
      </button>
    </div>
  );
}
