import { CONFIG } from '../lib/config';

const BASE = 'https://api.trakt.tv';

const h = (token?: string) => ({
  'Content-Type': 'application/json',
  'trakt-api-version': '2',
  'trakt-api-key': CONFIG.trakt.clientId,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export interface TraktAuth {
  username: string;
  name: string;
  avatar?: string;
  token: string;
  refreshToken: string;
  expiresAt: number;
}

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
    body: JSON.stringify({ client_id: CONFIG.trakt.clientId }),
  });
  if (!res.ok) throw new Error('Impossibile ottenere device code da Trakt');
  return res.json();
}

export async function pollTraktToken(deviceCode: string): Promise<{
  access_token: string; refresh_token: string; expires_in: number;
} | null> {
  const res = await fetch(`${BASE}/oauth/device/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: deviceCode,
      client_id: CONFIG.trakt.clientId,
      client_secret: CONFIG.trakt.clientSecret,
    }),
  });
  if (res.status === 400) return null;
  if (res.status === 200) return res.json();
  throw new Error(`Trakt auth error: ${res.status}`);
}

export async function getTraktProfile(token: string): Promise<TraktAuth> {
  const res = await fetch(`${BASE}/users/me?extended=full`, { headers: h(token) });
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

// ─── Watched History ──────────────────────────────────────────────────────────

export interface TraktHistoryItem {
  id: number;
  watched_at: string;
  type: 'movie' | 'episode';
  movie?: { title: string; year: number; ids: { trakt: number; imdb: string; tmdb: number } };
  episode?: { season: number; number: number; title: string; ids: { trakt: number; tvdb: number; imdb: string; tmdb: number } };
  show?: { title: string; year: number; ids: { trakt: number; imdb: string; tmdb: number } };
}

export async function getTraktHistory(token: string, limit = 50): Promise<TraktHistoryItem[]> {
  const res = await fetch(`${BASE}/sync/history?limit=${limit}&extended=full`, { headers: h(token) });
  if (!res.ok) return [];
  return res.json();
}

export async function getTraktWatchlist(token: string, type: 'movies' | 'shows') {
  const res = await fetch(`${BASE}/sync/watchlist/${type}?extended=full`, { headers: h(token) });
  if (!res.ok) return [];
  return res.json();
}

export async function markTraktWatched(
  token: string,
  type: 'movie' | 'episode',
  ids: { imdb?: string; tmdb?: number; trakt?: number },
  watchedAt = new Date().toISOString()
): Promise<void> {
  const body = type === 'movie'
    ? { movies: [{ watched_at: watchedAt, ids }] }
    : { episodes: [{ watched_at: watchedAt, ids }] };
  await fetch(`${BASE}/sync/history`, {
    method: 'POST', headers: h(token), body: JSON.stringify(body),
  });
}
