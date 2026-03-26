/// <reference types="vite/client" />
/**
 * Addon client — usa fetch() del browser direttamente.
 * Gli addon Stremio hanno CORS: Access-Control-Allow-Origin: *
 * quindi non serve passare per Rust. mpv viene ancora lanciato via invoke.
 */
import { invoke } from '@tauri-apps/api/core';
import { Addon, MetaItem, Stream } from './types';

// ─── URL normalization ────────────────────────────────────────────────────────

export function normalizeAddonUrl(rawUrl: string): string {
  let url = rawUrl.trim();
  if (url.startsWith('stremio://')) url = 'https://' + url.slice('stremio://'.length);
  if (url.startsWith('http://')) url = 'https://' + url.slice('http://'.length);
  return url.replace(/\/manifest\.json$/, '').replace(/\/$/, '');
}

// ─── Addon install ────────────────────────────────────────────────────────────

export async function installAddon(rawUrl: string): Promise<Addon> {
  const baseUrl = normalizeAddonUrl(rawUrl);
  const res = await fetch(`${baseUrl}/manifest.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const manifest = await res.json();

  const resources: string[] = Array.isArray(manifest.resources)
    ? manifest.resources.map((r: any) => typeof r === 'string' ? r : r.name)
    : [];

  return {
    url: baseUrl,
    id: manifest.id,
    name: manifest.name,
    version: manifest.version ?? '0.0.0',
    description: manifest.description ?? '',
    types: manifest.types ?? [],
    catalogs: (manifest.catalogs ?? []).map((c: any) => ({
      type: c.type, id: c.id, name: c.name ?? c.id, extra: c.extra ?? [],
    })),
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
  const base = normalizeAddonUrl(addonUrl);
  const extraSeg = extra ? `/${extra}` : '';
  const url = `${base}/catalog/${type}/${id}${extraSeg}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status} ${url}`);
  const data = await res.json();
  return (data.metas ?? []) as MetaItem[];
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

export async function fetchMeta(
  addonUrl: string,
  type: string,
  id: string
): Promise<MetaItem | null> {
  try {
    const base = normalizeAddonUrl(addonUrl);
    const res = await fetch(`${base}/meta/${type}/${id}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.meta ?? null) as MetaItem | null;
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
      const base = normalizeAddonUrl(addon.url);
      const res = await fetch(`${base}/stream/${type}/${id}.json`);
      if (!res.ok) return { addonName: addon.name, addonUrl: addon.url, streams: [] };
      const data = await res.json();
      return {
        addonName: addon.name,
        addonUrl: addon.url,
        streams: (data.streams ?? []) as Stream[],
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<StreamGroup> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((r) => r.streams.length > 0);
}

// ─── mpv (unico che usa Rust) ─────────────────────────────────────────────────

export async function launchMpv(url: string, title?: string): Promise<void> {
  await invoke('launch_mpv', { url, title: title ?? null });
}

export async function mpvCommand(cmd: string, args: unknown[] = []): Promise<void> {
  await invoke('mpv_command', { cmd, args });
}

export async function mpvStop(): Promise<void> {
  await invoke('mpv_stop');
}