/// <reference types="vite/client" />
/**
 * Nuvio API — usa Supabase direttamente con gli stessi RPC del sync tool.
 * RPCs chiave: get_sync_owner, sync_pull_*, sync_push_*
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

async function rpc(fn: string, payload: Record<string, unknown> = {}, token?: string | null): Promise<any> {
  // IMPORTANTE: deve usare il token utente, non anon - come il sync tool
  const auth = token ?? _userToken;
  if (!auth) throw new Error(`RPC ${fn}: token utente mancante - effettua il login`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${auth}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`RPC ${fn} failed ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function nuvioLogin(email: string, password: string): Promise<NuvioUser> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? data.msg ?? data.error ?? 'Login fallito');
  
  // Imposta token SUBITO prima di qualsiasi altra chiamata
  _userToken = data.access_token;
  
  // get_sync_owner: ottieni l'owner reale (esattamente come il sync tool)
  let ownerId = data.user.id;
  try {
    const ownerRes = await rpc('get_sync_owner', {}, data.access_token);
    if (typeof ownerRes === 'string' && ownerRes.length > 10) ownerId = ownerRes;
    else if (Array.isArray(ownerRes) && ownerRes.length > 0) ownerId = String(ownerRes[0]);
    else if (ownerRes && typeof ownerRes === 'object' && ownerRes.id) ownerId = ownerRes.id;
    console.log('[Nuvio] owner reale:', ownerId);
  } catch (e) {
    console.warn('[Nuvio] get_sync_owner fallito, uso user.id:', e);
  }

  let name = data.user.email.split('@')[0];
  let avatar: string | undefined;
  try {
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=username,full_name,avatar_url&id=eq.${data.user.id}`, { headers: sbH(true) });
    const p = (await pr.json())?.[0];
    if (p) { name = p.username ?? p.full_name ?? name; avatar = p.avatar_url; }
  } catch { /* non bloccante */ }

  return { id: ownerId, email: data.user.email, token: data.access_token, name, avatar };
}

export async function nuvioLogout(): Promise<void> {
  if (!_userToken) return;
  try { await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: sbH(true) }); } catch { }
  _userToken = null;
}

// ─── Continue Watching (watch_progress) ──────────────────────────────────────

export interface NuvioCW {
  id: string; type: string; name: string; poster?: string;
  videoId?: string; season?: number; episode?: number;
  progress: number; duration: number; updatedAt: string;
}

export async function getContinueWatching(userId: string): Promise<NuvioCW[]> {
  if (!_userToken || !userId) return [];
  try {
    // Usa l'RPC ufficiale sync_pull_watch_progress (identico al sync tool)
    const data = await rpc('sync_pull_watch_progress', {}, _userToken);
    if (!Array.isArray(data) || data.length === 0) return [];
    return data
      .filter((r: any) => {
        const pos = r.position ?? 0;
        const dur = r.duration ?? 0;
        if (dur <= 0) return false;
        const pct = pos / dur;
        return pct >= 0.03 && pct <= 0.95;
      })
      .sort((a: any, b: any) => (b.last_watched ?? 0) - (a.last_watched ?? 0))
      .slice(0, 20)
      .map((r: any): NuvioCW => {
        // position e duration sono in ms (schema Kotlin)
        const durSec = r.duration > 3600000 ? r.duration / 1000 : (r.duration ?? 0);
        const posSec = r.position > 3600000 ? r.position / 1000 : (r.position ?? 0);
        const progress = durSec > 0 ? posSec / durSec : 0;
        return {
          id: r.content_id,
          type: r.content_type,
          name: r.name ?? '',
          poster: r.poster ?? null,
          videoId: r.video_id,
          season: r.season ?? undefined,
          episode: r.episode ?? undefined,
          progress,
          duration: durSec,
          updatedAt: new Date(r.last_watched ?? Date.now()).toISOString(),
        };
      });
  } catch { return []; }
}

export async function upsertCW(userId: string, item: {
  id: string; type: string; name: string; poster?: string;
  videoId?: string; season?: number; episode?: number;
  progress: number; duration: number;
}): Promise<void> {
  if (!_userToken || !userId) return;
  const now = Date.now();
  const posMs = Math.round(item.progress * item.duration * 1000);
  const durMs = Math.round(item.duration * 1000);
  const progressKey = item.season != null && item.episode != null
    ? `${item.id}_s${item.season}e${item.episode}`
    : item.id;

  // Usa sync_push_watch_progress con il formato corretto
  // Schema corretto: watch_progress NON ha name/poster
  const entry = {
    content_id: item.id,
    content_type: item.type,
    video_id: item.videoId ?? item.id,
    season: item.season ?? null,
    episode: item.episode ?? null,
    position: posMs,
    duration: durMs,
    last_watched: now,
    progress_key: progressKey,
  };
  try {
    await rpc('sync_push_watch_progress', { p_entries: [entry] }, _userToken);
  } catch (e) {
    console.warn('[Nuvio] sync_push_watch_progress fallback REST:', e);
    // Fallback REST diretto (senza name/poster)
    await fetch(`${SUPABASE_URL}/rest/v1/watch_progress`, {
      method: 'POST',
      headers: { ...sbH(true), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId, profile_id: 1, ...entry }),
    }).catch(() => {});
  }
}

export async function removeCW(userId: string, contentId: string): Promise<void> {
  if (!_userToken || !userId) return;
  await Promise.allSettled([
    fetch(`${SUPABASE_URL}/rest/v1/watch_progress?user_id=eq.${userId}&content_id=eq.${contentId}`, { method: 'DELETE', headers: sbH(true) }),
    fetch(`${SUPABASE_URL}/rest/v1/continue_watching?user_id=eq.${userId}&content_id=eq.${contentId}`, { method: 'DELETE', headers: sbH(true) }),
  ]);
}

// ─── Library ──────────────────────────────────────────────────────────────────

export async function removeFromLibrary(userId: string, contentId: string): Promise<void> {
  if (!_userToken || !userId) return;
  await fetch(`${SUPABASE_URL}/rest/v1/library_items?user_id=eq.${userId}&content_id=eq.${contentId}`, { method: 'DELETE', headers: sbH(true) });
}

// ─── Addons ───────────────────────────────────────────────────────────────────

export async function getNuvioAddons(userId: string): Promise<any[]> {
  if (!_userToken || !userId) return [];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/addons?select=url,name,sort_order&user_id=eq.${userId}&order=sort_order.asc`, { headers: sbH(true) });
  if (!res.ok) return [];
  const rows = await res.json();
  return (rows ?? []).map((r: any) => ({ id: r.url, url: r.url, name: r.name ?? r.url }));
}

// ─── Watched items ────────────────────────────────────────────────────────────

export async function getAllWatchedItems(userId: string): Promise<any[]> {
  if (!_userToken || !userId) return [];
  try {
    const data = await rpc('sync_pull_watched_items', {}, _userToken);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

export async function markNuvioWatched(userId: string, contentId: string, contentType: string): Promise<void> {
  if (!_userToken || !userId) return;
  await rpc('sync_push_watched_items', {
    p_items: [{ content_id: contentId, content_type: contentType, title: contentId, season: null, episode: null, watched_at: Date.now() }],
  }, _userToken).catch(() => {});
}

export async function removeNuvioWatched(userId: string, contentId: string): Promise<void> {
  if (!_userToken || !userId) return;
  await fetch(`${SUPABASE_URL}/rest/v1/watched_items?user_id=eq.${userId}&content_id=eq.${contentId}`, { method: 'DELETE', headers: sbH(true) });
}

// ─── Account Stats (usa Content-Range come il sync tool) ─────────────────────

export interface AccountStats {
  totalMovies: number;
  totalEpisodes: number;
  totalWatched: number;
  librarySize: number;
  watchTimeHours: number;
}

async function countTable(table: string, userId: string, extra = ''): Promise<number> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?user_id=eq.${userId}${extra}&select=id`,
    { headers: { ...sbH(true), Prefer: 'count=exact', Range: '0-0' } }
  );
  const cr = res.headers.get('content-range');
  if (cr) { const parts = cr.split('/'); if (parts[1] && parts[1] !== '*') return parseInt(parts[1], 10); }
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data.length : 0;
}

export async function getAccountStats(userId: string): Promise<AccountStats> {
  if (!_userToken || !userId) return { totalMovies: 0, totalEpisodes: 0, totalWatched: 0, librarySize: 0, watchTimeHours: 0 };
  try {
    // Usa gli stessi RPCs del sync tool per avere i dati reali
    const [watchedItems, watchProgress, libraryItems] = await Promise.all([
      rpc('sync_pull_watched_items', {}, _userToken).then((d: any) => Array.isArray(d) ? d : []).catch(() => []),
      rpc('sync_pull_watch_progress', {}, _userToken).then((d: any) => Array.isArray(d) ? d : []).catch(() => []),
      rpc('sync_pull_library', {}, _userToken).then((d: any) => Array.isArray(d) ? d : []).catch(() => []),
    ]);

    const movies = (watchedItems as any[]).filter((w: any) => w.content_type === 'movie' && w.season == null).length;
    const episodes = (watchedItems as any[]).filter((w: any) => w.season != null).length;
    const seriesWatched = (watchedItems as any[]).filter((w: any) => w.content_type === 'series' && w.season == null).length;

    const watchTimeMs = (watchProgress as any[]).reduce((acc: number, w: any) => {
      const pos = w.position ?? 0;
      // position è in ms se > 3.6M (1 ora in ms), altrimenti in secondi
      return acc + (pos > 3600000 ? pos : pos * 1000);
    }, 0);

    return {
      totalMovies: movies,
      totalEpisodes: episodes,
      totalWatched: movies + seriesWatched,
      librarySize: (libraryItems as any[]).length,
      watchTimeHours: Math.round(watchTimeMs / 3600000),
    };
  } catch { return { totalMovies: 0, totalEpisodes: 0, totalWatched: 0, librarySize: 0, watchTimeHours: 0 }; }
}

// ─── Avatar Catalog ───────────────────────────────────────────────────────────

export interface SupabaseAvatar {
  id: string; displayName: string; imageUrl: string;
  category: string; sortOrder: number; bgColor?: string;
}

export async function getAvatarCatalog(): Promise<SupabaseAvatar[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_avatar_catalog`, {
      method: 'POST',
      headers: { ...sbH(), 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) return [];
    const data: any[] = await res.json();
    return data.map((item: any) => ({
      id: item.id,
      displayName: item.display_name,
      imageUrl: item.storage_path?.startsWith('http')
        ? item.storage_path
        : `${SUPABASE_URL}/storage/v1/object/public/avatars/${item.storage_path}`,
      category: item.category,
      sortOrder: item.sort_order ?? 0,
      bgColor: item.bg_color,
    }));
  } catch { return []; }
}

// ─── Trakt Scrobble ───────────────────────────────────────────────────────────

export async function traktScrobble(
  token: string,
  action: 'start' | 'pause' | 'stop',
  item: { type: 'movie' | 'episode'; imdbId?: string; traktId?: number; title?: string; season?: number; episode?: number },
  progress: number
): Promise<void> {
  if (!token) return;
  const body: any = { progress: Math.round(progress * 100) };
  if (item.type === 'movie') {
    body.movie = { title: item.title ?? '', ids: { imdb: item.imdbId, trakt: item.traktId } };
  } else {
    body.episode = { season: item.season ?? 1, number: item.episode ?? 1, ids: { imdb: item.imdbId } };
    body.show = { title: item.title ?? '', ids: { imdb: item.imdbId } };
  }
  await fetch(`https://api.trakt.tv/scrobble/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'trakt-api-version': '2',
      'trakt-api-key': import.meta.env.VITE_TRAKT_CLIENT_ID ?? '',
    },
    body: JSON.stringify(body),
  }).catch(() => {});
}
