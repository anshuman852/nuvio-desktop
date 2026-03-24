import { invoke } from '@tauri-apps/api/core';
import { Addon, MetaItem, Stream } from './types';

// ─── Addon install ────────────────────────────────────────────────────────────

/**
 * Scarica il manifest da un URL e restituisce un oggetto Addon pronto per lo store.
 * L'URL può essere sia "https://…/manifest.json" che "https://…" (base).
 */
export async function installAddon(rawUrl: string): Promise<Addon> {
  // Normalizza: se non finisce con manifest.json, aggiungilo per il fetch
  const baseUrl = rawUrl.replace(/\/manifest\.json$/, '').replace(/\/$/, '');
  const manifestUrl = `${baseUrl}/manifest.json`;

  const manifest = await invoke<any>('fetch_manifest', { url: manifestUrl });

  return {
    url: baseUrl,
    id: manifest.id,
    name: manifest.name,
    version: manifest.version ?? '0.0.0',
    description: manifest.description ?? '',
    types: manifest.types ?? [],
    catalogs: manifest.catalogs ?? [],
    resources: Array.isArray(manifest.resources)
      ? manifest.resources.map((r: any) => (typeof r === 'string' ? r : r.name))
      : [],
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
  const result = await invoke<any>('fetch_catalog', {
    addonUrl,
    type_: type,
    id,
    extra: extra ?? null,
  });
  return (result.metas ?? []) as MetaItem[];
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

/**
 * Aggrega gli stream da tutti gli addon che supportano la risorsa "stream".
 */
export async function fetchAllStreams(
  addons: Pick<Addon, 'url' | 'resources'>[],
  type: string,
  id: string
): Promise<{ addon: string; streams: Stream[] }[]> {
  const results = await Promise.allSettled(
    addons
      .filter((a) => a.resources.includes('stream'))
      .map(async (a) => {
        const result = await invoke<any>('fetch_streams', {
          addonUrl: a.url,
          type_: type,
          id,
        });
        return { addon: a.url, streams: (result.streams ?? []) as Stream[] };
      })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<{ addon: string; streams: Stream[] }> =>
      r.status === 'fulfilled'
    )
    .map((r) => r.value)
    .filter((r) => r.streams.length > 0);
}

// ─── mpv ──────────────────────────────────────────────────────────────────────

export async function launchMpv(url: string, title?: string): Promise<void> {
  await invoke('launch_mpv', { url, title: title ?? null });
}

export async function mpvCommand(
  cmd: string,
  args: unknown[] = []
): Promise<void> {
  await invoke('mpv_command', { cmd, args });
}

export async function mpvStop(): Promise<void> {
  await invoke('mpv_stop');
}
