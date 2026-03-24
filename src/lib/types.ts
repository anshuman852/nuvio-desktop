// ─── Addon / Stremio manifest ─────────────────────────────────────────────────

export interface AddonCatalog {
  type: string;
  id: string;
  name: string;
  extra?: { name: string; isRequired?: boolean; options?: string[] }[];
}

export interface Addon {
  /** URL base dell'addon (senza /manifest.json) */
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

// ─── Catalogo / Metadata ──────────────────────────────────────────────────────

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
  /** Solo per le serie */
  videos?: Video[];
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
  /** Nome del provider (es. "Torrentio", "OpenSubs") */
  name: string;
  title?: string;
  /** HTTP/HTTPS diretto → playback immediato via mpv */
  url?: string;
  /** Torrent info hash */
  infoHash?: string;
  fileIdx?: number;
  behaviorHints?: {
    notWebReady?: boolean;
    bingeGroup?: string;
    filename?: string;
  };
  /** Qualità/tag mostrati nell'UI */
  description?: string;
}

// ─── Cronologia ───────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  type: string;
  name: string;
  poster?: string;
  /** Video ID corrente (per le serie) */
  videoId?: string;
  /** Secondi di avanzamento (future feature via IPC) */
  progress?: number;
  watchedAt: number; // timestamp ms
}
