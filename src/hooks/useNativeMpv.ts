/// <reference types="vite/client" />
import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface NativeMpvState {
  timePos: number;
  duration: number;
  paused: boolean;
  ready: boolean;
  playing: boolean;
}

export function useNativeMpv() {
  const [state, setState] = useState<NativeMpvState>({
    timePos: 0, duration: 0, paused: false, ready: false, playing: false,
  });
  const initRef = useRef(false);

  // Init once (persists across mount/unmount on Rust side)
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    invoke('mpv_native_init').then(() => {
      console.log('[NativeMpv] Ready');
      setState(s => ({ ...s, ready: true }));
    }).catch((e: unknown) => {
      console.log('[NativeMpv] Init failed:', e);
    });

    return () => {
      initRef.current = false;
    };
  }, []);

  // Event listeners — register every mount so they work on remount
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let posLogCount = 0;

    listen<number>('mpv:time-pos', (e) => {
      posLogCount++;
      if (posLogCount === 1 || posLogCount % 30 === 0) {
        console.log('[NativeMpv] time-pos event #' + posLogCount + ':', e.payload);
      }
      setState(s => ({ ...s, timePos: e.payload }));
    }).then(fn => unlisteners.push(fn));

    listen<number>('mpv:duration', (e) => {
      console.log('[NativeMpv] duration event:', e.payload);
      setState(s => ({ ...s, duration: e.payload }));
    }).then(fn => unlisteners.push(fn));

    listen<boolean>('mpv:pause', (e) => {
      console.log('[NativeMpv] pause event:', e.payload);
      setState(s => ({ ...s, paused: e.payload }));
    }).then(fn => unlisteners.push(fn));

    listen('mpv:file-loaded', () => {
      console.log('[NativeMpv] file-loaded event');
      setState(s => ({ ...s, playing: true, paused: false }));
    }).then(fn => unlisteners.push(fn));

    listen('mpv:end-file', () => {
      console.log('[NativeMpv] end-file event');
      setState(s => ({ ...s, playing: false }));
    }).then(fn => unlisteners.push(fn));

    return () => {
      unlisteners.forEach(fn => fn());
    };
  }, []);

  const loadUrl = useCallback((url: string) => {
    invoke('mpv_native_load_url', { url }).catch((e: unknown) => console.log('[NativeMpv] Load error:', e));
  }, []);

  const togglePause = useCallback(() => {
    invoke('mpv_native_toggle_pause').catch(() => {});
  }, []);

  const seek = useCallback((seconds: number) => {
    invoke('mpv_native_seek', { seconds }).catch(() => {});
  }, []);

  const setVolume = useCallback((vol: number) => {
    invoke('mpv_native_set_volume', { volume: vol }).catch(() => {});
  }, []);

  const stop = useCallback(() => {
    invoke('mpv_native_stop').catch(() => {});
    setState(s => ({ ...s, playing: false }));
  }, []);

  return { ...state, loadUrl, togglePause, seek, setVolume, stop };
}
