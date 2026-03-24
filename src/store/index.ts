import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Addon, MetaItem, Stream, PlayerState,
  NuvioUser, NuvioContinueWatching
} from '../types';
import { fetchManifest } from '../api/stremio';
import { setAuthToken } from '../api/nuvio';

// ─── Addon Store ──────────────────────────────────────────────────────────────

interface AddonStore {
  addons: Addon[];
  addAddon: (url: string) => Promise<void>;
  removeAddon: (id: string) => void;
  toggleAddon: (id: string) => void;
}

export const useAddonStore = create<AddonStore>()(
  persist(
    (set, get) => ({
      addons: [],

      addAddon: async (url: string) => {
        const manifest = await fetchManifest(url);
        const existing = get().addons.find((a) => a.id === manifest.id);
        if (existing) throw new Error(`Addon "${manifest.name}" già installato`);
        set((s) => ({
          addons: [
            ...s.addons,
            {
              id: manifest.id,
              version: manifest.version,
              name: manifest.name,
              description: manifest.description,
              logo: manifest.logo,
              transportUrl: url,
              manifest,
              enabled: true,
            },
          ],
        }));
      },

      removeAddon: (id) =>
        set((s) => ({ addons: s.addons.filter((a) => a.id !== id) })),

      toggleAddon: (id) =>
        set((s) => ({
          addons: s.addons.map((a) =>
            a.id === id ? { ...a, enabled: !a.enabled } : a
          ),
        })),
    }),
    { name: 'nuvio-addons' }
  )
);

// ─── Auth Store ───────────────────────────────────────────────────────────────

interface AuthStore {
  user: NuvioUser | null;
  setUser: (user: NuvioUser | null) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => {
        setAuthToken(user?.token ?? null);
        set({ user });
      },
    }),
    {
      name: 'nuvio-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.user?.token) setAuthToken(state.user.token);
      },
    }
  )
);

// ─── Player Store ─────────────────────────────────────────────────────────────

interface PlayerStore extends PlayerState {
  open: (params: { url: string; title: string; meta?: MetaItem; stream?: Stream }) => void;
  close: () => void;
  setPaused: (p: boolean) => void;
  setPosition: (pos: number) => void;
  setDuration: (dur: number) => void;
  setVolume: (vol: number) => void;
}

export const usePlayerStore = create<PlayerStore>()((set) => ({
  isOpen: false,
  url: undefined,
  title: undefined,
  meta: undefined,
  stream: undefined,
  paused: false,
  position: 0,
  duration: 0,
  volume: 100,

  open: ({ url, title, meta, stream }) =>
    set({ isOpen: true, url, title, meta, stream, paused: false, position: 0 }),

  close: () =>
    set({ isOpen: false, url: undefined, title: undefined, meta: undefined }),

  setPaused: (paused) => set({ paused }),
  setPosition: (position) => set({ position }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
}));

// ─── Continue Watching Store ──────────────────────────────────────────────────

interface ContinueWatchingStore {
  items: NuvioContinueWatching[];
  setItems: (items: NuvioContinueWatching[]) => void;
}

export const useContinueWatchingStore = create<ContinueWatchingStore>()((set) => ({
  items: [],
  setItems: (items) => set({ items }),
}));

// ─── Search Store ─────────────────────────────────────────────────────────────

interface SearchStore {
  query: string;
  results: MetaItem[];
  loading: boolean;
  setQuery: (q: string) => void;
  setResults: (r: MetaItem[]) => void;
  setLoading: (l: boolean) => void;
  clear: () => void;
}

export const useSearchStore = create<SearchStore>()((set) => ({
  query: '',
  results: [],
  loading: false,
  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results }),
  setLoading: (loading) => set({ loading }),
  clear: () => set({ query: '', results: [], loading: false }),
}));
