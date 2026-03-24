/**
 * usePlayer — hook per controllare mpv tramite comandi Tauri
 */
import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";
import { usePlayerStore } from "../store";
import type { MetaItem, Stream } from "../types";

export function usePlayer() {
  const store = usePlayerStore();

  const play = useCallback(
    async (url: string, title: string, meta?: MetaItem, stream?: Stream) => {
      store.open({ url, title, meta, stream });
      try {
        await invoke("player_play", { url, title });
      } catch (err) {
        console.error("Errore avvio mpv:", err);
      }
    },
    [store]
  );

  const pause = useCallback(async () => {
    await invoke("player_pause");
    store.setPaused(true);
  }, [store]);

  const resume = useCallback(async () => {
    await invoke("player_resume");
    store.setPaused(false);
  }, [store]);

  const stop = useCallback(async () => {
    await invoke("player_stop");
    store.close();
  }, [store]);

  const seek = useCallback(async (seconds: number) => {
    await invoke("player_seek", { seconds });
    store.setPosition(seconds);
  }, [store]);

  const setVolume = useCallback(
    async (vol: number) => {
      await invoke("player_set_volume", { volume: vol });
      store.setVolume(vol);
    },
    [store]
  );

  // Poll dello stato da mpv ogni secondo
  const syncState = useCallback(async () => {
    try {
      const state = await invoke<{ position: number; duration: number; paused: boolean }>(
        "player_get_state"
      );
      store.setPosition(state.position);
      store.setDuration(state.duration);
      store.setPaused(state.paused);
    } catch {
      // mpv non in esecuzione
    }
  }, [store]);

  return {
    ...store,
    play,
    pause,
    resume,
    stop,
    seek,
    setVolume,
    syncState,
  };
}
