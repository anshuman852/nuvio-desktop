/// <reference types="vite/client" />
import { TraktAuth } from '../lib/types';

const BASE = 'https://api.trakt.tv';
const CLIENT_ID = import.meta.env.VITE_TRAKT_CLIENT_ID ?? '';
const CLIENT_SECRET = import.meta.env.VITE_TRAKT_CLIENT_SECRET ?? '';

const h = (token?: string) => ({
  'Content-Type': 'application/json',
  'trakt-api-version': '2',
  'trakt-api-key': CLIENT_ID,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export async function getTraktDeviceCode() {
  const res = await fetch(`${BASE}/oauth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID }),
  });
  if (!res.ok) throw new Error('Impossibile ottenere device code da Trakt');
  return res.json();
}

export async function pollTraktToken(deviceCode: string): Promise<any | null> {
  const res = await fetch(`${BASE}/oauth/device/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: deviceCode, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
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
    token, refreshToken: '', expiresAt: 0,
  };
}

export async function getTraktHistory(token: string, limit = 100): Promise<any[]> {
  const res = await fetch(`${BASE}/sync/history?limit=${limit}&extended=full`, { headers: h(token) });
  if (!res.ok) return [];
  return res.json();
}

export async function getTraktWatchlist(token: string, type: 'movies' | 'shows'): Promise<any[]> {
  const res = await fetch(`${BASE}/sync/watchlist/${type}?extended=full`, { headers: h(token) });
  if (!res.ok) return [];
  return res.json();
}

export async function markTraktWatched(token: string, type: 'movie' | 'episode', ids: any, watchedAt = new Date().toISOString()) {
  const body = type === 'movie' ? { movies: [{ watched_at: watchedAt, ids }] } : { episodes: [{ watched_at: watchedAt, ids }] };
  await fetch(`${BASE}/sync/history`, { method: 'POST', headers: h(token), body: JSON.stringify(body) });
}
