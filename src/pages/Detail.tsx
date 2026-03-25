import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import { fetchMeta, fetchAllStreams, launchMpv, StreamGroup } from '../lib/addon-client';
import { MetaItem, Stream, Video } from '../lib/types';
import {
  Play, ArrowLeft, Star, Clock, Film,
  ChevronDown, ChevronUp, Loader2, AlertCircle, Tv,
} from 'lucide-react';
import clsx from 'clsx';

// ─── StreamCard ───────────────────────────────────────────────────────────────

function StreamCard({ stream, onPlay }: { stream: Stream; onPlay: () => void }) {
  const hasUrl = Boolean(stream.url);
  const isYt = Boolean((stream as any).ytId);

  return (
    <button
      onClick={() => hasUrl && onPlay()}
      disabled={!hasUrl && !isYt}
      className={clsx(
        'w-full text-left px-4 py-3 rounded-lg border transition-all duration-150 group',
        hasUrl
          ? 'border-white/10 bg-white/5 hover:bg-violet-600/20 hover:border-violet-500 cursor-pointer'
          : 'border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white group-hover:text-violet-200 transition-colors truncate">
            {stream.name ?? 'Stream'}
          </p>
          {stream.title && (
            <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{stream.title}</p>
          )}
          {stream.description && (
            <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{stream.description}</p>
          )}
        </div>
        <div className="flex-shrink-0 mt-0.5">
          {hasUrl
            ? <Play size={15} className="text-violet-400 group-hover:text-violet-300" />
            : stream.infoHash
            ? <span className="text-xs text-yellow-500/70 font-mono">torrent</span>
            : null}
        </div>
      </div>
    </button>
  );
}

// ─── EpisodeList ──────────────────────────────────────────────────────────────

function EpisodeList({
  videos,
  selectedId,
  onSelect,
}: {
  videos: Video[];
  selectedId: string | null;
  onSelect: (v: Video) => void;
}) {
  const seasons = [...new Set(videos.map((v) => v.season ?? 0))].sort((a, b) => a - b);
  const [activeSeason, setActiveSeason] = useState(seasons[0] ?? 1);
  const episodes = videos.filter((v) => (v.season ?? 0) === activeSeason);

  return (
    <div>
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
      <div className="space-y-1.5">
        {episodes.map((ep) => (
          <button
            key={ep.id}
            onClick={() => onSelect(ep)}
            className={clsx(
              'w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3',
              selectedId === ep.id
                ? 'bg-violet-600/20 border-violet-500'
                : 'bg-white/5 hover:bg-violet-600/10 border-white/5 hover:border-violet-500/50'
            )}
          >
            {ep.thumbnail && (
              <img
                src={ep.thumbnail}
                alt=""
                className="w-20 h-12 rounded object-cover flex-shrink-0 bg-white/5"
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
            <Play size={14} className="text-white/30 flex-shrink-0" />
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

  const decodedId = decodeURIComponent(id ?? '');

  const [meta, setMeta] = useState<MetaItem | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(false);

  const [streamGroups, setStreamGroups] = useState<StreamGroup[]>([]);
  const [streamsLoading, setStreamsLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);

  // ── Fetch meta ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!type || !decodedId) return;
    setMetaLoading(true);
    setMetaError(false);

    (async () => {
      let found: MetaItem | null = null;
      // Prova tutti gli addon in parallelo, prendi il primo che risponde
      const results = await Promise.allSettled(
        addons.map((a) => fetchMeta(a.url, type, decodedId))
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          found = r.value;
          break;
        }
      }
      setMeta(found);
      setMetaLoading(false);
      if (!found) setMetaError(true);

      // Film: carica stream subito
      if (found?.type === 'movie') {
        loadStreams(decodedId);
      }
    })();
  }, [type, decodedId, addons.length]);

  // ── Fetch streams ───────────────────────────────────────────────────────────
  const loadStreams = useCallback(async (videoId: string) => {
    setStreamsLoading(true);
    setStreamGroups([]);
    setStreamError(null);
    setPlayError(null);
    try {
      const groups = await fetchAllStreams(addons, type!, videoId);
      setStreamGroups(groups);
      if (groups.length === 0) {
        setStreamError('Nessun stream trovato. Installa Torrentio o altri addon stream.');
      }
    } catch (e: any) {
      setStreamError(e.message ?? 'Errore nel caricamento degli stream');
    } finally {
      setStreamsLoading(false);
    }
  }, [addons, type]);

  // ── Episode select ──────────────────────────────────────────────────────────
  function handleEpisodeSelect(video: Video) {
    setSelectedVideo(video);
    loadStreams(video.id);
  }

  // ── Play ────────────────────────────────────────────────────────────────────
  async function handlePlay(stream: Stream) {
    if (!stream.url) return;
    setPlayError(null);
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
      setPlayError(e.message ?? 'Impossibile avviare mpv. Assicurati che mpv.exe sia nella cartella dell\'app.');
    }
  }

  const isSeries = meta?.type === 'series';

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (metaLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-white/40">
        <Loader2 size={28} className="animate-spin" />
        <span className="text-sm">Caricamento...</span>
      </div>
    );
  }

  if (metaError && !meta) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-white/60 text-sm">Impossibile caricare i dettagli.</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg text-sm"
        >
          Torna indietro
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative flex-shrink-0 h-64 md:h-72">
        {(meta?.background || meta?.poster) && (
          <img
            src={meta!.background ?? meta!.poster}
            alt=""
            className={clsx(
              'absolute inset-0 w-full h-full object-cover',
              !meta!.background && 'object-top blur-sm scale-105'
            )}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f13] via-[#0f0f13]/70 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f13]/90 via-[#0f0f13]/30 to-transparent" />

        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 flex items-center gap-1.5 text-white/70 hover:text-white transition-colors bg-black/30 px-3 py-1.5 rounded-lg backdrop-blur-sm"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">Indietro</span>
        </button>

        <div className="absolute bottom-5 left-5 flex gap-4 items-end">
          {meta?.poster && (
            <img
              src={meta.poster}
              alt={meta.name}
              className="w-24 md:w-28 rounded-lg shadow-2xl border border-white/10 flex-shrink-0"
            />
          )}
          <div className="pb-1">
            <div className="flex items-center gap-2 mb-1">
              {isSeries
                ? <Tv size={14} className="text-violet-400" />
                : <Film size={14} className="text-violet-400" />}
              <span className="text-xs text-violet-400 uppercase tracking-wider font-medium">
                {isSeries ? 'Serie' : 'Film'}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white drop-shadow-lg leading-tight">
              {meta?.name ?? decodedId}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {meta?.releaseInfo && (
                <span className="text-xs text-white/60">{meta.releaseInfo}</span>
              )}
              {meta?.imdbRating && (
                <span className="flex items-center gap-1 text-xs text-yellow-400 font-medium">
                  <Star size={11} className="fill-yellow-400" />
                  {meta.imdbRating}
                </span>
              )}
              {meta?.runtime && (
                <span className="flex items-center gap-1 text-xs text-white/60">
                  <Clock size={11} />
                  {meta.runtime}
                </span>
              )}
              {meta?.genres && meta.genres.length > 0 && (
                <span className="text-xs text-white/50">{meta.genres.slice(0, 3).join(' · ')}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Contenuto scrollabile ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 space-y-6 max-w-4xl">

          {/* Descrizione */}
          {meta?.description && (
            <div>
              <p className={clsx(
                'text-sm text-white/70 leading-relaxed',
                !descExpanded && 'line-clamp-3'
              )}>
                {meta.description}
              </p>
              {meta.description.length > 180 && (
                <button
                  onClick={() => setDescExpanded((v) => !v)}
                  className="flex items-center gap-1 text-xs text-violet-400 mt-1.5 hover:text-violet-300"
                >
                  {descExpanded
                    ? <><ChevronUp size={12} /> Meno</>
                    : <><ChevronDown size={12} /> Leggi di più</>}
                </button>
              )}
            </div>
          )}

          {/* Errore play */}
          {playError && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{playError}</span>
            </div>
          )}

          {/* Episodi per le serie */}
          {isSeries && meta?.videos && meta.videos.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                Episodi
              </h2>
              <EpisodeList
                videos={meta.videos}
                selectedId={selectedVideo?.id ?? null}
                onSelect={handleEpisodeSelect}
              />
            </div>
          )}

          {/* Stream */}
          {(streamsLoading || streamGroups.length > 0 || streamError) && (
            <div>
              <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                {isSeries && selectedVideo
                  ? `Stream · ${selectedVideo.title}`
                  : 'Stream disponibili'}
              </h2>

              {streamsLoading ? (
                <div className="flex items-center gap-2 text-white/40 text-sm py-4">
                  <Loader2 size={16} className="animate-spin" />
                  Ricerca stream in corso...
                </div>
              ) : streamError ? (
                <div className="flex items-start gap-2 text-yellow-400/80 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{streamError}</span>
                </div>
              ) : (
                <div className="space-y-5">
                  {streamGroups.map((group) => (
                    <div key={group.addonUrl}>
                      <p className="text-xs text-violet-400/70 font-medium mb-2 uppercase tracking-wider">
                        {group.addonName}
                      </p>
                      <div className="space-y-1.5">
                        {group.streams.map((stream, i) => (
                          <StreamCard
                            key={i}
                            stream={stream}
                            onPlay={() => handlePlay(stream)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Prompt per serie: seleziona episodio */}
          {isSeries && !selectedVideo && !streamsLoading && streamGroups.length === 0 && (
            <div className="text-center py-6 text-white/30 text-sm border border-dashed border-white/10 rounded-xl">
              Seleziona un episodio per vedere gli stream disponibili
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
