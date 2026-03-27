/// <reference types="vite/client" />
import { MALAuth } from '../lib/types';

const BASE = 'https://api.myanimelist.net/v2';
const CLIENT_ID = import.meta.env.VITE_MAL_CLIENT_ID ?? '';
const h = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

function genVerifier() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function getMALAuthUrl(): { url: string; codeVerifier: string } {
  const codeVerifier = genVerifier();
  const url = `https://myanimelist.net/v1/oauth2/authorize?response_type=code&client_id=${CLIENT_ID}&code_challenge=${codeVerifier}&code_challenge_method=plain`;
  return { url, codeVerifier };
}

export async function exchangeMALCode(code: string, codeVerifier: string): Promise<any> {
  const res = await fetch('https://myanimelist.net/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, grant_type: 'authorization_code', code, code_verifier: codeVerifier }),
  });
  if (!res.ok) throw new Error('MAL auth failed');
  return res.json();
}

export async function getMALProfile(token: string): Promise<MALAuth> {
  const res = await fetch(`${BASE}/users/@me?fields=id,name,picture`, { headers: h(token) });
  if (!res.ok) throw new Error('Impossibile caricare profilo MAL');
  const data = await res.json();
  return { id: data.id, name: data.name, picture: data.picture, token, refreshToken: '', expiresAt: 0 };
}

export async function getMALAnimeList(token: string): Promise<any[]> {
  const params = new URLSearchParams({ fields: 'list_status,title,main_picture,num_episodes', limit: '100', status: 'watching' });
  const res = await fetch(`${BASE}/users/@me/animelist?${params}`, { headers: h(token) });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data ?? [];
}
