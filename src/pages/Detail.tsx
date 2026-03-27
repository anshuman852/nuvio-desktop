/// <reference types="vite/client" />
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { fetchMeta, fetchAllStreams, launchPlayer, openExternal } from '../api/stremio';
import { getDetails, tmdbImg, hasTMDBKey } from '../api/tmdb';
import { MetaItem, Stream, StreamGroup, Video } from '../lib/types';
import {
  Play, ArrowLeft, Star, Clock, Film, ChevronDown, ChevronUp,
  Loader2, AlertCircle, Tv, Users, ExternalLink, Download, Magnet,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Stream Card ──────────────────────────────────────────────────────────────

function StreamCard({ stream, onPlay }: { stream: Stream; onPlay: () => void }) {
  const canPlay = Boolean(stream.url);
  const hasTorrent = Boolean(stream.infoHash);
  const quality = (stream.name ?? '' + ' ' + (stream.title ?? '')).match(/\b(4K|2160p|1080p|720p|480p|HDR|HEVC|x265|x264|BluRay|WEB-DL)\b/gi)?.join(' ') ?? '';
  const size = stream.behaviorHints?.videoSize ? `${(stream.behaviorHints.videoSize / 1e9).toFixed(1)} GB` : '';

  return (
    <button
      type="button"
      onClick={() => onPlay()}
      className={clsx(
        'w-full text-left px-4 py-3 rounded-xl border transition-all duration-150',
        canPlay
          ? 'border-white/10 bg-white/5 hover:bg-[color:var(--accent-bg)] hover:border-[color:var(--accent)] cursor-pointer active:scale-[0.99]'
          : 'border-white/5 bg-white/[0.03] opacity-50 cursor-pointer hover:bg-white/5'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{stream.name ?? 'Stream'}</p>
            {quality && <span className="text-xs px-1.5 py-0.5 rounded-md bg-white/10 text-white/70">{quality}</span>}
            {size && <span className="text-xs text-white/40">{size}</span>}
          </div>
          {stream.title && <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{stream.title}</p>}
          {stream.description && <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{stream.description}</p>}
          {hasTorrent && !canPlay && <p className="text-xs text-yellow-500/60 mt-1">🧲 torrent puro · serve Debrid o resolver</p>}
        </div>
        <div className="flex-shrink-0 mt-1">
          {canPlay && (
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{backgroundColor:'var(--accent-bg)'}}>
              <Play size={14} style={{color:'var(--accent)'}} className="ml-0.5 fill-[color:var(--accent)]" />
            </div>
          )}
          {!canPlay && hasTorrent && <Magnet size={14} className="text-yellow-500/50 mt-1" />}
        </div>
      </div>
    </button>
  );
}


// ─── Episode List ─────────────────────────────────────────────────────────────

function EpisodeList({ videos, selectedId, onSelect }: {
  videos: Video[]; selectedId: string | null; onSelect: (v: Video) => void;
}) {
  const seasons = [...new Set(videos.map(v => v.season ?? 0))].sort((a, b) => a - b);
  const [activeSeason, setActiveSeason] = useState(seasons[0] ?? 1);
  const episodes = videos.filter(v => (v.season ?? 0) === activeSeason);

  return (
    <div>
      {seasons.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {seasons.map(s => (
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
        {episodes.map(ep => (
          <button key={ep.id} onClick={() => onSelect(ep)}
            className={clsx('w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3',
              selectedId === ep.id
                ? 'border-[color:var(--accent)] bg-[color:var(--accent-bg)]'
                : 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/20')}>
            {ep.thumbnail && <img src={ep.thumbnail} alt="" className="w-20 h-12 rounded-lg object-cover flex-shrink-0 bg-white/5" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">
                {ep.season !== undefined && ep.episode !== undefined
                  ? `${ep.season}×${String(ep.episode).padStart(2, '0')} · `
                  : ''}
                {ep.title}
              </p>
              {ep.overview && <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{ep.overview}</p>}
            </div>
            <Play size={14} className="text-white/30 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Person Card ──────────────────────────────────────────────────────────────

function PersonCard({ person }: { person: { id: number; name: string; role: string; photo?: string } }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <Link to={`/person/${person.id}`} className="flex-shrink-0 w-20 group text-center">
      <div className="w-20 h-20 rounded-full overflow-hidden bg-white/5 border-2 border-white/10 group-hover:border-[color:var(--accent)] transition-all mx-auto">
        {person.photo && !imgErr
          ? <img src={person.photo} alt={person.name} className="w-full h-full object-cover object-top" onError={() => setImgErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>}
      </div>
      <p className="mt-1.5 text-xs font-medium text-white/80 group-hover:text-white line-clamp-1">{person.name}</p>
      <p className="text-xs text-white/40 line-clamp-1">{person.role}</p>
    </Link>
  );
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export default function Detail() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const { addons, settings, upsertWatch } = useStore();
  const decodedId = decodeURIComponent(id ?? '');

  const [meta, setMeta] = useState<MetaItem | null>(null);
  const [tmdb, setTmdb] = useState<any>(null);
  const [cast, setCast] = useState<any[]>([]);
  const [crew, setCrew] = useState<any[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [streamGroups, setStreamGroups] = useState<StreamGroup[]>([]);
  const [streamsLoading, setStreamsLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [castExpanded, setCastExpanded] = useState(false);
  const [launching, setLaunching] = useState(false);

  const isTmdbId = decodedId.startsWith('tmdb:');

  // ── Fetch meta ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!type || !decodedId) return;
    setMetaLoading(true);
    setMeta(null); setTmdb(null); setCast([]); setCrew([]);

    (async () => {
      let found: MetaItem | null = null;
      let tmdbNumId: number | null = null;

      if (isTmdbId) {
        // ID TMDB — usa TMDB API per metadata
        tmdbNumId = parseInt(decodedId.replace('tmdb:', ''));
      } else if (decodedId.match(/^\d+$/) && hasTMDBKey()) {
        tmdbNumId = parseInt(decodedId);
      }

      // Prova addon Stremio prima
      if (!isTmdbId) {
        const results = await Promise.allSettled(addons.map(a => fetchMeta(a.url, type, decodedId)));
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) { found = r.value; break; }
        }
      }

      // TMDB per arricchire o come fallback
      if (hasTMDBKey() && tmdbNumId) {
        try {
          const tmdbType = type === 'series' ? 'tv' : 'movie';
          const data = await getDetails(tmdbType, tmdbNumId);
          setTmdb(data);

          // Cast
          setCast((data.credits?.cast ?? []).slice(0, 30).map((c: any) => ({
            id: c.id, name: c.name, role: c.character ?? '',
            photo: c.profile_path ? tmdbImg(c.profile_path, 'w185') : undefined,
          })));

          // Crew (regista, sceneggiatori)
          setCrew((data.credits?.crew ?? [])
            .filter((c: any) => ['Director', 'Screenplay', 'Writer', 'Creator'].includes(c.job))
            .slice(0, 8)
            .map((c: any) => ({
              id: c.id, name: c.name, role: c.job,
              photo: c.profile_path ? tmdbImg(c.profile_path, 'w185') : undefined,
            }))
          );

          if (!found || isTmdbId) {
            const imdbId = data.external_ids?.imdb_id;
            found = {
              id: imdbId ?? decodedId,
              type: type ?? 'movie',
              name: data.title ?? data.name ?? '',
              poster: data.poster_path ? tmdbImg(data.poster_path, 'w342') : undefined,
              background: data.backdrop_path ? tmdbImg(data.backdrop_path, 'w1280') : undefined,
              description: data.overview,
              releaseInfo: (data.release_date ?? data.first_air_date ?? '').slice(0, 4),
              imdbRating: data.vote_average ? data.vote_average.toFixed(1) : undefined,
              runtime: data.runtime ? `${data.runtime} min` : (data.episode_run_time?.[0] ? `${data.episode_run_time[0]} min/ep` : undefined),
              genres: data.genres?.map((g: any) => g.name) ?? [],
              tagline: data.tagline,
            } as any;
          }
        } catch { /* TMDB non disponibile */ }
      }

      setMeta(found);
      setMetaLoading(false);

      const streamId = found?.id ?? decodedId;
      if (found?.type === 'movie' || type === 'movie') {
        loadStreams(streamId);
      }
    })();
  }, [type, decodedId]);

  // ── Streams ───────────────────────────────────────────────────────────────

  const loadStreams = useCallback(async (videoId: string) => {
    setStreamsLoading(true);
    setStreamGroups([]);
    setStreamError(null);
    setPlayError(null);
    try {
      const groups = await fetchAllStreams(addons, type!, videoId);
      setStreamGroups(groups);
      if (groups.length === 0) {
        setStreamError('Nessun stream trovato. Assicurati di avere Torrentio o altri addon stream installati.');
      }
    } catch (e: any) {
      setStreamError(e.message ?? 'Errore');
    } finally {
      setStreamsLoading(false);
    }
  }, [addons, type]);

  function handleEpisodeSelect(video: Video) {
    setSelectedVideo(video);
    loadStreams(video.id);
  }

  // ── Play ──────────────────────────────────────────────────────────────────

  async function handlePlay(stream: Stream) {
    if (!stream.url) {
      setPlayError('Questo stream non ha un URL diretto. Installa Torrentio con Real-Debrid/AllDebrid per stream riproducibili.');
      return;
    }
    setPlayError(null);
    setLaunching(true);
    try {
      const title = meta
        ? selectedVideo ? `${meta.name} – ${selectedVideo.title}` : meta.name
        : undefined;
      const playerPath = settings.customPlayerPath || 'mpv';
      await launchPlayer(stream.url, title, playerPath);
      // Salva in storia
      if (meta) {
        upsertWatch({
          id: meta.id,
          type: type!,
          name: meta.name,
          poster: meta.poster,
          videoId: selectedVideo?.id,
          season: selectedVideo?.season,
          episode: selectedVideo?.episode,
          progress: 0,
          duration: 0,
        });
      }
    } catch (e: any) {
      setPlayError(e.message ?? 'Impossibile avviare mpv.');
    } finally {
      setLaunching(false);
    }
  }

  const isSeries = meta?.type === 'series' || type === 'series';
  const bgImage = meta?.background ?? (tmdb?.backdrop_path ? tmdbImg(tmdb.backdrop_path, 'w1280') : meta?.poster);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (metaLoading) return (
    <div className="flex items-center justify-center h-full gap-3 text-white/40">
      <Loader2 size={28} className="animate-spin" /><span className="text-sm">Caricamento...</span>
    </div>
  );

  if (!meta && !tmdb) return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <AlertCircle size={32} className="text-red-400" />
      <p className="text-white/60 text-sm">Impossibile caricare i dettagli.</p>
      <button onClick={() => navigate(-1)} className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg text-sm">Torna indietro</button>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Hero */}
      <div className="relative flex-shrink-0 h-72">
        {bgImage && (
          <>
            <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f13] via-[#0f0f13]/60 to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f13]/90 via-[#0f0f13]/30 to-transparent" />
          </>
        )}
        {!bgImage && <div className="absolute inset-0 bg-[#0f0f13]" />}

        <button onClick={() => navigate(-1)}
          className="absolute top-4 left-4 flex items-center gap-1.5 text-white/70 hover:text-white bg-black/30 px-3 py-1.5 rounded-lg backdrop-blur-sm transition-colors">
          <ArrowLeft size={16} /><span className="text-sm">Indietro</span>
        </button>

        <div className="absolute bottom-5 left-5 flex gap-5 items-end">
          {(meta?.poster ?? (tmdb?.poster_path ? tmdbImg(tmdb.poster_path, 'w342') : null)) && (
            <img
              src={meta?.poster ?? tmdbImg(tmdb?.poster_path, 'w342')}
              alt={meta?.name}
              className="w-28 rounded-xl shadow-2xl border border-white/10 flex-shrink-0 hidden md:block"
            />
          )}
          <div className="pb-1">
            {(tmdb as any)?.tagline && (
              <p className="text-xs text-white/40 italic mb-1">{(tmdb as any).tagline}</p>
            )}
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">{meta?.name ?? decodedId}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full border font-medium" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                {isSeries ? 'Serie TV' : 'Film'}
              </span>
              {meta?.releaseInfo && <span className="text-xs text-white/60">{meta.releaseInfo}</span>}
              {meta?.imdbRating && (
                <span className="flex items-center gap-1 text-xs text-yellow-400 font-medium">
                  <Star size={11} className="fill-yellow-400" />{meta.imdbRating}
                </span>
              )}
              {meta?.runtime && <span className="flex items-center gap-1 text-xs text-white/60"><Clock size={11} />{meta.runtime}</span>}
              {meta?.genres && <span className="text-xs text-white/50">{meta.genres.slice(0, 3).join(' · ')}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-6 space-y-8 max-w-5xl">

          {/* Descrizione */}
          {(meta?.description ?? tmdb?.overview) && (
            <div>
              <p className={clsx('text-sm text-white/70 leading-relaxed', !descExpanded && 'line-clamp-4')}>
                {meta?.description ?? tmdb?.overview}
              </p>
              {(meta?.description ?? tmdb?.overview ?? '').length > 200 && (
                <button onClick={() => setDescExpanded(v => !v)}
                  className="flex items-center gap-1 text-xs mt-2 hover:opacity-80" style={{ color: 'var(--accent)' }}>
                  {descExpanded ? <><ChevronUp size={12} />Meno</> : <><ChevronDown size={12} />Leggi di più</>}
                </button>
              )}
            </div>
          )}

          {/* Play Error */}
          {playError && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{playError}</span>
            </div>
          )}

          {/* Cast */}
          {cast.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-2">
                  <Users size={13} />Cast
                </h2>
                {cast.length > 8 && (
                  <button onClick={() => setCastExpanded(v => !v)} className="text-xs hover:opacity-80" style={{ color: 'var(--accent)' }}>
                    {castExpanded ? 'Meno' : `Tutti (${cast.length})`}
                  </button>
                )}
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {(castExpanded ? cast : cast.slice(0, 10)).map(p => <PersonCard key={p.id} person={p} />)}
              </div>
            </div>
          )}

          {/* Crew */}
          {crew.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-2 mb-3">
                <Film size={13} />Regia & Sceneggiatura
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {crew.map(p => <PersonCard key={`${p.id}-${p.role}`} person={p} />)}
              </div>
            </div>
          )}

          {!hasTMDBKey() && cast.length === 0 && (
            <p className="text-xs text-white/30 flex items-center gap-1.5">
              <ExternalLink size={11} />Aggiungi la chiave API TMDB nelle impostazioni per vedere cast, trame tradotte e info complete.
            </p>
          )}

          {/* Episodi */}
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
                  <Loader2 size={16} className="animate-spin" />Ricerca stream in corso...
                </div>
              ) : streamError ? (
                <div className="flex items-start gap-2 text-yellow-400/80 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{streamError}</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {streamGroups.map(group => (
                    <div key={group.addonUrl}>
                      <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                        {group.addonName}
                        <span className="text-white/30 normal-case font-normal ml-2">({group.streams.length} stream)</span>
                      </p>
                      <div className="space-y-2">
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

          {/* Prompt serie: seleziona episodio */}
          {isSeries && !selectedVideo && !streamsLoading && streamGroups.length === 0 && !streamError && (
            <div className="text-center py-8 text-white/30 text-sm border border-dashed border-white/10 rounded-xl">
              ← Seleziona un episodio per vedere gli stream disponibili
            </div>
          )}

          {/* Provider TMDB */}
          {tmdb?.['watch/providers']?.results?.IT && (
            <div>
              <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Disponibile su</h2>
              <div className="flex gap-3 flex-wrap">
                {[
                  ...(tmdb['watch/providers'].results.IT?.flatrate ?? []),
                  ...(tmdb['watch/providers'].results.IT?.rent ?? []),
                ].slice(0, 6).map((p: any) => (
                  <div key={p.provider_id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                    {p.logo_path && <img src={tmdbImg(p.logo_path, 'w45')} alt={p.provider_name} className="w-6 h-6 rounded" />}
                    <span className="text-xs text-white/70">{p.provider_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Titoli simili */}
          {(tmdb?.similar?.results ?? tmdb?.recommendations?.results)?.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Titoli simili</h2>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {(tmdb.recommendations?.results ?? tmdb.similar?.results).slice(0, 10).map((item: any) => {
                  const isMovie = !!item.title;
                  const poster = item.poster_path ? tmdbImg(item.poster_path, 'w342') : undefined;
                  return (
                    <Link key={item.id} to={`/detail/${isMovie ? 'movie' : 'series'}/tmdb:${item.id}`} className="flex-shrink-0 w-28 group">
                      <div className="w-28 h-40 rounded-lg overflow-hidden bg-white/5 border border-white/10 group-hover:border-[color:var(--accent)] transition-all">
                        {poster ? <img src={poster} alt={item.title ?? item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>}
                      </div>
                      <p className="mt-1 text-xs text-white/60 truncate group-hover:text-white">{item.title ?? item.name}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
