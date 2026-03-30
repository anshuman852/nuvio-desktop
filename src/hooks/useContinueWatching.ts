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
    const key = item.id.toLowerCase().replace(/^tt/, '');
    const existing = seen.get(key);
    if (!existing || item.watchedAt > existing.watchedAt) {
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

  // Reload quando cambia la storia locale (guardando qualcosa di nuovo)
  useEffect(() => { load(); }, [traktAuth?.token, simklAuth?.token, nuvioUser?.token, localHistory.length, localHistory[0]?.watchedAt]);

  // Reload immediato quando il player chiude
  useEffect(() => {
    const handler = () => setTimeout(load, 300); // breve delay per lasciare scrivere allo store
    window.addEventListener('nuvio:cw-updated', handler);
    return () => window.removeEventListener('nuvio:cw-updated', handler);
  }, []);

  async function load() {
    setLoading(true);
    const all: CWItem[] = [];

    // 1. LOCALE — sempre per primo, aggiornato in tempo reale
    for (const h of localHistory.slice(0, 50)) {
      if (!h.progress || h.progress < 0.01) continue; // solo items con progresso
      all.push({
        id: h.id, type: h.type, name: h.name, poster: h.poster,
        videoId: h.videoId, season: h.season, episode: h.episode,
        progress: h.progress, source: 'local', watchedAt: h.watchedAt,
      });
    }

    // 2. Nuvio cloud (merge con locale)
    if (nuvioUser?.token && nuvioUser.id) {
      try {
        const cw = await getContinueWatching(nuvioUser.id);
        for (const i of cw) {
          if (!i.progress || i.progress < 0.01) continue;
          all.push({
            id: i.id, type: i.type, name: i.name, poster: i.poster,
            videoId: i.videoId, season: i.season, episode: i.episode,
            progress: i.progress, source: 'nuvio',
            watchedAt: new Date(i.updatedAt).getTime(),
          });
        }
      } catch { /* non bloccante */ }
    }

    // 3. Trakt history (solo per chi non ha ancora visto nulla in locale)
    if (traktAuth?.token && all.length < 5) {
      try {
        const history = await getTraktHistory(traktAuth.token, 100);
        const seen = new Set<string>();
        for (const h of history) {
          const isMovie = h.type === 'movie';
          const item = isMovie ? h.movie : h.show;
          if (!item) continue;
          const imdb = item.ids?.imdb;
          const key = imdb ?? item.title;
          if (seen.has(key)) continue;
          seen.add(key);
          all.push({
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
      } catch { /* fallback */ }
    }

    // 4. Simkl
    if (simklAuth?.token && all.length < 5) {
      try {
        const history = await getSimklHistory(simklAuth.token);
        for (const h of history.slice(0, 20)) {
          const isMovie = h._type === 'movie';
          const item = h.movie ?? h.show;
          if (!item) continue;
          const id = item.ids?.imdb ?? `simkl:${item.ids?.simkl}`;
          all.push({ id, type: isMovie ? 'movie' : 'series', name: item.title, source: 'simkl', watchedAt: new Date(h.last_watched_at ?? 0).getTime() });
        }
      } catch { /* fallback */ }
    }

    const deduped = dedup(all).slice(0, 30);
    setItems(deduped);
    setLoading(false);
  }

  return { items, loading, reload: load };
}
