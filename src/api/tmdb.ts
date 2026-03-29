/// <reference types="vite/client" />
/**
 * TMDB v3 API — usa api_key come query parameter (NON bearer token v4).
 * La chiave si ottiene su https://www.themoviedb.org/settings/api
 * e ha il formato: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (32 char hex)
 */
import { useStore } from '../lib/store';

const BASE = 'https://api.themoviedb.org/3';
export const IMG_BASE = 'https://image.tmdb.org/t/p';

export function tmdbImg(path: string | null | undefined, size = 'w500'): string | undefined {
  return path ? `${IMG_BASE}/${size}${path}` : undefined;
}

function apiKey(): string {
  return useStore.getState().settings.tmdbApiKey;
}

function lang(): string {
  return useStore.getState().settings.tmdbLanguage ?? 'it-IT';
}

async function get(path: string, extra: Record<string, string> = {}): Promise<any> {
  const key = apiKey();
  if (!key) throw new Error('TMDB API key non configurata');
  const params = new URLSearchParams({ api_key: key, language: lang(), ...extra });
  const res = await fetch(`${BASE}${path}?${params}`);
  if (!res.ok) throw new Error(`TMDB HTTP ${res.status}: ${path}`);
  return res.json();
}

// ─── Streaming services ───────────────────────────────────────────────────────

export interface StreamingService {
  id: string;
  name: string;
  tmdbId: number;
  color: string;
  logo: string;
  logoBg?: string;      // background color per il logo
  logoFallback: string;
  gradient: string;
}

export const STREAMING_SERVICES: StreamingService[] = [
  { id: 'netflix',    name: 'Netflix',      tmdbId: 8,   color: '#E50914',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg',
    logoBg: '#E50914', logoFallback: '🔴', gradient: 'from-red-950 to-black' },
  { id: 'disney',     name: 'Disney+',      tmdbId: 337, color: '#113CCF',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg',
    logoBg: '#113CCF', logoFallback: '✨', gradient: 'from-blue-950 to-black' },
  { id: 'apple',      name: 'Apple TV+',    tmdbId: 350, color: '#1c1c1e',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg',
    logoBg: '#000000', logoFallback: '🍎', gradient: 'from-gray-900 to-black' },
  { id: 'paramount',  name: 'Paramount+',   tmdbId: 531, color: '#0064FF',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Paramount_Plus_logo.svg',
    logoBg: '#0064FF', logoFallback: '⛰️', gradient: 'from-blue-950 to-black' },
  { id: 'amazon',     name: 'Prime Video',  tmdbId: 9,   color: '#00A8E1',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg',
    logoBg: '#00A8E1', logoFallback: '📦', gradient: 'from-cyan-950 to-black' },
  { id: 'hbo',        name: 'Max',          tmdbId: 384, color: '#5822B4',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/17/HBO_Max_Logo.svg',
    logoBg: '#5822B4', logoFallback: '💜', gradient: 'from-purple-950 to-black' },
  { id: 'crunchyroll',name: 'Crunchyroll',  tmdbId: 283, color: '#F47521',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Crunchyroll_logo_2024.svg',
    logoBg: '#F47521', logoFallback: '🍥', gradient: 'from-orange-950 to-black' },
  { id: 'raiplay',    name: 'RaiPlay',      tmdbId: 675, color: '#009246',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/RaiPlay_-_Logo.svg',
    logoBg: '#009246', logoFallback: '🇮🇹', gradient: 'from-green-950 to-black' },
];

// ─── Discover ─────────────────────────────────────────────────────────────────

export async function discoverByProvider(
  providerId: number,
  type: 'movie' | 'tv',
  page = 1
): Promise<{ results: any[]; total_pages: number }> {
  return get(`/discover/${type}`, {
    with_watch_providers: String(providerId),
    watch_region: 'IT',
    sort_by: 'popularity.desc',
    page: String(page),
  });
}

// ─── Details (film o serie) ───────────────────────────────────────────────────

export async function getDetails(type: 'movie' | 'tv', id: number): Promise<any> {
  return get(`/${type}/${id}`, {
    append_to_response: 'credits,videos,external_ids,watch/providers,similar,recommendations',
  });
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchTMDB(query: string): Promise<any[]> {
  const data = await get('/search/multi', { query, include_adult: 'false' });
  return (data.results ?? []).filter((r: any) => r.media_type !== 'person');
}

// ─── Trending ─────────────────────────────────────────────────────────────────

export async function getTrending(type: 'movie' | 'tv' | 'all', window: 'day' | 'week' = 'week'): Promise<any[]> {
  const data = await get(`/trending/${type}/${window}`);
  return data.results ?? [];
}

// ─── Person ───────────────────────────────────────────────────────────────────

export async function getPerson(id: number): Promise<any> {
  return get(`/person/${id}`, { append_to_response: 'combined_credits' });
}

// ─── Converti risultato TMDB → MetaItem-like ──────────────────────────────────

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
    poster: tmdbImg(item.poster_path, 'w342'),
    background: tmdbImg(item.backdrop_path, 'w780'),
    description: item.overview,
    releaseInfo: (item.release_date ?? item.first_air_date ?? '').slice(0, 4),
    imdbRating: item.vote_average ? item.vote_average.toFixed(1) : undefined,
    genres: [],
  };
}

// ─── Verifica chiave ──────────────────────────────────────────────────────────

export async function validateTMDBKey(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/configuration?api_key=${key}`);
    return res.ok;
  } catch {
    return false;
  }
}

export function hasTMDBKey(): boolean {
  return Boolean(apiKey());
}
