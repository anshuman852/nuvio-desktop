/**
 * Trakt.tv API Client
 * Docs: https://trakt.docs.apiary.io/
 * Usiamo il Device Auth flow (no browser redirect necessario)
 */

const CLIENT_ID = 'YOUR_TRAKT_CLIENT_ID'; // da sostituire con il tuo app client id
const BASE = 'https://api.trakt.tv';

const headers = (token?: string) => ({
  'Content-Type': 'application/json',
  'trakt-api-version': '2',
  'trakt-api-key': CLIENT_ID,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export interface TraktUser {
  username: string;
  name: string;
  avatar?: string;
  token: string;
  refreshToken: string;
  expiresAt: number;
}

// ─── Device Auth Flow ─────────────────────────────────────────────────────────

export interface TraktDeviceCode {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

export async function getTraktDeviceCode(): Promise<TraktDeviceCode> {
  const res = await fetch(`${BASE}/oauth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID }),
  });
  if (!res.ok) throw new Error('Impossibile ottenere device code da Trakt');
  return res.json();
}

export async function pollTraktToken(
  deviceCode: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const res = await fetch(`${BASE}/oauth/device/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: deviceCode,
      client_id: CLIENT_ID,
      client_secret: 'YOUR_TRAKT_CLIENT_SECRET',
    }),
  });
  if (res.status === 400) return null; // pending
  if (res.status === 200) return res.json();
  throw new Error(`Trakt auth error: ${res.status}`);
}

export async function getTraktProfile(token: string): Promise<TraktUser> {
  const res = await fetch(`${BASE}/users/me?extended=full`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error('Impossibile caricare profilo Trakt');
  const data = await res.json();
  return {
    username: data.username,
    name: data.name ?? data.username,
    avatar: data.images?.avatar?.full,
    token,
    refreshToken: '',
    expiresAt: 0,
  };
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export async function markWatched(
  token: string,
  type: 'movie' | 'episode',
  ids: { imdb?: string; tmdb?: number; trakt?: number },
  watchedAt = new Date().toISOString()
): Promise<void> {
  const body =
    type === 'movie'
      ? { movies: [{ watched_at: watchedAt, ids }] }
      : { episodes: [{ watched_at: watchedAt, ids }] };

  await fetch(`${BASE}/sync/history`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
}

export async function getTraktWatchlist(token: string, type: 'movies' | 'shows') {
  const res = await fetch(`${BASE}/sync/watchlist/${type}`, {
    headers: headers(token),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function getTraktHistory(token: string, type: 'movies' | 'episodes', limit = 20) {
  const res = await fetch(`${BASE}/sync/history/${type}?limit=${limit}`, {
    headers: headers(token),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function getTraktRatings(token: string) {
  const res = await fetch(`${BASE}/sync/ratings`, {
    headers: headers(token),
  });
  if (!res.ok) return [];
  return res.json();
}
