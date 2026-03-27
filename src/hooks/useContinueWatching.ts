import { useState, useEffect } from 'react';
import { useStore, useWatchHistory } from '../lib/store';
import { getTraktHistory } from '../api/trakt';
import { getSimklHistory } from '../api/simkl';
import { getContinueWatching } from '../api/nuvio';

export interface CWItem {
  id: string;
  type: string;
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
  const { traktAuth, simklAuth, nuvioUser } = useStore();
  const localHistory = useWatchHistory();
  const [items, setItems] = useState<CWItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<CWItem['source']>('local');

  useEffect(() => { load(); }, [traktAuth?.token, simklAuth?.token, nuvioUser?.token]);

  async function load() {
    setLoading(true);

    // 1. Trakt
    if (traktAuth?.token) {
      try {
        const history = await getTraktHistory(traktAuth.token, 200);
        const seen = new Map<string, CWItem>();
        for (const h of history) {
          const isMovie = h.type === 'movie';
          const item = isMovie ? h.movie : h.show;
          if (!item) continue;
          const key = item.title?.toLowerCase() ?? '';
          if (seen.has(key)) continue;
          const imdb = item.ids?.imdb;
          seen.set(key, {
            id: imdb ?? `trakt:${h.id}`,
            type: isMovie ? 'movie' : 'series',
            name: item.title,
            season: h.episode?.season,
            episode: h.episode?.number,
            source: 'trakt',
            watchedAt: new Date(h.watched_at).getTime(),
          });
          if (seen.size >= 20) break;
        }
        setItems(Array.from(seen.values()));
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
          const isMovie = h._type === 'movie';
          const item = h.movie ?? h.show;
          if (!item) continue;
          const id = item.ids?.imdb ?? `simkl:${item.ids?.simkl}`;
          if (seen.has(id)) continue;
          seen.add(id);
          mapped.push({ id, type: isMovie ? 'movie' : 'series', name: item.title, source: 'simkl', watchedAt: new Date(h.last_watched_at).getTime() });
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
        const cw = await getContinueWatching();
        setItems(cw.map((i): CWItem => ({
          id: i.id, type: i.type, name: i.name, poster: i.poster,
          videoId: i.videoId, season: i.season, episode: i.episode,
          progress: i.progress, source: 'nuvio',
          watchedAt: new Date(i.updatedAt).getTime(),
        })));
        setSource('nuvio');
        setLoading(false);
        return;
      } catch { /* fallback */ }
    }

    // 4. Locale
    setItems(localHistory.slice(0, 20).map((h): CWItem => ({
      id: h.id, type: h.type, name: h.name, poster: h.poster,
      videoId: h.videoId, season: h.season, episode: h.episode,
      progress: h.progress, source: 'local', watchedAt: h.watchedAt,
    })));
    setSource('local');
    setLoading(false);
  }

  return { items, loading, source, reload: load };
}
