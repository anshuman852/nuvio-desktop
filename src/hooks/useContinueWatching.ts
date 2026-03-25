/**
 * Hook "Continua a guardare" con catena di priorità:
 * Trakt → Simkl → Nuvio cloud → locale (history)
 *
 * Restituisce una lista unificata di CWItem da qualsiasi fonte.
 */
import { useState, useEffect } from 'react';
import { useAppStore, useActiveHistory } from '../lib/store';
import { getTraktHistory } from '../api/trakt';
import { getSimklHistory } from '../api/simkl';
import { getContinueWatching as getNuvioCW } from '../api/nuvio';
import { tmdbImg } from '../api/tmdb';

export interface CWItem {
  id: string;             // imdb:tt1234 o tmdb:1234
  type: 'movie' | 'series' | string;
  name: string;
  poster?: string;
  videoId?: string;       // per le serie
  season?: number;
  episode?: number;
  progress?: number;      // 0-1
  source: 'trakt' | 'simkl' | 'nuvio' | 'local';
  watchedAt: number;      // timestamp ms
}

export function useContinueWatching() {
  const { traktAuth, simklAuth, nuvioUser } = useAppStore();
  const localHistory = useActiveHistory();
  const [items, setItems] = useState<CWItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'trakt' | 'simkl' | 'nuvio' | 'local'>('local');

  useEffect(() => {
    load();
  }, [traktAuth?.token, simklAuth?.token, nuvioUser?.token]);

  async function load() {
    setLoading(true);

    // 1. Prova Trakt
    if (traktAuth?.token) {
      try {
        const history = await getTraktHistory(traktAuth.token, 40);
        const mapped = history.slice(0, 20).map((h): CWItem => {
          const isMovie = h.type === 'movie';
          const title = isMovie ? h.movie?.title : h.show?.title;
          const imdbId = isMovie ? h.movie?.ids?.imdb : h.show?.ids?.imdb;
          return {
            id: imdbId ? `tt${imdbId}` : `trakt:${h.id}`,
            type: isMovie ? 'movie' : 'series',
            name: title ?? 'Sconosciuto',
            poster: undefined,
            season: h.episode?.season,
            episode: h.episode?.number,
            videoId: h.episode ? `${h.show?.ids?.trakt}:${h.episode.season}:${h.episode.number}` : undefined,
            source: 'trakt',
            watchedAt: new Date(h.watched_at).getTime(),
          };
        });
        // Deduplica per ID
        const seen = new Set<string>();
        const deduped = mapped.filter((i) => {
          if (seen.has(i.id)) return false;
          seen.add(i.id);
          return true;
        });
        setItems(deduped);
        setSource('trakt');
        setLoading(false);
        return;
      } catch { /* fallback */ }
    }

    // 2. Prova Simkl
    if (simklAuth?.token) {
      try {
        const history = await getSimklHistory(simklAuth.token);
        const mapped = history.slice(0, 20).map((h): CWItem => {
          const isMovie = !!(h as any).movie;
          const item = isMovie ? (h as any).movie : (h as any).show;
          const imdbId = item?.ids?.imdb;
          return {
            id: imdbId ? imdbId : `simkl:${item?.ids?.simkl}`,
            type: isMovie ? 'movie' : 'series',
            name: item?.title ?? 'Sconosciuto',
            source: 'simkl',
            watchedAt: new Date(h.last_watched_at).getTime(),
          };
        });
        setItems(mapped);
        setSource('simkl');
        setLoading(false);
        return;
      } catch { /* fallback */ }
    }

    // 3. Prova Nuvio cloud
    if (nuvioUser?.token) {
      try {
        const cwItems = await getNuvioCW();
        const mapped = cwItems.map((i): CWItem => ({
          id: i.id,
          type: i.type,
          name: i.name,
          poster: i.poster,
          videoId: i.videoId,
          season: i.season,
          episode: i.episode,
          progress: i.progress,
          source: 'nuvio',
          watchedAt: new Date(i.updatedAt).getTime(),
        }));
        setItems(mapped);
        setSource('nuvio');
        setLoading(false);
        return;
      } catch { /* fallback */ }
    }

    // 4. Fallback: storia locale
    const mapped = localHistory.slice(0, 20).map((h): CWItem => ({
      id: h.id,
      type: h.type,
      name: h.name,
      poster: h.poster,
      videoId: h.videoId,
      progress: h.progress,
      source: 'local',
      watchedAt: h.watchedAt,
    }));
    setItems(mapped);
    setSource('local');
    setLoading(false);
  }

  return { items, loading, source, reload: load };
}
