/// <reference types="vite/client" />
import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useStore } from '../lib/store';
import { upsertCW } from '../api/nuvio';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, X, ChevronRight } from 'lucide-react';

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
  nextEpisode?: EpisodeRef | null;
  prevEpisode?: { id: string; title: string } | null;
  availableQualities?: { label: string; url: string }[];
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  initialProgress?: number;
}

function extractReferrer(url: string): string | undefined {
  try {
    const m = url.match(/[&?]?h=Referer%3A([^&/]+)/i) || url.match(/h=Referer:([^&/]+)/i);
    if (m) return decodeURIComponent(m[1]);
  } catch { }
  return undefined;
}

function fmtTime(s: number) {
  if (!s || !isFinite(s)) return '0:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

export default function VideoPlayer(props: VideoPlayerProps) {
  const { url, title, subtitle, contentId, contentType, poster, backdrop, cast = [],
    season, episode, nextEpisode, prevEpisode, onClose, onNext, onPrev, initialProgress = 0 } = props;

  const { nuvioUser, upsertWatch } = useStore();
  const [launched, setLaunched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showNextCard, setShowNextCard] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const bgImg = backdrop || poster;

  // Lancia mpv
  useEffect(() => {
    const referrer = extractReferrer(url);
    invoke('launch_mpv_stream', { url, title: title ?? null, referrer: referrer ?? null })
      .then(() => setLaunched(true))
      .catch(e => setError(String(e)));
    return () => { invoke('mpv_stop').catch(() => {}); };
  }, [url]);

  // Seek iniziale
  useEffect(() => {
    if (!launched || initialProgress < 0.01) return;
    setTimeout(async () => {
      try {
        const dur = await invoke<number>('mpv_get_duration');
        if (dur > 0) await invoke('mpv_command', { cmd: 'seek', args: [dur * initialProgress, 'absolute'] });
      } catch { }
    }, 2000);
  }, [launched]);

  // Ascolta eventi Tauri da mpv (emessi dal thread Rust)
  useEffect(() => {
    if (!launched) return;
    const unsubs: Array<() => void> = [];

    listen<number>('mpv_position', e => {
      const pos = e.payload ?? 0;
      setPosition(pos);
      if (duration > 0) {
        const prog = pos / duration;
        upsertWatch({ id: contentId ?? '', type: contentType ?? 'movie', name: title ?? '',
          poster, videoId: contentId, season, episode, progress: prog, duration });
        if (nuvioUser?.token && nuvioUser.id)
          upsertCW(nuvioUser.id, { id: contentId ?? '', type: contentType ?? 'movie', name: title ?? '',
            poster, videoId: contentId, season, episode, progress: prog, duration }).catch(() => {});
        if (nextEpisode && (duration - pos) < 35 && !showNextCard) setShowNextCard(true);
      }
    }).then(f => unsubs.push(f));

    listen<number>('mpv_duration', e => setDuration(e.payload ?? 0)).then(f => unsubs.push(f));
    listen('mpv_ended', () => { onClose(); }).then(f => unsubs.push(f));

    return () => unsubs.forEach(f => f());
  }, [launched, duration, showNextCard]);

  function resetHide() {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 4000);
  }
  useEffect(() => { resetHide(); return () => clearTimeout(hideTimer.current); }, []);

  function handleClose() { invoke('mpv_stop').catch(() => {}); onClose(); }
  async function togglePause() {
    try { await invoke('mpv_command', { cmd: 'cycle', args: ['pause'] }); setPaused(p => !p); } catch { }
  }
  async function seek(to: number) {
    try { await invoke('mpv_command', { cmd: 'seek', args: [to, 'absolute'] }); } catch { }
  }

  if (error) return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black">
      {bgImg && <><img src={bgImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15 blur-2xl scale-110" /><div className="absolute inset-0 bg-black/80" /></>}
      <div className="relative z-10 flex flex-col items-center gap-5 text-center max-w-sm px-6">
        {poster && <img src={poster} alt={title} className="h-32 rounded-2xl shadow-2xl border border-white/10" />}
        {title && <p className="text-white font-bold text-lg">{title}</p>}
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 w-full text-left space-y-2">
          <p className="text-red-400 font-semibold text-sm">Impossibile avviare il player</p>
          <p className="text-white/50 text-xs">{error}</p>
          <p className="text-white/30 text-xs">Verifica che mpv.exe sia nella cartella dell'app.</p>
        </div>
        <button onClick={handleClose} className="flex items-center gap-2 py-2.5 px-6 text-sm text-white bg-white/10 hover:bg-white/20 rounded-xl">
          <ArrowLeft size={14} />Indietro
        </button>
      </div>
    </div>
  );

  const progress = duration > 0 ? position / duration : 0;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" onMouseMove={resetHide} onClick={resetHide}>
      {/* Loading */}
      {!launched && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          {bgImg && <img src={bgImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-xl" />}
          <div className="relative flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white/60 text-sm">Avvio riproduzione...</p>
          </div>
        </div>
      )}

      {/* Cast — visibile quando mpv è aperto */}
      {launched && cast.length > 0 && (
        <div className="absolute bottom-20 left-6 z-10 pointer-events-none">
          <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2">Cast</p>
          <div className="flex gap-3">
            {cast.slice(0, 8).map((p, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-11 h-11 rounded-full overflow-hidden border border-white/20 bg-white/10">
                  {p.photo
                    ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(p.name)}`; }} />
                    : <img src={`https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(p.name)}`} alt={p.name} className="w-full h-full object-cover" />}
                </div>
                <p className="text-white/40 text-[9px] truncate w-11 text-center">{p.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className={`absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-5 py-4 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button onClick={handleClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-0">
          {title && <p className="text-white font-semibold text-base truncate">{title}</p>}
          {subtitle && <p className="text-white/50 text-xs truncate">{subtitle}</p>}
        </div>
      </div>

      {/* Next episode card */}
      {showNextCard && nextEpisode && (
        <div className="absolute top-16 right-6 z-20 bg-black/90 border border-white/20 rounded-2xl p-4 flex items-center gap-3 max-w-xs">
          <div><p className="text-white/50 text-xs">Prossimo</p><p className="text-white text-sm font-medium truncate max-w-[150px]">{nextEpisode.title}</p></div>
          {onNext && <button onClick={() => { setShowNextCard(false); onNext(); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-white font-medium flex-shrink-0" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
            <ChevronRight size={14} />Vai
          </button>}
          <button onClick={() => setShowNextCard(false)} className="text-white/40 hover:text-white flex-shrink-0"><X size={14} /></button>
        </div>
      )}

      {/* Bottom controls */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-gradient-to-t from-black/90 via-black/60 to-transparent px-5 pt-10 pb-5">
          {/* Progress */}
          <div className="mb-3 h-1 bg-white/20 rounded-full cursor-pointer hover:h-1.5 transition-all"
            onClick={e => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * duration); }}>
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="flex items-center gap-4">
            {prevEpisode && onPrev && <button onClick={onPrev} className="p-2 text-white/60 hover:text-white"><SkipBack size={18} /></button>}
            <button onClick={togglePause} className="p-2.5 rounded-full bg-white text-black hover:bg-white/90">
              {paused ? <Play size={18} className="fill-black ml-0.5" /> : <Pause size={18} />}
            </button>
            {nextEpisode && onNext && <button onClick={onNext} className="p-2 text-white/60 hover:text-white"><SkipForward size={18} /></button>}
            <span className="text-white/70 text-sm font-mono">{fmtTime(position)} / {fmtTime(duration)}</span>
            <div className="flex-1" />
            <input type="range" min={0} max={100} defaultValue={100}
              onChange={e => invoke('mpv_command', { cmd: 'set_property', args: ['volume', Number(e.target.value)] }).catch(() => {})}
              className="w-20 accent-white" />
            <button onClick={handleClose} className="p-2 text-white/60 hover:text-white"><X size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
