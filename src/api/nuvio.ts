/**
 * Nuvio API Client
 * Gestisce autenticazione, Continue Watching e sync con Nuvio
 */
import axios from "axios";
import type { NuvioUser, NuvioContinueWatching, ContentType } from "../types";

const BASE_URL = "https://api.nuvioapp.space"; // aggiorna se cambia

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
});

// Inietta il token auth in ogni richiesta
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<NuvioUser> {
  const { data } = await api.post<{ user: NuvioUser; token: string }>("/auth/login", {
    email,
    password,
  });
  return { ...data.user, token: data.token };
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } catch {
    // ignora errori logout
  }
}

// ─── Continue Watching ────────────────────────────────────────────────────────

export async function getContinueWatching(): Promise<NuvioContinueWatching[]> {
  const { data } = await api.get<{ items: NuvioContinueWatching[] }>(
    "/continue-watching"
  );
  return data.items ?? [];
}

export async function updateProgress(
  id: string,
  type: ContentType,
  videoId: string,
  position: number,
  duration: number,
  meta?: { name?: string; poster?: string; season?: number; episode?: number }
): Promise<void> {
  await api.post("/continue-watching/update", {
    id,
    type,
    videoId,
    position,
    duration,
    progress: duration > 0 ? position / duration : 0,
    ...meta,
  });
}

export async function removeFromContinueWatching(id: string): Promise<void> {
  await api.delete(`/continue-watching/${id}`);
}

// ─── Library Sync (da Stremio) ────────────────────────────────────────────────
// Riusa la logica del tuo stremio-nuvio-importer

export async function syncLibrary(
  items: Array<{ id: string; type: ContentType; name: string; poster?: string }>
): Promise<{ synced: number; errors: number }> {
  const { data } = await api.post<{ synced: number; errors: number }>(
    "/library/sync",
    { items }
  );
  return data;
}
