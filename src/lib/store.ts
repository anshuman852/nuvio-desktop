import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Addon, HistoryEntry, Profile,
  NuvioUser, TraktAuth, SimklAuth, MALAuth,
} from './types';

const storage = createJSONStorage(() => localStorage);

// ─── Default addons ───────────────────────────────────────────────────────────

const DEFAULT_ADDONS: Addon[] = [
  {
    url: 'https://v3-cinemeta.strem.io',
    id: 'com.linvo.cinemeta',
    name: 'Cinemeta',
    version: '3.0.0',
    description: 'The official addon for movie and series catalogs on Stremio',
    types: ['movie', 'series'],
    catalogs: [
      { type: 'movie', id: 'top', name: 'Film Popolari' },
      { type: 'series', id: 'top', name: 'Serie Popolari' },
    ],
    resources: ['catalog', 'meta', 'stream'],
    logo: 'https://v3-cinemeta.strem.io/static/imgs/logo.png',
  },
];

// ─── Default profile ──────────────────────────────────────────────────────────

const DEFAULT_PROFILE: Profile = {
  id: 'default',
  name: 'Principale',
  avatar: '🎬',
  color: '#7c3aed',
  isKids: false,
  createdAt: Date.now(),
};

// ─── Store types ──────────────────────────────────────────────────────────────

interface AppStore {
  // Profili (Netflix-style)
  profiles: Profile[];
  activeProfileId: string;
  addProfile: (profile: Omit<Profile, 'id' | 'createdAt'>) => void;
  updateProfile: (id: string, patch: Partial<Profile>) => void;
  removeProfile: (id: string) => void;
  setActiveProfile: (id: string) => void;

  // Addon
  addons: Addon[];
  addAddon: (addon: Addon) => void;
  removeAddon: (id: string) => void;
  reorderAddon: (id: string, direction: 'up' | 'down') => void;

  // History (per profilo)
  history: Record<string, HistoryEntry[]>;
  addToHistory: (entry: Omit<HistoryEntry, 'watchedAt'>) => void;
  clearHistory: () => void;

  // Auth: Nuvio
  nuvioUser: NuvioUser | null;
  setNuvioUser: (user: NuvioUser | null) => void;

  // Auth: Trakt
  traktAuth: TraktAuth | null;
  setTraktAuth: (auth: TraktAuth | null) => void;

  // Auth: Simkl
  simklAuth: SimklAuth | null;
  setSimklAuth: (auth: SimklAuth | null) => void;

  // Auth: MAL
  malAuth: MALAuth | null;
  setMALAuth: (auth: MALAuth | null) => void;

  // Settings
  settings: {
    mpvPath: string;
    language: string;
    subtitleLanguage: string;
    defaultQuality: string;
    autoplay: boolean;
    skipIntro: boolean;
    hardwareDecode: boolean;
    // RPDB & TMDB
    rpdbKey: string;
    tmdbLanguage: string;
    // Streaming services visibili
    visibleStreamingServices: string[];
    // Personalizzazione UI
    accentColor: string;
    uiDensity: 'comfortable' | 'compact';
  };
  updateSettings: (patch: Partial<AppStore['settings']>) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ── Profili ────────────────────────────────────────────────────────────
      profiles: [DEFAULT_PROFILE],
      activeProfileId: DEFAULT_PROFILE.id,

      addProfile: (data) => {
        const profile: Profile = {
          ...data,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        };
        set((s) => ({ profiles: [...s.profiles, profile] }));
      },

      updateProfile: (id, patch) =>
        set((s) => ({
          profiles: s.profiles.map((p) => p.id === id ? { ...p, ...patch } : p),
        })),

      removeProfile: (id) =>
        set((s) => ({
          profiles: s.profiles.filter((p) => p.id !== id),
          activeProfileId: s.activeProfileId === id ? DEFAULT_PROFILE.id : s.activeProfileId,
        })),

      setActiveProfile: (id) => set({ activeProfileId: id }),

      // ── Addon ──────────────────────────────────────────────────────────────
      addons: DEFAULT_ADDONS,

      addAddon: (addon) =>
        set((s) => ({
          addons: [...s.addons.filter((a) => a.id !== addon.id), addon],
        })),

      removeAddon: (id) =>
        set((s) => ({ addons: s.addons.filter((a) => a.id !== id) })),

      reorderAddon: (id, direction) =>
        set((s) => {
          const idx = s.addons.findIndex((a) => a.id === id);
          if (idx === -1) return s;
          const arr = [...s.addons];
          const target = direction === 'up' ? idx - 1 : idx + 1;
          if (target < 0 || target >= arr.length) return s;
          [arr[idx], arr[target]] = [arr[target], arr[idx]];
          return { addons: arr };
        }),

      // ── History per profilo ────────────────────────────────────────────────
      history: {},

      addToHistory: (entry) =>
        set((s) => {
          const pid = s.activeProfileId;
          const prev = s.history[pid] ?? [];
          return {
            history: {
              ...s.history,
              [pid]: [
                { ...entry, watchedAt: Date.now() },
                ...prev.filter((h) => h.id !== entry.id),
              ].slice(0, 200),
            },
          };
        }),

      clearHistory: () =>
        set((s) => ({
          history: { ...s.history, [s.activeProfileId]: [] },
        })),

      // ── Auth ───────────────────────────────────────────────────────────────
      nuvioUser: null,
      setNuvioUser: (user) => set({ nuvioUser: user }),

      traktAuth: null,
      setTraktAuth: (auth) => set({ traktAuth: auth }),

      simklAuth: null,
      setSimklAuth: (auth) => set({ simklAuth: auth }),

      malAuth: null,
      setMALAuth: (auth) => set({ malAuth: auth }),

      // ── Settings ───────────────────────────────────────────────────────────
      settings: {
        mpvPath: 'mpv',
        language: 'it',
        subtitleLanguage: 'it',
        defaultQuality: 'best',
        autoplay: true,
        skipIntro: false,
        hardwareDecode: true,
        rpdbKey: '',
        tmdbLanguage: 'it-IT',
        visibleStreamingServices: ['netflix','disney','apple','paramount','amazon','hbo','crunchyroll','raiplay'],
        accentColor: '#7c3aed',
        uiDensity: 'comfortable',
      },

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: 'nuvio-desktop-v2',
      storage,
      migrate: (persisted: any, version) => {
        // migrazione da v1 (history era array, ora è Record)
        if (version < 2 && Array.isArray(persisted.history)) {
          return {
            ...persisted,
            history: { [DEFAULT_PROFILE.id]: persisted.history },
          };
        }
        return persisted;
      },
      version: 2,
    }
  )
);

// ─── Selettori helper ─────────────────────────────────────────────────────────

export const useActiveProfile = () => {
  const { profiles, activeProfileId } = useAppStore();
  return profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
};

export const useActiveHistory = () => {
  const { history, activeProfileId } = useAppStore();
  return history[activeProfileId] ?? [];
};
