/// <reference types="vite/client" />
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Addon, Profile, WatchEntry, NuvioUser, TraktAuth,
  SimklAuth, MALAuth, AppSettings, DEFAULT_SETTINGS,
} from './types';

export const CINEMETA: Addon = {
  url: 'https://v3-cinemeta.strem.io',
  id: 'com.linvo.cinemeta',
  name: 'Cinemeta',
  version: '3.0.0',
  description: 'Official Stremio metadata addon',
  types: ['movie', 'series'],
  catalogs: [
    { type: 'movie',  id: 'top', name: 'Film Popolari' },
    { type: 'series', id: 'top', name: 'Serie Popolari' },
  ],
  resources: ['catalog', 'meta', 'stream'],
  logo: 'https://v3-cinemeta.strem.io/static/imgs/logo.png',
};

export const DEFAULT_PROFILE: Profile = {
  id: 'default',
  name: 'Principale',
  avatar: 'red',
  avatarUrl: '',
  color: '#7c3aed',
  isKids: false,
  createdAt: Date.now(),
};

interface Store {
  profiles: Profile[];
  activeProfileId: string;
  profileSelected: boolean;
  addProfile: (p: Omit<Profile, 'id' | 'createdAt'>) => void;
  updateProfile: (id: string, patch: Partial<Profile>) => void;
  removeProfile: (id: string) => void;
  setActiveProfile: (id: string) => void;
  setProfileSelected: (v: boolean) => void;
  addons: Addon[];
  addAddon: (a: Addon) => void;
  removeAddon: (id: string) => void;
  setAddons: (addons: Addon[]) => void;
  reorderAddon: (id: string, dir: 'up' | 'down') => void;
  updateAddon: (id: string, patch: Partial<Addon>) => void;
  watchHistory: Record<string, WatchEntry[]>;
  upsertWatch: (e: Omit<WatchEntry, 'watchedAt'>) => void;
  clearHistory: () => void;
  removeWatch: (id: string) => void;
  nuvioUser: NuvioUser | null;
  traktAuth: TraktAuth | null;
  simklAuth: SimklAuth | null;
  malAuth: MALAuth | null;
  setNuvioUser: (u: NuvioUser | null) => void;
  setTraktAuth: (a: TraktAuth | null) => void;
  setSimklAuth: (a: SimklAuth | null) => void;
  setMALAuth: (a: MALAuth | null) => void;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  posterOrientation: Record<string, 'horizontal' | 'vertical'>;
  setPosterOrientation: (contentId: string, orientation: 'horizontal' | 'vertical') => void;
  // Immagini custom per servizi streaming (serviceId -> dataURL o URL)
  streamingCustomImages: Record<string, string>;
  setStreamingCustomImage: (serviceId: string, imageUrl: string | null) => void;
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      profiles: [DEFAULT_PROFILE],
      activeProfileId: DEFAULT_PROFILE.id,
      profileSelected: false,
      addProfile: (data) => set((s) => ({
        profiles: [...s.profiles, { ...data, id: crypto.randomUUID(), createdAt: Date.now() }],
      })),
      updateProfile: (id, patch) => set((s) => ({
        profiles: s.profiles.map((p) => p.id === id ? { ...p, ...patch } : p),
      })),
      removeProfile: (id) => set((s) => ({
        profiles: s.profiles.filter((p) => p.id !== id && p.id !== DEFAULT_PROFILE.id),
        activeProfileId: s.activeProfileId === id ? DEFAULT_PROFILE.id : s.activeProfileId,
      })),
      setActiveProfile: (id) => set({ activeProfileId: id }),
      setProfileSelected: (v) => set({ profileSelected: v }),
      addons: [CINEMETA],
      addAddon: (a) => set((s) => ({ addons: [...s.addons.filter((x) => x.id !== a.id), a] })),
      removeAddon: (id) => set((s) => ({ addons: s.addons.filter((a) => a.id !== id) })),
      setAddons: (addons) => set({ addons }),
      updateAddon: (id, patch) => set((s) => ({
        addons: s.addons.map((a) => a.id === id ? { ...a, ...patch } : a),
      })),
      reorderAddon: (id, dir) => set((s) => {
        const i = s.addons.findIndex((a) => a.id === id);
        if (i === -1) return s;
        const arr = [...s.addons];
        const t = dir === 'up' ? i - 1 : i + 1;
        if (t < 0 || t >= arr.length) return s;
        [arr[i], arr[t]] = [arr[t], arr[i]];
        return { addons: arr };
      }),
      watchHistory: {},
      upsertWatch: (entry) => set((s) => {
        const pid = s.activeProfileId;
        const prev = s.watchHistory[pid] ?? [];
        return {
          watchHistory: {
            ...s.watchHistory,
            [pid]: [{ ...entry, watchedAt: Date.now() }, ...prev.filter((h) => h.id !== entry.id)].slice(0, 500),
          },
        };
      }),
      clearHistory: () => set((s) => ({ watchHistory: { ...s.watchHistory, [s.activeProfileId]: [] } })),
      removeWatch: (id: string) => set((s) => {
        const pid = s.activeProfileId;
        return { watchHistory: { ...s.watchHistory, [pid]: (s.watchHistory[pid] ?? []).filter(h => h.id !== id) } };
      }),
      nuvioUser: null,
      traktAuth: null,
      simklAuth: null,
      malAuth: null,
      setNuvioUser: (u) => set({ nuvioUser: u }),
      setTraktAuth: (a) => set({ traktAuth: a }),
      setSimklAuth: (a) => set({ simklAuth: a }),
      setMALAuth: (a) => set({ malAuth: a }),
      settings: DEFAULT_SETTINGS,
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      posterOrientation: {},
      setPosterOrientation: (contentId, orientation) => set((s) => ({
        posterOrientation: { ...s.posterOrientation, [contentId]: orientation }
      })),
      // Immagini custom streaming
      streamingCustomImages: {},
      setStreamingCustomImage: (serviceId, imageUrl) => set((s) => {
        const next: Record<string, string> = { ...s.streamingCustomImages };
        if (imageUrl === null) delete next[serviceId];
        else next[serviceId] = imageUrl;
        return { streamingCustomImages: next };
      }),
    }),
    {
      name: 'nuvio-v1',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (old: any) => {
        let addons = old?.addons;
        if (!addons || addons.length === 0) {
          for (const name of ['nuvio-app', 'nuvio-desktop-v2', 'nuvio-desktop']) {
            try {
              const raw = localStorage.getItem(name);
              if (raw) {
                const a = JSON.parse(raw)?.state?.addons;
                if (a?.length > 0) { addons = a; break; }
              }
            } catch { /* ignore */ }
          }
        }
        return {
          ...old,
          addons: addons?.length ? addons : [CINEMETA],
          settings: { ...DEFAULT_SETTINGS, ...(old?.settings ?? {}) },
          profiles: old?.profiles?.length ? old.profiles : [DEFAULT_PROFILE],
          profileSelected: false,
          posterOrientation: old?.posterOrientation || {},
          streamingCustomImages: old?.streamingCustomImages || {},
        };
      },
    }
  )
);

export const useActiveProfile = () => {
  const { profiles, activeProfileId } = useStore();
  return profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? DEFAULT_PROFILE;
};

export const useWatchHistory = () => {
  const { watchHistory, activeProfileId } = useStore();
  return watchHistory[activeProfileId] ?? [];
};