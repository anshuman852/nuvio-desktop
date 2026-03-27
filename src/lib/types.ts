// ─── Stremio ──────────────────────────────────────────────────────────────────

export interface Addon {
  url: string;
  id: string;
  name: string;
  version: string;
  description: string;
  types: string[];
  catalogs: AddonCatalog[];
  resources: string[];
  logo?: string;
}

export interface AddonCatalog {
  type: string;
  id: string;
  name: string;
  extra?: { name: string; isRequired?: boolean; options?: string[] }[];
}

export interface MetaItem {
  id: string;
  type: string;
  name: string;
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  year?: number;
  genres?: string[];
  imdbRating?: string;
  runtime?: string;
  videos?: Video[];
  cast?: string[];
  director?: string[];
  country?: string;
  language?: string;
  awards?: string;
  dvdRelease?: string;
  popularity?: number;
  trailers?: { source: string; type: string }[];
  links?: { name: string; category: string; url: string }[];
}

export interface Video {
  id: string;
  title: string;
  season?: number;
  episode?: number;
  released?: string;
  thumbnail?: string;
  overview?: string;
  rating?: number;
  trailers?: { source: string; type: string }[];
}

export interface Stream {
  name?: string;
  title?: string;
  url?: string;
  infoHash?: string;
  fileIdx?: number;
  ytId?: string;
  externalUrl?: string;
  description?: string;
  subtitles?: { id: string; url: string; lang: string }[];
  behaviorHints?: {
    notWebReady?: boolean;
    bingeGroup?: string;
    filename?: string;
    videoSize?: number;
  };
}

export interface StreamGroup {
  addonName: string;
  addonUrl: string;
  streams: Stream[];
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  name: string;
  avatar: string;          // avatar id (es. 'red', 'blue'…)
  color: string;
  isKids: boolean;
  pin?: string;
  createdAt: number;
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface WatchEntry {
  id: string;
  type: string;
  name: string;
  poster?: string;
  videoId?: string;
  season?: number;
  episode?: number;
  progress: number;       // 0-1
  duration: number;       // secondi
  watchedAt: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface NuvioUser {
  id: string;
  email: string;
  token: string;
  name?: string;
  avatar?: string;
}

export interface TraktAuth {
  username: string;
  name: string;
  avatar?: string;
  token: string;
  refreshToken: string;
  expiresAt: number;
}

export interface SimklAuth {
  id: number;
  username: string;
  name: string;
  avatar?: string;
  token: string;
}

export interface MALAuth {
  id: number;
  name: string;
  picture?: string;
  token: string;
  refreshToken: string;
  expiresAt: number;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AppSettings {
  // Player
  mpvPath: string;
  hardwareDecode: boolean;
  autoplay: boolean;
  // Language
  language: string;
  subtitleLanguage: string;
  defaultQuality: string;
  // TMDB
  tmdbApiKey: string;
  tmdbLanguage: string;
  // Streaming services visibili
  visibleServices: string[];
  // UI
  accentColor: string;
  // Supabase (per sync Nuvio)
  supabaseUrl: string;
  supabaseKey: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  mpvPath: 'mpv',
  hardwareDecode: true,
  autoplay: true,
  language: 'it',
  subtitleLanguage: 'it',
  defaultQuality: 'best',
  tmdbApiKey: '',
  tmdbLanguage: 'it-IT',
  visibleServices: ['netflix', 'disney', 'apple', 'paramount', 'amazon', 'hbo', 'crunchyroll', 'raiplay'],
  accentColor: '#7c3aed',
  supabaseUrl: '',
  supabaseKey: '',
};

// ─── TMDB ─────────────────────────────────────────────────────────────────────

export interface TMDBPerson {
  id: number;
  name: string;
  role: string;
  photo?: string;
}

export interface TMDBDetails extends MetaItem {
  tmdbId?: number;
  cast?: any[];
  crew?: any[];
  tmdbRating?: number;
  tagline?: string;
  status?: string;
  budget?: number;
  revenue?: number;
  productionCompanies?: { name: string; logo?: string }[];
  watchProviders?: Record<string, any>;
}
