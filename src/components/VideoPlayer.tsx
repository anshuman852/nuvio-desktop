/// <reference types="vite/client" />
import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../lib/store';
import { upsertCW } from '../api/nuvio';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, X, ChevronRight, Volume2, VolumeX, Maximize } from 'lucide-react';

const HLS_CONFIG = {
  debug: false, enableWorker: true, lowLatencyMode: false,
  backBufferLength: 30, maxBufferLength: 50, maxMaxBufferLength: 80,
  maxFragLookUpTolerance: 0, maxBufferHole: 0,
  appendErrorMaxRetry: 20, nudgeMaxRetry: 20,
  manifestLoadingTimeOut: 30000, manifestLoadingMaxRetry: 10,
  fragLoadPolicy: { default: {
    maxTimeToFirstByteMs: 10000, maxLoadTimeMs: 120000,
    timeoutRetry: { maxNumRetry: 20, retryDelayMs: 0, maxRetryDelayMs: 15 },
    errorRetry: { maxNumRetry: 6, retryDelayMs: 1000, maxRetryDelayMs: 15 },
  }},
};

// Determina se un URL è HLS — NON fa HEAD request per localhost (WebView2 blocca CORS)
function detectHls(url: string): Promise<boolean> {
  // URL locali/proxy: sappiamo già che sono HLS
  if (url.includes('127.0.0.1:11470') || url.includes('localhost:11470')) return Promise.resolve(true);
  if (url.includes('.m3u8')) return Promise.resolve(true);
  // Per URL remoti: HEAD request per leggere Content-Type (come Stremio)
  return fetch(url, { method: 'HEAD' })
    .then(r => {
      const ct = r.headers.get('content-type') ?? '';
      return ct.includes('mpegurl') || ct.includes('m3u8');
    })
    .catch(() => false); // fallback: non è HLS
}

interface CastMember { name: string; character?: string; photo?: string; }
interface EpisodeRef { id: string; title: string; thumbnail?: string; streamUrl?: string; }
interface VideoPlayerProps {
  url: string; title?: string; subtitle?: string;
  contentId?: string; contentType?: string;
  poster?: string; backdrop?: string; cast?: CastMember[];
  season?: number; episode?: number;
  nextEpisode?: EpisodeRef | null; prevEpisode?: { id: string; title: string } | null;
  availableQualities?: { label: string; url: string }[];
  onClose: () => void; onNext?: () => void; onPrev?: () => void; initialProgress?: number;
}

function fmtTime(s: number) {
  if (!s || !isFinite(s)) return '0:00';
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60);
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

export default function VideoPlayer(props: VideoPlayerProps) {
  const { url, title, subtitle, contentId, contentType, poster, backdrop, cast = [],
    season, episode, nextEpisode, prevEpisode, onClose, onNext, onPrev, initialProgress = 0 } = props;

  const { nuvioUser, upsertWatch } = useStore();
  const vidRef    = useRef<HTMLVideoElement>(null);
  const hlsRef    = useRef<any>(null);
  const cwTimer   = useRef<ReturnType<typeof setInterval>>();
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const [ready,        setReady]        = useState(false);
  const [buffering,    setBuffering]     = useState(true);
  const [error,        setError]         = useState<string | null>(null);
  const [mpvError,     setMpvError]      = useState<string | null>(null);
  const [playing,      setPlaying]       = useState(false);
  const [currentTime,  setCurrentTime]   = useState(0);
  const [duration,     setDuration]      = useState(0);
  const [volume,       setVolume]        = useState(1);
  const [muted,        setMuted]         = useState(false);
  const [showControls, setShowControls]  = useState(true);
  const [showNextCard, setShowNextCard]  = useState(false);
  const [nextTriggered,setNextTriggered] = useState(false);

  const bgImg    = backdrop || poster;
  const isMagnet = url.startsWith('magnet:');

  // ── CW sync ──────────────────────────────────────────────────────────────
  const syncCW = useCallback((t: number, d: number) => {
    if (!contentId || d < 5) return;
    const progress = t / d;
    upsertWatch({ id: contentId, type: contentType ?? 'movie', name: title ?? '',
      poster, videoId: contentId, season, episode, progress, duration: d });
    if (nuvioUser?.token && nuvioUser.id)
      upsertCW(nuvioUser.id, { id: contentId, type: contentType ?? 'movie', name: title ?? '',
        poster, videoId: contentId, season, episode, progress, duration: d }).catch(() => {});
  }, [contentId, contentType, title, poster, season, episode, nuvioUser]);

  useEffect(() => {
    cwTimer.current = setInterval(() => {
      const v = vidRef.current;
      if (v && !v.paused && v.duration > 0) syncCW(v.currentTime, v.duration);
    }, 5000);
    return () => clearInterval(cwTimer.current);
  }, [syncCW]);

  // ── Magnet: lancia mpv e ferma quando si chiude ───────────────────────────
  useEffect(() => {
    if (!isMagnet) return;
    setBuffering(false);
    invoke('launch_mpv', { url, title: title ?? null })
      .catch(e => setMpvError(String(e)));
    // IMPORTANTE: ferma mpv quando il componente si smonta
    return () => { invoke('mpv_stop').catch(() => {}); };
  }, [url, isMagnet]);

  // ── HTML5 + HLS.js per tutti gli altri stream ─────────────────────────────
  useEffect(() => {
    if (isMagnet) return;
    const v = vidRef.current;
    if (!v) return;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    v.src = '';
    setReady(false); setBuffering(true); setError(null);
    setPlaying(false); setCurrentTime(0); setDuration(0);
    setShowNextCard(false); setNextTriggered(false);

    let cancelled = false;

    detectHls(url).then(isHls => {
      if (cancelled || !v) return;

      if (isHls) {
        import('hls.js').then(({ default: Hls }) => {
          if (cancelled) return;
          if (Hls.isSupported()) {
            const hls = new Hls(HLS_CONFIG as any);
            hlsRef.current = hls;
            hls.loadSource(url);
            hls.attachMedia(v);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (initialProgress > 0.01 && v.duration > 0)
                v.currentTime = v.duration * initialProgress;
              v.play().catch(() => {});
            });
            hls.on(Hls.Events.ERROR, (_: any, data: any) => {
              if (data.fatal) { setError(`HLS: ${data.details ?? data.type}`); setBuffering(false); }
            });
          } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
            v.src = url; v.load();
          } else {
            setError('HLS non supportato'); setBuffering(false);
          }
        });
      } else {
        v.src = url;
        v.load();
      }
    });

    return () => {
      cancelled = true;
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [url, isMagnet]);

  // ── Video event listeners ──────────────────────────────────────────────
  useEffect(() => {
    const v = vidRef.current;
    if (!v || isMagnet) return;
    const onCanPlay     = () => { setBuffering(false); setReady(true); v.play().catch(() => {}); };
    const onPlay        = () => { setPlaying(true); setBuffering(false); };
    const onPause       = () => setPlaying(false);
    const onWaiting     = () => setBuffering(true);
    const onPlaying     = () => { setBuffering(false); setReady(true); };
    const onTimeUpdate  = () => {
      setCurrentTime(v.currentTime);
      const rem = v.duration - v.currentTime;
      if (nextEpisode && rem < 35 && rem > 0 && !showNextCard) setShowNextCard(true);
      if (nextEpisode && onNext && rem < 5 && !nextTriggered && !v.paused) {
        setNextTriggered(true); syncCW(v.currentTime, v.duration); onNext();
      }
      if (!nextEpisode && v.duration > 0 && v.currentTime >= v.duration - 0.5) {
        syncCW(v.currentTime, v.duration); onClose();
      }
    };
    const onDuration = () => setDuration(v.duration);
    const onError    = () => { setError(v.error?.message ?? 'Errore caricamento'); setBuffering(false); };
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('play', onPlay); v.addEventListener('pause', onPause);
    v.addEventListener('waiting', onWaiting); v.addEventListener('playing', onPlaying);
    v.addEventListener('timeupdate', onTimeUpdate); v.addEventListener('durationchange', onDuration);
    v.addEventListener('error', onError);
    return () => {
      v.removeEventListener('canplay', onCanPlay); v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause); v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('playing', onPlaying); v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('durationchange', onDuration); v.removeEventListener('error', onError);
    };
  }, [url, isMagnet, showNextCard, nextTriggered]);

  function resetHide() {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 4000);
  }
  useEffect(() => { resetHide(); return () => clearTimeout(hideTimer.current); }, []);

  function handleClose() {
    if (isMagnet) invoke('mpv_stop').catch(() => {});
    onClose();
  }
  function togglePlay() { const v = vidRef.current; if (!v) return; v.paused ? v.play() : v.pause(); }
  function seek(pct: number) { const v = vidRef.current; if (v && duration > 0) v.currentTime = pct * duration; }
  function setVol(val: number) { const v = vidRef.current; if (v) { v.volume = val; setVolume(val); setMuted(val === 0); } }
  function toggleMute() { const v = vidRef.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); }

  const progress = duration > 0 ? currentTime / duration : 0;

  // ── Magnet screen ─────────────────────────────────────────────────────────
  if (isMagnet) return (
    <div className="fixed inset-0 bg-[#0c0c10] z-[100] flex items-center justify-center">
      {bgImg && <><img src={bgImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10 blur-2xl scale-110" /><div className="absolute inset-0 bg-black/80" /></>}
      <div className="relative z-10 flex flex-col items-center gap-6 max-w-md text-center px-8">
        {poster && <img src={poster} alt={title} className="h-28 rounded-xl shadow-2xl" />}
        {title && <p className="text-white font-bold text-xl">{title}</p>}
        {subtitle && <p className="text-white/60 text-sm">{subtitle}</p>}
        {mpvError ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 w-full text-left space-y-1">
            <p className="text-red-400 font-semibold text-sm">Impossibile avviare mpv</p>
            <p className="text-white/50 text-xs">{mpvError}</p>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
              <Play size={18} className="text-white fill-white ml-0.5" />
            </div>
            <p className="text-white/80 text-sm font-medium">Riproduzione torrent avviata</p>
            <p className="text-white/40 text-xs">Apertura nel player esterno...</p>
          </div>
        )}
        <button onClick={handleClose} className="text-white/40 hover:text-white text-sm flex items-center gap-1.5 mt-2">
          <ArrowLeft size={14} />Indietro
        </button>
      </div>
    </div>
  );

  // ── Error screen ──────────────────────────────────────────────────────────
  if (error) return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black">
      {bgImg && <><img src={bgImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15 blur-2xl scale-110" /><div className="absolute inset-0 bg-black/80" /></>}
      <div className="relative z-10 flex flex-col items-center gap-5 text-center max-w-sm px-6">
        {poster && <img src={poster} alt={title} className="h-32 rounded-2xl shadow-2xl border border-white/10" />}
        {title && <p className="text-white font-bold text-lg">{title}</p>}
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 w-full text-left space-y-2">
          <p className="text-red-400 font-semibold text-sm">Stream non disponibile</p>
          <p className="text-white/50 text-xs">{error}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setError(null); setBuffering(true); const v = vidRef.current; if(v){v.load();v.play().catch(()=>{});} }}
            className="flex items-center gap-2 py-2.5 px-5 text-sm text-white bg-white/10 hover:bg-white/20 rounded-xl">↻ Riprova</button>
          <button onClick={handleClose} className="flex items-center gap-2 py-2.5 px-5 text-sm text-white bg-white/10 hover:bg-white/20 rounded-xl">
            <ArrowLeft size={14} />Cambia stream</button>
        </div>
      </div>
    </div>
  );

  // ── Player ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] bg-black" onMouseMove={resetHide} onClick={resetHide}>
      <video ref={vidRef} className="absolute inset-0 w-full h-full object-contain" playsInline />

      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 pointer-events-none">
          {bgImg && <img src={bgImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-xl" />}
          <div className="relative flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white/60 text-sm">Caricamento...</p>
          </div>
        </div>
      )}

      {ready && cast.length > 0 && (
        <div className={`absolute bottom-20 left-6 z-10 pointer-events-none transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex gap-3">
            {cast.slice(0, 8).map((p, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 bg-white/10">
                  {p.photo
                    ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(p.name)}`; }} />
                    : <img src={`https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(p.name)}`} alt={p.name} className="w-full h-full object-cover" />}
                </div>
                <p className="text-white/40 text-[9px] truncate w-10 text-center">{p.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-5 py-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button onClick={handleClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-0">
          {title && <p className="text-white font-semibold text-base truncate">{title}</p>}
          {subtitle && <p className="text-white/50 text-xs truncate">{subtitle}</p>}
        </div>
      </div>

      {showNextCard && nextEpisode && (
        <div className="absolute top-16 right-6 z-20 bg-black/90 border border-white/20 rounded-2xl p-4 flex items-center gap-3 max-w-xs shadow-2xl">
          <div><p className="text-white/50 text-xs">Prossimo</p><p className="text-white text-sm font-medium truncate max-w-[140px]">{nextEpisode.title}</p></div>
          {onNext && <button onClick={() => { setShowNextCard(false); syncCW(currentTime, duration); onNext(); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-white font-medium flex-shrink-0" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
            <ChevronRight size={14} />Vai</button>}
          <button onClick={() => setShowNextCard(false)} className="text-white/40 hover:text-white flex-shrink-0"><X size={14} /></button>
        </div>
      )}

      <div className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-gradient-to-t from-black/95 via-black/70 to-transparent px-5 pt-10 pb-5">
          <div className="mb-3 h-1 bg-white/20 rounded-full cursor-pointer hover:h-2 transition-all"
            onClick={e => { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / r.width); }}>
            <div className="h-full rounded-full bg-white" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="flex items-center gap-3">
            {prevEpisode && onPrev && <button onClick={onPrev} className="p-2 text-white/60 hover:text-white"><SkipBack size={18} /></button>}
            <button onClick={togglePlay} className="p-2.5 rounded-full bg-white text-black hover:bg-white/90">
              {playing ? <Pause size={18} /> : <Play size={18} className="fill-black ml-0.5" />}
            </button>
            {nextEpisode && onNext && <button onClick={onNext} className="p-2 text-white/60 hover:text-white"><SkipForward size={18} /></button>}
            <span className="text-white/70 text-sm font-mono tabular-nums">{fmtTime(currentTime)} / {fmtTime(duration)}</span>
            <div className="flex-1" />
            <button onClick={toggleMute} className="p-2 text-white/60 hover:text-white">
              {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
              onChange={e => setVol(Number(e.target.value))} className="w-20 accent-white" />
            <button onClick={() => vidRef.current?.requestFullscreen?.()} className="p-2 text-white/60 hover:text-white"><Maximize size={16} /></button>
            <button onClick={handleClose} className="p-2 text-white/60 hover:text-white"><X size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
