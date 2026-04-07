/// <reference types="vite/client" />
import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../lib/store';
import { upsertCW } from '../api/nuvio';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize, X, ChevronRight, ExternalLink } from 'lucide-react';

interface CastMember { name: string; character?: string; photo?: string; }
interface EpisodeRef { id: string; title: string; thumbnail?: string; streamUrl?: string; }

interface VideoPlayerProps {
  url: string;
  title?: string;
  subtitle?: string;
  contentId?: string;
  contentType?: string;
  poster?: string;
  backdrop?: string;
  cast?: CastMember[];
  season?: number;
  episode?: number;
  episodeTitle?: string;
  nextEpisode?: EpisodeRef | null;
  prevEpisode?: { id: string; title: string } | null;
  availableQualities?: { label: string; url: string }[];
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  initialProgress?: number;
}

// Estrae referrer da URL WebStreamr (127.0.0.1:11470/proxy/h=Referer:URL/...)
function extractReferrer(url: string): string | undefined {
  try {
    if (!url.includes('11470/proxy/') && !url.includes('11470/proxy')) return undefined;
    const hMatch = url.match(/[&?]?h=Referer%3A([^&/]+)/i) || url.match(/h=Referer:([^&/]+)/i);
    if (hMatch) return decodeURIComponent(hMatch[1]);
  } catch { }
  return undefined;
}

export default function VideoPlayer(props: VideoPlayerProps) {
  const {
    url, title, subtitle, contentId, contentType, poster, backdrop, cast = [],
    season, episode, nextEpisode, prevEpisode,
    onClose, onNext, onPrev, initialProgress = 0,
  } = props;

  const { nuvioUser, upsertWatch, traktAuth } = useStore();

  const [mpvLaunched, setMpvLaunched] = useState(false);
  const [mpvError, setMpvError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showNextCard, setShowNextCard] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const bgImg = backdrop || poster;
  const isSeries = contentType === 'series' || (season != null && episode != null);

  // Lancia mpv con tutti i parametri corretti
  useEffect(() => {
    const referrer = extractReferrer(url);
    invoke('launch_mpv_stream', {
      url,
      title: title ?? null,
      referrer: referrer ?? null,
    })
      .then(() => {
        setMpvLaunched(true);
        // Salta al punto iniziale se necessario
        if (initialProgress > 0.01) {
          setTimeout(async () => {
            try {
              const dur = await invoke<number>('mpv_get_duration');
              if (dur > 0) {
                await invoke('mpv_command', { cmd: 'seek', args: [dur * initialProgress, 'absolute'] });
              }
            } catch { }
          }, 2000);
        }
      })
      .catch(e => setMpvError(String(e)));

    return () => {
      invoke('mpv_stop').catch(() => {});
    };
  }, [url]);

  // Poll posizione mpv ogni 2s
  useEffect(() => {
    if (!mpvLaunched) return;
    pollRef.current = setInterval(async () => {
      try {
        const [pos, dur] = await Promise.all([
          invoke<number>('mpv_get_position'),
          invoke<number>('mpv_get_duration'),
        ]);
        setPosition(pos || 0);
        setDuration(dur || 0);

        // Auto-mostra card prossimo episodio
        if (nextEpisode && dur > 0 && (dur - pos) < 35 && !showNextCard) setShowNextCard(true);

        // CW sync ogni poll
        if (contentId && dur > 5) {
          const progress = pos / dur;
          upsertWatch({ id: contentId, type: contentType ?? 'movie', name: title ?? '', poster, videoId: contentId, season, episode, progress, duration: dur });
          if (nuvioUser?.token && nuvioUser.id)
            upsertCW(nuvioUser.id, { id: contentId, type: contentType ?? 'movie', name: title ?? '', poster, videoId: contentId, season, episode, progress, duration: dur }).catch(() => {});
        }
      } catch { /* mpv non risponde o terminato */ }
    }, 2000);
    return () => clearInterval(pollRef.current);
  }, [mpvLaunched, contentId, duration]);

  // Auto-hide controls
  function resetHide() {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 5000);
  }
  useEffect(() => { resetHide(); return () => clearTimeout(hideTimer.current); }, []);

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
  };

  async function togglePause() {
    try {
      await invoke('mpv_command', { cmd: 'cycle', args: ['pause'] });
      setPaused(p => !p);
    } catch { }
  }

  async function seek(to: number) {
    try { await invoke('mpv_command', { cmd: 'seek', args: [to, 'absolute'] }); } catch { }
  }

  async function changeVolume(v: number) {
    try { await invoke('mpv_command', { cmd: 'set_property', args: ['volume', v] }); } catch { }
  }

  function handleClose() {
    invoke('mpv_stop').catch(() => {});
    onClose();
  }

  const progress = duration > 0 ? position / duration : 0;

  // Schermata errore
  if (mpvError) return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black">
      {bgImg && <><img src={bgImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15 blur-2xl scale-110" /><div className="absolute inset-0 bg-black/80" /></>}
      <div className="relative z-10 flex flex-col items-center gap-5 text-center max-w-sm px-6">
        {poster && <img src={poster} alt={title} className="h-32 rounded-2xl shadow-2xl border border-white/10" />}
        {title && <p className="text-white font-bold text-lg">{title}</p>}
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 w-full text-left space-y-2">
          <p className="text-red-400 font-semibold text-sm">Impossibile avviare il player</p>
          <p className="text-white/50 text-xs">{mpvError}</p>
          <p className="text-white/30 text-xs">Assicurati che mpv.exe sia nella cartella dell'app.</p>
        </div>
        <button onClick={handleClose} className="flex items-center gap-2 py-2.5 px-6 text-sm text-white bg-white/10 hover:bg-white/20 rounded-xl">
          <ArrowLeft size={14} />Indietro
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[100] bg-black flex flex-col"
      onMouseMove={resetHide}
      onClick={resetHide}
    >
      {/* Backdrop quando mpv non ancora pronto */}
      {!mpvLaunched && bgImg && (
        <img src={bgImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-xl" />
      )}
      {!mpvLaunched && <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Avvio player...</p>
        </div>
      </div>}

      {/* Cast overlay (sinistra-basso, sempre visibile) */}
      {mpvLaunched && cast.length > 0 && (
        <div className="absolute bottom-20 left-6 z-10 pointer-events-none">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2 font-medium">Cast</p>
          <div className="flex gap-3">
            {cast.slice(0, 8).map((p, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-11 h-11 rounded-full overflow-hidden border border-white/20 bg-white/10">
                  {p.photo
                    ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(p.name)}`; }} />
                    : <img src={`https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(p.name)}`} alt={p.name} className="w-full h-full object-cover" />}
                </div>
                <p className="text-white/50 text-[9px] truncate w-11 text-center">{p.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className={`absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-5 py-4 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button onClick={handleClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          {title && <p className="text-white font-semibold text-base truncate">{title}</p>}
          {subtitle && <p className="text-white/50 text-xs truncate">{subtitle}</p>}
        </div>
      </div>

      {/* Next episode card */}
      {showNextCard && nextEpisode && (
        <div className="absolute top-16 right-6 z-20 bg-black/90 border border-white/20 rounded-2xl p-4 flex items-center gap-3 max-w-xs">
          <div>
            <p className="text-white/50 text-xs">Prossimo episodio</p>
            <p className="text-white text-sm font-medium">{nextEpisode.title}</p>
          </div>
          {onNext && (
            <button onClick={() => { setShowNextCard(false); onNext(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-white font-medium" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
              <ChevronRight size={14} />Vai
            </button>
          )}
          <button onClick={() => setShowNextCard(false)} className="text-white/40 hover:text-white"><X size={14} /></button>
        </div>
      )}

      {/* Bottom controls */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-gradient-to-t from-black/90 via-black/60 to-transparent px-5 pt-8 pb-5">
          {/* Progress bar */}
          <div className="mb-3 relative group">
            <div className="h-1 bg-white/20 rounded-full cursor-pointer hover:h-1.5 transition-all"
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                seek(pct * duration);
              }}>
              <div className="h-full rounded-full bg-white" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Prev ep */}
            {prevEpisode && onPrev && (
              <button onClick={onPrev} className="p-2 text-white/60 hover:text-white"><SkipBack size={18} /></button>
            )}

            {/* Play/pause */}
            <button onClick={togglePause} className="p-2.5 rounded-full bg-white text-black hover:bg-white/90 transition-colors">
              {paused ? <Play size={18} className="fill-black ml-0.5" /> : <Pause size={18} />}
            </button>

            {/* Next ep */}
            {nextEpisode && onNext && (
              <button onClick={onNext} className="p-2 text-white/60 hover:text-white"><SkipForward size={18} /></button>
            )}

            {/* Time */}
            <span className="text-white/70 text-sm font-mono">{formatTime(position)} / {formatTime(duration)}</span>

            <div className="flex-1" />

            {/* Volume */}
            <input type="range" min={0} max={100} defaultValue={100}
              onChange={e => changeVolume(Number(e.target.value))}
              className="w-20 accent-white" />

            {/* Chiudi */}
            <button onClick={handleClose} className="p-2 text-white/60 hover:text-white"><X size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
