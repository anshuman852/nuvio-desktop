/**
 * MyAnimeList API Client
 * Docs: https://myanimelist.net/apiconfig/references/api/v2
 * Usa OAuth2 PKCE flow
 */

const CLIENT_ID = 'YOUR_MAL_CLIENT_ID';
const BASE = 'https://api.myanimelist.net/v2';

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

export interface MALUser {
  id: number;
  name: string;
  picture?: string;
  token: string;
  refreshToken: string;
  expiresAt: number;
}

// ─── PKCE Auth ────────────────────────────────────────────────────────────────
// MAL richiede PKCE - generiamo code verifier/challenge lato client

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function getMALAuthUrl(): { url: string; codeVerifier: string } {
  const codeVerifier = generateCodeVerifier();
  const url = `https://myanimelist.net/v1/oauth2/authorize?` +
    `response_type=code&` +
    `client_id=${CLIENT_ID}&` +
    `code_challenge=${codeVerifier}&` +
    `code_challenge_method=plain`;
  return { url, codeVerifier };
}

export async function exchangeMALCode(
  code: string,
  codeVerifier: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch('https://myanimelist.net/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) throw new Error('MAL auth exchange failed');
  return res.json();
}

export async function getMALProfile(token: string): Promise<MALUser> {
  const res = await fetch(`${BASE}/users/@me?fields=id,name,picture`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error('Impossibile caricare profilo MAL');
  const data = await res.json();
  return {
    id: data.id,
    name: data.name,
    picture: data.picture,
    token,
    refreshToken: '',
    expiresAt: 0,
  };
}

// ─── Animelist ────────────────────────────────────────────────────────────────

export async function getMALAnimeList(token: string, status?: string) {
  const params = new URLSearchParams({
    fields: 'list_status,title,main_picture',
    limit: '100',
    ...(status ? { status } : {}),
  });
  const res = await fetch(`${BASE}/users/@me/animelist?${params}`, {
    headers: headers(token),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data ?? [];
}

export async function updateMALStatus(
  token: string,
  animeId: number,
  status: 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch',
  episodesWatched?: number
): Promise<void> {
  const body = new URLSearchParams({ status });
  if (episodesWatched !== undefined) {
    body.append('num_watched_episodes', String(episodesWatched));
  }
  await fetch(`${BASE}/anime/${animeId}/my_list_status`, {
    method: 'PATCH',
    headers: { ...headers(token), 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}
