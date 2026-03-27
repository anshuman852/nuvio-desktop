/// <reference types="vite/client" />

import { useStore } from '../lib/store';
import netflixLogo from '/logos/netflix.svg';
import disneyLogo from '/logos/disney.svg';
import appleLogo from '/logos/apple.svg';
import paramountLogo from '/logos/paramount.svg';
import amazonLogo from '/logos/amazon.svg';
import maxLogo from '/logos/max.svg';
import crunchyrollLogo from '/logos/crunchyroll.svg';
import raiplayLogo from '/logos/raiplay.svg';

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
  gradient: string;
}

export const STREAMING_SERVICES: StreamingService[] = [
  { id: 'netflix', name: 'Netflix', tmdbId: 8, color: '#E50914', logo: netflixLogo, gradient: 'from-red-900 to-black' },
  { id: 'disney', name: 'Disney+', tmdbId: 337, color: '#113CCF', logo: disneyLogo, gradient: 'from-blue-900 to-indigo-950' },
  { id: 'apple', name: 'Apple TV+', tmdbId: 350, color: '#555555', logo: appleLogo, gradient: 'from-gray-800 to-black' },
  { id: 'paramount', name: 'Paramount+', tmdbId: 531, color: '#0064FF', logo: paramountLogo, gradient: 'from-blue-800 to-blue-950' },
  { id: 'amazon', name: 'Amazon Prime', tmdbId: 9, color: '#00A8E1', logo: amazonLogo, gradient: 'from-cyan-900 to-slate-950' },
  { id: 'hbo', name: 'Max', tmdbId: 384, color: '#5822B4', logo: maxLogo, gradient: 'from-purple-900 to-black' },
  { id: 'crunchyroll', name: 'Crunchyroll', tmdbId: 283, color: '#F47521', logo: crunchyrollLogo, gradient: 'from-orange-900 to-black' },
  { id: 'raiplay', name: 'RaiPlay', tmdbId: 675, color: '#009246', logo: raiplayLogo, gradient: 'from-green-900 to-slate-950' },
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
