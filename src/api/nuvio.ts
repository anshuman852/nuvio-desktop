/// <reference types="vite/client" />

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL      ?? '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const SUPABASE_ENDPOINT = SUPABASE_URL;
export const SUPABASE_KEY = SUPABASE_ANON;

// Funzione helper pubblica per chiamate RPC dall'esterno
export async function callRpc(fn: string, payload: Record<string, unknown>, token: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`RPC ${fn} ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

let _userToken: string | null = null;

export function setAuthToken(t: string | null) { _userToken = t; }

// Headers con token utente obbligatorio
function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON,
    'Authorization': `Bearer ${token}`,
  };
}

// RPC Supabase — richiede SEMPRE token utente
async function rpc(fn: string, payload: Record<string, unknown> = {}, token: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`RPC ${fn} failed ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface NuvioUser {
  id: string; email: string; token: string; name: string; avatar?: string;
}

export async function nuvioLogin(email: string, password: string): Promise<NuvioUser> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? data.msg ?? data.error ?? 'Login fallito');

  _userToken = data.access_token;

  // get_sync_owner per owner reale (come il sync tool)
  let ownerId = data.user.id;
  try {
    const ownerRes = await rpc('get_sync_owner', {}, data.access_token);
    if (typeof ownerRes === 'string' && ownerRes.length > 10) ownerId = ownerRes;
    else if (Array.isArray(ownerRes) && ownerRes.length > 0) ownerId = String(ownerRes[0]);
    else if (ownerRes?.id) ownerId = ownerRes.id;
  } catch { /* usa user.id */ }

  let name = data.user.email.split('@')[0];
  let avatar: string | undefined;
  try {
    // Carica profilo: usa il user_id dell'autenticazione per trovare il profilo primario
    const pr = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=name,avatar_id,avatar_color_hex&user_id=eq.${data.user.id}&order=profile_index.asc&limit=1`,
      { headers: authHeaders(data.access_token) }
    );
    const rows = await pr.json();
    const p = Array.isArray(rows) ? rows[0] : null;
    if (p) {
      name = p.name ?? p.username ?? p.full_name ?? name;
      // Carica URL avatar dal catalog se c'è un avatar_id
      if (p.avatar_id) {
        try {
          const avatarRes = await fetch(
            `${SUPABASE_URL}/rest/v1/avatar_catalog?select=storage_path&id=eq.${p.avatar_id}&is_active=eq.true&limit=1`,
            { headers: authHeaders(data.access_token) }
          );
          const avatarRows = await avatarRes.json();
          const storagePath = avatarRows?.[0]?.storage_path;
          if (storagePath) {
            avatar = `${SUPABASE_URL}/storage/v1/object/public/avatars/${storagePath}`;
          }
        } catch { /* usa icona default */ }
      }
    }
  } catch { /* opzionale */ }

  return { id: ownerId, email: data.user.email, token: data.access_token, name, avatar };
}

export async function nuvioLogout() {
  const tok = _userToken;
  _userToken = null;
  if (!tok) return;
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: authHeaders(tok),
    });
  } catch { }
}

// ─── Continue Watching ────────────────────────────────────────────────────────

export interface NuvioCW {
  id: string; type: string; name: string; poster?: string;
  videoId?: string; season?: number; episode?: number;
  progress: number; duration: number; updatedAt: string;
}

export async function getContinueWatching(userId: string, userToken?: string): Promise<NuvioCW[]> {
  const tok = userToken ?? _userToken;
  if (!tok) return [];
  try {
    const data = await rpc('sync_pull_watch_progress', {}, tok);
    if (!Array.isArray(data) || data.length === 0) return [];

    // Fetch library per avere name e poster (watch_progress non li ha)
    let libraryMap: Map<string, { name: string; poster: string | null }> = new Map();
    try {
      const lib = await rpc('sync_pull_library', {}, tok);
      if (Array.isArray(lib)) {
        for (const item of lib) {
          libraryMap.set(item.content_id, { name: item.name ?? '', poster: item.poster ?? null });
        }
      }
    } catch { /* opzionale */ }

    return data
      .filter((r: any) => {
        const pos = r.position ?? 0;
        const dur = r.duration ?? 0;
        if (dur <= 0) return false;
        const pct = pos / dur;
        return pct >= 0.01 && pct <= 0.97;
      })
      .sort((a: any, b: any) => (b.last_watched ?? 0) - (a.last_watched ?? 0))
      .slice(0, 20)
      .map((r: any): NuvioCW => {
        // Dal DB reale: position e duration sono in SECONDI
        // Verifica: Coco position=1005s, duration=6299s ✓
        const durSec = r.duration ?? 0;
        const posSec = r.position ?? 0;
        const progress = durSec > 0 ? Math.min(posSec / durSec, 1) : 0;
        const lib = libraryMap.get(r.content_id);
        return {
          id: r.content_id,
          type: r.content_type,
          name: lib?.name ?? r.content_id ?? '',
          poster: lib?.poster ?? undefined,
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

// ─── Watched Items ────────────────────────────────────────────────────────────

export interface WatchedItem {
  id: string;
  content_id: string; content_type: string;
  type: string; name: string; poster?: string;
  season?: number | null; episode?: number | null;
  watchedAt: number;
}

export async function getAllWatchedItems(userId: string, userToken?: string): Promise<WatchedItem[]> {
  const tok = userToken ?? _userToken;
  if (!tok) return [];
  try {
    const data = await rpc('sync_pull_watched_items', {}, tok);
    if (!Array.isArray(data)) return [];
    return data.map((r: any) => ({
      id: r.content_id,
      content_id: r.content_id,
      content_type: r.content_type,
      type: r.content_type,
      name: r.title ?? r.content_id ?? '',
      poster: r.poster ?? undefined,
      season: r.season ?? null,
      episode: r.episode ?? null,
      watchedAt: r.watched_at ?? Date.now(),
    }));
  } catch { return []; }
}

// ─── Upsert Continue Watching ─────────────────────────────────────────────────

export async function upsertCW(userId: string, item: {
  id: string; type: string; name: string; poster?: string;
  progress: number; duration: number; videoId?: string;
  season?: number; episode?: number;
}): Promise<void> {
  const tok = _userToken;
  if (!tok || !userId || item.duration <= 0) return;

  const progressKey = item.type === 'movie' ? item.id
    : item.season && item.episode ? `${item.id}_s${item.season}e${item.episode}` : item.id;

  // Formato ufficiale NuvioTV: MILLISECONDI (come il mobile app)
  // progress * duration * 1000 = posizione in ms
  const posMs = Math.round(item.progress * item.duration * 1000);
  const durMs = Math.round(item.duration * 1000);

  const entry = {
    content_id: item.id,
    content_type: item.type,
    video_id: item.videoId ?? item.id,
    season: item.season ?? null,
    episode: item.episode ?? null,
    position: posMs,
    duration: durMs,
    last_watched: Date.now(),
    progress_key: progressKey,
  };

  try {
    await rpc('sync_push_watch_progress', { p_entries: [entry] }, tok);
  } catch {
    // Fallback REST — senza name/poster (non esistono nel schema)
    await fetch(`${SUPABASE_URL}/rest/v1/watch_progress`, {
      method: 'POST',
      headers: { ...authHeaders(tok), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId, profile_id: 1, ...entry }),
    }).catch(() => {});
  }
}

export async function removeCW(userId: string, contentId: string): Promise<void> {
  const tok = _userToken;
  if (!tok) return;
  // Usa sync_delete_watch_progress se disponibile, altrimenti REST DELETE
  try {
    await rpc('sync_delete_watch_progress', { p_content_ids: [contentId] }, tok);
  } catch {
    await fetch(
      `${SUPABASE_URL}/rest/v1/watch_progress?user_id=eq.${userId}&content_id=eq.${encodeURIComponent(contentId)}`,
      { method: 'DELETE', headers: { ...authHeaders(tok), Prefer: 'return=minimal' } }
    ).catch(() => {});
  }
}

// ─── Watched Items ─────────────────────────────────────────────────────────────

export async function markWatched(userId: string, contentId: string, contentType = 'movie', season?: number, episode?: number): Promise<void> {
  const tok = _userToken;
  if (!tok) return;
  const item = { content_id: contentId, content_type: contentType, title: contentId, season: season ?? null, episode: episode ?? null, watched_at: Date.now() };
  try {
    await rpc('sync_push_watched_items', { p_items: [item] }, tok);
  } catch {
    await fetch(`${SUPABASE_URL}/rest/v1/watched_items`, {
      method: 'POST',
      headers: { ...authHeaders(tok), Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId, profile_id: 1, ...item }),
    }).catch(() => {});
  }
}

export async function unmarkWatched(userId: string, contentId: string, contentType = "movie"): Promise<void> {
  const tok = _userToken;
  if (!tok) return;
  try {
    await rpc('sync_delete_watched_items', { p_content_ids: [contentId] }, tok);
  } catch {
    await fetch(
      `${SUPABASE_URL}/rest/v1/watched_items?user_id=eq.${userId}&content_id=eq.${encodeURIComponent(contentId)}`,
      { method: 'DELETE', headers: { ...authHeaders(tok), Prefer: 'return=minimal' } }
    ).catch(() => {});
  }
}

// ─── Library ──────────────────────────────────────────────────────────────────

export async function removeFromLibrary(userId: string, contentId: string): Promise<void> {
  const tok = _userToken;
  if (!tok) return;
  await fetch(`${SUPABASE_URL}/rest/v1/library_items?user_id=eq.${userId}&content_id=eq.${encodeURIComponent(contentId)}`,
    { method: 'DELETE', headers: { ...authHeaders(tok), Prefer: 'return=minimal' } }
  ).catch(() => {});
}

// ─── Addons ───────────────────────────────────────────────────────────────────

export async function getNuvioAddons(userId: string, userToken?: string): Promise<any[]> {
  const tok = userToken ?? _userToken;
  if (!tok) return [];
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/addons?select=url,name,sort_order&user_id=eq.${userId}&order=sort_order.asc`,
    { headers: authHeaders(tok) }
  );
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return [];

  // Fetcha il manifest per ogni addon (per avere catalogs, resources, types)
  const addons = await Promise.allSettled(
    rows.map(async (r: any) => {
      const manifestUrl = r.url.endsWith('manifest.json') ? r.url : r.url.replace(/\/?$/, '/manifest.json');
      try {
        const mRes = await fetch(manifestUrl, { signal: AbortSignal.timeout(5000) });
        if (mRes.ok) {
          const m = await mRes.json();
          return {
            id: m.id ?? r.url,
            url: r.url,
            name: m.name ?? r.name ?? r.url,
            version: m.version ?? '',
            description: m.description ?? '',
            types: m.types ?? [],
            catalogs: m.catalogs ?? [],
            resources: Array.isArray(m.resources) ? m.resources.map((res: any) => typeof res === 'string' ? res : res.name) : [],
            logo: m.logo ?? m.icon ?? null,
          };
        }
      } catch { /* manifest non raggiungibile */ }
      // Fallback senza manifest
      return { id: r.url, url: r.url, name: r.name ?? r.url, version: '', description: '', types: [], catalogs: [], resources: [], logo: null };
    })
  );
  return addons.filter(r => r.status === 'fulfilled').map((r: any) => r.value);
}

// ─── Account Stats ────────────────────────────────────────────────────────────

export interface AccountStats {
  totalMovies: number; totalEpisodes: number; totalWatched: number;
  librarySize: number; watchTimeHours: number;
}

export async function getAccountStats(userId: string, userToken?: string): Promise<AccountStats> {
  const tok = userToken ?? _userToken;
  if (!tok || !userId) return { totalMovies: 0, totalEpisodes: 0, totalWatched: 0, librarySize: 0, watchTimeHours: 0 };
  try {
    const [watchedItems, watchProgress, libraryItems] = await Promise.all([
      rpc('sync_pull_watched_items', {}, tok).then((d: any) => { console.log('[stats] watched_items:', d); return Array.isArray(d) ? d : []; }).catch((e: any) => { console.error('[stats] watched_items ERR:', e.message); return [] as any[]; }),
      rpc('sync_pull_watch_progress', {}, tok).then((d: any) => { console.log('[stats] watch_progress:', Array.isArray(d) ? d.length : d); return Array.isArray(d) ? d : []; }).catch((e: any) => { console.error('[stats] watch_progress ERR:', e.message); return [] as any[]; }),
      rpc('sync_pull_library', {}, tok).then((d: any) => { console.log('[stats] library:', Array.isArray(d) ? d.length : d); return Array.isArray(d) ? d : []; }).catch((e: any) => { console.error('[stats] library ERR:', e.message); return [] as any[]; }),
    ]);
    // Conta correttamente: watched_items ha sia title-level (season=null) che episodi (season!=null)
    // title-level film = content_type=movie AND season IS NULL
    // title-level serie = content_type=series AND season IS NULL  
    // episodi = season IS NOT NULL
    const movies = (watchedItems as any[]).filter((w: any) => w.content_type === 'movie' && (w.season == null || w.season === undefined)).length;
    const episodes = (watchedItems as any[]).filter((w: any) => w.season != null && w.episode != null).length;
    const seriesWatched = (watchedItems as any[]).filter((w: any) => w.content_type === 'series' && (w.season == null || w.season === undefined)).length;
    // Position: auto-detect ms vs sec
    const watchTimeSec = (watchProgress as any[]).reduce((acc: number, w: any) => {
      const pos = w.position ?? 0;
      return acc + (pos > 3_600_000 ? pos / 1000 : pos);
    }, 0);
    console.log(`[stats] movies=${movies} episodes=${episodes} series=${seriesWatched} library=${(libraryItems as any[]).length} watchTime=${Math.round(watchTimeSec/3600)}h`);
    return {
      totalMovies: movies,
      totalEpisodes: episodes,
      totalWatched: movies + seriesWatched,
      librarySize: (libraryItems as any[]).length,
      watchTimeHours: Math.round(watchTimeSec / 3600),
    };
  } catch { return { totalMovies: 0, totalEpisodes: 0, totalWatched: 0, librarySize: 0, watchTimeHours: 0 }; }
}

// ─── Avatar Catalog ───────────────────────────────────────────────────────────

export interface SupabaseAvatar { id: string; display_name: string; storage_path: string; category?: string; bg_color?: string; }

export async function getAvatarCatalog(): Promise<SupabaseAvatar[]> {
  // Prova con token utente prima
  const tok = _userToken;
  try {
    const endpoint = `${SUPABASE_URL}/rest/v1/rpc/get_avatar_catalog`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON,
    };
    // Se c'è token usiamolo, altrimenti anon
    if (tok) headers['Authorization'] = `Bearer ${tok}`;
    else headers['Authorization'] = `Bearer ${SUPABASE_ANON}`;
    const res = await fetch(endpoint, { method: 'POST', headers, body: '{}' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch { /* fallback */ }
  // Fallback: leggi avatar_catalog direttamente (potrebbe essere pubblica)
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/avatar_catalog?select=*&is_active=eq.true&order=sort_order.asc`, {
      headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch { /* fallback */ }
  return [];
}

// ─── Alias per compatibilità ──────────────────────────────────────────────────
export async function markNuvioWatched(userId: string, contentId: string, contentType = 'movie') { return markWatched(userId, contentId, contentType); }
export async function removeNuvioWatched(userId: string, contentId: string, _contentType = 'movie') { return unmarkWatched(userId, contentId); }

// traktScrobble stub (usato da VideoPlayer - la vera impl è in trakt.ts)
export async function traktScrobble(_token: string, _action: string, _item: any, _progress?: number): Promise<void> {
  // Stub - la vera implementazione è in api/trakt.ts
}
