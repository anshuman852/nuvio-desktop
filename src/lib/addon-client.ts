import { invoke } from '@tauri-apps/api/core';
import { Addon, MetaItem, Stream } from './types';

// ─── URL normalization ────────────────────────────────────────────────────────

/**
 * Converte qualsiasi formato URL addon in un URL base HTTPS.
 * Gestisce: stremio://, https://, http://, URL con /manifest.json
 */
export function normalizeAddonUrl(rawUrl: string): string {
  let url = rawUrl.trim();

  // stremio://host/path → https://host/path
  if (url.startsWith('stremio://')) {
    url = 'https://' + url.slice('stremio://'.length);
  }

  // http → https
  if (url.startsWith('http://')) {
    url = 'https://' + url.slice('http://'.length);
  }

  // Rimuovi /manifest.json finale e slash trailing
  url = url.replace(/\/manifest\.json$/, '').replace(/\/$/, '');

  return url;
}

// ─── Addon install ────────────────────────────────────────────────────────────

export async function installAddon(rawUrl: string): Promise<Addon> {
  const baseUrl = normalizeAddonUrl(rawUrl);
  const manifestUrl = `${baseUrl}/manifest.json`;

  const manifest = await invoke<any>('fetch_manifest', { url: manifestUrl });

  // Normalizza resources: può essere string[] o {name, types, idPrefixes}[]
  const resources: string[] = Array.isArray(manifest.resources)
    ? manifest.resources.map((r: any) => (typeof r === 'string' ? r : r.name))
    : [];

  // Normalizza catalogs
  const catalogs = (manifest.catalogs ?? []).map((c: any) => ({
    type: c.type,
    id: c.id,
    name: c.name ?? c.id,
    extra: c.extra ?? [],
  }));

  return {
    url: baseUrl,
    id: manifest.id,
    name: manifest.name,
    version: manifest.version ?? '0.0.0',
    description: manifest.description ?? '',
    types: manifest.types ?? [],
    catalogs,
    resources,
    logo: manifest.logo,
  };
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export async function fetchCatalog(
  addonUrl: string,
  type: string,
  id: string,
  extra?: string
): Promise<MetaItem[]> {
  try {
    const result = await invoke<any>('fetch_catalog', {
      addonUrl,
      type_: type,
      id,
      extra: extra ?? null,
    });
    return (result.metas ?? []) as MetaItem[];
  } catch {
    return [];
  }
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

export async function fetchMeta(
  addonUrl: string,
  type: string,
  id: string
): Promise<MetaItem | null> {
  try {
    const result = await invoke<any>('fetch_meta', { addonUrl, type_: type, id });
    return (result.meta ?? null) as MetaItem | null;
  } catch {
    return null;
  }
}

// ─── Streams ──────────────────────────────────────────────────────────────────

export interface StreamGroup {
  addonName: string;
  addonUrl: string;
  streams: Stream[];
}

/**
 * Aggrega gli stream da tutti gli addon che supportano la risorsa "stream".
 * Ritorna i gruppi anche se alcuni addon falliscono.
 */
export async function fetchAllStreams(
  addons: Addon[],
  type: string,
  id: string
): Promise<StreamGroup[]> {
  const eligible = addons.filter((a) =>
    a.resources.some((r) => r === 'stream' || r.startsWith('stream'))
  );

  const results = await Promise.allSettled(
    eligible.map(async (addon) => {
      const result = await invoke<any>('fetch_streams', {
        addonUrl: addon.url,
        type_: type,
        id,
      });
      const streams = (result.streams ?? []) as Stream[];
      return { addonName: addon.name, addonUrl: addon.url, streams };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<StreamGroup> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((r) => r.streams.length > 0);
}

// ─── mpv ──────────────────────────────────────────────────────────────────────

export async function launchMpv(url: string, title?: string): Promise<void> {
  await invoke('launch_mpv', { url, title: title ?? null });
}

export async function mpvStop(): Promise<void> {
  await invoke('mpv_stop');
}
