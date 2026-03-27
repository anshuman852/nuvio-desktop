/// <reference types="vite/client" />
/**
 * Client API Nuvio + Supabase sync.
 * Nuvio usa Supabase come backend.
 */
import { NuvioUser } from '../lib/types';

const NUVIO_API = 'https://api.nuvioapp.space';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

async function api(path: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(`${NUVIO_API}${path}`, {
    ...opts,
    headers: { ...headers(), ...(opts.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function nuvioLogin(email: string, password: string): Promise<NuvioUser> {
  const data = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return { ...data.user, token: data.token };
}

export async function nuvioLogout(): Promise<void> {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
}

// ─── Continue Watching ────────────────────────────────────────────────────────

export interface NuvioCW {
  id: string;
  type: string;
  name: string;
  poster?: string;
  videoId?: string;
  season?: number;
  episode?: number;
  progress: number;
  duration: number;
  updatedAt: string;
}

export async function getContinueWatching(): Promise<NuvioCW[]> {
  const data = await api('/continue-watching');
  return data.items ?? [];
}

export async function updateProgress(
  id: string,
  type: string,
  videoId: string,
  position: number,
  duration: number,
  meta?: { name?: string; poster?: string; season?: number; episode?: number }
): Promise<void> {
  await api('/continue-watching/update', {
    method: 'POST',
    body: JSON.stringify({
      id, type, videoId, position, duration,
      progress: duration > 0 ? position / duration : 0,
      ...meta,
    }),
  });
}

// ─── Supabase sync ────────────────────────────────────────────────────────────

export function createSupabaseClient(url: string, key: string) {
  if (!url || !key) return null;
  return {
    from: (table: string) => ({
      select: async (cols = '*') => {
        const res = await fetch(`${url}/rest/v1/${table}?select=${cols}`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        });
        return res.json();
      },
      upsert: async (data: any) => {
        const res = await fetch(`${url}/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify(data),
        });
        return res.json();
      },
    }),
  };
}
