import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Addon, HistoryEntry } from './types';

// Storage adapter che usa localStorage in dev,
// sostituibile con tauri-plugin-store per la build finale.
const storage = createJSONStorage(() => localStorage);

// ─── Tipi store ───────────────────────────────────────────────────────────────

interface AppStore {
  // Addon installati
  addons: Addon[];
  addAddon: (addon: Addon) => void;
  removeAddon: (id: string) => void;
  reorderAddon: (id: string, direction: 'up' | 'down') => void;

  // Cronologia visione
  history: HistoryEntry[];
  addToHistory: (entry: Omit<HistoryEntry, 'watchedAt'>) => void;
  clearHistory: () => void;

  // Impostazioni
  settings: {
    mpvPath: string;
    language: string;
    subtitleLanguage: string;
    defaultQuality: string;
  };
  updateSettings: (patch: Partial<AppStore['settings']>) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // ── Addon ──────────────────────────────────────────────────────────────
      addons: [],

      addAddon: (addon) =>
        set((s) => ({
          addons: [
            ...s.addons.filter((a) => a.id !== addon.id),
            addon,
          ],
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

      // ── Cronologia ─────────────────────────────────────────────────────────
      history: [],

      addToHistory: (entry) =>
        set((s) => ({
          history: [
            { ...entry, watchedAt: Date.now() },
            ...s.history.filter((h) => h.id !== entry.id),
          ].slice(0, 100),
        })),

      clearHistory: () => set({ history: [] }),

      // ── Impostazioni ───────────────────────────────────────────────────────
      settings: {
        mpvPath: 'mpv',          // assume mpv nel PATH
        language: 'it',
        subtitleLanguage: 'it',
        defaultQuality: 'best',
      },

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: 'nuvio-desktop',
      storage,
    }
  )
);
