/// <reference types="vite/client" />
import { SimklAuth } from '../lib/types';

const BASE = 'https://api.simkl.com';
const CLIENT_ID = import.meta.env.VITE_SIMKL_CLIENT_ID ?? '';
const h = (token?: string) => ({
  'Content-Type': 'application/json',
  'simkl-api-key': CLIENT_ID,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export async function getSimklPin() {
  const res = await fetch(`${BASE}/oauth/pin?client_id=${CLIENT_ID}`);
  if (!res.ok) throw new Error('Impossibile ottenere PIN da Simkl');
  return res.json();
}

export async function pollSimklToken(userCode: string): Promise<string | null> {
  const res = await fetch(`${BASE}/oauth/pin/${userCode}?client_id=${CLIENT_ID}`);
  if (res.status === 200) { const d = await res.json(); return d.access_token ?? null; }
  return null;
}

export async function getSimklProfile(token: string): Promise<SimklAuth> {
  const res = await fetch(`${BASE}/users/settings`, { headers: h(token) });
  if (!res.ok) throw new Error('Impossibile caricare profilo Simkl');
  const data = await res.json();
  return { id: data.user?.pk, username: data.user?.name, name: data.user?.name, avatar: data.user?.avatar, token };
}

export async function getSimklHistory(token: string): Promise<any[]> {
  const res = await fetch(`${BASE}/sync/all-items/movies,shows?episode_watched_at=yes`, { headers: h(token) });
  if (!res.ok) return [];
  const data = await res.json();
  return [
    ...(data.movies ?? []).map((m: any) => ({ ...m, _type: 'movie' })),
    ...(data.shows ?? []).map((s: any) => ({ ...s, _type: 'show' })),
  ];
}
