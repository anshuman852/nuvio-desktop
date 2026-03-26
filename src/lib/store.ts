/// <reference types="vite/client" />
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Addon, HistoryEntry, Profile,
  NuvioUser, TraktAuth, SimklAuth, MALAuth,
} from './types';

const storage = createJSONStorage(() => localStorage);

// ─── Default addons ───────────────────────────────────────────────────────────

export const DEFAULT_ADDONS: Addon[] = [
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

export const DEFAULT_PROFILE: Profile = {
  id: 'default',
  name: 'Principale',
  avatar: 'red',
  avatarType: 'netflix',
  color: '#7c3aed',
  isKids: false,
  createdAt: Date.now(),
};

const DEFAULT_SETTINGS = {
  mpvPath: 'mpv',
  language: 'it',
  subtitleLanguage: 'it',
  defaultQuality: 'best',
  autoplay: true,
  skipIntro: false,
  hardwareDecode: true,
  rpdbKey: '',
  tmdbLanguage: 'it-IT',
  tmdbToken: '',
  visibleStreamingServices: ['netflix','disney','apple','paramount','amazon','hbo','crunchyroll','raiplay'],
  accentColor: '#7c3aed',
  uiDensity: 'comfortable' as const,
};

// ─── Store types ──────────────────────────────────────────────────────────────

interface AppStore {
  profiles: Profile[];
  activeProfileId: string;
  profileSelected: boolean;  // true dopo che l'utente ha scelto il profilo
  addProfile: (p: Omit<Profile, 'id' | 'createdAt'>) => void;
  updateProfile: (id: string, patch: Partial<Profile>) => void;
  removeProfile: (id: string) => void;
  setActiveProfile: (id: string) => void;
  setProfileSelected: (v: boolean) => void;

  addons: Addon[];
  addAddon: (addon: Addon) => void;
  removeAddon: (id: string) => void;
  reorderAddon: (id: string, direction: 'up' | 'down') => void;

  history: Record<string, HistoryEntry[]>;
  addToHistory: (entry: Omit<HistoryEntry, 'watchedAt'>) => void;
  clearHistory: () => void;

  nuvioUser: NuvioUser | null;
  setNuvioUser: (user: NuvioUser | null) => void;

  traktAuth: TraktAuth | null;
  setTraktAuth: (auth: TraktAuth | null) => void;

  simklAuth: SimklAuth | null;
  setSimklAuth: (auth: SimklAuth | null) => void;

  malAuth: MALAuth | null;
  setMALAuth: (auth: MALAuth | null) => void;

  settings: typeof DEFAULT_SETTINGS;
  updateSettings: (patch: Partial<typeof DEFAULT_SETTINGS>) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
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

      // Garantisce sempre almeno Cinemeta
      addons: DEFAULT_ADDONS,

      addAddon: (addon) => set((s) => ({
        addons: [...s.addons.filter((a) => a.id !== addon.id), addon],
      })),
      removeAddon: (id) => set((s) => ({
        addons: s.addons.filter((a) => a.id !== id),
      })),
      reorderAddon: (id, direction) => set((s) => {
        const idx = s.addons.findIndex((a) => a.id === id);
        if (idx === -1) return s;
        const arr = [...s.addons];
        const target = direction === 'up' ? idx - 1 : idx + 1;
        if (target < 0 || target >= arr.length) return s;
        [arr[idx], arr[target]] = [arr[target], arr[idx]];
        return { addons: arr };
      }),

      history: {},
      addToHistory: (entry) => set((s) => {
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
      clearHistory: () => set((s) => ({
        history: { ...s.history, [s.activeProfileId]: [] },
      })),

      nuvioUser: null,
      setNuvioUser: (user) => set({ nuvioUser: user }),
      traktAuth: null,
      setTraktAuth: (auth) => set({ traktAuth: auth }),
      simklAuth: null,
      setSimklAuth: (auth) => set({ simklAuth: auth }),
      malAuth: null,
      setMALAuth: (auth) => set({ malAuth: auth }),

      settings: DEFAULT_SETTINGS,
      updateSettings: (patch) => set((s) => ({
        settings: { ...s.settings, ...patch },
      })),
    }),
    {
      // Nome fisso - NON cambiare mai più
      name: 'nuvio-app',
      storage,
      version: 1,
      migrate: (persisted: any) => {
        // Migrazione universale da qualsiasi versione precedente
        const old = persisted ?? {};

        // Recupera addons da vecchi nomi store se presenti
        let addons = old.addons;
        if (!addons || addons.length === 0) {
          // Prova a leggere da vecchi store names
          try {
            const oldNames = ['nuvio-desktop-v2', 'nuvio-desktop', 'nuvio-desktop-v3'];
            for (const name of oldNames) {
              const raw = localStorage.getItem(name);
              if (raw) {
                const parsed = JSON.parse(raw);
                const a = parsed?.state?.addons;
                if (a && a.length > 0) { addons = a; break; }
              }
            }
          } catch { /* ignore */ }
        }
        if (!addons || addons.length === 0) addons = DEFAULT_ADDONS;

        // Recupera history
        let history = old.history ?? {};
        if (Array.isArray(history)) {
          history = { [DEFAULT_PROFILE.id]: history };
        }

        // Recupera settings con spread dei nuovi campi
        const settings = { ...DEFAULT_SETTINGS, ...(old.settings ?? {}) };

        // Recupera profili
        const profiles = old.profiles?.length ? old.profiles : [DEFAULT_PROFILE];

        return {
          ...old,
          addons,
          history,
          settings,
          profiles,
          activeProfileId: old.activeProfileId ?? DEFAULT_PROFILE.id,
          profileSelected: false, // sempre false dopo update → mostra selezione
          nuvioUser: old.nuvioUser ?? null,
          traktAuth: old.traktAuth ?? null,
          simklAuth: old.simklAuth ?? null,
          malAuth: old.malAuth ?? null,
        };
      },
    }
  )
);

// ─── Selettori ────────────────────────────────────────────────────────────────

export const useActiveProfile = () => {
  const { profiles, activeProfileId } = useAppStore();
  return profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? DEFAULT_PROFILE;
};

export const useActiveHistory = () => {
  const { history, activeProfileId } = useAppStore();
  return history[activeProfileId] ?? [];
};
