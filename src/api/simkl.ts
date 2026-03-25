/**
 * Simkl API Client
 * Docs: https://simkl.docs.apiary.io/
 */

const CLIENT_ID = 'YOUR_SIMKL_CLIENT_ID';
const BASE = 'https://api.simkl.com';

const headers = (token?: string) => ({
  'Content-Type': 'application/json',
  'simkl-api-key': CLIENT_ID,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export interface SimklUser {
  id: number;
  username: string;
  name: string;
  avatar?: string;
  token: string;
}

// ─── OAuth PIN Flow ───────────────────────────────────────────────────────────

export async function getSimklPin(): Promise<{ user_code: string; verification_url: string; expires_in: number; interval: number }> {
  const res = await fetch(`${BASE}/oauth/pin?client_id=${CLIENT_ID}`);
  if (!res.ok) throw new Error('Impossibile ottenere PIN da Simkl');
  return res.json();
}

export async function pollSimklToken(userCode: string): Promise<string | null> {
  const res = await fetch(`${BASE}/oauth/pin/${userCode}?client_id=${CLIENT_ID}`);
  if (res.status === 200) {
    const data = await res.json();
    return data.access_token ?? null;
  }
  return null;
}

export async function getSimklProfile(token: string): Promise<SimklUser> {
  const res = await fetch(`${BASE}/users/settings`, { headers: headers(token) });
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

// ─── Sync ─────────────────────────────────────────────────────────────────────

export async function getSimklWatchlist(token: string) {
  const res = await fetch(`${BASE}/sync/all-items/?episode_watched_at=yes`, {
    headers: headers(token),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function markSimklWatched(
  token: string,
  items: { movies?: any[]; shows?: any[]; episodes?: any[] }
): Promise<void> {
  await fetch(`${BASE}/sync/history`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(items),
  });
}
