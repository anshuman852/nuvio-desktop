import React from 'react';
/// <reference types="vite/client" />
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { getAllWatchedItems, markWatched, unmarkWatched } from '../api/nuvio';
import { fetchMeta, fetchAllStreams, openExternal, launchPlayer } from '../api/stremio';
import { getDetails, getSeasonDetails, tmdbImg, hasTMDBKey, STREAMING_SERVICES, getPerson } from '../api/tmdb';
import { MetaItem, Stream, StreamGroup, Video } from '../lib/types';
import VideoPlayer from '../components/VideoPlayer';
import { invoke } from '@tauri-apps/api/core';
import { showContextMenu, copyText } from '../lib/contextMenu';
import { useT } from '../lib/i18n';
import {
  Play, ArrowLeft, Star, ChevronLeft, ChevronRight,
  Loader2, AlertCircle, Bookmark, Users, RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';

const QUALITY_ORDER: Record<string, number> = { '4K': 0, '2160P': 1, '1080P': 2, '720P': 3, '480P': 4 };

function getStreamQuality(stream: Stream): string {
  const raw = `${stream.name ?? ''} ${stream.title ?? ''} ${stream.description ?? ''}`;
  const qualMatch = raw.match(/\b(4K|2160p|1080p|720p|480p)\b/i);
  return qualMatch?.[0]?.toUpperCase() ?? '';
}

function StreamRow({ stream, onPlay, active }: { stream: Stream; onPlay: () => void; active: boolean }) {
  const hasUrl = Boolean(stream.url);
  const hasMagnet = Boolean(stream.infoHash) && !hasUrl;
  const raw = `${stream.name ?? ''} ${stream.title ?? ''} ${stream.description ?? ''}`;
  const quality = getStreamQuality(stream);
  const tags = Array.from(new Set(
    (raw.match(/\b(HDR10\+?|HDR|DV|Dolby Vision|HEVC|x265|x264|WEBDL|WEB-DL|BluRay|SDR|AVC)\b/gi) ?? [])
      .map((t: string) => t.toUpperCase().replace('DOLBY VISION','DV').replace('WEB-DL','WEBDL'))
  )).slice(0, 4) as string[];
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

  // Parse description into structured lines
  const descLines = (stream.description ?? '').split('\n').map(l => l.trim()).filter(Boolean);
  const firstLine = descLines[0] ?? '';
  const detailLines = descLines.slice(1).reduce<{ label: string; value: string }[]>((acc, line) => {
    const sep = line.match(/^(\w+)\s*:\s*(.+)/);
    if (sep) acc.push({ label: sep[1], value: sep[2] });
    return acc;
  }, []);
  const hasSizeDetail = detailLines.find(d => d.label.toLowerCase() === 'size');
  const hasLangDetail = detailLines.find(d => d.label.toLowerCase() === 'language');
  const hasAddonDetail = detailLines.find(d => d.label.toLowerCase() === 'addon');

  return (
    <button
      type="button"
      onClick={onPlay}
      className={clsx(
        'w-full text-left rounded-xl border p-3 transition-all cursor-pointer group relative overflow-hidden mb-2',
        active
          ? 'bg-gradient-to-br from-[color:var(--accent)]/15 to-[color:var(--accent)]/5 border-[color:var(--accent)]/50 shadow-[0_0_20px_rgba(124,58,237,0.2)]'
          : 'bg-[#13131a] border-white/[0.06] hover:border-[color:var(--accent)]/30 hover:bg-[#1a1a22] hover:shadow-xl hover:shadow-black/30'
      )}
    >
      {/* Active play indicator */}
      {active && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[color:var(--accent)] flex items-center justify-center shadow-lg shadow-[color:var(--accent)]/30 z-10">
          <Play size={10} className="fill-white text-white ml-0.5" />
        </div>
      )}

      {/* Top row: Quality badge + codec tags */}
      <div className={clsx('flex items-center gap-1.5 flex-wrap', active && 'pr-7')}>
        {quality && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {quality}
          </span>
        )}
        {tags.map((t: string) => (
          <span
            key={t}
            className="px-1 py-0.5 rounded text-[9px] font-semibold bg-[color:var(--accent)]/8 text-[color:var(--accent)]/70 border border-[color:var(--accent)]/12"
          >
            {t}
          </span>
        ))}
        {hasMagnet && (
          <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-[color:var(--accent)]/15 text-[color:var(--accent)]/80 border border-[color:var(--accent)]/20">
            P2P
          </span>
        )}
      </div>

      {/* File / source name */}
      <p className="text-[13px] font-semibold text-white/85 mt-2 leading-snug line-clamp-2 group-hover:text-white transition-colors">
        {sourceLine || firstLine || addonLabel}
      </p>

      {/* Meta row: size, language, seeds */}
      <div className="flex items-center gap-2.5 mt-2 flex-wrap">
        {hasSizeDetail ? (
          <span className="text-[11px] text-white/40 font-medium">{hasSizeDetail.value}</span>
        ) : (
          sizeStr && <span className="text-[11px] text-white/40 font-medium">{sizeStr}</span>
        )}
        {langs && <span className="text-[11px] leading-none">{langs}</span>}
        {hasLangDetail && (
          <span className="text-[11px] text-white/30">{hasLangDetail.value}</span>
        )}
        {seeds && (
          <span className="flex items-center gap-0.5 text-[11px] text-white/40">
            <span className="text-green-400/60 text-[10px]">👤</span>
            {seeds}
          </span>
        )}
      </div>

      {/* Addon source */}
      {hasAddonDetail && (
        <p className="text-[10px] text-white/20 mt-1.5 font-medium tracking-wide">
          via {hasAddonDetail.value}
        </p>
      )}
    </button>
  );
}

export default function Detail() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const { addons, settings, nuvioUser, upsertWatch } = useStore();
  const { t } = useT();
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
  const [qualityFilter, setQualityFilter] = useState<string>('all');
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [playerStream, setPlayerStream] = useState<Stream | null>(null);
  const [streamReferer, setStreamReferer] = useState<string | undefined>(undefined);
  const [activeSeason, setActiveSeason] = useState<number>(1);
  const [watchedEpIds, setWatchedEpIds] = useState<Set<string>>(new Set());
  const isTmdbId = decodedId.startsWith('tmdb:');

  const streamGroupsRef = useRef<StreamGroup[]>([]);
  const hasStreamsLoadedRef = useRef(false);
  const tmdbRef = useRef<any>(null);
  const fetchedSeasonsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    tmdbRef.current = tmdb;
  }, [tmdb]);

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
    streamGroupsRef.current = [];
    hasStreamsLoadedRef.current = false;
    tmdbRef.current = null;
    fetchedSeasonsRef.current = new Set();

    (async () => {
      let found: MetaItem | null = null;
      const tmdbNumId = isTmdbId ? parseInt(decodedId.replace('tmdb:', '')) : null;
      const imdbId = decodedId.startsWith('tt') ? decodedId : null;

      const addonResult = isTmdbId ? Promise.resolve(null) : Promise.race([
        Promise.any(
          addons.slice(0, 8).map(addon =>
            fetchMeta(addon.url, type!, decodedId).then(m => {
              if (!m?.name) throw new Error('no meta');
              return m;
            })
          )
        ).catch(() => null),
        new Promise<null>(res => setTimeout(() => res(null), 5000)),
      ]);

      let tmdbData = null;
      let localCast: any[] = [];
      if (hasTMDBKey() && settings.tmdbApiKey) {
        try {
          let tmdbId = tmdbNumId;
          if (!tmdbId && imdbId) {
            const fr = await fetch(
              `https://api.themoviedb.org/3/find/${imdbId}?api_key=${settings.tmdbApiKey}&external_source=imdb_id`
            ).then(r => r.json()).catch(() => null);
            const arr = type === 'series' ? (fr?.tv_results ?? []) : (fr?.movie_results ?? []);
            if (arr.length > 0) tmdbId = arr[0].id;
          }

          if (tmdbId) {
            const tmdbType = type === 'series' ? 'tv' : 'movie';
            const details = await getDetails(tmdbType, tmdbId);

            const [creditsIT, creditsEN] = await Promise.all([
              fetch(`https://api.themoviedb.org/3/${tmdbType}/${tmdbId}/credits?api_key=${settings.tmdbApiKey}&language=it-IT`).then(r => r.json()).catch(() => null),
              fetch(`https://api.themoviedb.org/3/${tmdbType}/${tmdbId}/credits?api_key=${settings.tmdbApiKey}&language=en-US`).then(r => r.json()).catch(() => null),
            ]);

            let bestCredits = details.credits;
            if (creditsEN?.cast && creditsEN.cast.length > (bestCredits?.cast?.length ?? 0)) bestCredits = creditsEN;
            if (creditsIT?.cast && creditsIT.cast.length > (bestCredits?.cast?.length ?? 0)) bestCredits = creditsIT;
            if (bestCredits) details.credits = bestCredits;

            tmdbData = details;
          }
        } catch (e) {
          console.error('TMDB error:', e);
        }
      }

      const addonResultData = await addonResult;
      found = addonResultData as MetaItem | null;

      if (tmdbData) {
        setTmdb(tmdbData);
        tmdbRef.current = tmdbData;

        const fullCast = (tmdbData.credits?.cast ?? [])
          .filter((c: any) => c.name)
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            role: c.character ?? '',
photo: c.profile_path ? `https://image.tmdb.org/t/p/h632${c.profile_path}` : undefined,
          }));
        setCast(fullCast); localCast = fullCast;

        setCrew((tmdbData.credits?.crew ?? []).filter((c: any) =>
          ['Director', 'Screenplay', 'Writer', 'Creator', 'Producer'].includes(c.job)
        ).slice(0, 8).map((c: any) => ({
          id: c.id, name: c.name, role: c.job,
          photo: c.profile_path ? `https://image.tmdb.org/t/p/h632${c.profile_path}` : undefined,
        })));

        if (!found || isTmdbId) {
          const imdbFromTmdb = tmdbData.external_ids?.imdb_id;
          let episodes: Video[] = [];
          if (tmdbData.seasons?.length) {
            for (const season of tmdbData.seasons) {
              if (!season.season_number) continue;
              const baseId = imdbFromTmdb ?? decodedId;
              for (let ep = 1; ep <= (season.episode_count ?? 0); ep++) {
                episodes.push({ id: `${baseId}:${season.season_number}:${ep}`, title: `Episode ${ep}`, season: season.season_number, episode: ep });
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
              eps.push({ id: `${baseId}:${season.season_number}:${ep}`, title: `Episode ${ep}`, season: season.season_number, episode: ep });
            }
          }
          if (eps.length > 0) found = { ...found, videos: eps };
        }
      }

      if (localCast.length === 0 && found && (found as any).cast && (found as any).cast.length > 0) {
        const fallbackCast = ((found as any).cast as string[]).map((name: string, i: number) => ({
          id: `fallback_${i}_${name}`, name, role: '', photo: undefined
        }));
        setCast(fallbackCast);
      }

      if (found) {
        const seasons = [...new Set((found.videos ?? []).map(v => v.season ?? 0))].filter(Boolean).sort((a, b) => a - b);
        if (seasons.length > 0) setActiveSeason(seasons[0]);
        setMeta(found);

        // Eagerly fetch the first season's episode details
        if (tmdbData?.id && seasons.length > 0) {
          const firstSeason = seasons[0];
          fetchedSeasonsRef.current.add(firstSeason);
          getSeasonDetails(tmdbData.id, firstSeason).then(seasonData => {
            if (!seasonData?.episodes) return;
            setMeta(prev => {
              if (!prev?.videos) return prev;
              const updatedVideos = prev.videos.map(v => {
                if ((v.season ?? 0) !== firstSeason) return v;
                const epData = seasonData.episodes.find((e: any) => e.episode_number === v.episode);
                if (!epData) return v;
                return {
                  ...v,
                  title: epData.name ?? v.title,
                  released: epData.air_date ?? v.released,
                  thumbnail: epData.still_path ? `https://image.tmdb.org/t/p/w300${epData.still_path}` : v.thumbnail,
                  overview: epData.overview ?? v.overview,
                };
              });
              return { ...prev, videos: updatedVideos };
            });
          }).catch(() => {});
        }
      }

      setMetaLoading(false);
      if ((found?.type === 'movie' || type === 'movie') && found) loadStreams(found.id, true);
    })();
  }, [type, decodedId]);

  // ── Fetch season details when activeSeason changes ──────────────────────────
  useEffect(() => {
    if (!tmdb || !isSeries || !meta?.videos) return;
    const tvId = tmdb.id;
    if (!tvId) return;

    // Skip if this season was already fetched
    if (fetchedSeasonsRef.current.has(activeSeason)) return;
    fetchedSeasonsRef.current.add(activeSeason);

    getSeasonDetails(tvId, activeSeason).then(seasonData => {
      if (!seasonData?.episodes) return;
      setMeta(prev => {
        if (!prev?.videos) return prev;
        const updatedVideos = prev.videos.map(v => {
          if ((v.season ?? 0) !== activeSeason) return v;
          const epData = seasonData.episodes.find((e: any) => e.episode_number === v.episode);
          if (!epData) return v;
          return {
            ...v,
            title: epData.name ?? v.title,
            released: epData.air_date ?? v.released,
            thumbnail: epData.still_path ? `https://image.tmdb.org/t/p/w300${epData.still_path}` : v.thumbnail,
            overview: epData.overview ?? v.overview,
          };
        });
        return { ...prev, videos: updatedVideos };
      });
    }).catch(() => {});
  }, [activeSeason, tmdb?.id, isSeries]);

  // ── loadStreams with cache + plugin integration ────────────────────────────
  const loadStreams = useCallback(async (videoId: string, force = false) => {
    if (!force && hasStreamsLoadedRef.current && streamGroupsRef.current.length > 0) {
      console.log('[Detail] Restoring streams from cache:', streamGroupsRef.current.length);
      setStreamGroups(streamGroupsRef.current);
      return;
    }

    console.log('[Detail] loadStreams called for:', videoId, force ? '(forced)' : '');
    setStreamsLoading(true);
    setStreamGroups([]);
    setStreamError(null);
    setPlayError(null);
    setActiveStreamKey(null);

    try {
      const allGroups: StreamGroup[] = [];

      // 1. Streams from Stremio addons
      await fetchAllStreams(addons, type!, videoId, (group) => {
        const exists = allGroups.find(g => g.addonUrl === group.addonUrl);
        if (!exists) allGroups.push(group);
        setStreamGroups([...allGroups]);
        streamGroupsRef.current = [...allGroups];
      }, force);

      // 2. Streams from plugin system (JavaScript scrapers)
      const parts = videoId.split(':');
      const hasEpisode = parts.length >= 3
        && !isNaN(Number(parts[parts.length - 1]))
        && !isNaN(Number(parts[parts.length - 2]));
      const epSeason  = hasEpisode ? Number(parts[parts.length - 2]) : undefined;
      const epEpisode = hasEpisode ? Number(parts[parts.length - 1]) : undefined;

      // FIX: scrapers expect IMDB ID (tt...), not TMDB numeric
      const imdbIdForPlugin = videoId.startsWith('tt')
        ? videoId.split(':')[0]                                          // "tt1234:1:2" → "tt1234"
        : (tmdbRef.current?.external_ids?.imdb_id ?? videoId.replace(/:\d+:\d+$/, ''));

      console.log('[Detail] plugin_get_streams →', {
        mediaType: type === 'series' ? 'tv' : 'movie',
        tmdbId: imdbIdForPlugin,
        season: epSeason,
        episode: epEpisode,
      });

      const isInTauri = typeof invoke === 'function';

      try {
        if (!isInTauri) throw new Error('Not in Tauri environment');

        const pluginsEnabled = await invoke<boolean>('plugin_is_enabled');

        if (pluginsEnabled) {
          const pluginStreams = await invoke<Array<{
            name?: string;
            title?: string;
            url: string;
            quality?: string;
            size?: string;
            info_hash?: string;
            file_idx?: number;
            headers?: Record<string, string>;
          }>>('plugin_get_streams', {
            mediaType: type === 'series' ? 'tv' : 'movie',
            tmdbId: imdbIdForPlugin,
            season: epSeason,
            episode: epEpisode,
          });

          if (pluginStreams && pluginStreams.length > 0) {
            const converted: Stream[] = pluginStreams.map(s => ({
              name: s.name ?? '🔌 Plugin',
              title: s.title ?? s.quality ?? s.name,
              url: s.url,
              infoHash: s.info_hash,
              fileIdx: s.file_idx,
              description: s.quality ?? s.size ?? undefined,
              behaviorHints: s.headers && Object.keys(s.headers).length > 0
                ? { proxyHeaders: { request: s.headers } }
                : undefined,
            }));

            const pluginGroup: StreamGroup = {
              addonUrl: 'plugin://scrapers',
              addonName: '🧩 Plugin Scrapers',
              streams: converted,
            };

            const pluginIdx = allGroups.findIndex(g => g.addonUrl === 'plugin://scrapers');
            if (pluginIdx === -1) allGroups.push(pluginGroup);
            else allGroups[pluginIdx] = pluginGroup;

            setStreamGroups([...allGroups]);
            streamGroupsRef.current = [...allGroups];
            console.log(`[Detail] Plugin streams added: ${converted.length}`);
          }
        }
      } catch (pluginErr) {
        console.warn('[Detail] Plugin streams unavailable:', pluginErr);
      }

      console.log('[Detail] streamGroups after fetch:', streamGroupsRef.current.length);
      hasStreamsLoadedRef.current = true;
    } catch (e: any) {
      console.error('[Detail] loadStreams error:', e);
      setStreamError(e.message ?? 'Error');
    } finally {
      setStreamsLoading(false);
    }
  }, [addons, type]);

  function getCastFromMeta() {
    if (cast.length > 0) return cast;
    if (meta && (meta as any).cast && (meta as any).cast.length > 0) {
      return ((meta as any).cast as string[]).map((name: string, i: number) => ({
        id: `fallback_${i}_${name}`, name, role: '', photo: undefined
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
    streamGroupsRef.current = [];
    hasStreamsLoadedRef.current = false;
    loadStreams(streamId, true);
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
    if (!playUrl) {
      setPlayError('Stream senza URL valido.');
      setActiveStreamKey(null);
      return;
    }
    const custom = settings.customPlayerPath?.trim();
    if (custom) {
      launchPlayer(playUrl, meta?.name, custom).catch(e => {
        setPlayError(e.message);
        setActiveStreamKey(null);
      });
      return;
    }
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

  const resetAndReloadStreams = useCallback(() => {
    setPlayerStream(null);
    setStreamGroups([]);
    setActiveStreamKey(null);
    setPlayError(null);
    setStreamError(null);
    streamGroupsRef.current = [];
    hasStreamsLoadedRef.current = false;
    const idToLoad = meta?.id || decodedId;
    if (idToLoad) setTimeout(() => loadStreams(idToLoad, true), 300);
  }, [meta?.id, decodedId, loadStreams]);

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
      ? `${selectedVideo.title ?? `Episode ${selectedVideo.episode}`}`
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
        cast={displayCast.slice(0, 12).map((p: any) => ({ name: p.name, character: p.role, photo: p.photo }))}
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
          setActiveStreamKey(null);
          window.dispatchEvent(new CustomEvent('nuvio:cw-updated'));
          setPlayError(null);
          if (streamGroupsRef.current.length > 0) {
            setStreamGroups(streamGroupsRef.current);
          } else {
            loadStreams(meta?.id || decodedId, true);
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
      <Loader2 size={28} className="animate-spin" /><span className="text-sm">Loading...</span>
    </div>
  );
  if (!meta && !tmdb) return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <AlertCircle size={32} className="text-red-400" />
      <p className="text-white/60 text-sm">Unable to load details.</p>
      <button onClick={() => navigate(-1)} className="px-4 py-2 bg-white/10 text-white rounded-xl text-sm">Back</button>
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
          <ArrowLeft size={14} />Back
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
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1.5">Genres</p>
              <div className="flex flex-wrap gap-1.5">
                {genres.slice(0, 6).map((g: string) => <span key={g} className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white/70">{g}</span>)}
              </div>
            </div>
          )}
          {overview && (
            <div className="mb-4 max-w-lg">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Synopsis</p>
              <p className="text-sm text-white/75 leading-relaxed line-clamp-4">{overview}</p>
            </div>
          )}
          {displayCast.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Users size={12} /> Cast ({displayCast.length})
              </p>
              <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
                {displayCast.slice(0, 12).map((p: any) => (
                  <Link key={p.id} to={`/person/${p.id}`} className="flex-shrink-0 w-20 text-center group">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-white/10 border border-white/10 mx-auto group-hover:border-[color:var(--accent)] transition-colors">
                      {p.photo ? (
                        <img src={p.photo} alt={p.name} className="w-full h-full object-cover object-center"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const parent = (e.target as HTMLImageElement).parentElement;
                            if (parent) {
                              const div = document.createElement('div');
                              div.className = 'w-full h-full flex items-center justify-center text-white/40 text-base font-bold bg-white/5';
                              div.textContent = p.name.charAt(0).toUpperCase();
                              parent.appendChild(div);
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/40 text-base font-bold bg-white/5">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-white/60 mt-1.5 leading-tight line-clamp-2 group-hover:text-white transition-colors font-medium">{p.name}</p>
                    {p.role && <p className="text-[10px] text-white/30 line-clamp-1 mt-0.5">{p.role}</p>}
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
                {streamsLoading ? 'Loading...' : 'Play'}
              </button>
            )}
            <button className="flex items-center gap-2 px-4 py-2.5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full text-sm transition-all">
              <Bookmark size={14} />Library
            </button>
            <button
              onClick={() => {
                streamGroupsRef.current = [];
                hasStreamsLoadedRef.current = false;
                setStreamGroups([]);
                const idToLoad = meta?.id || decodedId;
                if (idToLoad) loadStreams(idToLoad, true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full text-sm transition-all"
            >
              <RefreshCw size={14} /> Reload streams
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
              <button onClick={resetAndReloadStreams} className="ml-auto text-white/60 hover:text-white text-xs underline">Retry</button>
            </div>
          )}
        </div>
      </div>
      <div className="relative z-10 w-[380px] flex-shrink-0 bg-[#111115]/90 backdrop-blur-2xl border-l border-white/[0.08] flex flex-col h-full">
        {isSeries && selectedVideo && (
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.08] flex-shrink-0">
            <button onClick={() => { setSelectedVideo(null); setStreamGroups([]); setStreamError(null); }} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"><ChevronLeft size={16} /></button>
            <p className="text-sm font-semibold text-white flex-1 truncate">S{selectedVideo.season}E{selectedVideo.episode} · {selectedVideo.title ?? `Episode ${selectedVideo.episode}`}</p>
          </div>
        )}
        {showEpisodePanel && !selectedVideo && (
          <div className="flex flex-col h-full">
            {seasons.length > 1 && (
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.08] flex-shrink-0">
                <button onClick={() => { const idx = seasons.indexOf(activeSeason); if (idx > 0) setActiveSeason(seasons[idx - 1]); }} disabled={seasons.indexOf(activeSeason) === 0} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 disabled:opacity-25 flex-shrink-0"><ChevronLeft size={16} /></button>
                <select value={activeSeason} onChange={e => setActiveSeason(Number(e.target.value))} className="flex-1 bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-[color:var(--accent)] cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                  {seasons.map(s => <option key={s} value={s} style={{ backgroundColor: '#1a1a22' }}>{s === 0 ? 'Specials' : `Season ${s}`}</option>)}
                </select>
                <button onClick={() => { const idx = seasons.indexOf(activeSeason); if (idx < seasons.length - 1) setActiveSeason(seasons[idx + 1]); }} disabled={seasons.indexOf(activeSeason) === seasons.length - 1} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 disabled:opacity-25 flex-shrink-0"><ChevronRight size={16} /></button>
                <span className="text-xs text-white/30 flex-shrink-0">{episodesForSeason.length} ep</span>
              </div>
            )}
            {seasons.length <= 1 && <div className="px-4 py-2.5 border-b border-white/[0.08] flex-shrink-0"><p className="text-xs text-white/40">{episodesForSeason.length} episodes</p></div>}
            <div className="flex-1 overflow-y-auto">
              {episodesForSeason.map((ep, i) => (
                <button key={ep.id} type="button" onClick={() => handleEpisodeSelect(ep)}
                  onContextMenu={e => {
                    e.preventDefault();
                    showContextMenu([
                      { id: 'play', text: t('ctx_play'), accelerator: 'Enter', action: () => handleEpisodeSelect(ep) },
                      '---' as const,
                      { id: 'watched', text: t('ctx_mark_watched'), action: async () => {
                        if (nuvioUser?.id) await markWatched(nuvioUser.id, ep.id.split(':')[0], 'series', ep.season, ep.episode).catch(() => {});
                        setWatchedEpIds(prev => new Set([...prev, ep.id]));
                      }},
                      { id: 'watched-up', text: t('ctx_mark_up_to'), action: async () => {
                        const epIdx = episodesForSeason.findIndex(e2 => e2.id === ep.id);
                        if (epIdx >= 0 && nuvioUser?.id) {
                          const contentId = ep.id.split(':')[0];
                          for (let i = 0; i <= epIdx; i++) { const e2 = episodesForSeason[i]; await markWatched(nuvioUser.id, contentId, 'series', e2.season, e2.episode).catch(() => {}); }
                          const newIds = new Set(watchedEpIds);
                          episodesForSeason.slice(0, epIdx + 1).forEach(e2 => newIds.add(e2.id));
                          setWatchedEpIds(newIds);
                        }
                      }},
                      '---' as const,
                      { id: 'unwatched', text: t('ctx_mark_unwatched'), action: async () => {
                        if (nuvioUser?.id) await unmarkWatched(nuvioUser.id, ep.id.split(':')[0], 'series').catch(() => {});
                        setWatchedEpIds(prev => { const s = new Set(prev); s.delete(ep.id); return s; });
                      }},
                    ]);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] hover:bg-white/[0.05] transition-colors cursor-pointer text-left">
                  {(() => {
                    const epVideoId = `${decodedId}:${ep.season}:${ep.episode}`;
                    const epWatched = watchedEpIds.has(epVideoId) || watchedEpIds.has(decodedId);
                    const shouldBlur = (settings as any).blurUnwatched && !epWatched;
                    if (ep.thumbnail) return <img src={ep.thumbnail} alt="" className={`w-24 h-[54px] rounded-lg object-cover flex-shrink-0 bg-white/5 ${shouldBlur ? 'blur-sm brightness-50' : ''}`} />;
                    return <div className={`w-24 h-[54px] rounded-lg flex-shrink-0 flex items-center justify-center text-white/30 text-sm font-bold ${shouldBlur ? 'bg-white/3' : 'bg-white/5'}`}>{ep.episode}</div>;
                  })()}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white leading-tight">{i + 1}. {ep.title ?? `Episode ${ep.episode}`}</p>
                    {ep.overview && <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{ep.overview}</p>}
                    {ep.released && <p className="text-[10px] text-white/30 mt-0.5">{new Date(ep.released).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {(!showEpisodePanel || selectedVideo) && (
          <div className="flex flex-col h-full">
            <div className="px-3 py-2 border-b border-white/[0.08] flex-shrink-0 flex items-center gap-2">
              {streamGroups.length > 1 ? (
                <select value={selectedAddon ?? 'all'} onChange={e => setSelectedAddon(e.target.value === 'all' ? null : e.target.value)} className="flex-1 bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[color:var(--accent)] cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                  <option value="all" style={{ backgroundColor: '#1a1a22' }}>All addons ({streamGroups.reduce((t, g) => t + g.streams.length, 0)})</option>
                  {streamGroups.map(g => <option key={g.addonUrl} value={g.addonUrl} style={{ backgroundColor: '#1a1a22' }}>{g.addonName} ({g.streams.length})</option>)}
                </select>
              ) : <p className="text-xs font-bold text-white/50 uppercase tracking-wider flex-1">Available streams</p>}
              <button
                onClick={() => {
                  streamGroupsRef.current = [];
                  hasStreamsLoadedRef.current = false;
                  setStreamGroups([]);
                  const idToLoad = meta?.id || decodedId;
                  if (idToLoad) loadStreams(idToLoad, true);
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                title="Reload streams"
              >
                <RefreshCw size={14} />
              </button>
              {streamsLoading && <div className="flex items-center gap-1 flex-shrink-0"><Loader2 size={11} className="animate-spin text-white/40" /><span className="text-[10px] text-white/30">{streamGroups.length}</span></div>}
            </div>
            {streamsLoading && <div className="h-0.5 bg-white/5 flex-shrink-0"><div className="h-full animate-pulse" style={{ backgroundColor: 'var(--accent)', width: '60%' }} /></div>}
            {(() => {
              const allStreams = (selectedAddon ? streamGroups.filter(g => g.addonUrl === selectedAddon) : streamGroups).flatMap(g => g.streams.map(s => ({ stream: s, addonUrl: g.addonUrl, addonName: g.addonName })));
              const sortedStreams = [...allStreams];
              
              // Sort by size when sortDir is active
              if (sortDir) {
                sortedStreams.sort((a, b) => {
                  const sizeA = a.stream.behaviorHints?.videoSize ?? 0;
                  const sizeB = b.stream.behaviorHints?.videoSize ?? 0;
                  return sortDir === 'desc' ? sizeB - sizeA : sizeA - sizeB;
                });
              }
              const qualityCounts = sortedStreams.reduce<Record<string, number>>((acc, { stream }) => {
                const q = getStreamQuality(stream) || 'Unknown';
                acc[q] = (acc[q] || 0) + 1;
                return acc;
              }, {});
              const qualityTabs = ['all', ...Object.keys(qualityCounts).sort((a, b) => (QUALITY_ORDER[a] ?? 99) - (QUALITY_ORDER[b] ?? 99))];
              const filteredStreams = qualityFilter === 'all' ? sortedStreams : sortedStreams.filter(({ stream }) => (getStreamQuality(stream) || 'Unknown') === qualityFilter);
              const filteredGroups = filteredStreams.reduce<StreamGroup[]>((acc, { stream, addonUrl, addonName }) => {
                let g = acc.find(x => x.addonUrl === addonUrl);
                if (!g) { g = { addonName, addonUrl, streams: [] }; acc.push(g); }
                g.streams.push(stream);
                return acc;
              }, []);
              return (
                <>
                  {sortedStreams.length > 0 && (
                    <div className="flex gap-1 px-2 py-1.5 border-b border-white/[0.06] overflow-x-auto flex-shrink-0 scrollbar-none">
                      {qualityTabs.map(q => {
                        const label = q === 'all' ? 'All' : q === 'Unknown' ? 'Unknown' : q;
                        const count = q === 'all' ? sortedStreams.length : qualityCounts[q] || 0;
                        const isActive = qualityFilter === q;
                        return (
                          <button key={q} onClick={() => {
                            if (q !== qualityFilter) {
                              setQualityFilter(q);
                              setSortDir('desc');
                            } else {
                              setSortDir(prev => prev === 'desc' ? 'asc' : prev === 'asc' ? null : 'desc');
                            }
                          }}
                            className={clsx('px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors', isActive ? 'text-white' : 'text-white/40 hover:text-white/70')}
                            style={isActive ? { backgroundColor: 'var(--accent)', color: '#fff' } : {}}>
                            {label} <span className="font-normal opacity-60">{count}</span>
                            {isActive && sortDir && <span className="ml-0.5 font-normal">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto">
                    {streamGroups.length === 0 && !streamsLoading && streamError && <div className="px-4 py-6 text-center"><AlertCircle size={20} className="text-white/30 mx-auto mb-2" /><p className="text-xs text-white/40">{streamError}</p></div>}
                    {streamGroups.length === 0 && !streamsLoading && !streamError && isSeries && !selectedVideo && <div className="px-4 py-6 text-center text-xs text-white/30">Select an episode to load streams</div>}
                    {streamGroups.length === 0 && !streamsLoading && !streamError && !(isSeries && !selectedVideo) && <div className="px-4 py-6 text-center text-xs text-white/30">No streams available. Try reloading or check your addons.</div>}
                    {filteredGroups.map((group) => {
                      let si = 0;
                      return (
                        <div key={group.addonUrl}>
                          <div className="sticky top-0 bg-[#111115]/95 backdrop-blur-sm px-3 py-2 border-b border-white/[0.05] z-10">
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>{group.addonName}</span>
                            <span className="text-[10px] text-white/25 ml-1.5">({group.streams.length})</span>
                          </div>
                          {group.streams.map((stream) => {
                            const idx = si++;
                            return (
                              <div key={idx} onContextMenu={e => {
                                e.preventDefault();
                                const streamUrl = stream.url ?? (stream.infoHash ? `magnet:?xt=urn:btih:${stream.infoHash}${stream.fileIdx !== undefined ? `&so=${stream.fileIdx}` : ''}` : '');
                                showContextMenu([
                                  { id: 'play', text: t('ctx_play'), accelerator: 'Enter', action: () => handlePlay(stream, group.addonUrl, idx) },
                                  ...(streamUrl ? ['---' as const, { id: 'copy-url', text: t('ctx_copy_url'), accelerator: 'CmdOrCtrl+C', action: () => copyText(streamUrl) }] : []),
                                ]);
                              }}>
                                <StreamRow stream={stream} onPlay={() => handlePlay(stream, group.addonUrl, idx)} active={activeStreamKey === `${group.addonUrl}:${idx}`} />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}