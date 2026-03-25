// ─── Addon ────────────────────────────────────────────────────────────────────

export interface AddonCatalog {
  type: string;
  id: string;
  name: string;
  extra?: { name: string; isRequired?: boolean; options?: string[] }[];
}

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

// ─── Meta ─────────────────────────────────────────────────────────────────────

export interface MetaItem {
  id: string;
  type: 'movie' | 'series' | string;
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
}

export interface Video {
  id: string;
  title: string;
  season?: number;
  episode?: number;
  released?: string;
  thumbnail?: string;
  overview?: string;
}

// ─── Stream ───────────────────────────────────────────────────────────────────

export interface Stream {
  name?: string;
  title?: string;
  url?: string;
  infoHash?: string;
  fileIdx?: number;
  ytId?: string;
  description?: string;
  behaviorHints?: {
    notWebReady?: boolean;
    bingeGroup?: string;
    filename?: string;
  };
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  type: string;
  name: string;
  poster?: string;
  videoId?: string;
  progress?: number;        // 0-1
  watchedAt: number;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  name: string;
  avatar?: string;          // emoji o URL
  color: string;            // colore accent es. "#7c3aed"
  isKids: boolean;
  createdAt: number;
}

// ─── Nuvio ────────────────────────────────────────────────────────────────────

export interface NuvioUser {
  id: string;
  email: string;
  token: string;
  name?: string;
  avatar?: string;
}

export interface NuvioContinueWatching {
  id: string;
  type: string;
  name: string;
  poster?: string;
  videoId?: string;
  season?: number;
  episode?: number;
  progress: number;
  duration: number;
  updatedAt: string;
}

export type ContentType = 'movie' | 'series' | 'channel' | 'tv';

// ─── Trakt ────────────────────────────────────────────────────────────────────

export interface TraktAuth {
  username: string;
  name: string;
  avatar?: string;
  token: string;
  refreshToken: string;
  expiresAt: number;
}

// ─── Simkl ────────────────────────────────────────────────────────────────────

export interface SimklAuth {
  id: number;
  username: string;
  name: string;
  avatar?: string;
  token: string;
}

// ─── MAL ──────────────────────────────────────────────────────────────────────

export interface MALAuth {
  id: number;
  name: string;
  picture?: string;
  token: string;
  refreshToken: string;
  expiresAt: number;
}
