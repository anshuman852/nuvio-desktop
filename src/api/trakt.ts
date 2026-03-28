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
  throw new Error(`Trakt auth: ${res.status}`);
}

export async function getTraktProfile(token: string): Promise<TraktAuth> {
  const res = await fetch(`${BASE}/users/me?extended=full`, { headers: h(token) });
  if (!res.ok) throw new Error('Profilo Trakt non disponibile');
  const d = await res.json();
  return { username: d.username, name: d.name ?? d.username, avatar: d.images?.avatar?.full, token, refreshToken: '', expiresAt: 0 };
}

// ─── History (episodi visti) ──────────────────────────────────────────────────

export async function getTraktHistory(token: string, limit = 100): Promise<any[]> {
  const res = await fetch(`${BASE}/sync/history?limit=${limit}&extended=full`, { headers: h(token) });
  if (!res.ok) return [];
  return res.json();
}

// ─── Watched (elenco completo film/serie viste) ───────────────────────────────

export async function getTraktWatchedMovies(token: string): Promise<any[]> {
  const res = await fetch(`${BASE}/sync/watched/movies?extended=full,images`, { headers: h(token) });
  if (!res.ok) return [];
  return res.json();
}

export async function getTraktWatchedShows(token: string): Promise<any[]> {
  const res = await fetch(`${BASE}/sync/watched/shows?extended=full,images`, { headers: h(token) });
  if (!res.ok) return [];
  return res.json();
}

// ─── Watchlist ────────────────────────────────────────────────────────────────

export async function getTraktWatchlist(token: string, type: 'movies' | 'shows'): Promise<any[]> {
  const res = await fetch(`${BASE}/sync/watchlist/${type}?extended=full`, { headers: h(token) });
  if (!res.ok) return [];
  return res.json();
}

// ─── Ratings ──────────────────────────────────────────────────────────────────

export async function getTraktRatings(token: string, type: 'movies' | 'shows'): Promise<any[]> {
  const res = await fetch(`${BASE}/sync/ratings/${type}?extended=full`, { headers: h(token) });
  if (!res.ok) return [];
  return res.json();
}

// ─── Mark as watched ─────────────────────────────────────────────────────────

export async function markTraktWatched(
  token: string,
  type: 'movie' | 'show' | 'season' | 'episode',
  ids: { trakt?: number; imdb?: string; tmdb?: number; slug?: string },
  extra?: { season?: number; episode?: number },
  watchedAt = new Date().toISOString()
): Promise<{ added: number; not_found: number }> {
  let body: any;
  if (type === 'movie') {
    body = { movies: [{ watched_at: watchedAt, ids }] };
  } else if (type === 'show') {
    // Marca tutti gli episodi della serie come visti
    body = { shows: [{ watched_at: watchedAt, ids }] };
  } else if (type === 'season') {
    body = { shows: [{ ids, seasons: [{ number: extra!.season, watched_at: watchedAt }] }] };
  } else {
    body = { episodes: [{ watched_at: watchedAt, ids }] };
  }
  const res = await fetch(`${BASE}/sync/history`, {
    method: 'POST', headers: h(token), body: JSON.stringify(body),
  });
  if (!res.ok) return { added: 0, not_found: 1 };
  const d = await res.json();
  return { added: d.added?.movies ?? d.added?.episodes ?? 0, not_found: d.not_found?.movies?.length ?? 0 };
}

// ─── Remove from watched ─────────────────────────────────────────────────────

export async function removeTraktWatched(
  token: string,
  type: 'movie' | 'show',
  ids: { trakt?: number; imdb?: string; tmdb?: number }
): Promise<void> {
  const body = type === 'movie'
    ? { movies: [{ ids }] }
    : { shows: [{ ids }] };
  await fetch(`${BASE}/sync/history/remove`, {
    method: 'POST', headers: h(token), body: JSON.stringify(body),
  });
}

// ─── Rating ───────────────────────────────────────────────────────────────────

export async function rateTraktItem(
  token: string,
  type: 'movie' | 'show',
  ids: { trakt?: number; imdb?: string },
  rating: number // 1-10
): Promise<void> {
  const body = type === 'movie'
    ? { movies: [{ rating, ids }] }
    : { shows: [{ rating, ids }] };
  await fetch(`${BASE}/sync/ratings`, {
    method: 'POST', headers: h(token), body: JSON.stringify(body),
  });
}

// ─── Aggiungi/rimuovi watchlist ───────────────────────────────────────────────

export async function toggleTraktWatchlist(
  token: string,
  type: 'movie' | 'show',
  ids: { trakt?: number; imdb?: string },
  add: boolean
): Promise<void> {
  const body = type === 'movie' ? { movies: [{ ids }] } : { shows: [{ ids }] };
  const endpoint = add ? `${BASE}/sync/watchlist` : `${BASE}/sync/watchlist/remove`;
  await fetch(endpoint, { method: 'POST', headers: h(token), body: JSON.stringify(body) });
}
