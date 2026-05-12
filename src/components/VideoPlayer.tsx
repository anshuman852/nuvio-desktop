/// <reference types="vite/client" />
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../lib/store';
import { upsertCW } from '../api/nuvio';
import {
  ArrowLeft, Play, Pause, SkipBack, SkipForward, X, ChevronRight,
  Volume2, VolumeX, Maximize, Settings, ChevronLeft, Check, List
} from 'lucide-react';
import { useT } from '../lib/i18n';
import { useDiscordRPC } from '../hooks/useDiscordRPC';
import { useNativeMpv } from '../hooks/useNativeMpv';
import { usePluginMpv } from '../hooks/usePluginMpv';

interface CastMember { name: string; character?: string; photo?: string; }
interface EpisodeRef { id: string; title: string; thumbnail?: string; streamUrl?: string; }
interface EpisodeItem { id: string; title: string; season?: number; episode?: number; thumbnail?: string; }
interface QualityOption { label: string; url: string; }
interface SubtitleTrack { label: string; lang: string; url: string; }

interface VideoPlayerProps {
  url: string; title?: string; subtitle?: string;
  contentId?: string; contentType?: string;
  poster?: string; backdrop?: string; cast?: CastMember[];
  season?: number; episode?: number;
  referer?: string;
  nextEpisode?: EpisodeRef | null;
  prevEpisode?: { id: string; title: string } | null;
  availableQualities?: QualityOption[];
  subtitleTracks?: SubtitleTrack[];
  allEpisodes?: EpisodeItem[];
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onPlayNextEpisode?: () => void;
  onQualitySelect?: (url: string) => void;
  onEpisodeSelect?: (episodeId: string) => void;
  initialProgress?: number;
}

function fmtTime(s: number) {
  if (!s || !isFinite(s)) return '0:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

type SettingsPanel = null | 'main' | 'quality' | 'subtitles' | 'audio' | 'speed' | 'display' | 'next_ep';
type AspectRatio = 'contain' | 'cover' | 'fill' | '16/9' | '4/3' | '2.35/1';

export default function VideoPlayer(props: VideoPlayerProps) {
  const {
    url, title, subtitle, contentId, contentType, poster, backdrop, cast = [],
    season, episode, referer, nextEpisode, prevEpisode,
    availableQualities = [], subtitleTracks = [], allEpisodes = [],
    onClose, onNext, onPrev, onPlayNextEpisode, onQualitySelect, onEpisodeSelect, initialProgress = 0,
  } = props;

  const { t } = useT();
  const { nuvioUser, upsertWatch, settings } = useStore();
  const vidRef    = useRef<HTMLVideoElement>(null);
  const hlsRef    = useRef<any>(null);
  const cwTimer   = useRef<ReturnType<typeof setInterval>>();
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const [buffering,       setBuffering]       = useState(true);
  const [ready,           setReady]           = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [playing,         setPlaying]         = useState(false);
  const [hasPlayedOnce,   setHasPlayedOnce]   = useState(false);
  const [currentTime,     setCurrentTime]     = useState(0);
  const [duration,        setDuration]        = useState(0);
  const [volume,          setVolume]          = useState(1);
  const [muted,           setMuted]           = useState(false);
  const [showControls,    setShowControls]    = useState(true);
  const [showNextCard,    setShowNextCard]    = useState(false);
  const [nextTriggered,   setNextTriggered]   = useState(false);
  const [settingsPanel,   setSettingsPanel]   = useState<SettingsPanel>(null);
  const [activeQuality,   setActiveQuality]   = useState<string>(url);
  const [activeSub,       setActiveSub]       = useState<string | null>(null);
  const [activeAudio,     setActiveAudio]     = useState<number>(0);
  const [audioTracks,     setAudioTracks]     = useState<{id: number; label: string}[]>([]);
  const [playbackSpeed,   setPlaybackSpeed]   = useState(1);
  const [showCastPanel,   setShowCastPanel]   = useState(false);
  const [aspectRatio,     setAspectRatio]     = useState<AspectRatio>('contain');
  const [nextEpThreshold, setNextEpThreshold] = useState(35);
  const [hideDelay,       setHideDelay]       = useState(2000);
  const [showEpisodeList, setShowEpisodeList] = useState(false);

  const discordRPC = useDiscordRPC();
  const nativeMpv = useNativeMpv();
  const pluginMpv = usePluginMpv();

  const bgImg = backdrop || poster;

  const playerMode = (settings as any).playerMode ?? 'auto';
  const usesMpv = playerMode === 'mpv'
    ? true  // force MPV
    : playerMode === 'html5'
      ? false  // force HTML5
      : (url.startsWith('magnet:')
        || url.includes('127.0.0.1:11470')
        || url.includes('localhost:11470')
        || url.includes('127.0.0.1:11473'));  // auto-detect
  console.log(`[player] Mode: ${playerMode}, Player: ${usesMpv ? 'MPV' : 'HTML5'}, URL: ${url.substring(0, 80)}`);
  // Nota: .m3u8 rimosso da usesMpv — viene gestito da HLS.js tramite proxy

  const [showPlayerIndicator, setShowPlayerIndicator] = useState(true);

  useEffect(() => {
    setShowPlayerIndicator(true);
    // Keep indicator visible in MPV mode for debug status
    if (!usesMpv) {
      const timer = setTimeout(() => setShowPlayerIndicator(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [url, usesMpv]);

  // When MPV is active, hide the React app and make the body transparent so
  // WebView2 reveals libmpv's child HWND behind it. The VideoPlayer is
  // portaled into document.body below so it survives #root being hidden.
  // Re-force the WebView2 transparent background each time MPV mode activates:
  // certain window state transitions (maximize, fullscreen, restore) on
  // Windows reset the WebView2 DefaultBackgroundColor back to opaque.
  useEffect(() => {
    if (!usesMpv) return;
    document.body.classList.add('mpv-active');
    invoke('force_transparent_webview').catch(e => console.log('[player] force_transparent_webview:', e));
    return () => { document.body.classList.remove('mpv-active'); };
  }, [usesMpv]);

  const syncCW = useCallback((t: number, d: number) => {
    if (!contentId || d < 5) return;
    const p = t / d;
    upsertWatch({ id: contentId, type: contentType ?? 'movie', name: title ?? '',
      poster, videoId: contentId, season, episode, progress: p, duration: d });
    if (nuvioUser?.token && nuvioUser.id)
      upsertCW(nuvioUser.id, { id: contentId, type: contentType ?? 'movie', name: title ?? '',
        poster, videoId: contentId, season, episode, progress: p, duration: d }).catch(() => {});
  }, [contentId, contentType, title, poster, season, episode, nuvioUser]);

  useEffect(() => {
    cwTimer.current = setInterval(() => {
      const v = vidRef.current;
      if (v && !v.paused && v.duration > 0) syncCW(v.currentTime, v.duration);
    }, 5000);
    return () => clearInterval(cwTimer.current);
  }, [syncCW]);

  // MPV via native libmpv FFI — wait for init to finish before loading,
  // otherwise the first loadUrl IPC arrives while AppState.native_mpv is
  // still None and the command returns "MPV not initialized" silently.
  useEffect(() => {
    if (!usesMpv) return;
    if (!nativeMpv.ready) {
      console.log('[player] Waiting for MPV init before loading URL...');
      return;
    }
    setBuffering(true);
    nativeMpv.loadUrl(url);

    const sub = season && episode ? `S${season} · E${episode}` : subtitle ?? '';
    const type = contentType ?? (season ? 'series' : 'movie');
    discordRPC.startPlaying(title ?? url, sub, type);

    return () => {
      nativeMpv.stop();
      discordRPC.stopPlaying();
    };
  }, [url, usesMpv, nativeMpv.ready]);

  // Clear buffering when MPV file loads
  useEffect(() => {
    if (!usesMpv) return;
    if (nativeMpv.playing) setBuffering(false);
  }, [usesMpv, nativeMpv.playing]);

  // HTML5
  useEffect(() => {
    if (usesMpv) return;
    const v = vidRef.current;
    if (!v) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    v.src = '';
    setReady(false); setBuffering(true); setError(null);
    setPlaying(false); setHasPlayedOnce(false); setCurrentTime(0); setDuration(0);
    setShowNextCard(false); setNextTriggered(false); setShowCastPanel(false);
    setAudioTracks([]);
    v.src = activeQuality;
    v.playbackRate = playbackSpeed;
    v.load();
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [activeQuality, usesMpv]);

  // HTML5 event listeners
  useEffect(() => {
    const v = vidRef.current;
    if (!v || usesMpv) return;
    const canPlay   = () => {
      setBuffering(false); setReady(true); v.play().catch(() => {});
      // Rileva tracce audio
      const tracks: {id: number; label: string}[] = [];
      if ((v as any).audioTracks) {
        for (let i = 0; i < (v as any).audioTracks.length; i++) {
          const tr = (v as any).audioTracks[i];
          tracks.push({ id: i, label: tr.label || tr.language || `${t('player_track')} ${i + 1}` });
        }
      }
      if (tracks.length > 0) setAudioTracks(tracks);
    };
    const onPlay_   = () => {
      setPlaying(true); setBuffering(false); setShowCastPanel(false); setHasPlayedOnce(true);
      const sub = season && episode ? `S${season} · E${episode}` : subtitle ?? '';
      const type = contentType ?? (season ? 'series' : 'movie');
      if (!hasPlayedOnce) discordRPC.startPlaying(title ?? url, sub, type);
      else discordRPC.resumePlaying();
    };
    const onPause_  = () => {
      setPlaying(false);
      discordRPC.pausePlaying();
      if (cast.length > 0 && hasPlayedOnce) setShowCastPanel(true);
    };
    const onWait    = () => setBuffering(true);
    const onPlaying = () => { setBuffering(false); setReady(true); };
    const onTime    = () => {
      setCurrentTime(v.currentTime);
      const rem = v.duration - v.currentTime;
      if (nextEpisode && rem < nextEpThreshold && rem > 0 && !showNextCard && !nextTriggered)
        setShowNextCard(true);
      if (nextEpisode && onNext && rem < 5 && !nextTriggered && !v.paused) {
        setNextTriggered(true); syncCW(v.currentTime, v.duration); onNext();
      }
      if (!nextEpisode && v.duration > 0 && v.currentTime >= v.duration - 0.5) {
        syncCW(v.currentTime, v.duration); onClose();
      }
    };
    const onDur = () => setDuration(v.duration);
    const onErr = () => { setError(v.error?.message ?? t('error_loading')); setBuffering(false); };
    v.addEventListener('canplay', canPlay);    v.addEventListener('play', onPlay_);
    v.addEventListener('pause', onPause_);    v.addEventListener('waiting', onWait);
    v.addEventListener('playing', onPlaying); v.addEventListener('timeupdate', onTime);
    v.addEventListener('durationchange', onDur); v.addEventListener('error', onErr);
    return () => {
      v.removeEventListener('canplay', canPlay);    v.removeEventListener('play', onPlay_);
      v.removeEventListener('pause', onPause_);    v.removeEventListener('waiting', onWait);
      v.removeEventListener('playing', onPlaying); v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('durationchange', onDur); v.removeEventListener('error', onErr);
    };
  }, [url, usesMpv, showNextCard, nextTriggered, cast.length, nextEpisode, onNext, onClose, nextEpThreshold, hasPlayedOnce]);

  // Aspect ratio
  useEffect(() => {
    const v = vidRef.current;
    if (!v || usesMpv) return;
    if (aspectRatio === 'contain') { v.style.objectFit = 'contain'; v.style.width = '100%'; v.style.height = '100%'; v.style.aspectRatio = ''; }
    else if (aspectRatio === 'cover') { v.style.objectFit = 'cover'; v.style.width = '100%'; v.style.height = '100%'; v.style.aspectRatio = ''; }
    else if (aspectRatio === 'fill') { v.style.objectFit = 'fill'; v.style.width = '100%'; v.style.height = '100%'; v.style.aspectRatio = ''; }
    else if (aspectRatio === '16/9') { v.style.objectFit = 'contain'; v.style.aspectRatio = '16/9'; v.style.width = '100%'; v.style.height = 'auto'; v.style.maxHeight = '100%'; }
    else if (aspectRatio === '4/3') { v.style.objectFit = 'contain'; v.style.aspectRatio = '4/3'; v.style.width = 'auto'; v.style.height = '100%'; v.style.maxWidth = '100%'; }
    else if (aspectRatio === '2.35/1') { v.style.objectFit = 'contain'; v.style.aspectRatio = '2.35/1'; v.style.width = '100%'; v.style.height = 'auto'; v.style.maxHeight = '100%'; }
  }, [aspectRatio, usesMpv]);

  // Subtitles
  useEffect(() => {
    const v = vidRef.current;
    if (!v || usesMpv) return;
    Array.from(v.textTracks).forEach(t => { t.mode = 'disabled'; });
    if (activeSub) {
      const track = Array.from(v.textTracks).find(t => t.language === activeSub);
      if (track) track.mode = 'showing';
    }
  }, [activeSub, usesMpv]);

  // Audio track
  useEffect(() => {
    const v = vidRef.current;
    if (!v || usesMpv || !(v as any).audioTracks) return;
    for (let i = 0; i < (v as any).audioTracks.length; i++) {
      (v as any).audioTracks[i].enabled = (i === activeAudio);
    }
  }, [activeAudio, usesMpv]);

  useEffect(() => {
    const v = vidRef.current;
    if (v && !usesMpv) v.playbackRate = playbackSpeed;
  }, [playbackSpeed, usesMpv]);

  function resetHide() {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!settingsPanel && !showEpisodeList) setShowControls(false);
    }, hideDelay);
  }
  useEffect(() => { resetHide(); return () => clearTimeout(hideTimer.current); }, [hideDelay]);
  useEffect(() => { if (settingsPanel || showEpisodeList) setShowControls(true); }, [settingsPanel, showEpisodeList]);

  function handleClose() {
    discordRPC.stopPlaying();
    if (usesMpv) nativeMpv.stop();
    else invoke('mpv_stop').catch(() => {});
    onClose();
  }
  function togglePlay() {
    if (usesMpv) {
      nativeMpv.togglePause();
      return;
    }
    const v = vidRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setShowCastPanel(false); } else { v.pause(); }
  }
  function seek(pct: number) {
    if (usesMpv) {
      nativeMpv.seek(pct * nativeMpv.duration);
      return;
    }
    const v = vidRef.current; if (v && duration > 0) v.currentTime = pct * duration;
  }
  function seekRelative(secs: number) {
    if (usesMpv) {
      nativeMpv.seek(Math.max(0, nativeMpv.timePos + secs));
      return;
    }
    const v = vidRef.current;
    if (v) v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + secs));
  }
  function setVol(val: number) { const v = vidRef.current; if (v) { v.volume = val; setVolume(val); setMuted(val === 0); } }
  function toggleMute() { const v = vidRef.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); }
  async function toggleFullscreen() {
    if (usesMpv) {
      // In MPV mode there is no <video> element to fullscreen — toggle the
      // Tauri window itself so the mpv child HWND grows with it.
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const w = getCurrentWindow();
        await w.setFullscreen(!(await w.isFullscreen()));
      } catch (e) { console.log('[player] fullscreen toggle failed', e); }
      return;
    }
    vidRef.current?.requestFullscreen?.();
  }

  function handlePlayNextEpisode(e: React.MouseEvent) {
    e.stopPropagation();
    setShowNextCard(false); setNextTriggered(true);
    const v = vidRef.current;
    if (v && v.duration > 0 && !usesMpv) syncCW(v.currentTime, v.duration);
    else syncCW(currentTime, duration);
    if (onPlayNextEpisode) onPlayNextEpisode();
    else if (onNext) onNext();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (settingsPanel) { if (e.key === 'Escape') setSettingsPanel(null); return; }
      if (showEpisodeList) { if (e.key === 'Escape') setShowEpisodeList(false); return; }
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'ArrowLeft':  e.preventDefault(); seekRelative(-10); break;
        case 'ArrowRight': e.preventDefault(); seekRelative(10); break;
        case 'ArrowUp':    e.preventDefault(); setVol(Math.min(1, volume + 0.1)); break;
        case 'ArrowDown':  e.preventDefault(); setVol(Math.max(0, volume - 0.1)); break;
        case 'm': toggleMute(); break;
        case 'f': toggleFullscreen(); break;
        case 'Escape': handleClose(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [volume, settingsPanel, showEpisodeList, playing]);

  const progress = duration > 0 ? currentTime / duration : 0;
  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const NEXT_EP_THRESHOLDS = [15, 30, 45, 60, 90];
  const HIDE_DELAYS = [
    { label: t('player_hide_1s'), ms: 1000 },
    { label: t('player_hide_2s'), ms: 2000 },
    { label: t('player_hide_3s'), ms: 3000 },
    { label: t('player_hide_5s'), ms: 5000 },
  ];
  const ASPECTS: AspectRatio[] = ['contain', 'cover', 'fill', '16/9', '4/3', '2.35/1'];
  const secsLeft = Math.max(0, Math.ceil(duration - currentTime - 5));

  function aspectLabel(a: AspectRatio): string {
    switch (a) {
      case 'contain': return t('player_aspect_fit');
      case 'cover': return t('player_aspect_fill');
      case 'fill': return t('player_aspect_stretch');
      case '16/9': return t('player_aspect_169');
      case '4/3': return '4:3';
      case '2.35/1': return t('player_aspect_cinemascope');
    }
  }

  // Episodi raggruppati per stagione
  const episodesBySeason = allEpisodes.reduce((acc, ep) => {
    const s = ep.season ?? 0;
    if (!acc[s]) acc[s] = [];
    acc[s].push(ep);
    return acc;
  }, {} as Record<number, EpisodeItem[]>);
  const episodeSeasons = Object.keys(episodesBySeason).map(Number).sort((a, b) => a - b);

  const SettingsMenu = () => (
    <div className="absolute bottom-20 right-5 z-30 bg-black/95 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
      style={{ width: 272 }} onClick={e => e.stopPropagation()}>
      {settingsPanel === 'main' && (
        <div className="py-1">
          <div className="px-4 py-2.5 text-xs font-bold text-white/40 uppercase tracking-widest border-b border-white/5">{t('settings')}</div>
          {availableQualities.length > 0 && (
            <button onClick={() => setSettingsPanel('quality')}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 text-white text-sm">
              <span className="flex items-center gap-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>
                {t('player_quality')}
              </span>
              <span className="text-white/40 text-xs flex items-center gap-1">
                {availableQualities.find(q => q.url === activeQuality)?.label ?? 'Auto'}<ChevronRight size={13} />
              </span>
            </button>
          )}
          <button onClick={() => setSettingsPanel('subtitles')}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 text-white text-sm">
            <span className="flex items-center gap-2.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h4M15 15h2M7 10h2M13 10h4"/></svg>
              {t('subtitles')}
            </span>
            <span className="text-white/40 text-xs flex items-center gap-1">
              {activeSub ? (subtitleTracks.find(s => s.lang === activeSub)?.label ?? activeSub) : 'Off'}<ChevronRight size={13} />
            </span>
          </button>
          {audioTracks.length > 1 && (
            <button onClick={() => setSettingsPanel('audio')}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 text-white text-sm">
              <span className="flex items-center gap-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                {t('player_audio_track')}
              </span>
              <span className="text-white/40 text-xs flex items-center gap-1">
                {audioTracks[activeAudio]?.label ?? `${t('player_track')} ${activeAudio + 1}`}<ChevronRight size={13} />
              </span>
            </button>
          )}
          <button onClick={() => setSettingsPanel('speed')}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 text-white text-sm">
            <span className="flex items-center gap-2.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              {t('player_speed')}
            </span>
            <span className="text-white/40 text-xs flex items-center gap-1">
              {playbackSpeed === 1 ? t('player_normal') : `${playbackSpeed}x`}<ChevronRight size={13} />
            </span>
          </button>
          <button onClick={() => setSettingsPanel('display')}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 text-white text-sm">
            <span className="flex items-center gap-2.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              {t('player_display')}
            </span>
            <span className="text-white/40 text-xs flex items-center gap-1">
              {(aspectRatio === 'contain' ? t('player_aspect_fit') : aspectRatio === 'cover' ? t('player_aspect_fill') : aspectRatio === 'fill' ? t('player_aspect_stretch') : aspectRatio === '16/9' ? t('player_aspect_169') : aspectRatio === '4/3' ? '4:3' : t('player_aspect_cinemascope')).split(' ')[0]}<ChevronRight size={13} />
            </span>
          </button>
          <button onClick={() => setSettingsPanel('next_ep')}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 text-white text-sm">
            <span className="flex items-center gap-2.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50"><polygon points="5 3 19 12 5 21 5 3"/><line x1="19" y1="3" x2="19" y2="21"/></svg>
              {t('player_next_ep')}
            </span>
            <span className="text-white/40 text-xs flex items-center gap-1">
              {nextEpThreshold === 9999 ? t('player_never') : `${nextEpThreshold}s`}<ChevronRight size={13} />
            </span>
          </button>
        </div>
      )}
      {settingsPanel === 'quality' && (
        <div className="py-1">
          <button onClick={() => setSettingsPanel('main')} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/5 text-white/60 text-sm border-b border-white/5">
            <ChevronLeft size={14} />{t('player_quality')}
          </button>
          {availableQualities.map(q => (
            <button key={q.url} onClick={() => { setActiveQuality(q.url); onQualitySelect?.(q.url); setSettingsPanel(null); }}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 text-white text-sm">
              {q.label} {activeQuality === q.url && <Check size={14} className="text-[color:var(--accent)]" />}
            </button>
          ))}
        </div>
      )}
      {settingsPanel === 'subtitles' && (
        <div className="py-1">
          <button onClick={() => setSettingsPanel('main')} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/5 text-white/60 text-sm border-b border-white/5">
            <ChevronLeft size={14} />{t('subtitles')}
          </button>
          <button onClick={() => { setActiveSub(null); setSettingsPanel(null); }}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 text-white text-sm">
            {t('disabled_label')} {!activeSub && <Check size={14} className="text-[color:var(--accent)]" />}
          </button>
          {subtitleTracks.length === 0 && <div className="px-4 py-3 text-white/30 text-xs">{t('no_subtitles')}</div>}
          {subtitleTracks.map(s => (
            <button key={s.lang} onClick={() => { setActiveSub(s.lang); setSettingsPanel(null); }}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 text-white text-sm">
              {s.label} {activeSub === s.lang && <Check size={14} className="text-[color:var(--accent)]" />}
            </button>
          ))}
        </div>
      )}
      {settingsPanel === 'audio' && (
        <div className="py-1">
          <button onClick={() => setSettingsPanel('main')} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/5 text-white/60 text-sm border-b border-white/5">
            <ChevronLeft size={14} />{t('player_audio_track')}
          </button>
          {audioTracks.map(t => (
            <button key={t.id} onClick={() => { setActiveAudio(t.id); setSettingsPanel(null); }}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 text-white text-sm">
              {t.label} {activeAudio === t.id && <Check size={14} className="text-[color:var(--accent)]" />}
            </button>
          ))}
        </div>
      )}
      {settingsPanel === 'speed' && (
        <div className="py-1">
          <button onClick={() => setSettingsPanel('main')} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/5 text-white/60 text-sm border-b border-white/5">
            <ChevronLeft size={14} />{t('player_speed')}
          </button>
          {SPEEDS.map(s => (
            <button key={s} onClick={() => { setPlaybackSpeed(s); setSettingsPanel(null); }}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 text-white text-sm">
              {s === 1 ? t('player_normal') : `${s}x`} {playbackSpeed === s && <Check size={14} className="text-[color:var(--accent)]" />}
            </button>
          ))}
        </div>
      )}
      {settingsPanel === 'display' && (
        <div className="py-1">
          <button onClick={() => setSettingsPanel('main')} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/5 text-white/60 text-sm border-b border-white/5">
            <ChevronLeft size={14} />{t('player_display')}
          </button>
          {ASPECTS.map(a => (
            <button key={a} onClick={() => { setAspectRatio(a); setSettingsPanel(null); }}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 text-white text-sm">
              {aspectLabel(a)} {aspectRatio === a && <Check size={14} className="text-[color:var(--accent)]" />}
            </button>
          ))}
          <div className="border-t border-white/5 mt-1 pt-1">
            <div className="px-4 py-2 text-xs text-white/40 uppercase tracking-widest">{t('player_hide_overlay')}</div>
            {HIDE_DELAYS.map(d => (
              <button key={d.ms} onClick={() => { setHideDelay(d.ms); setSettingsPanel(null); }}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 text-white text-sm">
                {d.label} {hideDelay === d.ms && <Check size={14} className="text-[color:var(--accent)]" />}
              </button>
            ))}
          </div>
        </div>
      )}
      {settingsPanel === 'next_ep' && (
        <div className="py-1">
          <button onClick={() => setSettingsPanel('main')} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/5 text-white/60 text-sm border-b border-white/5">
            <ChevronLeft size={14} />Popup prossimo episodio
          </button>
          <div className="px-4 py-2 text-xs text-white/40">{t('player_next_ep_hint')}</div>
          {NEXT_EP_THRESHOLDS.map(th => (
            <button key={th} onClick={() => { setNextEpThreshold(th); setSettingsPanel(null); }}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 text-white text-sm">
              {th} {t('player_seconds_before')} {nextEpThreshold === th && <Check size={14} className="text-[color:var(--accent)]" />}
            </button>
          ))}
          <button onClick={() => { setNextEpThreshold(9999); setSettingsPanel(null); }}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 text-white text-sm">
            {t('player_never')} {nextEpThreshold === 9999 && <Check size={14} className="text-[color:var(--accent)]" />}
          </button>
        </div>
      )}
    </div>
  );

  // ── Episode list panel (overlay laterale) ──────────────────────────────────
  const EpisodeListPanel = () => {
    const [panelSeason, setPanelSeason] = useState(season ?? episodeSeasons[0] ?? 1);
    const panelEps = episodesBySeason[panelSeason] ?? [];
    return (
      <div className="absolute top-0 right-0 bottom-0 z-30 w-80 bg-black/95 border-l border-white/10 flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <p className="text-sm font-bold text-white">{t('episodes')}</p>
          <button onClick={() => setShowEpisodeList(false)} className="p-1.5 text-white/40 hover:text-white">
            <X size={16} />
          </button>
        </div>
        {episodeSeasons.length > 1 && (
          <div className="px-3 py-2 border-b border-white/10 flex-shrink-0">
            <select value={panelSeason} onChange={e => setPanelSeason(Number(e.target.value))}
              className="w-full bg-white/10 text-white text-sm px-2 py-1.5 rounded-lg border border-white/10 focus:outline-none"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
              {episodeSeasons.map(s => (
                <option key={s} value={s} style={{ backgroundColor: '#1a1a22', color: 'white' }}>
                  {s === 0 ? t('specials') : `${t('season')} ${s}`}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {panelEps.map(ep => {
            const isCurrent = ep.season === season && ep.episode === episode;
            return (
              <button key={ep.id} onClick={() => { onEpisodeSelect?.(ep.id); setShowEpisodeList(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 border-b border-white/5 text-left transition-colors ${isCurrent ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                {ep.thumbnail
                  ? <img src={ep.thumbnail} alt="" className="w-20 h-[45px] rounded object-cover flex-shrink-0" />
                  : <div className="w-20 h-[45px] rounded bg-white/10 flex-shrink-0 flex items-center justify-center text-white/30 text-xs font-bold">{ep.episode}</div>}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${isCurrent ? 'text-white' : 'text-white/70'}`}>
                    {ep.season && ep.episode ? `${ep.season}×${String(ep.episode).padStart(2,'0')} ` : ''}{ep.title}
                  </p>
                  {isCurrent && <p className="text-[10px] mt-0.5" style={{ color: 'var(--accent)' }}>{t('player_now_playing')}</p>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Error screen ───────────────────────────────────────────────────────────
  if (error) return createPortal((
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black">
      {bgImg && <>
        <img src={bgImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15 blur-2xl scale-110" />
        <div className="absolute inset-0 bg-black/80" />
      </>}
      <div className="relative z-10 flex flex-col items-center gap-5 text-center max-w-sm px-6">
        {poster && <img src={poster} alt={title} className="h-32 rounded-2xl shadow-2xl border border-white/10" />}
        {title && <p className="text-white font-bold text-lg">{title}</p>}
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 w-full text-left space-y-2">
          <p className="text-red-400 font-semibold text-sm">{t('stream_unavailable')}</p>
          <p className="text-white/50 text-xs">{error}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setError(null); setBuffering(true); const v = vidRef.current; if (v) { v.load(); v.play().catch(() => {}); } }}
            className="flex items-center gap-2 py-2.5 px-5 text-sm text-white bg-white/10 hover:bg-white/20 rounded-xl">{t('retry')}</button>
          <button onClick={handleClose} className="flex items-center gap-2 py-2.5 px-5 text-sm text-white bg-white/10 hover:bg-white/20 rounded-xl">
            <ArrowLeft size={14} />{t('change_stream')}
          </button>
        </div>
      </div>
    </div>
  ), document.body);

  // ── Main HTML5 player ──────────────────────────────────────────────────────
  return createPortal((
    <div className={`fixed inset-0 z-[100] select-none ${usesMpv ? '' : 'bg-black'}`}
      onMouseMove={resetHide}
      onClick={() => {
        if (settingsPanel) { setSettingsPanel(null); return; }
        if (showEpisodeList) { setShowEpisodeList(false); return; }
        togglePlay(); resetHide();
      }}>
      {showPlayerIndicator && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-white/15 backdrop-blur-md border border-white/10 text-sm text-white/80">
          {usesMpv ? 'Native MPV' : 'Playing via Browser'}
        </div>
      )}
      {!usesMpv && (
      <video ref={vidRef} className="absolute inset-0 w-full h-full"
        style={{ objectFit: aspectRatio === 'cover' ? 'cover' : aspectRatio === 'fill' ? 'fill' : 'contain' }}
        playsInline>
        {subtitleTracks.map(s => (
          <track key={s.lang} kind="subtitles" label={s.label} srcLang={s.lang} src={s.url}
            default={s.lang === activeSub} />
        ))}
      </video>
      )}

      {/* Buffering */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 pointer-events-none">
          {bgImg && <img src={bgImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-xl" />}
          <div className="relative flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white/60 text-sm">{t('loading')}</p>
          </div>
        </div>
      )}

      {/* Cast overlay — solo su pausa, solo dopo aver riprodotto, solo in modalità finestra */}
      {showCastPanel && cast.length > 0 && !playing && hasPlayedOnce && !document.fullscreenElement && (
        <div className="absolute inset-0 z-10 flex items-end pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)' }}>
          <div className="w-full px-6 pb-28">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">{t('cast')}</p>
            <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {cast.slice(0, 12).map((p, i) => (
                <div key={i} className="flex-shrink-0 flex flex-col items-center gap-1.5 w-16">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/20 bg-white/10">
                    {p.photo
                      ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover object-top"
                          onError={e => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(p.name)}`; }} />
                      : <img src={`https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(p.name)}`} alt={p.name} className="w-full h-full object-cover" />}
                  </div>
                  <p className="text-white/80 text-[10px] font-semibold text-center leading-tight line-clamp-2">{p.name}</p>
                  {p.character && <p className="text-white/40 text-[9px] text-center leading-tight line-clamp-1">{p.character}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className={`absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-5 py-4
        bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300
        ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button onClick={e => { e.stopPropagation(); handleClose(); }}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          {title && <p className="text-white font-semibold text-base truncate">{title}</p>}
          {subtitle && <p className="text-white/50 text-xs truncate">{subtitle}</p>}
        </div>
        {allEpisodes.length > 0 && onEpisodeSelect && (
          <button onClick={e => { e.stopPropagation(); setShowEpisodeList(v => !v); setSettingsPanel(null); }}
            className={`p-2 rounded-full transition-colors ${showEpisodeList ? 'bg-white/20 text-white' : 'bg-white/10 hover:bg-white/20 text-white/70'}`}
            title={t('player_episode_list')}>
            <List size={18} />
          </button>
        )}
      </div>

      {/* Next episode card */}
      {showNextCard && nextEpisode && nextEpThreshold < 9999 && (
        <div className="absolute bottom-24 right-6 z-20 w-72">
          <div className="bg-black/95 border border-white/15 rounded-2xl overflow-hidden shadow-2xl">
            {nextEpisode.thumbnail ? (
              <div className="relative w-full h-36">
                <img src={nextEpisode.thumbnail} alt={nextEpisode.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute top-2 left-3">
                  <span className="text-[10px] text-white/60 uppercase tracking-widest font-bold bg-black/40 px-2 py-0.5 rounded">{t('next_episode')}</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-12 bg-white/5 flex items-center px-4">
                <p className="text-[10px] text-white/40 uppercase tracking-widest">{t('next_episode')}</p>
              </div>
            )}
            <div className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{nextEpisode.title}</p>
                <p className="text-white/40 text-xs mt-0.5">
                  {secsLeft > 0 ? t('starting_in').replace('{s}', String(secsLeft)) : t('loading')}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {onPlayNextEpisode && (
                  <button onClick={handlePlayNextEpisode}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-white font-semibold"
                    style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
                    <Play size={12} className="fill-white" />{t('watch_label')}
                  </button>
                )}
                <button onClick={e => { e.stopPropagation(); setShowNextCard(false); }}
                  className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/10">
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings menu */}
      {settingsPanel && <SettingsMenu />}

      {/* Episode list panel */}
      {showEpisodeList && allEpisodes.length > 0 && <EpisodeListPanel />}

      {/* Bottom controls */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300
        ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-gradient-to-t from-black/95 via-black/70 to-transparent px-5 pt-10 pb-5">
          <div className="mb-3 group cursor-pointer"
            onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / r.width); }}>
              <div className="h-1 group-hover:h-2 transition-all rounded-full bg-white/20 relative">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${(usesMpv && nativeMpv.duration > 0 ? (nativeMpv.timePos / nativeMpv.duration) * 100 : progress * 100)}%` }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${progress * 100}% - 6px)` }} />
            </div>
          </div>
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {prevEpisode && onPrev && (
              <button onClick={onPrev} className="p-2 text-white/60 hover:text-white" title={prevEpisode.title}>
                <SkipBack size={18} />
              </button>
            )}
            <button onClick={() => seekRelative(-10)} className="p-2 text-white/60 hover:text-white" title={t('seek_back_10s')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.5 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 16a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" opacity=".3"/>
                <path d="M12.5 3a9 9 0 0 0-9 9h2a7 7 0 0 1 7-7V3z"/>
                <path d="M6.5 5.5 5.09 4.09A9 9 0 0 0 3.5 12h2a7 7 0 0 1 1.2-3.95L5.5 6.8 6.5 5.5z"/>
                <text x="8.5" y="15" fontSize="6" fontWeight="bold" fill="currentColor">10</text>
              </svg>
            </button>
            <button onClick={togglePlay} className="p-2.5 rounded-full bg-white text-black hover:bg-white/90">
              {(usesMpv ? (nativeMpv.playing && !nativeMpv.paused) : playing) ? <Pause size={18} /> : <Play size={18} className="fill-black ml-0.5" />}
            </button>
            <button onClick={() => seekRelative(10)} className="p-2 text-white/60 hover:text-white" title={t('seek_forward_10s')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.5 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 16a7 7 0 1 0 0-14 7 7 0 0 0 0 14z" opacity=".3"/>
                <path d="M11.5 3a9 9 0 0 1 9 9h-2a7 7 0 0 0-7-7V3z"/>
                <path d="M17.5 5.5 18.91 4.09A9 9 0 0 1 20.5 12h-2a7 7 0 0 0-1.2-3.95l1.2-1.25L17.5 5.5z"/>
                <text x="8" y="15" fontSize="6" fontWeight="bold" fill="currentColor">10</text>
              </svg>
            </button>
            {nextEpisode && onPlayNextEpisode && (
              <button onClick={handlePlayNextEpisode} className="p-2 text-white/60 hover:text-white" title={nextEpisode.title}>
                <SkipForward size={18} />
              </button>
            )}
            <span className="text-white/70 text-sm font-mono tabular-nums ml-1">
              {fmtTime(usesMpv ? nativeMpv.timePos : currentTime)} / {fmtTime(usesMpv ? nativeMpv.duration : duration)}
            </span>
            <div className="flex-1" />
            <button onClick={toggleMute} className="p-2 text-white/60 hover:text-white">
              {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
              onChange={e => setVol(Number(e.target.value))} className="w-20 accent-white" />
            <button onClick={e => { e.stopPropagation(); setSettingsPanel(p => p ? null : 'main'); setShowEpisodeList(false); }}
              className={`p-2 transition-colors ${settingsPanel ? 'text-white' : 'text-white/60 hover:text-white'}`}>
              <Settings size={16} />
            </button>
            <button onClick={() => toggleFullscreen()} className="p-2 text-white/60 hover:text-white">
              <Maximize size={16} />
            </button>
            <button onClick={handleClose} className="p-2 text-white/60 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}