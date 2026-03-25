import { CONFIG } from '../lib/config';

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

// Token: prima usa quello dell'utente (dallo store), poi quello di build
function getToken(): string {
  try {
    const stored = localStorage.getItem('nuvio-desktop-v2');
    if (stored) {
      const parsed = JSON.parse(stored);
      const userToken = parsed?.state?.settings?.tmdbToken;
      if (userToken) return userToken;
    }
  } catch { /* ignore */ }
  return CONFIG.tmdb.token;
}

const h = () => ({
  Authorization: `Bearer ${getToken()}`,
  'Content-Type': 'application/json',
});

export const tmdbImg = (path: string | null | undefined, size: 'w300' | 'w500' | 'w780' | 'original' = 'w500') =>
  path ? `${IMG}/${size}${path}` : undefined;

// ─── Streaming service ID map (Stremio catalog IDs su TMDB) ──────────────────

export const STREAMING_SERVICES: StreamingService[] = [
  { id: 'netflix',    name: 'Netflix',      tmdbId: 8,   color: '#E50914', logo: '🔴', gradient: 'from-red-900 to-black' },
  { id: 'disney',     name: 'Disney+',      tmdbId: 337, color: '#113CCF', logo: '✨', gradient: 'from-blue-900 to-indigo-950' },
  { id: 'apple',      name: 'Apple TV+',    tmdbId: 350, color: '#555555', logo: '🍎', gradient: 'from-gray-800 to-black' },
  { id: 'paramount',  name: 'Paramount+',   tmdbId: 531, color: '#0064FF', logo: '⛰️',  gradient: 'from-blue-800 to-blue-950' },
  { id: 'amazon',     name: 'Amazon Prime', tmdbId: 9,   color: '#00A8E1', logo: '📦', gradient: 'from-cyan-900 to-slate-950' },
  { id: 'hbo',        name: 'Max',          tmdbId: 384, color: '#5822B4', logo: '💜', gradient: 'from-purple-900 to-black' },
  { id: 'crunchyroll',name: 'Crunchyroll',  tmdbId: 283, color: '#F47521', logo: '🍥', gradient: 'from-orange-900 to-black' },
  { id: 'raiplay',    name: 'RaiPlay',      tmdbId: 675, color: '#009246', logo: '🇮🇹', gradient: 'from-green-900 to-slate-950' },
];

export interface StreamingService {
  id: string;
  name: string;
  tmdbId: number;
  color: string;
  logo: string;
  gradient: string;
}

// ─── Discover per provider ────────────────────────────────────────────────────

export async function discoverByProvider(
  providerId: number,
  type: 'movie' | 'tv',
  page = 1,
  language = 'it-IT'
) {
  const params = new URLSearchParams({
    with_watch_providers: String(providerId),
    watch_region: 'IT',
    sort_by: 'popularity.desc',
    page: String(page),
    language,
  });
  const res = await fetch(`${BASE}/discover/${type}?${params}`, { headers: h() });
  if (!res.ok) return { results: [], total_pages: 0, total_results: 0 };
  return res.json();
}

// ─── Trending ─────────────────────────────────────────────────────────────────

export async function getTrending(type: 'movie' | 'tv' | 'all', window: 'day' | 'week' = 'week', language = 'it-IT') {
  const res = await fetch(`${BASE}/trending/${type}/${window}?language=${language}`, { headers: h() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchTMDB(query: string, language = 'it-IT') {
  const params = new URLSearchParams({ query, language, include_adult: 'false' });
  const res = await fetch(`${BASE}/search/multi?${params}`, { headers: h() });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []).filter((r: any) => r.media_type !== 'person');
}

// ─── Details ──────────────────────────────────────────────────────────────────

export async function getTMDBDetails(type: 'movie' | 'tv', id: number, language = 'it-IT') {
  const res = await fetch(
    `${BASE}/${type}/${id}?language=${language}&append_to_response=credits,videos,watch/providers`,
    { headers: h() }
  );
  if (!res.ok) return null;
  return res.json();
}

// ─── Converte risultato TMDB in MetaItem-like ─────────────────────────────────

export function tmdbToMeta(item: any): {
  id: string; type: string; name: string;
  poster?: string; background?: string; description?: string;
  releaseInfo?: string; imdbRating?: string; genres?: string[];
} {
  const isMovie = item.media_type === 'movie' || item.title !== undefined;
  return {
    id: `tmdb:${item.id}`,
    type: isMovie ? 'movie' : 'series',
    name: item.title ?? item.name ?? '',
    poster: tmdbImg(item.poster_path, 'w300'),
    background: tmdbImg(item.backdrop_path, 'w780'),
    description: item.overview,
    releaseInfo: (item.release_date ?? item.first_air_date ?? '').slice(0, 4),
    imdbRating: item.vote_average ? item.vote_average.toFixed(1) : undefined,
    genres: [],
  };
}


// Deve essere qui (non solo in config.ts) perché Streaming.tsx la importa da tmdb
export const hasTMDBToken = () => Boolean(getToken());
