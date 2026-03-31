/// <reference types="vite/client" />
import { invoke } from '@tauri-apps/api/core';
import { Addon, MetaItem, Stream, StreamGroup } from '../lib/types';

// ─── URL normalization ────────────────────────────────────────────────────────

export function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (u.startsWith('stremio://')) u = 'https://' + u.slice('stremio://'.length);
  if (u.startsWith('http://'))    u = 'https://' + u.slice('http://'.length);
  return u.replace(/\/manifest\.json$/, '').replace(/\/$/, '');
}

// ─── Open external URL (usa Tauri shell open) ─────────────────────────────────

export async function openExternal(url: string): Promise<void> {
  try {
    // Tauri 2: usa il comando shell open via invoke
    await invoke('open_url', { url });
  } catch {
    // Fallback: window.open (funziona in alcuni contesti)
    window.open(url, '_blank');
  }
}

// ─── Addon install ────────────────────────────────────────────────────────────

export async function installAddon(rawUrl: string): Promise<Addon> {
  const base = normalizeUrl(rawUrl);
  const res = await fetch(`${base}/manifest.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status} — impossibile raggiungere l'addon`);
  const m = await res.json();
  return {
    url: base, id: m.id, name: m.name,
    version: m.version ?? '0.0.0',
    description: m.description ?? '',
    types: m.types ?? [],
    catalogs: (m.catalogs ?? []).map((c: any) => ({
      type: c.type, id: c.id, name: c.name ?? c.id, extra: c.extra ?? [],
    })),
    resources: Array.isArray(m.resources)
      ? m.resources.map((r: any) => (typeof r === 'string' ? r : r.name))
      : [],
    logo: m.logo,
  };
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export async function fetchCatalog(addonUrl: string, type: string, id: string, extra?: string): Promise<MetaItem[]> {
  const base = normalizeUrl(addonUrl);
  const extraSeg = extra ? `/${extra}` : '';
  const res = await fetch(`${base}/catalog/${type}/${id}${extraSeg}.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()).metas ?? []) as MetaItem[];
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

export async function fetchMeta(addonUrl: string, type: string, id: string): Promise<MetaItem | null> {
  try {
    const base = normalizeUrl(addonUrl);
    const res = await fetch(`${base}/meta/${type}/${id}.json`);
    if (!res.ok) return null;
    return (await res.json()).meta ?? null;
  } catch { return null; }
}

// ─── Streams ──────────────────────────────────────────────────────────────────

export async function fetchStreams(addonUrl: string, type: string, id: string): Promise<Stream[]> {
  try {
    const base = normalizeUrl(addonUrl);
    const res = await fetch(`${base}/stream/${type}/${id}.json`);
    if (!res.ok) return [];
    return (await res.json()).streams ?? [];
  } catch { return []; }
}

// Cache stream per 5 minuti
const _streamCache = new Map<string, { data: StreamGroup[]; ts: number }>();

export async function fetchAllStreams(addons: Addon[], type: string, id: string, onGroup?: (g: StreamGroup) => void): Promise<StreamGroup[]> {
  const cacheKey = `${type}:${id}`;
  const cached = _streamCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 300_000) return cached.data;

  const eligible = addons.filter(a => a.resources.some(r => r === 'stream' || r.startsWith('stream')));
  const groups: StreamGroup[] = [];

  // Fetch in parallelo con timeout 10s per addon
  await Promise.allSettled(
    eligible.map(async addon => {
      try {
        const streams = await Promise.race([
          fetchStreams(addon.url, type, id),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000)),
        ]);
        if (streams.length > 0) {
          const group: StreamGroup = { addonName: addon.name, addonUrl: addon.url, streams };
          groups.push(group);
          onGroup?.(group); // callback progressivo
        }
      } catch { /* timeout o errore addon */ }
    })
  );

  _streamCache.set(cacheKey, { data: groups, ts: Date.now() });
  return groups;
}

// ─── Player (invoke Rust) ─────────────────────────────────────────────────────

export async function launchPlayer(url: string, title?: string, playerPath?: string): Promise<void> {
  const custom = playerPath?.trim();
  if (custom && custom !== 'mpv') {
    // Player esterno specificato dall'utente
    await invoke('launch_custom_player', { playerPath: custom, url, title: title ?? null });
  } else {
    // mpv di default (bundled)
    await invoke('launch_mpv', { url, title: title ?? null });
  }
}

export async function mpvStop(): Promise<void> {
  try { await invoke('mpv_stop'); } catch { /* ignore */ }
}
