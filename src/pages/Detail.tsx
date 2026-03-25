import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAppStore, useActiveHistory } from '../lib/store';
import { fetchMeta, fetchAllStreams, launchMpv, StreamGroup } from '../lib/addon-client';
import { getTMDBDetails, tmdbImg } from '../api/tmdb';
import { MetaItem, Stream, Video } from '../lib/types';
import {
  Play, ArrowLeft, Star, Clock, Film, ChevronDown, ChevronUp,
  Loader2, AlertCircle, Tv, Users, ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Interfaccia persona (cast/crew) ─────────────────────────────────────────

interface Person {
  id: number;
  name: string;
  role: string;           // personaggio o ruolo (es. "Director")
  photo?: string;
  department?: string;
}

// ─── PersonCard ───────────────────────────────────────────────────────────────

function PersonCard({ person }: { person: Person }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <Link to={`/person/${person.id}`} className="flex-shrink-0 w-24 group text-center">
      <div className="w-24 h-24 rounded-full overflow-hidden bg-white/5 border-2 border-white/10 group-hover:border-[color:var(--accent)] transition-all mx-auto">
        {person.photo && !imgErr
          ? <img src={person.photo} alt={person.name} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform" onError={() => setImgErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-3xl bg-white/5">👤</div>}
      </div>
      <p className="mt-1.5 text-xs font-medium text-white/80 group-hover:text-white transition-colors line-clamp-1">{person.name}</p>
      <p className="text-xs text-white/40 line-clamp-1">{person.role}</p>
    </Link>
  );
}

// ─── StreamCard ───────────────────────────────────────────────────────────────

function StreamCard({ stream, onPlay }: { stream: Stream; onPlay: () => void }) {
  const hasUrl = Boolean(stream.url);
  return (
    <button onClick={() => hasUrl && onPlay()} disabled={!hasUrl}
      className={clsx('w-full text-left px-4 py-3 rounded-lg border transition-all duration-150 group',
        hasUrl ? 'border-white/10 bg-white/5 hover:bg-[color:var(--accent-bg)] hover:border-[color:var(--accent)] cursor-pointer'
               : 'border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{stream.name ?? 'Stream'}</p>
          {stream.title && <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{stream.title}</p>}
          {stream.description && <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{stream.description}</p>}
        </div>
        <div className="flex-shrink-0 mt-0.5">
          {hasUrl ? <Play size={15} style={{ color: 'var(--accent)' }} />
                  : stream.infoHash ? <span className="text-xs text-yellow-500/70 font-mono">torrent</span>
                  : null}
        </div>
      </div>
    </button>
  );
}

// ─── EpisodeList ──────────────────────────────────────────────────────────────

function EpisodeList({ videos, selectedId, onSelect }: {
  videos: Video[]; selectedId: string | null; onSelect: (v: Video) => void;
}) {
  const seasons = [...new Set(videos.map((v) => v.season ?? 0))].sort((a, b) => a - b);
  const [activeSeason, setActiveSeason] = useState(seasons[0] ?? 1);
  const episodes = videos.filter((v) => (v.season ?? 0) === activeSeason);

  return (
    <div>
      {seasons.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {seasons.map((s) => (
            <button key={s} onClick={() => setActiveSeason(s)}
              className={clsx('flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                activeSeason === s ? 'text-white' : 'bg-white/10 text-white/60 hover:text-white')}
              style={activeSeason === s ? { backgroundColor: 'var(--accent)' } : {}}>
              {s === 0 ? 'Speciali' : `Stagione ${s}`}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        {episodes.map((ep) => (
          <button key={ep.id} onClick={() => onSelect(ep)}
            className={clsx('w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3',
              selectedId === ep.id ? 'border-[color:var(--accent)] bg-[color:var(--accent-bg)]'
                                   : 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/20')}>
            {ep.thumbnail && <img src={ep.thumbnail} alt="" className="w-20 h-12 rounded object-cover flex-shrink-0 bg-white/5" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">
                {ep.season !== undefined && ep.episode !== undefined ? `${ep.season}×${String(ep.episode).padStart(2, '0')} · ` : ''}
                {ep.title}
              </p>
              {ep.overview && <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{ep.overview}</p>}
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
  const { addons, settings } = useAppStore();
  const history = useActiveHistory();

  const decodedId = decodeURIComponent(id ?? '');

  const [meta, setMeta] = useState<MetaItem | null>(null);
  const [tmdbData, setTmdbData] = useState<any>(null);
  const [cast, setCast] = useState<Person[]>([]);
  const [crew, setCrew] = useState<Person[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [streamGroups, setStreamGroups] = useState<StreamGroup[]>([]);
  const [streamsLoading, setStreamsLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [castExpanded, setCastExpanded] = useState(false);

  useEffect(() => {
    if (!type || !decodedId) return;
    setMetaLoading(true);

    (async () => {
      // Fetch meta da addon
      let found: MetaItem | null = null;
      const results = await Promise.allSettled(addons.map((a) => fetchMeta(a.url, type, decodedId)));
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) { found = r.value; break; }
      }
      setMeta(found);
      setMetaLoading(false);
      if (found?.type === 'movie') loadStreams(decodedId);

      // Fetch dati TMDB per cast (se disponibile token)
      const tmdbToken = settings.tmdbToken;
      if (tmdbToken) {
        try {
          // Estrai ID TMDB dall'ID stremio o cerca per titolo
          const tmdbType = type === 'series' ? 'tv' : 'movie';
          let tmdbId: number | null = null;

          if (decodedId.startsWith('tmdb:')) {
            tmdbId = parseInt(decodedId.replace('tmdb:', ''));
          } else if (decodedId.match(/^\d+$/)) {
            tmdbId = parseInt(decodedId);
          }

          if (tmdbId) {
            const data = await getTMDBDetails(tmdbType, tmdbId);
            if (data) {
              setTmdbData(data);
              // Cast
              const castRaw = data.credits?.cast ?? [];
              setCast(castRaw.slice(0, 30).map((c: any): Person => ({
                id: c.id, name: c.name,
                role: c.character ?? '',
                photo: c.profile_path ? tmdbImg(c.profile_path, 'w300') : undefined,
                department: 'Acting',
              })));
              // Crew (regista, sceneggiatori, ecc.)
              const crewRaw = data.credits?.crew ?? [];
              const importantCrew = crewRaw.filter((c: any) =>
                ['Director', 'Screenplay', 'Writer', 'Producer', 'Original Music Composer'].includes(c.job)
              );
              setCrew(importantCrew.slice(0, 10).map((c: any): Person => ({
                id: c.id, name: c.name,
                role: c.job,
                photo: c.profile_path ? tmdbImg(c.profile_path, 'w300') : undefined,
                department: c.department,
              })));
            }
          }
        } catch { /* TMDB non disponibile, ignora */ }
      }
    })();
  }, [type, decodedId, addons.length]);

  const loadStreams = useCallback(async (videoId: string) => {
    setStreamsLoading(true); setStreamGroups([]); setStreamError(null); setPlayError(null);
    try {
      const groups = await fetchAllStreams(addons, type!, videoId);
      setStreamGroups(groups);
      if (groups.length === 0) setStreamError('Nessun stream trovato. Installa Torrentio o altri addon stream.');
    } catch (e: any) {
      setStreamError(e.message ?? 'Errore nel caricamento degli stream');
    } finally { setStreamsLoading(false); }
  }, [addons, type]);

  function handleEpisodeSelect(video: Video) { setSelectedVideo(video); loadStreams(video.id); }

  async function handlePlay(stream: Stream) {
    if (!stream.url) return;
    setPlayError(null);
    try {
      const title = meta ? (selectedVideo ? `${meta.name} – ${selectedVideo.title}` : meta.name) : undefined;
      await launchMpv(stream.url, title);
      // Non usiamo addToHistory direttamente qui - gestito altrove
    } catch (e: any) {
      setPlayError(e.message ?? 'Impossibile avviare mpv.');
    }
  }

  const isSeries = meta?.type === 'series';

  if (metaLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-white/40">
        <Loader2 size={28} className="animate-spin" />
        <span className="text-sm">Caricamento...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Hero */}
      <div className="relative flex-shrink-0 h-64 md:h-72">
        {(meta?.background ?? tmdbData?.backdrop_path ? tmdbImg(tmdbData?.backdrop_path, 'w780') : meta?.poster) && (
          <img
            src={meta?.background ?? (tmdbData?.backdrop_path ? tmdbImg(tmdbData.backdrop_path, 'w780') : meta?.poster)}
            alt=""
            className={clsx('absolute inset-0 w-full h-full object-cover', !meta?.background && !tmdbData?.backdrop_path && 'object-top blur-sm scale-105')}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f13] via-[#0f0f13]/70 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f13]/90 via-[#0f0f13]/30 to-transparent" />

        <button onClick={() => navigate(-1)}
          className="absolute top-4 left-4 flex items-center gap-1.5 text-white/70 hover:text-white transition-colors bg-black/30 px-3 py-1.5 rounded-lg backdrop-blur-sm">
          <ArrowLeft size={16} /><span className="text-sm">Indietro</span>
        </button>

        <div className="absolute bottom-5 left-5 flex gap-4 items-end">
          {(meta?.poster ?? tmdbData?.poster_path) && (
            <img
              src={meta?.poster ?? tmdbImg(tmdbData?.poster_path, 'w300')}
              alt={meta?.name}
              className="w-24 md:w-28 rounded-lg shadow-2xl border border-white/10 flex-shrink-0"
            />
          )}
          <div className="pb-1">
            <div className="flex items-center gap-2 mb-1">
              {isSeries ? <Tv size={14} style={{ color: 'var(--accent)' }} /> : <Film size={14} style={{ color: 'var(--accent)' }} />}
              <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--accent)' }}>
                {isSeries ? 'Serie' : 'Film'}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white drop-shadow-lg">{meta?.name ?? decodedId}</h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {meta?.releaseInfo && <span className="text-xs text-white/60">{meta.releaseInfo}</span>}
              {(meta?.imdbRating ?? tmdbData?.vote_average) && (
                <span className="flex items-center gap-1 text-xs text-yellow-400 font-medium">
                  <Star size={11} className="fill-yellow-400" />
                  {meta?.imdbRating ?? tmdbData?.vote_average?.toFixed(1)}
                </span>
              )}
              {meta?.runtime && <span className="flex items-center gap-1 text-xs text-white/60"><Clock size={11} />{meta.runtime}</span>}
              {(meta?.genres ?? tmdbData?.genres?.map((g: any) => g.name)) && (
                <span className="text-xs text-white/50">
                  {(meta?.genres ?? tmdbData?.genres?.map((g: any) => g.name))?.slice(0, 3).join(' · ')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contenuto scrollabile */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 space-y-7 max-w-4xl">

          {/* Descrizione */}
          {(meta?.description ?? tmdbData?.overview) && (
            <div>
              <p className={clsx('text-sm text-white/70 leading-relaxed', !descExpanded && 'line-clamp-3')}>
                {meta?.description ?? tmdbData?.overview}
              </p>
              {(meta?.description ?? tmdbData?.overview ?? '').length > 180 && (
                <button onClick={() => setDescExpanded(v => !v)}
                  className="flex items-center gap-1 text-xs mt-1.5 hover:opacity-80" style={{ color: 'var(--accent)' }}>
                  {descExpanded ? <><ChevronUp size={12} /> Meno</> : <><ChevronDown size={12} /> Leggi di più</>}
                </button>
              )}
            </div>
          )}

          {/* Errore play */}
          {playError && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{playError}</span>
            </div>
          )}

          {/* Cast */}
          {cast.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-2">
                  <Users size={13} /> Cast
                </h2>
                {cast.length > 8 && (
                  <button onClick={() => setCastExpanded(v => !v)}
                    className="text-xs hover:opacity-80" style={{ color: 'var(--accent)' }}>
                    {castExpanded ? 'Mostra meno' : `Tutti (${cast.length})`}
                  </button>
                )}
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {(castExpanded ? cast : cast.slice(0, 10)).map((p) => (
                  <PersonCard key={p.id} person={p} />
                ))}
              </div>
            </div>
          )}

          {/* Crew */}
          {crew.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-2 mb-3">
                <Film size={13} /> Regia & Produzione
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {crew.map((p) => <PersonCard key={`${p.id}-${p.role}`} person={p} />)}
              </div>
            </div>
          )}

          {/* TMDB note se cast non disponibile */}
          {cast.length === 0 && !settings.tmdbToken && (
            <div className="flex items-center gap-2 text-white/30 text-xs">
              <ExternalLink size={11} />
              Aggiungi il token TMDB nelle impostazioni per vedere il cast completo.
            </div>
          )}

          {/* Episodi per le serie */}
          {isSeries && meta?.videos && meta.videos.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Episodi</h2>
              <EpisodeList videos={meta.videos} selectedId={selectedVideo?.id ?? null} onSelect={handleEpisodeSelect} />
            </div>
          )}

          {/* Stream */}
          {(streamsLoading || streamGroups.length > 0 || streamError) && (
            <div>
              <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                {isSeries && selectedVideo ? `Stream · ${selectedVideo.title}` : 'Stream disponibili'}
              </h2>
              {streamsLoading ? (
                <div className="flex items-center gap-2 text-white/40 text-sm py-4">
                  <Loader2 size={16} className="animate-spin" /> Ricerca stream...
                </div>
              ) : streamError ? (
                <div className="flex items-start gap-2 text-yellow-400/80 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{streamError}</span>
                </div>
              ) : (
                <div className="space-y-5">
                  {streamGroups.map((group) => (
                    <div key={group.addonUrl}>
                      <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--accent)' }}>{group.addonName}</p>
                      <div className="space-y-1.5">
                        {group.streams.map((stream, i) => (
                          <StreamCard key={i} stream={stream} onPlay={() => handlePlay(stream)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
