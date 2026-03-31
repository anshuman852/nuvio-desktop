/// <reference types="vite/client" />
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { fetchMeta, fetchAllStreams, openExternal, launchPlayer } from '../api/stremio';
import { getDetails, tmdbImg, hasTMDBKey, STREAMING_SERVICES } from '../api/tmdb';
import { MetaItem, Stream, StreamGroup, Video } from '../lib/types';
import VideoPlayer from '../components/VideoPlayer';
import {
  Play, ArrowLeft, Star, Clock, Film, ChevronDown, ChevronUp,
  Loader2, AlertCircle, Tv, Users, ExternalLink, Magnet,
  SkipForward, Check, Plus, Heart,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Stream Card ──────────────────────────────────────────────────────────────

function StreamCard({ stream, onPlay, active }: { stream: Stream; onPlay: () => void; active: boolean }) {
  const hasUrl = Boolean(stream.url);
  const hasMagnet = Boolean(stream.infoHash);
  const canPlay = hasUrl || hasMagnet; // entrambi cliccabili
  const quality = ((stream.name ?? '') + ' ' + (stream.title ?? '')).match(/\b(4K|2160p|1080p|720p|480p|HDR|HEVC|x265|x264)\b/gi)?.join(' ') ?? '';
  const size = stream.behaviorHints?.videoSize ? `${(stream.behaviorHints.videoSize / 1e9).toFixed(1)} GB`
                              : stream.behaviorHints?.filename ? `${Math.round((stream.behaviorHints.videoSize ?? 0) / 1e9 * 10) / 10} GB` : '';
                            // Estrai il nome file per mostrarlo come info
                            const fname = stream.behaviorHints?.filename?.replace(/\.mkv|\.[a-z0-9]{2,4}$/i, '').slice(0, 40) ?? '';

  return (
    <button type="button" onClick={onPlay}
      className={clsx(
        'w-full text-left px-4 py-3 rounded-xl border transition-all duration-150 cursor-pointer',
        active ? 'border-[color:var(--accent)] bg-[color:var(--accent-bg)]'
          : 'border-white/[0.08] bg-white/[0.04] hover:bg-[color:var(--accent-bg)] hover:border-[color:var(--accent)]'
      )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{stream.name ?? 'Stream'}</p>
            {quality && <span className="text-xs px-1.5 py-0.5 rounded-md bg-white/10 text-white/70 font-medium">{quality}</span>}
            {size && <span className="text-xs text-white/40">{size}</span>}
            {hasMagnet && !hasUrl && <span className="text-xs px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400">🧲 torrent</span>}
          </div>
          {stream.title && <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{stream.title}</p>}
        </div>
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: hasMagnet && !hasUrl ? '#f59e0b22' : 'var(--accent-bg)' }}>
            <Play size={13} style={{ color: hasMagnet && !hasUrl ? '#f59e0b' : 'var(--accent)' }} className="ml-0.5" />
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Episode List ─────────────────────────────────────────────────────────────

function EpisodeList({ videos, selectedId, onSelect, watchedIds }: {
  videos: Video[]; selectedId: string | null;
  onSelect: (v: Video) => void; watchedIds?: Set<string>;
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
      <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
        {episodes.map(ep => (
          <button key={ep.id} type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(ep); }}
            className={clsx('w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer',
              selectedId === ep.id
                ? 'border-[color:var(--accent)] bg-[color:var(--accent-bg)]'
                : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.06] hover:border-[color:var(--accent)]')}>
            {ep.thumbnail && <img src={ep.thumbnail} alt="" className="w-20 h-12 rounded-lg object-cover flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                {ep.season !== undefined && ep.episode !== undefined ? `${ep.season}×${String(ep.episode).padStart(2, '0')} · ` : ''}
                {ep.title}
              </p>
              {ep.overview && <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{ep.overview}</p>}
            </div>
            <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
              selectedId === ep.id ? 'bg-[color:var(--accent)]' : 'bg-white/10')}>
              <Play size={10} className="fill-white text-white ml-0.5" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Person Card ──────────────────────────────────────────────────────────────

function PersonCard({ person }: { person: { id: number; name: string; role: string; photo?: string } }) {
  const [err, setErr] = useState(false);
  return (
    <Link to={`/person/${person.id}`} className="flex-shrink-0 w-20 group text-center">
      <div className="w-20 h-20 rounded-full overflow-hidden bg-white/[0.06] border-2 border-white/[0.08] group-hover:border-[color:var(--accent)] transition-all mx-auto">
        {person.photo && !err
          ? <img src={person.photo} alt={person.name} className="w-full h-full object-cover object-top" onError={() => setErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>}
      </div>
      <p className="mt-1.5 text-xs font-medium text-white/70 group-hover:text-white line-clamp-1 transition-colors">{person.name}</p>
      <p className="text-xs text-white/40 line-clamp-1">{person.role}</p>
    </Link>
  );
}

// ─── Detail Page ──────────────────────────────────────────────────────────────

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
  const [castExpanded, setCastExpanded] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [activeStreamIdx, setActiveStreamIdx] = useState<number | null>(null);
  const [activeGroupIdx, setActiveGroupIdx] = useState<number | null>(null);
  const [streamSort, setStreamSort] = useState<'quality' | 'size' | 'default'>('default');

  // Player interno
  const [playerStream, setPlayerStream] = useState<Stream | null>(null);

  const isTmdbId = decodedId.startsWith('tmdb:');

  // ── Meta fetch ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!type || !decodedId) return;
    setMetaLoading(true);
    setMeta(null); setTmdb(null); setCast([]); setCrew([]);
    setPlayerStream(null); setStreamGroups([]);

    (async () => {
      let found: MetaItem | null = null;
      const tmdbNumId = isTmdbId ? parseInt(decodedId.replace('tmdb:', '')) : null;

      // Stremio addons
      if (!isTmdbId) {
        const results = await Promise.allSettled(addons.map(a => fetchMeta(a.url, type, decodedId)));
        for (const r of results) { if (r.status === 'fulfilled' && r.value) { found = r.value; break; } }
      }

      // TMDB
      if (hasTMDBKey() && (tmdbNumId || found)) {
        try {
          const tid = tmdbNumId ?? null;
          if (tid) {
            const tmdbType = type === 'series' ? 'tv' : 'movie';
            const data = await getDetails(tmdbType, tid);
            setTmdb(data);
            setCast((data.credits?.cast ?? []).slice(0, 30).map((c: any) => ({
              id: c.id, name: c.name, role: c.character ?? '',
              photo: c.profile_path ? tmdbImg(c.profile_path, 'w185') : undefined,
            })));
            setCrew((data.credits?.crew ?? []).filter((c: any) => ['Director','Screenplay','Writer','Creator'].includes(c.job)).slice(0, 6).map((c: any) => ({
              id: c.id, name: c.name, role: c.job,
              photo: c.profile_path ? tmdbImg(c.profile_path, 'w185') : undefined,
            })));
            if (!found || isTmdbId) {
              const imdb = data.external_ids?.imdb_id;
              found = {
                id: imdb ?? decodedId,
                type: type ?? 'movie',
                name: data.title ?? data.name ?? '',
                poster: data.poster_path ? tmdbImg(data.poster_path, 'w342') : undefined,
                background: data.backdrop_path ? tmdbImg(data.backdrop_path, 'w1280') : undefined,
                description: data.overview,
                releaseInfo: (data.release_date ?? data.first_air_date ?? '').slice(0, 4),
                imdbRating: data.vote_average ? data.vote_average.toFixed(1) : undefined,
                runtime: data.runtime ? `${data.runtime} min` : undefined,
                genres: data.genres?.map((g: any) => g.name) ?? [],
              } as any;
            }
          }
        } catch { /* non bloccante */ }
      }

      setMeta(found);
      setMetaLoading(false);
      if ((found?.type === 'movie' || type === 'movie') && found) loadStreams(found.id);
    })();
  }, [type, decodedId]);

  // ── Stream load ───────────────────────────────────────────────────────────

  const loadStreams = useCallback(async (videoId: string) => {
    setStreamsLoading(true);
    setStreamGroups([]);
    setStreamError(null);
    setPlayError(null);
    setActiveStreamIdx(null);
    setActiveGroupIdx(null);
    try {
      const groups = await fetchAllStreams(addons, type!, videoId);
      setStreamGroups(groups);
      if (groups.length === 0) setStreamError('Nessun stream trovato. Installa Torrentio e configura un servizio Debrid per avere stream diretti.');
    } catch (e: any) {
      setStreamError(e.message ?? 'Errore');
    } finally { setStreamsLoading(false); }
  }, [addons, type]);

  function handleEpisodeSelect(video: Video) {
    setSelectedVideo(video);
    setStreamGroups([]);
    setStreamError(null);
    setPlayError(null);
    // L'ID video per Stremio è nel formato: tt1234567:1:2 (imdbId:season:episode)
    const imdbBase = meta?.id?.startsWith('tt') ? meta.id : (decodedId.startsWith('tt') ? decodedId : null);
    const streamId = imdbBase && video.season && video.episode
      ? `${imdbBase}:${video.season}:${video.episode}`
      : video.id;
    loadStreams(streamId);
  }

  // ── Play ──────────────────────────────────────────────────────────────────

  function handlePlay(stream: Stream, gi: number, si: number) {
    setPlayError(null);
    setActiveGroupIdx(gi);
    setActiveStreamIdx(si);

    // Costruisce l'URL: preferisce url diretto, fallback a magnet
    const playUrl = stream.url ?? (stream.infoHash
      ? `magnet:?xt=urn:btih:${stream.infoHash}${stream.fileIdx !== undefined ? `&so=${stream.fileIdx}` : ''}`
      : null);

    if (!playUrl) {
      setPlayError('Stream senza URL. Configura Real-Debrid in Torrentio per stream diretti.');
      return;
    }

    // Override per usare la url costruita
    stream = { ...stream, url: playUrl };
    if (!stream.url) return;

    // Player esterno custom?
    const custom = settings.customPlayerPath?.trim();
    if (custom) {
      launchPlayer(stream.url, meta?.name, custom).catch(e => setPlayError(e.message));
      return;
    }

    // Player interno
    setPlayerStream(stream);
  }

  // ── Next episode ──────────────────────────────────────────────────────────

  const nextEpisodeData = (() => {
    if (!meta?.videos || !selectedVideo) return null;
    const idx = meta.videos.findIndex(v => v.id === selectedVideo.id);
    return idx >= 0 && idx < meta.videos.length - 1 ? meta.videos[idx + 1] : null;
  })();

  function handleNext() {
    if (nextEpisodeData) {
      setPlayerStream(null);
      handleEpisodeSelect(nextEpisodeData);
    }
  }

  const isSeries = meta?.type === 'series' || type === 'series';
  const bg = meta?.background ?? (tmdb?.backdrop_path ? tmdbImg(tmdb.backdrop_path, 'w1280') : meta?.poster);

  // ── Player aperto ─────────────────────────────────────────────────────────

  if (playerStream) {
    const titleStr = meta ? (selectedVideo ? `${meta.name} – S${selectedVideo.season}E${selectedVideo.episode} ${selectedVideo.title}` : meta.name) : undefined;
    const subtitleStr = selectedVideo ? `Stagione ${selectedVideo.season} · Episodio ${selectedVideo.episode}` : undefined;
    return (
      <VideoPlayer
        url={playerStream.url!}
        title={titleStr}
        subtitle={subtitleStr}
        contentId={meta?.id ?? decodedId}
        contentType={type}
        poster={meta?.poster}
        cast={(tmdb?.credits?.cast ?? []).slice(0, 15).map((p: any) => ({
          name: p.name,
          character: p.character,
          photo: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : undefined,
        }))}
        season={selectedVideo?.season}
        episode={selectedVideo?.episode}
        nextEpisode={nextEpisodeData ? { id: nextEpisodeData.id, title: nextEpisodeData.title, thumbnail: nextEpisodeData.thumbnail } : null}
        onClose={() => {
          setPlayerStream(null);
          window.dispatchEvent(new CustomEvent('nuvio:cw-updated'));
        }}
        onPrev={isSeries && prevEpData ? () => handleEpisodeSelect(prevEpData) : undefined}
        prevEpisode={isSeries && prevEpData ? { id: prevEpData.id, title: prevEpData.title ?? '' } : null}
        onNext={nextEpisodeData ? handleNext : undefined}
        initialProgress={0}
      />
    );
  }

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
      <button onClick={() => navigate(-1)} className="px-4 py-2 bg-white/10 text-white rounded-xl text-sm">Indietro</button>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Hero */}
      <div className="relative flex-shrink-0 h-[280px]">
        {bg && <><img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f13] via-[#0f0f13]/50 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f13]/90 via-[#0f0f13]/30 to-transparent" />
        </>}
        {!bg && <div className="absolute inset-0 bg-[#0f0f13]" />}

        <button onClick={() => navigate(-1)} className="absolute top-4 left-5 flex items-center gap-1.5 text-white/60 hover:text-white bg-black/30 px-3 py-1.5 rounded-full backdrop-blur-sm text-sm transition-colors">
          <ArrowLeft size={15} />Indietro
        </button>

        <div className="absolute bottom-5 left-5 flex gap-5 items-end">
          {(meta?.poster ?? (tmdb?.poster_path ? tmdbImg(tmdb.poster_path, 'w342') : null)) && (
            <img src={meta?.poster ?? tmdbImg(tmdb?.poster_path, 'w342')} alt={meta?.name}
              className="w-[90px] rounded-xl shadow-2xl border border-white/10 flex-shrink-0 hidden sm:block" />
          )}
          <div className="pb-1">
            {(tmdb as any)?.tagline && <p className="text-xs text-white/40 italic mb-1">{(tmdb as any).tagline}</p>}
            <h1 className="text-xl font-bold text-white drop-shadow-lg">{meta?.name ?? decodedId}</h1>
            <div className="flex items-center gap-2.5 mt-2 flex-wrap">
              <span className="text-xs px-2.5 py-1 rounded-full border font-medium" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                {isSeries ? 'Serie TV' : 'Film'}
              </span>
              {meta?.releaseInfo && <span className="text-xs text-white/50">{meta.releaseInfo}</span>}
              {meta?.imdbRating && <span className="flex items-center gap-1 text-xs text-yellow-400 font-semibold"><Star size={11} className="fill-yellow-400" />{meta.imdbRating}</span>}
              {meta?.runtime && <span className="flex items-center gap-1 text-xs text-white/50"><Clock size={11} />{meta.runtime}</span>}
              {meta?.genres && <span className="text-xs text-white/40">{meta.genres.slice(0, 3).join(' · ')}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto" style={{ overflowY: "auto" }}>
        <div className="px-5 py-5 space-y-7 max-w-5xl">

          {/* Description */}
          {(meta?.description ?? tmdb?.overview) && (
            <div>
              <p className={clsx('text-sm text-white/70 leading-relaxed', !descExpanded && 'line-clamp-3')}>
                {meta?.description ?? tmdb?.overview}
              </p>
              {(meta?.description ?? tmdb?.overview ?? '').length > 200 && (
                <button onClick={() => setDescExpanded(v => !v)} className="flex items-center gap-1 text-xs mt-1.5 hover:opacity-80" style={{ color: 'var(--accent)' }}>
                  {descExpanded ? <><ChevronUp size={12} />Meno</> : <><ChevronDown size={12} />Leggi di più</>}
                </button>
              )}
            </div>
          )}

          {/* Play error */}
          {playError && (
            <div className="flex items-start gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{playError}</span>
            </div>
          )}

          {/* Trailer YouTube */}
          {tmdb?.videos?.results?.length > 0 && (() => {
            const trailer = tmdb.videos.results.find((v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'));
            if (!trailer) return null;
            return (
              <div>
                <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Trailer</h2>
                <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9', maxWidth: 480 }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${trailer.key}?autoplay=0&rel=0&modestbranding=1`}
                    title={trailer.name}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            );
          })()}

          {/* Cast */}
          {cast.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2"><Users size={13} />Cast</h2>
                {cast.length > 8 && <button onClick={() => setCastExpanded(v => !v)} className="text-xs hover:opacity-80" style={{ color: 'var(--accent)' }}>{castExpanded ? 'Meno' : `Tutti (${cast.length})`}</button>}
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {(castExpanded ? cast : cast.slice(0, 10)).map(p => <PersonCard key={p.id} person={p} />)}
              </div>
            </div>
          )}

          {/* Crew */}
          {crew.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2 mb-3"><Film size={13} />Regia</h2>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {crew.map(p => <PersonCard key={`${p.id}-${p.role}`} person={p} />)}
              </div>
            </div>
          )}

          {!hasTMDBKey() && cast.length === 0 && (
            <p className="text-xs text-white/25 flex items-center gap-1.5"><ExternalLink size={11} />Aggiungi la chiave TMDB nelle impostazioni per vedere cast e trame tradotte.</p>
          )}

          {/* Episodes — usa meta.videos (addon) oppure genera da TMDB seasons */}
          {isSeries && (() => {
            // Usa videos dall'addon se disponibili
            const addonVideos = meta?.videos ?? [];
            // Fallback: genera episodi dalle stagioni TMDB
            const tmdbVideos: Video[] = [];
            if (addonVideos.length === 0 && tmdb?.seasons) {
              for (const season of tmdb.seasons) {
                if (!season.season_number) continue;
                for (let ep = 1; ep <= (season.episode_count ?? 0); ep++) {
                  const imdbBase = meta?.id?.startsWith('tt') ? meta.id : (decodedId.startsWith('tt') ? decodedId : null);
                  tmdbVideos.push({
                    id: imdbBase ? `${imdbBase}:${season.season_number}:${ep}` : `${meta?.id}:${season.season_number}:${ep}`,
                    title: `Episodio ${ep}`,
                    season: season.season_number,
                    episode: ep,
                  });
                }
              }
            }
            const videos = addonVideos.length > 0 ? addonVideos : tmdbVideos;
            if (videos.length === 0) return null;
            return (
              <div>
                {streamGroups.length > 0 && (
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {(['default','quality','size'] as const).map(s => {
                      const labels = { default: '⚡ Default', quality: '🎬 Qualità', size: '💾 Dimensione' };
                      return (
                        <button key={s} onClick={() => setStreamSort(s)}
                          className={clsx('text-xs px-3 py-1.5 rounded-full border transition-colors',
                            streamSort === s ? 'border-[color:var(--accent)] bg-[color:var(--accent-bg)] text-[color:var(--accent)]' : 'border-white/10 text-white/50 hover:text-white hover:border-white/20')}>
                          {labels[s]}
                        </button>
                      );
                    })}
                  </div>
                )}
                <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Episodi · {videos.length}
                </h2>
                <EpisodeList videos={videos} selectedId={selectedVideo?.id ?? null} onSelect={handleEpisodeSelect} />
              </div>
            );
          })()}

          {/* Streams */}
          {(streamsLoading || streamGroups.length > 0 || streamError) && (
            <div>
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                {isSeries && selectedVideo ? `Stream · S${selectedVideo.season}E${selectedVideo.episode} ${selectedVideo.title}` : 'Stream disponibili'}
              </h2>

              {streamsLoading ? (
                <div className="flex items-center gap-2 text-white/40 text-sm py-4"><Loader2 size={16} className="animate-spin" />Ricerca stream...</div>
              ) : streamError ? (
                <div className="flex items-start gap-2 text-amber-400/80 text-sm bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{streamError}</span>
                </div>
              ) : (
                <div className="flex gap-6 overflow-x-auto pb-2">
                  {streamGroups.map((group, gi) => {
                    const sortedStreams = [...group.streams].sort((a, b) => {
                      if (streamSort === 'quality') {
                        const qa = parseInt(((a.name ?? '') + (a.title ?? '')).match(/([0-9]{3,4})p/)?.[1] ?? '0');
                        const qb = parseInt(((b.name ?? '') + (b.title ?? '')).match(/([0-9]{3,4})p/)?.[1] ?? '0');
                        return qb - qa;
                      }
                      if (streamSort === 'size') {
                        const sa = a.behaviorHints?.videoSize ?? 0;
                        const sb = b.behaviorHints?.videoSize ?? 0;
                        return sb - sa;
                      }
                      return 0;
                    });
                    return (
                      <div key={group.addonUrl} className="flex-shrink-0 w-64">
                        <div className="flex items-center gap-2 mb-3 px-1">
                          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>{group.addonName}</span>
                          <span className="text-xs text-white/25">({sortedStreams.length})</span>
                        </div>
                        <div className="space-y-1.5">
                          {sortedStreams.slice(0, 15).map((stream, si) => {
                            const hasUrl = Boolean(stream.url);
                            const hasMagnet = Boolean(stream.infoHash);
                            const quality = ((stream.name ?? '') + ' ' + (stream.title ?? '')).match(/(4K|2160p|1080p|720p|480p|HDR|HEVC)/gi)?.slice(0,2).join(' ') ?? '';
                            const size = stream.behaviorHints?.videoSize ? `${(stream.behaviorHints.videoSize / 1e9).toFixed(1)} GB`
                              : stream.behaviorHints?.filename ? `${Math.round((stream.behaviorHints.videoSize ?? 0) / 1e9 * 10) / 10} GB` : '';
                            // Estrai il nome file per mostrarlo come info
                            const fname = stream.behaviorHints?.filename?.replace(/\.mkv|\.[a-z0-9]{2,4}$/i, '').slice(0, 40) ?? '';
                            const isActive = activeGroupIdx === gi && activeStreamIdx === si;
                            // Estrai info dalla description/title dello stream
                            const desc = stream.description ?? stream.title ?? '';
                            const seeds = desc.match(/👤\s*(\d+)/)?.[1];
                            const langs = desc.match(/[🇮🇹🇬🇧🇺🇸🏴󠁧󠁢󠁥󠁮󠁧󠁿]+/g)?.slice(0,3).join(' ') ?? '';
                            const source = stream.behaviorHints?.filename
                              ? stream.behaviorHints.filename.replace(/\.[^.]+$/, '').slice(0,30)
                              : desc.split('\n').find((l: string) => l.includes('from') || l.includes('⚙️'))?.slice(0,30) ?? '';
                            return (
                              <button key={si} type="button"
                                onClick={() => handlePlay(stream, gi, si)}
                                className={clsx(
                                  'w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-150 group/s',
                                  isActive
                                    ? 'border-[color:var(--accent)] bg-[color:var(--accent-bg)]'
                                    : 'border-white/[0.07] bg-white/[0.03] hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-bg)] cursor-pointer'
                                )}>
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                                    {quality && <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-white/10" style={{ color: isActive ? 'var(--accent)' : 'white' }}>{quality}</span>}
                                    {hasMagnet && !hasUrl && <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400">🧲 P2P</span>}
                                    {langs && <span className="text-[10px] text-white/50">{langs}</span>}
                                  </div>
                                  <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors mt-0.5',
                                    isActive ? 'bg-[color:var(--accent)]' : 'bg-white/10 group-hover/s:bg-[color:var(--accent)]')}>
                                    <Play size={10} className="ml-0.5 fill-white text-white" />
                                  </div>
                                </div>
                                {size && <p className="text-xs text-white/60 font-mono">{size}</p>}
                                {(fname || source) && <p className="text-[10px] text-white/30 line-clamp-1 mt-0.5">{fname || source}</p>}
                                {seeds && <p className="text-[10px] text-green-400/70">👤 {seeds}</p>}
                              </button>
                            );
                          })}
                          {sortedStreams.length > 15 && (
                            <p className="text-xs text-white/30 text-center py-1">+{sortedStreams.length - 15} altri</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Prompt serie */}
          {isSeries && !selectedVideo && !streamsLoading && streamGroups.length === 0 && !streamError && (
            <div className="text-center py-8 text-white/25 text-sm border border-dashed border-white/[0.08] rounded-2xl">
              ← Seleziona un episodio per caricare gli stream
            </div>
          )}

          {/* Production companies → link a streaming */}
          {(tmdb?.production_companies ?? tmdb?.networks)?.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                {tmdb?.networks ? 'Network' : 'Produzione'}
              </h2>
              <div className="flex gap-2 flex-wrap">
                {(tmdb?.networks ?? tmdb?.production_companies ?? []).slice(0, 6).map((co: any) => {
                  // Prova a matchare con un servizio streaming
                  const coName = co.name?.toLowerCase() ?? '';
                  const matchService = STREAMING_SERVICES.find((s: any) => {
                    const sid = s.id.toLowerCase();
                    const sname = s.name.toLowerCase();
                    return coName.includes(sid) || coName.includes(sname) ||
                      sname.includes(coName.split(' ')[0]) ||
                      // Match specifici comuni
                      (sid === 'netflix' && coName.includes('netflix')) ||
                      (sid === 'disney' && (coName.includes('disney') || coName.includes('pixar'))) ||
                      (sid === 'amazon' && coName.includes('amazon')) ||
                      (sid === 'apple' && coName.includes('apple')) ||
                      (sid === 'hbo' && (coName.includes('hbo') || coName.includes('warner'))) ||
                      (sid === 'paramount' && coName.includes('paramount')) ||
                      (sid === 'crunchyroll' && coName.includes('crunchyroll'));
                  });
                  const el = (
                    <div key={co.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/25 transition-colors">
                      {co.logo_path
                        ? <img src={tmdbImg(co.logo_path, 'w92')} alt={co.name} className="h-5 object-contain max-w-[80px] brightness-150" />
                        : <span className="text-xs text-white/60">{co.name}</span>}
                    </div>
                  );
                  return matchService
                    ? <Link key={co.id} to={`/streaming/${matchService.id}`}>{el}</Link>
                    : <div key={co.id}>{el}</div>;
                })}
              </div>
            </div>
          )}

          {/* Where to watch — cliccabile → sezione streaming */}
          {tmdb?.['watch/providers']?.results && (() => {
            const regions = ['IT', 'US', 'GB'];
            const providers: any[] = [];
            const seen = new Set<number>();
            for (const r of regions) {
              const region = tmdb['watch/providers'].results[r];
              if (!region) continue;
              for (const p of [...(region.flatrate ?? []), ...(region.free ?? []), ...(region.ads ?? [])]) {
                if (!seen.has(p.provider_id)) { seen.add(p.provider_id); providers.push(p); }
              }
              if (providers.length >= 6) break;
            }
            if (providers.length === 0) return null;
            return (
              <div>
                <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Disponibile su</h2>
                <div className="flex gap-2 flex-wrap">
                  {providers.slice(0, 8).map((p: any) => {
                    const pname = p.provider_name?.toLowerCase() ?? '';
                    const service = STREAMING_SERVICES.find(s =>
                      pname.includes(s.id) || pname.includes(s.name.toLowerCase().split(' ')[0])
                    );
                    const inner = (
                      <div key={p.provider_id} className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-150 bg-white/[0.05] border-white/[0.07] hover:border-white/20 hover:bg-white/[0.08]">
                        {p.logo_path && <img src={tmdbImg(p.logo_path, 'w45')} alt={p.provider_name} className="w-6 h-6 rounded-lg" />}
                        <span className="text-xs text-white/70 font-medium">{p.provider_name}</span>
                      </div>
                    );
                    return service
                      ? <Link key={p.provider_id} to={`/streaming/${service.id}`}>{inner}</Link>
                      : <div key={p.provider_id}>{inner}</div>;
                  })}
                </div>
              </div>
            );
          })()}

          {/* Simili */}
          {(tmdb?.recommendations?.results ?? tmdb?.similar?.results)?.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Titoli simili</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {(tmdb.recommendations?.results ?? tmdb.similar.results).slice(0, 10).map((item: any) => {
                  const isM = !!item.title;
                  return (
                    <Link key={item.id} to={`/detail/${isM ? 'movie' : 'series'}/tmdb:${item.id}`} className="flex-shrink-0 w-28 group">
                      <div className="w-28 h-40 rounded-xl overflow-hidden bg-white/[0.05] border border-white/[0.07] group-hover:border-[color:var(--accent)] transition-all group-hover:scale-[1.02]">
                        {item.poster_path ? <img src={tmdbImg(item.poster_path, 'w185')} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>}
                      </div>
                      <p className="mt-1 text-xs text-white/50 group-hover:text-white truncate">{item.title ?? item.name}</p>
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
