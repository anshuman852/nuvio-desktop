/// <reference types="vite/client" />

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
    proxyHeaders?: {
      request?: Record<string, string>;
      response?: Record<string, string>;
    };
  };
}

export interface StreamGroup {
  addonName: string;
  addonUrl: string;
  streams: Stream[];
}

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  color: string;
  isKids: boolean;
  pin?: string;
  createdAt: number;
}

export interface WatchEntry {
  id: string;
  type: string;
  name: string;
  poster?: string;
  videoId?: string;
  season?: number;
  episode?: number;
  progress: number;
  duration: number;
  watchedAt: number;
}

export interface NuvioUser {
  id: string;
  email: string;
  token: string;
  name?: string;
  avatar?: string;
  avatarUrl?: string;
}

export interface TraktAuth {
  username: string;
  name: string;
  avatar?: string;
  avatarUrl?: string;
  token: string;
  refreshToken: string;
  expiresAt: number;
}

export interface SimklAuth {
  id: number;
  username: string;
  name: string;
  avatar?: string;
  avatarUrl?: string;
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

export interface StreamingServiceSetting {
  id: string;
  enabled: boolean;
  customImage?: string;
}

export interface AppSettings {
  showHero: boolean;
  reduceSidebar: boolean;
  horizontalPosters: boolean;
  hideUnavailable: boolean;
  autoplay: boolean;
  skipIntro: boolean;
  preferredQuality: string;
  subtitlesEnabled: boolean;
  customPlayerPath: string;
  tmdbApiKey: string;
  tmdbLanguage: string;
  accentColor: string;
  appLanguage: string;
  visibleServices: string[];
  streamingServices: StreamingServiceSetting[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  showHero: true,
  reduceSidebar: false,
  horizontalPosters: false,
  hideUnavailable: false,
  autoplay: true,
  skipIntro: true,
  preferredQuality: 'auto',
  subtitlesEnabled: true,
  customPlayerPath: '',
  tmdbApiKey: '',
  tmdbLanguage: 'it-IT',
  accentColor: '#7c3aed',
  appLanguage: 'it',
  visibleServices: ['netflix', 'disney', 'apple', 'paramount', 'amazon', 'hbo', 'crunchyroll', 'raiplay'],
  streamingServices: [
    { id: 'netflix', enabled: true },
    { id: 'disney', enabled: true },
    { id: 'apple', enabled: true },
    { id: 'paramount', enabled: true },
    { id: 'amazon', enabled: true },
    { id: 'hbo', enabled: true },
    { id: 'crunchyroll', enabled: true },
    { id: 'raiplay', enabled: true },
  ],
};

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