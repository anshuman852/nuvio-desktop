// ─── Stremio Addon Protocol ─────────────────────────────────────────────────

export interface Addon {
  id: string;
  version: string;
  name: string;
  description?: string;
  logo?: string;
  transportUrl: string;
  manifest: AddonManifest;
  enabled: boolean;
}

export interface AddonManifest {
  id: string;
  version: string;
  name: string;
  description?: string;
  logo?: string;
  catalogs: CatalogDefinition[];
  resources: string[];
  types: ContentType[];
  idPrefixes?: string[];
  behaviorHints?: { configurable?: boolean; configurationRequired?: boolean };
}

export interface CatalogDefinition {
  type: ContentType;
  id: string;
  name: string;
  extra?: ExtraDefinition[];
}

export interface ExtraDefinition {
  name: string;
  isRequired?: boolean;
  options?: string[];
}

export type ContentType = 'movie' | 'series' | 'channel' | 'tv';

// ─── Content Meta ────────────────────────────────────────────────────────────

export interface MetaItem {
  id: string;
  type: ContentType;
  name: string;
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
  year?: number;
  runtime?: string;
  genres?: string[];
  imdbRating?: string;
  releaseInfo?: string;
  cast?: string[];
  director?: string[];
  videos?: Video[];
  links?: MetaLink[];
  trailers?: Trailer[];
}

export interface Video {
  id: string;
  title: string;
  season?: number;
  episode?: number;
  released?: string;
  overview?: string;
  thumbnail?: string;
}

export interface MetaLink {
  name: string;
  category: string;
  url: string;
}

export interface Trailer {
  source: string;
  type: 'Trailer' | 'Clip';
}

// ─── Streams ─────────────────────────────────────────────────────────────────

export interface Stream {
  name?: string;
  description?: string;
  url?: string;
  infoHash?: string;
  fileIdx?: number;
  ytId?: string;
  externalUrl?: string;
  behaviorHints?: {
    bingeGroup?: string;
    notWebReady?: boolean;
    filename?: string;
  };
  addonId?: string;
  addonName?: string;
}

/** Stream con i campi addon sempre valorizzati (post-fetch) */
export interface EnrichedStream extends Stream {
  addonId: string;
  addonName: string;
}

// ─── Nuvio Specific ──────────────────────────────────────────────────────────

export interface NuvioUser {
  id: string;
  email: string;
  token: string;
}

export interface NuvioContinueWatching {
  id: string;
  type: ContentType;
  name: string;
  poster?: string;
  videoId?: string;
  season?: number;
  episode?: number;
  progress: number;
  duration: number;
  updatedAt: string;
}

// ─── Player ──────────────────────────────────────────────────────────────────

export interface PlayerState {
  isOpen: boolean;
  url?: string;
  title?: string;
  meta?: MetaItem;
  stream?: Stream;
  paused: boolean;
  position: number;
  duration: number;
  volume: number;
}

// ─── App State ───────────────────────────────────────────────────────────────

export interface CatalogEntry {
  addonId: string;
  catalogId: string;
  type: ContentType;
  items: MetaItem[];
  loading: boolean;
  error?: string;
}
