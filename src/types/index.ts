// ─── Stremio Addon Protocol ─────────────────────────────────────────────────

export interface Addon {
  id: string;
  version: string;
  name: string;
  description?: string;
  logo?: string;
  transportUrl: string;  // URL base dell'addon (es. https://...)
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

export type ContentType = "movie" | "series" | "channel" | "tv";

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
  type: "Trailer" | "Clip";
}

// ─── Streams ─────────────────────────────────────────────────────────────────

export interface Stream {
  name?: string;
  description?: string;
  url?: string;          // HTTP(S) direct link
  infoHash?: string;     // Torrent info hash
  fileIdx?: number;      // File index nel torrent
  ytId?: string;         // YouTube ID
  externalUrl?: string;  // Apri browser esterno
  behaviorHints?: {
    bingeGroup?: string;
    notWebReady?: boolean;
    filename?: string;
  };
  // Campi extra Nuvio/custom
  addonId?: string;
  addonName?: string;
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
  progress: number;     // 0-1
  duration: number;     // secondi
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
  position: number;    // secondi
  duration: number;    // secondi
  volume: number;      // 0-100
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
