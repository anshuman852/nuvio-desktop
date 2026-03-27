/// <reference types="vite/client" />
/**
 * Nuvio API — usa Supabase direttamente.
 * La anon key è pubblica by design (Row Level Security protegge i dati utente).
 * URL e key vengono dagli env secrets GitHub (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
 */
import { NuvioUser } from '../lib/types';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL      ?? '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

let _userToken: string | null = null;

export function setAuthToken(t: string | null) { _userToken = t; }

function sbH(useUser = false): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON,
    Authorization: `Bearer ${useUser && _userToken ? _userToken : SUPABASE_ANON}`,
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function nuvioLogin(email: string, password: string): Promise<NuvioUser> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: sbH(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? data.msg ?? 'Login fallito');
  _userToken = data.access_token;

  // Prova a caricare profilo
  let name = data.user.email.split('@')[0];
  let avatar: string | undefined;
  try {
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=username,full_name,avatar_url&id=eq.${data.user.id}`, { headers: sbH(true) });
    const p = (await pr.json())?.[0];
    if (p) { name = p.username ?? p.full_name ?? name; avatar = p.avatar_url; }
  } catch { /* non bloccante */ }

  return { id: data.user.id, email: data.user.email, token: data.access_token, name, avatar };
}

export async function nuvioLogout(): Promise<void> {
  if (!_userToken) return;
  try { await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: sbH(true) }); } catch { /* ignore */ }
  _userToken = null;
}

// ─── Continue Watching ────────────────────────────────────────────────────────

export interface NuvioCW {
  id: string; type: string; name: string; poster?: string;
  videoId?: string; season?: number; episode?: number;
  progress: number; duration: number; updatedAt: string;
}

export async function getContinueWatching(userId: string): Promise<NuvioCW[]> {
  if (!_userToken || !userId) return [];
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/continue_watching?select=*&user_id=eq.${userId}&order=updated_at.desc&limit=50`,
    { headers: sbH(true) }
  );
  if (!res.ok) return [];
  return ((await res.json()) ?? []).map((r: any): NuvioCW => ({
    id: r.content_id, type: r.content_type, name: r.name ?? '',
    poster: r.poster, videoId: r.video_id, season: r.season, episode: r.episode,
    progress: r.progress_pct ?? 0, duration: r.duration ?? 0, updatedAt: r.updated_at,
  }));
}

export async function upsertCW(userId: string, item: {
  id: string; type: string; name: string; poster?: string;
  videoId?: string; season?: number; episode?: number;
  progress: number; duration: number;
}): Promise<void> {
  if (!_userToken || !userId) return;
  await fetch(`${SUPABASE_URL}/rest/v1/continue_watching`, {
    method: 'POST',
    headers: { ...sbH(true), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: userId, content_id: item.id, content_type: item.type,
      name: item.name, poster: item.poster, video_id: item.videoId,
      season: item.season, episode: item.episode,
      progress_pct: item.progress, duration: item.duration,
      updated_at: new Date().toISOString(),
    }),
  });
}

// ─── Addons sync ──────────────────────────────────────────────────────────────

export async function getNuvioAddons(userId: string): Promise<any[]> {
  if (!_userToken || !userId) return [];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_addons?select=addon_data&user_id=eq.${userId}`, { headers: sbH(true) });
  if (!res.ok) return [];
  return ((await res.json()) ?? []).map((r: any) => r.addon_data).filter(Boolean);
}

export async function syncAddons(userId: string, addons: any[]): Promise<void> {
  if (!_userToken || !userId || !addons.length) return;
  await fetch(`${SUPABASE_URL}/rest/v1/user_addons`, {
    method: 'POST',
    headers: { ...sbH(true), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(addons.map(a => ({ user_id: userId, addon_id: a.id, addon_data: a, updated_at: new Date().toISOString() }))),
  });
}

export async function getWatchedItems(userId: string): Promise<string[]> {
  if (!_userToken || !userId) return [];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/watched_items?select=content_id&user_id=eq.${userId}`, { headers: sbH(true) });
  if (!res.ok) return [];
  return ((await res.json()) ?? []).map((r: any) => r.content_id);
}

// ─── Mark as watched (Nuvio/Supabase) ────────────────────────────────────────

export async function markNuvioWatched(
  userId: string,
  item: { id: string; type: string; name: string; poster?: string }
): Promise<void> {
  if (!_userToken || !userId) return;
  await fetch(`${SUPABASE_URL}/rest/v1/watched_items`, {
    method: 'POST',
    headers: { ...sbH(true), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: userId,
      content_id: item.id,
      content_type: item.type,
      name: item.name,
      poster: item.poster,
      watched_at: new Date().toISOString(),
    }),
  });
}

export async function removeNuvioWatched(userId: string, contentId: string): Promise<void> {
  if (!_userToken || !userId) return;
  await fetch(`${SUPABASE_URL}/rest/v1/watched_items?user_id=eq.${userId}&content_id=eq.${contentId}`, {
    method: 'DELETE',
    headers: sbH(true),
  });
}

export async function getAllWatchedItems(userId: string): Promise<{ id: string; type: string; name: string; poster?: string; watchedAt: string }[]> {
  if (!_userToken || !userId) return [];
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/watched_items?select=content_id,content_type,name,poster,watched_at&user_id=eq.${userId}&order=watched_at.desc`,
    { headers: sbH(true) }
  );
  if (!res.ok) return [];
  return ((await res.json()) ?? []).map((r: any) => ({
    id: r.content_id, type: r.content_type,
    name: r.name, poster: r.poster, watchedAt: r.watched_at,
  }));
}
