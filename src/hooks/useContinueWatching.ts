import { useState, useEffect } from 'react';
import { useStore, useWatchHistory } from '../lib/store';
import { getTraktHistory } from '../api/trakt';
import { getSimklHistory } from '../api/simkl';
import { getContinueWatching } from '../api/nuvio';

export interface CWItem {
  id: string; type: string; name: string; poster?: string;
  videoId?: string; season?: number; episode?: number;
  progress?: number; source: 'trakt' | 'simkl' | 'nuvio' | 'local'; watchedAt: number;
}

function dedup(items: CWItem[]): CWItem[] {
  const seen = new Map<string, CWItem>();
  for (const item of items) {
    const key = item.id.toLowerCase();
    if (!seen.has(key) || item.watchedAt > (seen.get(key)!.watchedAt)) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.watchedAt - a.watchedAt);
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
    const all: CWItem[] = [];

    // 1. Nuvio cloud (più affidabile per progress)
    if (nuvioUser?.token && nuvioUser.id) {
      try {
        const cw = await getContinueWatching(nuvioUser.id);
        for (const i of cw) {
          all.push({
            id: i.id, type: i.type, name: i.name, poster: i.poster,
            videoId: i.videoId, season: i.season, episode: i.episode,
            progress: i.progress, source: 'nuvio',
            watchedAt: new Date(i.updatedAt).getTime(),
          });
        }
      } catch { /* non bloccante */ }
    }

    // 2. Trakt (history completa)
    if (traktAuth?.token) {
      try {
        const history = await getTraktHistory(traktAuth.token, 200);
        const seenTitles = new Map<string, boolean>();
        for (const h of history) {
          const isMovie = h.type === 'movie';
          const item = isMovie ? h.movie : h.show;
          if (!item) continue;
          const titleKey = item.title?.toLowerCase() ?? '';
          if (seenTitles.has(titleKey)) continue;
          seenTitles.set(titleKey, true);
          const imdb = item.ids?.imdb;
          all.push({
            id: imdb ?? `trakt:${h.id}`,
            type: isMovie ? 'movie' : 'series',
            name: item.title,
            season: h.episode?.season,
            episode: h.episode?.number,
            source: 'trakt',
            watchedAt: new Date(h.watched_at).getTime(),
          });
          if (seenTitles.size >= 30) break;
        }
        setSource('trakt');
      } catch { /* fallback */ }
    } else if (simklAuth?.token) {
      try {
        const history = await getSimklHistory(simklAuth.token);
        for (const h of history.slice(0, 30)) {
          const isMovie = h._type === 'movie';
          const item = h.movie ?? h.show;
          if (!item) continue;
          const id = item.ids?.imdb ?? `simkl:${item.ids?.simkl}`;
          all.push({ id, type: isMovie ? 'movie' : 'series', name: item.title, source: 'simkl', watchedAt: new Date(h.last_watched_at ?? 0).getTime() });
        }
        if (!traktAuth) setSource('simkl');
      } catch { /* fallback */ }
    }

    if (all.length > 0) {
      setItems(dedup(all).slice(0, 30));
      setLoading(false);
      return;
    }

    // 3. Locale
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
