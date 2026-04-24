// storage.ts - Funziona sia in Tauri che in browser
const isTauri = () => {
    return !!(
    (window as any).__TAURI__ ||
    (window as any).__TAURI_IPC__ ||
    (window as any).__TAURI_INTERNALS__ ||
    window.location.protocol === 'tauri:' ||
    window.location.hostname === 'tauri.localhost'
  );
};

export const checkIsTauri = isTauri;

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (isTauri()) {
      // Usa Tauri store
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('store.json');
      const value = await store.get<string>(key);
      return value || null;
    } else {
      // Fallback a localStorage
      return localStorage.getItem(key);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isTauri()) {
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('store.json');
      await store.set(key, value);
    } else {
      localStorage.setItem(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (isTauri()) {
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('store.json');
      await store.delete(key);
    } else {
      localStorage.removeItem(key);
    }
  },

  async getAllKeys(): Promise<string[]> {
    if (isTauri()) {
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('store.json');
      return await store.keys();
    } else {
      return Object.keys(localStorage);
    }
  }
};