/// <reference types="vite/client" />
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
  const appLang = useStore.getState().settings.appLanguage || 'it';
  const langMap: Record<string, string> = {
    'it': 'it-IT',
    'en': 'en-US',
    'es': 'es-ES',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'pt': 'pt-BR',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'zh': 'zh-CN',
    'ru': 'ru-RU',
  };
  return langMap[appLang] || 'it-IT';
}

async function get(path: string, extra: Record<string, string> = {}): Promise<any> {
  const key = apiKey();
  if (!key) throw new Error('TMDB API key non configurata');
  const params = new URLSearchParams({ api_key: key, language: lang(), ...extra });
  const res = await fetch(`${BASE}${path}?${params}`);
  if (!res.ok) throw new Error(`TMDB HTTP ${res.status}: ${path}`);
  return res.json();
}

// Cache TMDB
const tmdbCache = new Map<string, { data: any; expires: number }>();
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;

export async function getCachedTMDB(type: string, id: number, apiKey: string) {
  const cacheKey = `${type}:${id}`;
  const cached = tmdbCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;
  try {
    const [detailsRes, creditsRes] = await Promise.all([
      fetch(`${BASE}/${type}/${id}?api_key=${apiKey}&language=it-IT`),
      fetch(`${BASE}/${type}/${id}/credits?api_key=${apiKey}&language=it-IT`)
    ]);
    const details = await detailsRes.json();
    let credits = await creditsRes.json();
    if (!credits.cast?.length) {
      const creditsENRes = await fetch(`${BASE}/${type}/${id}/credits?api_key=${apiKey}&language=en-US`);
      const creditsEN = await creditsENRes.json();
      if (creditsEN.cast?.length) credits = creditsEN;
    }
    const data = { ...details, credits };
    tmdbCache.set(cacheKey, { data, expires: Date.now() + CACHE_DURATION });
    return data;
  } catch (e) {
    console.error('TMDB fetch error:', e);
    return null;
  }
}

export interface StreamingService {
  id: string;
  name: string;
  tmdbId: number;
  color: string;
  logo: string;
  logoBg?: string;
  logoFallback: string;
  forceRegion?: string;
  gradient: string;
}

export const STREAMING_SERVICES = [
  {
    id: 'netflix',
    name: 'Netflix',
    tmdbId: 8,
    color: '#E50914',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg',
    logoBg: '#E50914',
    logoFallback: '🔴',
    gradient: 'from-red-950 to-black',
    lightLogo: false,
  },
  {
    id: 'disney',
    name: 'Disney+',
    tmdbId: 337,
    color: '#113CCF',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg',
    logoBg: '#113CCF',
    logoFallback: '✨',
    gradient: 'from-blue-950 to-black',
    lightLogo: false,
  },
  {
    id: 'apple',
    name: 'Apple TV+',
    tmdbId: 350,
    color: '#2a2a2e',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg',
    logoBg: '#FFFFFF',
    logoFallback: '🍎',
    gradient: 'from-gray-800 to-black',
    lightLogo: true,
  },
  {
    id: 'paramount',
    name: 'Paramount+',
    tmdbId: 531,
    color: '#0064FF',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Paramount_Plus_logo.svg',
    logoBg: '#0064FF',
    logoFallback: '⛰️',
    gradient: 'from-blue-950 to-black',
    lightLogo: false,
  },
  {
    id: 'amazon',
    name: 'Prime Video',
    tmdbId: 9,
    color: '#00A8E1',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg',
    logoBg: '#00A8E1',
    logoFallback: '📦',
    gradient: 'from-cyan-950 to-black',
    lightLogo: false,
  },
  {
    id: 'hbo',
    name: 'Max',
    tmdbId: 1899,
    color: '#5822B4',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/17/HBO_Max_Logo.svg',
    logoBg: '#5822B4',
    logoFallback: '💜',
    gradient: 'from-purple-950 to-black',
    lightLogo: false,
  },
  {
    id: 'crunchyroll',
    name: 'Crunchyroll',
    tmdbId: 283,
    color: '#F47521',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Crunchyroll_logo_2024.svg',
    logoBg: '#F47521',
    logoFallback: '🍥',
    gradient: 'from-orange-950 to-black',
    lightLogo: false,
  },
  {
    id: 'raiplay',
    name: 'RaiPlay',
    tmdbId: 675,
    color: '#009246',
    forceRegion: 'IT',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/RaiPlay_-_Logo.svg',
    logoBg: '#009246',
    logoFallback: '🇮🇹',
    gradient: 'from-green-950 to-black',
    lightLogo: false,
  },
];

export const SUPPORTED_LANGUAGES = [
  { code: 'it', name: 'Italiano', flag: '🇮🇹', tmdbCode: 'it-IT' },
  { code: 'en', name: 'English', flag: '🇬🇧', tmdbCode: 'en-US' },
  { code: 'es', name: 'Español', flag: '🇪🇸', tmdbCode: 'es-ES' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', tmdbCode: 'fr-FR' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', tmdbCode: 'de-DE' },
  { code: 'pt', name: 'Português', flag: '🇧🇷', tmdbCode: 'pt-BR' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', tmdbCode: 'ja-JP' },
  { code: 'ko', name: '한국어', flag: '🇰🇷', tmdbCode: 'ko-KR' },
  { code: 'zh', name: '中文', flag: '🇨🇳', tmdbCode: 'zh-CN' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺', tmdbCode: 'ru-RU' },
];

export interface DiscoverOptions {
  apiKey: string;
  withWatchProviders?: string;
  withGenres?: string;
  primaryReleaseYear?: string;
  firstAirYear?: string;
  sortBy?: string;
  page?: number;
  watchRegion?: string;
}

export async function getDiscoverMovies(options: DiscoverOptions): Promise<any> {
  const params: Record<string, string> = {
    api_key: options.apiKey,
    language: lang(),
    include_adult: 'false',
    sort_by: options.sortBy || 'popularity.desc',
    page: String(options.page || 1),
  };
  if (options.withWatchProviders) params.with_watch_providers = options.withWatchProviders;
  if (options.watchRegion) params.watch_region = options.watchRegion;
  if (options.withGenres) params.with_genres = options.withGenres;
  if (options.primaryReleaseYear) params.primary_release_year = options.primaryReleaseYear;
  
  // Log per debugging
  console.log('[TMDB] discover/movie params:', params);
  
  const res = await fetch(`${BASE}/discover/movie?${new URLSearchParams(params)}`);
  if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);
  return res.json();
}

export async function getDiscoverTV(options: DiscoverOptions): Promise<any> {
  const params: Record<string, string> = {
    api_key: options.apiKey,
    language: lang(),
    include_adult: 'false',
    sort_by: options.sortBy || 'popularity.desc',
    page: String(options.page || 1),
  };
  if (options.withWatchProviders) params.with_watch_providers = options.withWatchProviders;
  if (options.watchRegion) params.watch_region = options.watchRegion;
  if (options.withGenres) params.with_genres = options.withGenres;
  if (options.primaryReleaseYear) params.first_air_date_year = options.primaryReleaseYear;
  
  console.log('[TMDB] discover/tv params:', params);
  
  const res = await fetch(`${BASE}/discover/tv?${new URLSearchParams(params)}`);
  if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);
  return res.json();
}

export async function discoverByProvider(providerId: number, type: 'movie' | 'tv', page = 1): Promise<{ results: any[]; total_pages: number }> {
  for (const region of ['IT', 'US']) {
    try {
      const data = await get(`/discover/${type}`, {
        with_watch_providers: String(providerId),
        watch_region: region,
        sort_by: 'popularity.desc',
        include_adult: 'false',
        page: String(page),
      });
      if ((data.results ?? []).length > 0) return data;
    } catch { }
  }
  return { results: [], total_pages: 0 };
}

export async function getGenres(apiKey: string, type: 'movie' | 'tv'): Promise<{ id: number; name: string }[]> {
  try {
    const params = new URLSearchParams({ api_key: apiKey, language: lang() });
    const res = await fetch(`${BASE}/genre/${type}/list?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.genres || [];
  } catch { return []; }
}

export async function getDetails(type: 'movie' | 'tv', id: number): Promise<any> {
  return get(`/${type}/${id}`, { append_to_response: 'credits,videos,external_ids,watch/providers,similar,recommendations' });
}

export async function searchTMDB(query: string): Promise<any[]> {
  const data = await get('/search/multi', { query, include_adult: 'false' });
  // Filtra anche per serie TV (media_type === 'tv')
  return (data.results ?? []).filter((r: any) => r.media_type !== 'person');
}

export async function getTrending(type: 'movie' | 'tv' | 'all', window: 'day' | 'week' = 'week'): Promise<any[]> {
  const data = await get(`/trending/${type}/${window}`);
  return data.results ?? [];
}

export async function getPerson(id: number): Promise<any> {
  return get(`/person/${id}`, { append_to_response: 'combined_credits' });
}

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

export async function validateTMDBKey(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/configuration?api_key=${key}`);
    return res.ok;
  } catch { return false; }
}

export function hasTMDBKey(): boolean {
  const key = apiKey();
  console.log('[TMDB] hasTMDBKey - key exists:', !!key, 'key length:', key?.length);
  return Boolean(key && key.length > 0);
}