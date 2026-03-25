import { CONFIG } from '../lib/config';

const BASE = 'https://api.myanimelist.net/v2';
const h = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

export interface MALAuth {
  id: number;
  name: string;
  picture?: string;
  token: string;
  refreshToken: string;
  expiresAt: number;
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function getMALAuthUrl(): { url: string; codeVerifier: string } {
  const codeVerifier = generateCodeVerifier();
  const url = `https://myanimelist.net/v1/oauth2/authorize?` +
    `response_type=code&client_id=${CONFIG.mal.clientId}&` +
    `code_challenge=${codeVerifier}&code_challenge_method=plain`;
  return { url, codeVerifier };
}

export async function exchangeMALCode(code: string, codeVerifier: string) {
  const res = await fetch('https://myanimelist.net/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CONFIG.mal.clientId,
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) throw new Error('MAL auth exchange failed');
  return res.json();
}

export async function getMALProfile(token: string): Promise<MALAuth> {
  const res = await fetch(`${BASE}/users/@me?fields=id,name,picture`, { headers: h(token) });
  if (!res.ok) throw new Error('Impossibile caricare profilo MAL');
  const data = await res.json();
  return { id: data.id, name: data.name, picture: data.picture, token, refreshToken: '', expiresAt: 0 };
}

export async function getMALAnimeList(token: string) {
  const params = new URLSearchParams({
    fields: 'list_status,title,main_picture,num_episodes',
    limit: '100',
    status: 'watching',
  });
  const res = await fetch(`${BASE}/users/@me/animelist?${params}`, { headers: h(token) });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data ?? [];
}
