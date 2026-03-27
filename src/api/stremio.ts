/// <reference types="vite/client" />
/**
 * Stremio Addon Protocol client.
 * Usa fetch() del browser — gli addon hanno CORS: Access-Control-Allow-Origin: *
 * NON usa invoke() Rust per le chiamate HTTP (invoke è solo per mpv).
 */
import { invoke } from '@tauri-apps/api/core';
import { Addon, MetaItem, Stream, StreamGroup } from '../lib/types';

// ─── URL normalization ────────────────────────────────────────────────────────

export function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (u.startsWith('stremio://')) u = 'https://' + u.slice('stremio://'.length);
  if (u.startsWith('http://'))    u = 'https://' + u.slice('http://'.length);
  return u.replace(/\/manifest\.json$/, '').replace(/\/$/, '');
}

// ─── Addon install ────────────────────────────────────────────────────────────

export async function installAddon(rawUrl: string): Promise<Addon> {
  const base = normalizeUrl(rawUrl);
  const res = await fetch(`${base}/manifest.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status} — impossibile raggiungere l'addon`);
  const m = await res.json();
  return {
    url: base,
    id: m.id,
    name: m.name,
    version: m.version ?? '0.0.0',
    description: m.description ?? '',
    types: m.types ?? [],
    catalogs: (m.catalogs ?? []).map((c: any) => ({
      type: c.type, id: c.id,
      name: c.name ?? c.id,
      extra: c.extra ?? [],
    })),
    resources: Array.isArray(m.resources)
      ? m.resources.map((r: any) => (typeof r === 'string' ? r : r.name))
      : [],
    logo: m.logo,
  };
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export async function fetchCatalog(
  addonUrl: string,
  type: string,
  id: string,
  extra?: string
): Promise<MetaItem[]> {
  const base = normalizeUrl(addonUrl);
  const extraSeg = extra ? `/${extra}` : '';
  const url = `${base}/catalog/${type}/${id}${extraSeg}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
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
    const base = normalizeUrl(addonUrl);
    const res = await fetch(`${base}/meta/${type}/${id}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.meta ?? null) as MetaItem | null;
  } catch {
    return null;
  }
}

// ─── Streams ──────────────────────────────────────────────────────────────────

export async function fetchStreams(
  addonUrl: string,
  type: string,
  id: string
): Promise<Stream[]> {
  try {
    const base = normalizeUrl(addonUrl);
    const res = await fetch(`${base}/stream/${type}/${id}.json`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.streams ?? []) as Stream[];
  } catch {
    return [];
  }
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
    eligible.map(async (addon) => ({
      addonName: addon.name,
      addonUrl: addon.url,
      streams: await fetchStreams(addon.url, type, id),
    }))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<StreamGroup> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((r) => r.streams.length > 0);
}

// ─── mpv (unico invoke Rust) ──────────────────────────────────────────────────

export async function launchMpv(url: string, title?: string): Promise<void> {
  await invoke('launch_mpv', { url, title: title ?? null });
}

export async function mpvStop(): Promise<void> {
  await invoke('mpv_stop');
}
