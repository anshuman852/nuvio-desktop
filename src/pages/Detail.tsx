import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import { fetchMeta, fetchAllStreams, launchMpv } from '../lib/addon-client';
import { MetaItem, Stream, Video } from '../lib/types';
import {
  Play,
  ArrowLeft,
  Star,
  Clock,
  Film,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';

// ─── StreamCard ───────────────────────────────────────────────────────────────

function StreamCard({
  stream,
  onPlay,
}: {
  stream: Stream;
  onPlay: (stream: Stream) => void;
}) {
  const hasUrl = Boolean(stream.url);

  return (
    <button
      onClick={() => hasUrl && onPlay(stream)}
      disabled={!hasUrl}
      className={clsx(
        'w-full text-left px-4 py-3 rounded-lg border transition-all duration-150',
        hasUrl
          ? 'border-white/10 bg-white/5 hover:bg-violet-600/20 hover:border-violet-500 cursor-pointer'
          : 'border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{stream.name}</p>
          {stream.title && (
            <p className="text-xs text-white/50 mt-0.5 truncate">{stream.title}</p>
          )}
          {stream.description && (
            <p className="text-xs text-white/40 mt-0.5 truncate">{stream.description}</p>
          )}
        </div>
        {hasUrl && (
          <Play size={16} className="text-violet-400 flex-shrink-0 mt-0.5" />
        )}
        {!hasUrl && stream.infoHash && (
          <span className="text-xs text-yellow-500/70 flex-shrink-0">torrent</span>
        )}
      </div>
    </button>
  );
}

// ─── EpisodeList ──────────────────────────────────────────────────────────────

function EpisodeList({
  videos,
  onSelect,
}: {
  videos: Video[];
  onSelect: (video: Video) => void;
}) {
  const seasons = [...new Set(videos.map((v) => v.season ?? 0))].sort((a, b) => a - b);
  const [activeSeason, setActiveSeason] = useState(seasons[0] ?? 0);

  const episodes = videos.filter((v) => (v.season ?? 0) === activeSeason);

  return (
    <div>
      {/* Season tabs */}
      {seasons.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {seasons.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSeason(s)}
              className={clsx(
                'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                activeSeason === s
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/10 text-white/60 hover:text-white'
              )}
            >
              {s === 0 ? 'Speciali' : `Stagione ${s}`}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1">
        {episodes.map((ep) => (
          <button
            key={ep.id}
            onClick={() => onSelect(ep)}
            className="w-full text-left px-4 py-3 rounded-lg bg-white/5 hover:bg-violet-600/20 border border-white/5 hover:border-violet-500 transition-all flex items-center gap-3"
          >
            {ep.thumbnail && (
              <img
                src={ep.thumbnail}
                alt=""
                className="w-20 h-12 rounded object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">
                {ep.season !== undefined && ep.episode !== undefined
                  ? `${ep.season}×${String(ep.episode).padStart(2, '0')} · `
                  : ''}
                {ep.title}
              </p>
              {ep.overview && (
                <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{ep.overview}</p>
              )}
            </div>
            <Play size={16} className="text-white/40 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export default function Detail() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const { addons, addToHistory } = useAppStore();

  const [meta, setMeta] = useState<MetaItem | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);

  const [streamGroups, setStreamGroups] = useState<
    { addon: string; streams: Stream[] }[]
  >([]);
  const [streamsLoading, setStreamsLoading] = useState(false);
  // streamsTarget rimosso

  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  // launching rimosso
  const [error, setError] = useState<string | null>(null);

  const decodedId = decodeURIComponent(id ?? '');

  // Fetch meta dal primo addon che supporta 'meta'
  useEffect(() => {
    if (!type || !decodedId || addons.length === 0) return;

    setMetaLoading(true);

    (async () => {
      let found: MetaItem | null = null;
      for (const addon of addons) {
        const m = await fetchMeta(addon.url, type, decodedId);
        if (m) { found = m; break; }
      }
      setMeta(found);
      setMetaLoading(false);

      // Per i film, carica gli stream subito
      if (found?.type === 'movie') {
        loadStreams(decodedId);
      }
    })();
  }, [type, decodedId, addons]);

  async function loadStreams(videoId: string) {
    setStreamsLoading(true);
    setStreamsTarget(videoId);
    setStreamGroups([]);
    setError(null);

    try {
      const groups = await fetchAllStreams(addons, type!, videoId);
      setStreamGroups(groups);
    } catch (e: any) {
      setError(e.message ?? 'Errore nel caricamento degli stream');
    } finally {
      setStreamsLoading(false);
    }
  }

  function handleEpisodeSelect(video: Video) {
    setSelectedVideo(video);
    loadStreams(video.id);
  }

  async function handlePlay(stream: Stream) {
    if (!stream.url) return;
    setLaunching(true);
    try {
      const title = meta
        ? selectedVideo
          ? `${meta.name} – ${selectedVideo.title}`
          : meta.name
        : undefined;

      await launchMpv(stream.url, title);

      if (meta) {
        addToHistory({
          id: decodedId,
          type: type!,
          name: meta.name,
          poster: meta.poster,
          videoId: selectedVideo?.id,
        });
      }
    } catch (e: any) {
      setError(e.message ?? 'Impossibile avviare mpv');
    } finally {
      setLaunching(false);
    }
  }

  const isSeries = meta?.type === 'series';

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (metaLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-white/40">
        <Loader2 size={20} className="animate-spin" />
        <span>Caricamento...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative flex-shrink-0 h-72">
        {meta?.background ? (
          <img
            src={meta.background}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : meta?.poster ? (
          <img
            src={meta.poster}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-top blur-sm scale-105"
          />
        ) : null}
        {/* Gradiente */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f13] via-[#0f0f13]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f13]/80 to-transparent" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 flex items-center gap-1.5 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Indietro</span>
        </button>

        {/* Info */}
        <div className="absolute bottom-6 left-6 flex gap-4 items-end">
          {meta?.poster && (
            <img
              src={meta.poster}
              alt={meta?.name}
              className="w-28 rounded-lg shadow-2xl border border-white/10 flex-shrink-0"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">
              {meta?.name ?? decodedId}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {meta?.releaseInfo && (
                <span className="text-sm text-white/60">{meta.releaseInfo}</span>
              )}
              {meta?.imdbRating && (
                <span className="flex items-center gap-1 text-sm text-yellow-400">
                  <Star size={12} className="fill-yellow-400" />
                  {meta.imdbRating}
                </span>
              )}
              {meta?.runtime && (
                <span className="flex items-center gap-1 text-sm text-white/60">
                  <Clock size={12} />
                  {meta.runtime}
                </span>
              )}
              {meta?.genres && meta.genres.length > 0 && (
                <span className="flex items-center gap-1 text-sm text-white/60">
                  <Film size={12} />
                  {meta.genres.slice(0, 3).join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Contenuto ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Descrizione */}
        {meta?.description && (
          <div>
            <p className={clsx('text-sm text-white/70 leading-relaxed', !descExpanded && 'line-clamp-3')}>
              {meta.description}
            </p>
            {meta.description.length > 200 && (
              <button
                onClick={() => setDescExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs text-violet-400 mt-1 hover:text-violet-300"
              >
                {descExpanded ? <><ChevronUp size={12} /> Meno</> : <><ChevronDown size={12} /> Leggi di più</>}
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Episodi (serie) */}
        {isSeries && meta?.videos && meta.videos.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wider mb-3">
              Episodi
            </h2>
            <EpisodeList videos={meta.videos} onSelect={handleEpisodeSelect} />
          </div>
        )}

        {/* Stream */}
        {(streamsLoading || streamGroups.length > 0) && (
          <div>
            <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wider mb-3">
              {isSeries && selectedVideo
                ? `Stream · ${selectedVideo.title}`
                : 'Stream disponibili'}
            </h2>

            {streamsLoading ? (
              <div className="flex items-center gap-2 text-white/40 text-sm">
                <Loader2 size={16} className="animate-spin" />
                Ricerca stream...
              </div>
            ) : (
              <div className="space-y-4">
                {streamGroups.map((group) => (
                  <div key={group.addon}>
                    <p className="text-xs text-white/30 mb-1.5 truncate">{group.addon}</p>
                    <div className="space-y-1.5">
                      {group.streams.map((stream, i) => (
                        <StreamCard
                          key={i}
                          stream={stream}
                          onPlay={handlePlay}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Film: bottone play rapido se c'è un solo stream */}
        {!isSeries && !streamsLoading && streamGroups.length === 0 && !error && (
          <div className="text-center py-8 text-white/30 text-sm">
            Nessuno stream trovato tra gli addon installati.
          </div>
        )}
      </div>
    </div>
  );
}
