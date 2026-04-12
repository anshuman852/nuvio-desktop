import React from 'react';
/// <reference types="vite/client" />
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { getAllWatchedItems, markWatched, unmarkWatched } from '../api/nuvio';
import { fetchMeta, fetchAllStreams, openExternal, launchPlayer } from '../api/stremio';
import { getDetails, tmdbImg, hasTMDBKey, STREAMING_SERVICES, getPerson } from '../api/tmdb';
import { MetaItem, Stream, StreamGroup, Video } from '../lib/types';
import VideoPlayer from '../components/VideoPlayer';
import { invoke } from '@tauri-apps/api/core';
import {
  Play, ArrowLeft, Star, ChevronLeft, ChevronRight,
  Loader2, AlertCircle, Bookmark,
} from 'lucide-react';
import clsx from 'clsx';

function StreamRow({ stream, onPlay, active }: { stream: Stream; onPlay: () => void; active: boolean }) {
  const hasUrl = Boolean(stream.url);
  const hasMagnet = Boolean(stream.infoHash) && !hasUrl;
  const raw = `${stream.name ?? ''} ${stream.title ?? ''} ${stream.description ?? ''}`;
  const qualMatch = raw.match(/\b(4K|2160p|1080p|720p|480p)\b/i);
  const quality = qualMatch?.[0]?.toUpperCase() ?? '';
  const tags = Array.from(new Set(
    (raw.match(/\b(HDR10\+?|HDR|DV|Dolby Vision|HEVC|x265|x264|WEBDL|WEB-DL|BluRay|SDR|AVC)\b/gi) ?? [])
      .map((t: string) => t.toUpperCase().replace('DOLBY VISION','DV').replace('WEB-DL','WEBDL'))
  )).slice(0, 3) as string[];
  const sizeMb = stream.behaviorHints?.videoSize ?? 0;
  const sizeStr = sizeMb > 0 ? (sizeMb >= 1e9 ? `${(sizeMb / 1e9).toFixed(2)} GB` : `${Math.round(sizeMb / 1e6)} MB`) : '';
  const seedMatch = raw.match(/👤\s*(\d+)/u) ?? raw.match(/(\d+)\s*seed/i);
  const seeds = seedMatch?.[1] ?? '';
  const langs = (() => {
    const m = [...raw.matchAll(/[\u{1F1E0}-\u{1F1FF}]{2}/gu)];
    return m.map(x => x[0]).slice(0, 3).join('');
  })();
  const filename = (stream.behaviorHints?.filename ?? '').replace(/\.[a-z0-9]{2,4}$/i, '');
  const sourceLine = filename.length > 3 ? filename
    : (stream.description ?? stream.title ?? '').split('\n').find((l: string) => l.length > 3)?.trim() ?? '';
  const addonLabel = stream.name ?? '';
  const qColors: Record<string, string> = { '4K': '#a78bfa', '2160P': '#a78bfa', '1080P': '#34d399', '720P': '#60a5fa', '480P': '#f59e0b' };
  const qColor = qColors[quality] ?? '#9ca3af';
  return (
    <button type="button" onClick={onPlay}
      className={clsx(
        'w-full text-left flex items-start gap-3 px-3 py-2.5 border-b transition-colors cursor-pointer',
        active ? 'bg-[color:var(--accent-bg)] border-b-[color:var(--accent)]/30'
          : 'border-b-white/[0.05] hover:bg-white/[0.05]'
      )}>
      <div className="flex-shrink-0 min-w-[90px] max-w-[90px]">
        {addonLabel && <p className="text-xs font-bold text-white/80 leading-tight line-clamp-2">{addonLabel}</p>}
        <div className="flex flex-col gap-0.5 mt-0.5">
          {quality && <span className="text-[10px] font-black" style={{ color: qColor }}>{quality}</span>}
          {tags.slice(0, 2).map((t: string) => <span key={t} className="text-[10px] font-semibold text-white/50">{t}</span>)}
          {hasMagnet && <span className="text-[10px] text-amber-400 font-bold">P2P</span>}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        {sourceLine && <p className="text-xs text-white/70 leading-tight line-clamp-2 mb-1">{sourceLine}</p>}
        <div className="flex items-center gap-2 flex-wrap">
          {langs && <span className="text-xs">{langs}</span>}
          {seeds && <span className="flex items-center gap-1 text-[11px] text-white/50"><span className="text-green-400/80">👤</span>{seeds}</span>}
          {sizeStr && <span className="text-[11px] font-semibold text-white/60">{sizeStr}</span>}
        </div>
      </div>
      {active && (
        <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: 'var(--accent)' }}>
          <Play size={8} className="fill-white text-white ml-0.5" />
        </div>
      )}
    </button>
  );
}

export default function Detail() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const { addons, settings, nuvioUser, upsertWatch } = useStore();
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
  const [prevEpData, setPrevEpData] = useState<Video | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [activeStreamKey, setActiveStreamKey] = useState<string | null>(null);
  const [selectedAddon, setSelectedAddon] = useState<string | null>(null);
  const [epCtxMenu, setEpCtxMenu] = useState<{ x: number; y: number; ep: Video } | null>(null);
  const [playerStream, setPlayerStream] = useState<Stream | null>(null);
  const [streamReferer, setStreamReferer] = useState<string | undefined>(undefined);
  const [activeSeason, setActiveSeason] = useState<number>(1);
  const [watchedEpIds, setWatchedEpIds] = useState<Set<string>>(new Set());
  const isTmdbId = decodedId.startsWith('tmdb:');

  useEffect(() => {
    if (!epCtxMenu) return;
    const close = () => setEpCtxMenu(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [epCtxMenu]);

  const isSeries = meta?.type === 'series' || type === 'series';

  useEffect(() => {
    if (!nuvioUser?.id || !isSeries) return;
    getAllWatchedItems(nuvioUser.id, nuvioUser.token).then((items: any[]) => {
      const ids = new Set<string>(items.map((w: any) => String(w.content_id ?? '')));
      setWatchedEpIds(ids);
    }).catch(() => {});
  }, [nuvioUser?.id, isSeries, decodedId]);

  useEffect(() => {
    if (!type || !decodedId) return;
    setMetaLoading(true);
    setMeta(null); setTmdb(null); setCast([]); setCrew([]);
    setPlayerStream(null); setStreamGroups([]);
    setSelectedVideo(null);
    (async () => {
      let found: MetaItem | null = null;
      const tmdbNumId = isTmdbId ? parseInt(decodedId.replace('tmdb:', '')) : null;
      const imdbId = decodedId.startsWith('tt') ? decodedId : null;
      const [addonResult, tmdbData] = await Promise.all([
        isTmdbId ? Promise.resolve(null) : Promise.race([
          Promise.any(
            addons.slice(0, 8).map(addon =>
              fetchMeta(addon.url, type!, decodedId).then(m => {
                if (!m?.name) throw new Error('no meta');
                return m;
              })
            )
          ).catch(() => null),
          new Promise<null>(res => setTimeout(() => res(null), 5000)),
        ]),
        hasTMDBKey() ? (async () => {
          try {
            let tmdbId = tmdbNumId;
            if (!tmdbId && imdbId) {
              const fr = await fetch(
                `https://api.themoviedb.org/3/find/${imdbId}?api_key=${settings.tmdbApiKey}&external_source=imdb_id`
              ).then(r => r.json()).catch(() => null);
              const arr = type === 'series' ? (fr?.tv_results ?? []) : (fr?.movie_results ?? []);
              tmdbId = arr[0]?.id ?? null;
            }
            if (!tmdbId) return null;
            const tmdbType = type === 'series' ? 'tv' : 'movie';
            const [details, creditsIT, creditsEN] = await Promise.all([
              getDetails(tmdbType, tmdbId),
              fetch(`https://api.themoviedb.org/3/${tmdbType}/${tmdbId}/credits?api_key=${settings.tmdbApiKey}&language=it-IT`)
                .then(r => r.json()).catch(() => null),
              fetch(`https://api.themoviedb.org/3/${tmdbType}/${tmdbId}/credits?api_key=${settings.tmdbApiKey}&language=en-US`)
                .then(r => r.json()).catch(() => null),
            ]);
            let bestCredits = details.credits;
            if (creditsEN?.cast && creditsEN.cast.length > (bestCredits?.cast?.length ?? 0)) {
              bestCredits = creditsEN;
            }
            if (creditsIT?.cast && creditsIT.cast.length > (bestCredits?.cast?.length ?? 0)) {
              bestCredits = creditsIT;
            }
            if (bestCredits) {
              details.credits = bestCredits;
            }
            return details;
          } catch { return null; }
        })() : Promise.resolve(null),
      ]);
      found = addonResult as MetaItem | null;
      if (tmdbData) {
        setTmdb(tmdbData);
        // Prendiamo TUTTO il cast (senza limiti) con le foto
        const fullCast = (tmdbData.credits?.cast ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          role: c.character ?? '',
          photo: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : undefined,
        }));
        setCast(fullCast);
        setCrew((tmdbData.credits?.crew ?? []).filter((c: any) =>
          ['Director','Screenplay','Writer','Creator'].includes(c.job)
        ).slice(0, 6).map((c: any) => ({
          id: c.id, name: c.name, role: c.job,
          photo: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : undefined,
        })));
        if (!found || isTmdbId) {
          const imdbFromTmdb = tmdbData.external_ids?.imdb_id;
          const episodes: Video[] = [];
          if (tmdbData.seasons?.length) {
            for (const season of tmdbData.seasons) {
              if (!season.season_number) continue;
              const baseId = imdbFromTmdb ?? decodedId;
              for (let ep = 1; ep <= (season.episode_count ?? 0); ep++) {
                episodes.push({ id: `${baseId}:${season.season_number}:${ep}`, title: `Episodio ${ep}`, season: season.season_number, episode: ep });
              }
            }
          }
          found = {
            id: imdbFromTmdb ?? decodedId, type: type ?? 'movie',
            name: tmdbData.title ?? tmdbData.name ?? '',
            poster: tmdbData.poster_path ? tmdbImg(tmdbData.poster_path, 'w342') : undefined,
            background: tmdbData.backdrop_path ? tmdbImg(tmdbData.backdrop_path, 'w1280') : undefined,
            description: tmdbData.overview,
            releaseInfo: (tmdbData.release_date ?? tmdbData.first_air_date ?? '').slice(0, 4),
            imdbRating: tmdbData.vote_average ? tmdbData.vote_average.toFixed(1) : undefined,
            runtime: tmdbData.runtime ? `${tmdbData.runtime}min` : tmdbData.episode_run_time?.[0] ? `${tmdbData.episode_run_time[0]}min` : undefined,
            genres: (tmdbData.genres ?? []).map((g: any) => g.name),
            videos: episodes.length > 0 ? episodes : undefined,
          };
        } else if (found && (!found.videos || found.videos.length === 0) && tmdbData.seasons?.length) {
          const baseId = found.id?.startsWith('tt') ? found.id : imdbId ?? found.id;
          const eps: Video[] = [];
          for (const season of tmdbData.seasons) {
            if (!season.season_number) continue;
            for (let ep = 1; ep <= (season.episode_count ?? 0); ep++) {
              eps.push({ id: `${baseId}:${season.season_number}:${ep}`, title: `Episodio ${ep}`, season: season.season_number, episode: ep });
            }
          }
          if (eps.length > 0) found = { ...found, videos: eps };
        }
      }
      if (found) {
        // Se non abbiamo cast da TMDB ma il meta ha un array cast, usalo
        if (cast.length === 0 && (found as any).cast && (found as any).cast.length > 0) {
          setCast(((found as any).cast as string[]).map((name: string, i: number) => ({ 
            id: i, 
            name, 
            role: '',
            photo: undefined 
          })));
        }
        const seasons = [...new Set((found.videos ?? []).map(v => v.season ?? 0))].filter(Boolean).sort((a, b) => a - b);
        if (seasons.length > 0) setActiveSeason(seasons[0]);
        setMeta(found);
      }
      setMetaLoading(false);
      if ((found?.type === 'movie' || type === 'movie') && found) loadStreams(found.id);
    })();
  }, [type, decodedId]);

  const loadStreams = useCallback(async (videoId: string) => {
    setStreamsLoading(true);
    setStreamGroups([]);
    setStreamError(null);
    setPlayError(null);
    setActiveStreamKey(null);
    try {
      await fetchAllStreams(addons, type!, videoId, (group) => {
        setStreamGroups(prev => {
          const exists = prev.find(g => g.addonUrl === group.addonUrl);
          return exists ? prev : [...prev, group];
        });
      });
    } catch (e: any) {
      setStreamError(e.message ?? 'Errore');
    } finally {
      setStreamsLoading(false);
    }
  }, [addons, type]);

  function getCastFromMeta() {
    // Se abbiamo cast da TMDB, usalo (priorità)
    if (cast.length > 0) return cast;
    // Altrimenti cerca nel meta
    if (meta && (meta as any).cast && (meta as any).cast.length > 0) {
      return (meta as any).cast.map((name: string, i: number) => ({ 
        id: i, 
        name: name, 
        role: '',
        photo: undefined 
      }));
    }
    return [];
  }

  function handleEpisodeSelect(video: Video) {
    setSelectedVideo(video);
    setStreamGroups([]);
    setStreamError(null);
    setPlayError(null);
    const allVids = meta?.videos ?? [];
    const idx = allVids.findIndex(v => v.id === video.id);
    setPrevEpData(idx > 0 ? allVids[idx - 1] : null);
    const imdbBase = meta?.id?.startsWith('tt') ? meta.id : (decodedId.startsWith('tt') ? decodedId : null);
    const streamId = imdbBase && video.season && video.episode
      ? `${imdbBase}:${video.season}:${video.episode}`
      : video.id;
    loadStreams(streamId);
  }

  function buildProxyUrl(streamUrl: string, requestHeaders: Record<string, string>): string {
    const headerParams = Object.entries(requestHeaders)
      .map(([k, v]) => `&h=${encodeURIComponent(`${k}:${v}`)}`)
      .join('');
    return `http://127.0.0.1:11473/proxy?url=${encodeURIComponent(streamUrl)}${headerParams}`;
  }

  function applyProxyIfNeeded(stream: Stream, rawUrl: string): string {
    const proxyHeaders = (stream.behaviorHints as any)?.proxyHeaders?.request as Record<string, string> | undefined;
    if (proxyHeaders && Object.keys(proxyHeaders).length > 0
      && rawUrl.startsWith('http')
      && !rawUrl.includes('127.0.0.1:11473')) {
      try { return buildProxyUrl(rawUrl, proxyHeaders); } catch {}
    }
    return rawUrl;
  }

  function handlePlay(stream: Stream, groupUrl: string, si: number) {
    setPlayError(null);
    setActiveStreamKey(`${groupUrl}:${si}`);
    const playUrl = stream.url ?? (stream.infoHash
      ? `magnet:?xt=urn:btih:${stream.infoHash}${stream.fileIdx !== undefined ? `&so=${stream.fileIdx}` : ''}`
      : null);
    if (!playUrl) { setPlayError('Stream senza URL valido.'); return; }
    const custom = settings.customPlayerPath?.trim();
    if (custom) { launchPlayer(playUrl, meta?.name, custom).catch(e => setPlayError(e.message)); return; }
    const finalUrl = applyProxyIfNeeded(stream, playUrl);
    setStreamReferer(undefined);
    setPlayerStream({ ...stream, url: finalUrl });
  }

  const nextEpisodeData = (() => {
    if (!meta?.videos || !selectedVideo) return null;
    const idx = meta.videos.findIndex(v => v.id === selectedVideo.id);
    return idx >= 0 && idx < meta.videos.length - 1 ? meta.videos[idx + 1] : null;
  })();

  const preloadedRef = React.useRef<{ streamId: string; groups: StreamGroup[] } | null>(null);

  React.useEffect(() => {
    if (!nextEpisodeData || !playerStream) return;
    const imdbBase = meta?.id?.startsWith('tt') ? meta.id : (decodedId.startsWith('tt') ? decodedId : null);
    const nextStreamId = imdbBase && nextEpisodeData.season && nextEpisodeData.episode
      ? `${imdbBase}:${nextEpisodeData.season}:${nextEpisodeData.episode}`
      : nextEpisodeData.id;
    if (preloadedRef.current?.streamId === nextStreamId) return;
    preloadedRef.current = { streamId: nextStreamId, groups: [] };
    (async () => {
      const groups: StreamGroup[] = [];
      await fetchAllStreams(addons, type!, nextStreamId, (g) => { groups.push(g); });
      preloadedRef.current = { streamId: nextStreamId, groups };
    })().catch(() => {});
  }, [nextEpisodeData?.id, playerStream?.url]);

  async function handleNextFromPlayer() {
    if (!nextEpisodeData) return;
    const imdbBase = meta?.id?.startsWith('tt') ? meta.id : (decodedId.startsWith('tt') ? decodedId : null);
    const nextStreamId = imdbBase && nextEpisodeData.season && nextEpisodeData.episode
      ? `${imdbBase}:${nextEpisodeData.season}:${nextEpisodeData.episode}`
      : nextEpisodeData.id;
    setSelectedVideo(nextEpisodeData);
    const idx2 = (meta?.videos ?? []).findIndex(v => v.id === nextEpisodeData.id);
    setPrevEpData(idx2 > 0 ? (meta?.videos ?? [])[idx2 - 1] : null);
    await invoke('mpv_stop').catch(() => {});
    const tryPlay = (groups: StreamGroup[]) => {
      const currentAddonUrl = activeStreamKey?.split(':')[0] ?? '';
      const targetGroup = groups.find(g => g.addonUrl === currentAddonUrl) ?? groups[0];
      const firstStream = targetGroup?.streams.find((s: Stream) => s.url || s.infoHash);
      if (firstStream && targetGroup) {
        setActiveStreamKey(`${targetGroup.addonUrl}:0`);
        const rawUrl = firstStream.url ?? (firstStream.infoHash
          ? `magnet:?xt=urn:btih:${firstStream.infoHash}${firstStream.fileIdx !== undefined ? `&so=${firstStream.fileIdx}` : ''}`
          : null);
        if (!rawUrl) return;
        const finalUrl = applyProxyIfNeeded(firstStream, rawUrl);
        setStreamReferer(undefined);
        setStreamGroups(groups);
        setPlayerStream({ ...firstStream, url: finalUrl });
      }
    };
    const preloaded = preloadedRef.current;
    if (preloaded?.streamId === nextStreamId && preloaded.groups.length > 0) {
      tryPlay(preloaded.groups);
    } else {
      const groups: StreamGroup[] = [];
      await fetchAllStreams(addons, type!, nextStreamId, (g) => {
        groups.push(g);
        setStreamGroups([...groups]);
      }).catch(() => {});
      tryPlay(groups);
    }
  }

  const bg = meta?.background ?? (tmdb?.backdrop_path ? tmdbImg(tmdb.backdrop_path, 'w1280') : null);
  const poster = meta?.poster ?? (tmdb?.poster_path ? tmdbImg(tmdb.poster_path, 'w342') : null);
  const allVideos = meta?.videos ?? [];
  const seasons = [...new Set(allVideos.map(v => v.season ?? 0))].filter(Boolean).sort((a, b) => a - b);
  const episodesForSeason = allVideos.filter(v => (v.season ?? 0) === activeSeason);
  const showEpisodePanel = isSeries && allVideos.length > 0;
  const displayCast = getCastFromMeta();

  if (playerStream) {
    const titleStr = meta ? (selectedVideo
      ? `${meta.name} – S${selectedVideo.season}E${selectedVideo.episode}`
      : meta.name) : undefined;
    const subtitleStr = selectedVideo
      ? `${selectedVideo.title ?? `Episodio ${selectedVideo.episode}`}`
      : undefined;
    const currentAddonUrl = activeStreamKey?.split(':')[0] ?? '';
    const currentGroup = streamGroups.find(g => g.addonUrl === currentAddonUrl) ?? streamGroups[0];
    const availableQualities = (currentGroup?.streams ?? [])
      .filter(s => s.url)
      .map(s => {
        const raw = `${s.name ?? ''} ${s.title ?? ''} ${s.description ?? ''}`;
        const q = raw.match(/(4K|2160p|1080p|720p|480p)/i)?.[0]?.toUpperCase() ?? 'Auto';
        return { label: q, url: s.url! };
      })
      .filter((v, i, a) => a.findIndex(x => x.label === v.label) === i);
    return (
      <VideoPlayer
        key={playerStream.url}
        url={playerStream.url!}
        title={titleStr}
        subtitle={subtitleStr}
        contentId={meta?.id ?? decodedId}
        contentType={type}
        poster={meta?.poster}
        backdrop={bg ?? undefined}
        referer={streamReferer}
        cast={displayCast.map(p => ({ name: p.name, character: p.role, photo: p.photo }))}
        season={selectedVideo?.season}
        episode={selectedVideo?.episode}
        nextEpisode={nextEpisodeData ? {
          id: nextEpisodeData.id,
          title: nextEpisodeData.title ?? `S${nextEpisodeData.season}E${nextEpisodeData.episode}`,
          thumbnail: nextEpisodeData.thumbnail,
          streamUrl: undefined,
        } : null}
        prevEpisode={prevEpData ? { id: prevEpData.id, title: prevEpData.title ?? '' } : null}
        onClose={() => {
          setPlayerStream(null);
          setStreamGroups([]);
          setActiveStreamKey(null);
          window.dispatchEvent(new CustomEvent('nuvio:cw-updated'));
          if (type === 'movie' && meta?.id) {
            setTimeout(() => loadStreams(meta.id), 100);
          }
        }}
        availableQualities={availableQualities}
        onQualitySelect={(qUrl) => {
          const stream = currentGroup?.streams.find((s: Stream) => s.url === qUrl);
          if (stream && currentGroup) handlePlay(stream, currentGroup.addonUrl, currentGroup.streams.indexOf(stream));
        }}
        onNext={nextEpisodeData ? handleNextFromPlayer : undefined}
        onPrev={prevEpData ? () => { setPlayerStream(null); handleEpisodeSelect(prevEpData!); } : undefined}
        onPlayNextEpisode={nextEpisodeData ? () => handleEpisodeSelect(nextEpisodeData) : undefined}
        initialProgress={0}
      />
    );
  }

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

  const name = meta?.name ?? tmdb?.title ?? tmdb?.name ?? decodedId;
  const overview = meta?.description ?? tmdb?.overview ?? '';
  const rating = meta?.imdbRating ?? (tmdb?.vote_average ? tmdb.vote_average.toFixed(1) : null);
  const year = meta?.releaseInfo ?? (tmdb?.release_date ?? tmdb?.first_air_date ?? '').slice(0, 4);
  const runtime = meta?.runtime ?? (tmdb?.runtime ? `${tmdb.runtime}min` : tmdb?.episode_run_time?.[0] ? `${tmdb.episode_run_time[0]}min` : null);
  const genres = meta?.genres ?? (tmdb?.genres?.map((g: any) => g.name) ?? []);

  return (
    <div className="relative w-full h-full overflow-hidden flex">
      {bg ? <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0 bg-[#0a0a0f]" />}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-black/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
      <div className="relative z-10 flex-1 min-w-0 flex flex-col justify-between p-6 pr-2 overflow-y-auto">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-white/60 hover:text-white bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm w-fit mb-4 transition-colors">
          <ArrowLeft size={14} />Indietro
        </button>
        <div className="flex-1 flex flex-col justify-end pb-2">
          {poster && <div className="mb-4 w-24 hidden sm:block"><img src={poster} alt={name} className="w-24 rounded-xl shadow-2xl border border-white/10" /></div>}
          <h1 className="text-3xl font-black text-white drop-shadow-2xl mb-2 max-w-lg leading-tight">{name}</h1>
          <div className="flex items-center gap-2.5 flex-wrap mb-3">
            {runtime && <span className="text-sm text-white/70">{runtime}</span>}
            {runtime && year && <span className="text-white/30">·</span>}
            {year && <span className="text-sm text-white/70">{year}</span>}
            {rating && <span className="flex items-center gap-1 text-sm font-bold bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-md"><Star size={11} className="fill-yellow-400" />{rating}</span>}
          </div>
          {genres.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1.5">Generi</p>
              <div className="flex flex-wrap gap-1.5">
                {genres.slice(0, 6).map((g: string) => <span key={g} className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white/70">{g}</span>)}
              </div>
            </div>
          )}
          {overview && (
            <div className="mb-4 max-w-lg">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Trama</p>
              <p className="text-sm text-white/75 leading-relaxed line-clamp-4">{overview}</p>
            </div>
          )}
          {displayCast.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Cast</p>
              <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
                {displayCast.map((p: any) => (
                  <Link key={p.id} to={`/person/${p.id}`} className="flex-shrink-0 w-16 text-center group">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 border border-white/10 mx-auto group-hover:border-[color:var(--accent)] transition-colors">
                      {p.photo ? (
                        <img 
                          src={p.photo} 
                          alt={p.name} 
                          className="w-full h-full object-cover object-top" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const parent = (e.target as HTMLImageElement).parentElement;
                            if (parent) {
                              const div = document.createElement('div');
                              div.className = 'w-full h-full flex items-center justify-center text-white/40 text-sm font-bold bg-white/5';
                              div.textContent = p.name.charAt(0).toUpperCase();
                              parent.appendChild(div);
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/40 text-sm font-bold bg-white/5">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-white/60 mt-1.5 leading-tight line-clamp-2 group-hover:text-white transition-colors font-medium">{p.name}</p>
                    {p.role && <p className="text-[9px] text-white/30 line-clamp-1 mt-0.5">{p.role}</p>}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            {!isSeries && (
              <button onClick={() => { const f = streamGroups[0]?.streams.find((s: Stream) => s.url); if (f) handlePlay(f, streamGroups[0].addonUrl, 0); }}
                disabled={streamGroups.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 text-black font-semibold rounded-full bg-white hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <Play size={16} className="fill-black" />
                {streamsLoading ? 'Caricamento...' : 'Riproduci'}
              </button>
            )}
            <button className="flex items-center gap-2 px-4 py-2.5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full text-sm transition-all">
              <Bookmark size={14} />Libreria
            </button>
            {tmdb?.['watch/providers']?.results && (() => {
              const regions = ['IT', 'US'];
              const providers: any[] = [];
              const seen = new Set<number>();
              for (const r of regions) {
                const reg = tmdb['watch/providers'].results[r];
                if (!reg) continue;
                for (const p of [...(reg.flatrate ?? []), ...(reg.free ?? [])]) {
                  if (!seen.has(p.provider_id)) { seen.add(p.provider_id); providers.push(p); }
                }
              }
              return providers.slice(0, 4).map((p: any) => {
                const pname = p.provider_name?.toLowerCase() ?? '';
                const service = STREAMING_SERVICES.find(s => pname.includes(s.id) || pname.includes(s.name.toLowerCase().split(' ')[0]));
                const btn = (
                  <button key={p.provider_id} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs text-white/70 hover:text-white transition-all">
                    {p.logo_path && <img src={`https://image.tmdb.org/t/p/w45${p.logo_path}`} alt="" className="w-5 h-5 rounded" />}
                    {p.provider_name}
                  </button>
                );
                return service ? <Link key={p.provider_id} to={`/streaming/${service.id}`}>{btn}</Link> : btn;
              });
            })()}
          </div>
          {playError && (
            <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 rounded-xl px-3 py-2 mt-3 max-w-md">
              <AlertCircle size={13} />{playError}
            </div>
          )}
        </div>
      </div>
      <div className="relative z-10 w-[380px] flex-shrink-0 bg-[#111115]/90 backdrop-blur-2xl border-l border-white/[0.08] flex flex-col h-full">
        {isSeries && selectedVideo && (
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.08] flex-shrink-0">
            <button onClick={() => { setSelectedVideo(null); setStreamGroups([]); setStreamError(null); }} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"><ChevronLeft size={16} /></button>
            <p className="text-sm font-semibold text-white flex-1 truncate">S{selectedVideo.season}E{selectedVideo.episode} · {selectedVideo.title ?? `Episodio ${selectedVideo.episode}`}</p>
          </div>
        )}
        {showEpisodePanel && !selectedVideo && (
          <div className="flex flex-col h-full">
            {seasons.length > 1 && (
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.08] flex-shrink-0">
                <button onClick={() => { const idx = seasons.indexOf(activeSeason); if (idx > 0) setActiveSeason(seasons[idx - 1]); }} disabled={seasons.indexOf(activeSeason) === 0} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 disabled:opacity-25 flex-shrink-0"><ChevronLeft size={16} /></button>
                <select value={activeSeason} onChange={e => setActiveSeason(Number(e.target.value))} className="flex-1 bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-[color:var(--accent)] cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                  {seasons.map(s => <option key={s} value={s} style={{ backgroundColor: '#1a1a22', color: 'white' }}>{s === 0 ? 'Speciali' : `Stagione ${s}`}</option>)}
                </select>
                <button onClick={() => { const idx = seasons.indexOf(activeSeason); if (idx < seasons.length - 1) setActiveSeason(seasons[idx + 1]); }} disabled={seasons.indexOf(activeSeason) === seasons.length - 1} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 disabled:opacity-25 flex-shrink-0"><ChevronRight size={16} /></button>
                <span className="text-xs text-white/30 flex-shrink-0">{episodesForSeason.length} ep</span>
              </div>
            )}
            {seasons.length <= 1 && <div className="px-4 py-2.5 border-b border-white/[0.08] flex-shrink-0"><p className="text-xs text-white/40">{episodesForSeason.length} episodi</p></div>}
            <div className="flex-1 overflow-y-auto">
              {episodesForSeason.map((ep, i) => (
                <button key={ep.id} type="button" onClick={() => handleEpisodeSelect(ep)} data-context-menu="true"
                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setEpCtxMenu({ x: e.clientX, y: e.clientY, ep }); }}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] hover:bg-white/[0.05] transition-colors cursor-pointer text-left">
                  {(() => {
                    const epVideoId = `${decodedId}:${ep.season}:${ep.episode}`;
                    const epWatched = watchedEpIds.has(epVideoId) || watchedEpIds.has(decodedId);
                    const shouldBlur = (settings as any).blurUnwatched && !epWatched;
                    if (ep.thumbnail) return <img src={ep.thumbnail} alt="" className={`w-24 h-[54px] rounded-lg object-cover flex-shrink-0 bg-white/5 ${shouldBlur ? 'blur-sm brightness-50' : ''}`} />;
                    return <div className={`w-24 h-[54px] rounded-lg flex-shrink-0 flex items-center justify-center text-white/30 text-sm font-bold ${shouldBlur ? 'bg-white/3' : 'bg-white/5'}`}>{ep.episode}</div>;
                  })()}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white leading-tight">{i + 1}. {ep.title ?? `Episodio ${ep.episode}`}</p>
                    {ep.overview && <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{ep.overview}</p>}
                    {ep.released && <p className="text-[10px] text-white/30 mt-0.5">{new Date(ep.released).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {epCtxMenu && (
          <div className="fixed z-[9999] bg-[#1e1e26] border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[200px]" style={{ left: epCtxMenu.x, top: epCtxMenu.y }} onMouseDown={e => e.stopPropagation()}>
            <button onMouseDown={e => { e.stopPropagation(); handleEpisodeSelect(epCtxMenu.ep); setEpCtxMenu(null); }} className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 flex items-center gap-2">▶ Riproduci</button>
            <button onMouseDown={async e => { e.stopPropagation(); setEpCtxMenu(null); if (nuvioUser?.id) await markWatched(nuvioUser.id, epCtxMenu.ep.id.split(':')[0], 'series', epCtxMenu.ep.season, epCtxMenu.ep.episode).catch(() => {}); setWatchedEpIds(prev => new Set([...prev, epCtxMenu.ep.id])); }} className="w-full text-left px-4 py-2.5 text-sm text-green-400 hover:bg-white/5 flex items-center gap-2">✓ Segna come visto</button>
            <button onMouseDown={async e => {
              e.stopPropagation(); setEpCtxMenu(null);
              const epIdx = episodesForSeason.findIndex(e => e.id === epCtxMenu.ep.id);
              if (epIdx >= 0 && nuvioUser?.id) {
                const contentId = epCtxMenu.ep.id.split(':')[0];
                for (let i = 0; i <= epIdx; i++) { const e = episodesForSeason[i]; await markWatched(nuvioUser.id, contentId, 'series', e.season, e.episode).catch(() => {}); }
                const newIds = new Set(watchedEpIds);
                episodesForSeason.slice(0, epIdx + 1).forEach(e => newIds.add(e.id));
                setWatchedEpIds(newIds);
              }
            }} className="w-full text-left px-4 py-2.5 text-sm text-blue-400 hover:bg-white/5 flex items-center gap-2">✓✓ Segna visti fino a qui</button>
            <button onMouseDown={async e => { e.stopPropagation(); setEpCtxMenu(null); if (nuvioUser?.id) await unmarkWatched(nuvioUser.id, epCtxMenu.ep.id.split(':')[0], 'series').catch(() => {}); setWatchedEpIds(prev => { const s = new Set(prev); s.delete(epCtxMenu.ep.id); return s; }); }} className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 flex items-center gap-2">✕ Segna come non visto</button>
          </div>
        )}
        {(!showEpisodePanel || selectedVideo) && (
          <div className="flex flex-col h-full">
            <div className="px-3 py-2 border-b border-white/[0.08] flex-shrink-0 flex items-center gap-2">
              {streamGroups.length > 1 ? (
                <select value={selectedAddon ?? 'all'} onChange={e => setSelectedAddon(e.target.value === 'all' ? null : e.target.value)} className="flex-1 bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[color:var(--accent)] cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                  <option value="all" style={{ backgroundColor: '#1a1a22' }}>Tutti gli addon ({streamGroups.reduce((t, g) => t + g.streams.length, 0)})</option>
                  {streamGroups.map(g => <option key={g.addonUrl} value={g.addonUrl} style={{ backgroundColor: '#1a1a22' }}>{g.addonName} ({g.streams.length})</option>)}
                </select>
              ) : <p className="text-xs font-bold text-white/50 uppercase tracking-wider flex-1">Stream disponibili</p>}
              {streamsLoading && <div className="flex items-center gap-1 flex-shrink-0"><Loader2 size={11} className="animate-spin text-white/40" /><span className="text-[10px] text-white/30">{streamGroups.length}</span></div>}
            </div>
            {streamsLoading && <div className="h-0.5 bg-white/5 flex-shrink-0"><div className="h-full animate-pulse" style={{ backgroundColor: 'var(--accent)', width: '60%' }} /></div>}
            <div className="flex-1 overflow-y-auto">
              {streamGroups.length === 0 && !streamsLoading && streamError && <div className="px-4 py-6 text-center"><AlertCircle size={20} className="text-white/30 mx-auto mb-2" /><p className="text-xs text-white/40">{streamError}</p></div>}
              {streamGroups.length === 0 && !streamsLoading && !streamError && isSeries && !selectedVideo && <div className="px-4 py-6 text-center text-xs text-white/30">Seleziona un episodio per caricare gli stream</div>}
              {(selectedAddon ? streamGroups.filter(g => g.addonUrl === selectedAddon) : streamGroups).map((group) => (
                <div key={group.addonUrl}>
                  <div className="sticky top-0 bg-[#111115]/95 backdrop-blur-sm px-3 py-2 border-b border-white/[0.05] z-10">
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>{group.addonName}</span>
                    <span className="text-[10px] text-white/25 ml-1.5">({group.streams.length})</span>
                  </div>
                  {group.streams.slice(0, 20).map((stream: Stream, si: number) => (
                    <StreamRow key={si} stream={stream} onPlay={() => handlePlay(stream, group.addonUrl, si)} active={activeStreamKey === `${group.addonUrl}:${si}`} />
                  ))}
                  {group.streams.length > 20 && <p className="text-[10px] text-white/25 text-center py-1.5">+{group.streams.length - 20} altri</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}