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
  progress?: number;
  watchedAt: number;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export type ProfileAvatar =
  | { type: 'emoji'; value: string }
  | { type: 'netflix'; value: string }  // nome dell'avatar Netflix predefinito
  | { type: 'color'; value: string };   // colore solido

export interface Profile {
  id: string;
  name: string;
  /** Emoji, nome avatar Netflix, o URL immagine */
  avatar?: string;
  avatarType?: 'emoji' | 'netflix' | 'image';
  color: string;
  isKids: boolean;
  pin?: string;          // PIN a 4 cifre (hash o plain per ora)
  createdAt: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

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
