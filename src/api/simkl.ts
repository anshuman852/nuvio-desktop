import { CONFIG } from '../lib/config';

const BASE = 'https://api.simkl.com';
const h = (token?: string) => ({
  'Content-Type': 'application/json',
  'simkl-api-key': CONFIG.simkl.clientId,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export interface SimklAuth {
  id: number;
  username: string;
  name: string;
  avatar?: string;
  token: string;
}

export async function getSimklPin(): Promise<{
  user_code: string; verification_url: string; expires_in: number; interval: number;
}> {
  const res = await fetch(`${BASE}/oauth/pin?client_id=${CONFIG.simkl.clientId}`);
  if (!res.ok) throw new Error('Impossibile ottenere PIN da Simkl');
  return res.json();
}

export async function pollSimklToken(userCode: string): Promise<string | null> {
  const res = await fetch(`${BASE}/oauth/pin/${userCode}?client_id=${CONFIG.simkl.clientId}`);
  if (res.status === 200) {
    const data = await res.json();
    return data.access_token ?? null;
  }
  return null;
}

export async function getSimklProfile(token: string): Promise<SimklAuth> {
  const res = await fetch(`${BASE}/users/settings`, { headers: h(token) });
  if (!res.ok) throw new Error('Impossibile caricare profilo Simkl');
  const data = await res.json();
  return {
    id: data.user?.pk,
    username: data.user?.name,
    name: data.user?.name,
    avatar: data.user?.avatar,
    token,
  };
}

export interface SimklHistoryItem {
  last_watched_at: string;
  status: string;
  show?: { title: string; ids: { simkl: number; imdb: string; tmdb: string } };
  movie?: { title: string; ids: { simkl: number; imdb: string; tmdb: string } };
}

export async function getSimklHistory(token: string): Promise<SimklHistoryItem[]> {
  const res = await fetch(`${BASE}/sync/all-items/movies,shows?episode_watched_at=yes`, {
    headers: h(token),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return [
    ...(data.movies ?? []).map((m: any) => ({ ...m, type: 'movie' })),
    ...(data.shows ?? []).map((s: any) => ({ ...s, type: 'show' })),
  ];
}
