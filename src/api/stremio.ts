/**
 * Stremio Addon Protocol Client
 * Implementa il protocollo HTTP JSON degli addon Stremio
 */
import axios from "axios";
import type { AddonManifest, MetaItem, Stream, ContentType } from "../types";

// Normalizza l'URL dell'addon (rimuove /manifest.json se presente)
export function normalizeAddonUrl(url: string): string {
  return url.replace(/\/manifest\.json$/, "").replace(/\/$/, "");
}

// Scarica il manifest di un addon
export async function fetchManifest(transportUrl: string): Promise<AddonManifest> {
  const base = normalizeAddonUrl(transportUrl);
  const { data } = await axios.get<AddonManifest>(`${base}/manifest.json`, {
    timeout: 10_000,
  });
  return data;
}

// Catalog: lista di contenuti da un addon
export async function fetchCatalog(
  transportUrl: string,
  type: ContentType,
  catalogId: string,
  extra: Record<string, string> = {}
): Promise<MetaItem[]> {
  const base = normalizeAddonUrl(transportUrl);
  const extraStr = Object.keys(extra).length
    ? Object.entries(extra)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")
    : "";
  const url = extraStr
    ? `${base}/catalog/${type}/${catalogId}/${extraStr}.json`
    : `${base}/catalog/${type}/${catalogId}.json`;

  const { data } = await axios.get<{ metas: MetaItem[] }>(url, { timeout: 15_000 });
  return data.metas ?? [];
}

// Meta: dettagli di un singolo contenuto
export async function fetchMeta(
  transportUrl: string,
  type: ContentType,
  id: string
): Promise<MetaItem | null> {
  const base = normalizeAddonUrl(transportUrl);
  try {
    const { data } = await axios.get<{ meta: MetaItem }>(
      `${base}/meta/${type}/${id}.json`,
      { timeout: 10_000 }
    );
    return data.meta ?? null;
  } catch {
    return null;
  }
}

// Streams: sorgenti di un contenuto
export async function fetchStreams(
  transportUrl: string,
  type: ContentType,
  id: string  // Per serie: "tt1234567:1:2" (id:season:episode)
): Promise<Stream[]> {
  const base = normalizeAddonUrl(transportUrl);
  try {
    const { data } = await axios.get<{ streams: Stream[] }>(
      `${base}/stream/${type}/${id}.json`,
      { timeout: 15_000 }
    );
    return data.streams ?? [];
  } catch {
    return [];
  }
}

// Cerca in tutti gli addon installati (search catalog)
export async function searchCatalog(
  transportUrl: string,
  type: ContentType,
  query: string
): Promise<MetaItem[]> {
  return fetchCatalog(transportUrl, type, "search", { search: query });
}
