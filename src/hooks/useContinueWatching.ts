import { useState, useEffect } from 'react';
import { useAppStore, useActiveHistory } from '../lib/store';
import { getTraktHistory } from '../api/trakt';
import { getSimklHistory } from '../api/simkl';
import { getContinueWatching as getNuvioCW } from '../api/nuvio';

export interface CWItem {
  id: string;
  type: 'movie' | 'series' | string;
  name: string;
  poster?: string;
  videoId?: string;
  season?: number;
  episode?: number;
  progress?: number;
  source: 'trakt' | 'simkl' | 'nuvio' | 'local';
  watchedAt: number;
}

export function useContinueWatching() {
  const { traktAuth, simklAuth, nuvioUser } = useAppStore();
  const localHistory = useActiveHistory();
  const [items, setItems] = useState<CWItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'trakt' | 'simkl' | 'nuvio' | 'local'>('local');

  useEffect(() => { load(); }, [traktAuth?.token, simklAuth?.token, nuvioUser?.token]);

  async function load() {
    setLoading(true);

    // 1. Trakt
    if (traktAuth?.token) {
      try {
        const history = await getTraktHistory(traktAuth.token, 100);
        // Deduplica per titolo (show/movie), tieni il più recente
        const seenTitles = new Map<string, CWItem>();
        for (const h of history) {
          const isMovie = h.type === 'movie';
          const title = isMovie ? h.movie?.title : h.show?.title;
          const imdbId = isMovie ? h.movie?.ids?.imdb : h.show?.ids?.imdb;
          const tmdbId = isMovie ? h.movie?.ids?.tmdb : h.show?.ids?.tmdb;
          if (!title) continue;

          // Chiave deduplicazione: per serie usa il titolo dello show (non dell'episodio)
          const dedupeKey = title.toLowerCase();
          if (seenTitles.has(dedupeKey)) continue;

          const id = imdbId ? imdbId : (tmdbId ? `tmdb:${tmdbId}` : `trakt:${h.id}`);

          seenTitles.set(dedupeKey, {
            id,
            type: isMovie ? 'movie' : 'series',
            name: title,
            season: h.episode?.season,
            episode: h.episode?.number,
            videoId: h.episode
              ? `${h.show?.ids?.trakt}:${h.episode.season}:${h.episode.number}`
              : undefined,
            source: 'trakt',
            watchedAt: new Date(h.watched_at).getTime(),
          });

          if (seenTitles.size >= 20) break;
        }

        const mapped = Array.from(seenTitles.values());
        setItems(mapped);
        setSource('trakt');
        setLoading(false);
        return;
      } catch { /* fallback */ }
    }

    // 2. Simkl
    if (simklAuth?.token) {
      try {
        const history = await getSimklHistory(simklAuth.token);
        const seen = new Set<string>();
        const mapped: CWItem[] = [];
        for (const h of history) {
          const isMovie = !!(h as any).movie;
          const item = isMovie ? (h as any).movie : (h as any).show;
          const imdbId = item?.ids?.imdb;
          const id = imdbId || `simkl:${item?.ids?.simkl}`;
          if (seen.has(id)) continue;
          seen.add(id);
          mapped.push({
            id,
            type: isMovie ? 'movie' : 'series',
            name: item?.title ?? 'Sconosciuto',
            source: 'simkl',
            watchedAt: new Date(h.last_watched_at).getTime(),
          });
          if (mapped.length >= 20) break;
        }
        setItems(mapped);
        setSource('simkl');
        setLoading(false);
        return;
      } catch { /* fallback */ }
    }

    // 3. Nuvio cloud
    if (nuvioUser?.token) {
      try {
        const cwItems = await getNuvioCW();
        const mapped = cwItems.map((i): CWItem => ({
          id: i.id, type: i.type, name: i.name, poster: i.poster,
          videoId: i.videoId, season: i.season, episode: i.episode,
          progress: i.progress, source: 'nuvio',
          watchedAt: new Date(i.updatedAt).getTime(),
        }));
        setItems(mapped);
        setSource('nuvio');
        setLoading(false);
        return;
      } catch { /* fallback */ }
    }

    // 4. Locale
    setItems(localHistory.slice(0, 20).map((h): CWItem => ({
      id: h.id, type: h.type, name: h.name, poster: h.poster,
      videoId: h.videoId, progress: h.progress,
      source: 'local', watchedAt: h.watchedAt,
    })));
    setSource('local');
    setLoading(false);
  }

  return { items, loading, source, reload: load };
}
