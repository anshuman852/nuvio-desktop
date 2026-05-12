/// <reference types="vite/client" />
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  init,
  command,
  setProperty,
  getProperty,
  observeProperties,
  type MpvConfig,
  type MpvObservableProperty,
} from 'tauri-plugin-libmpv-api';

const OBSERVED_PROPS: MpvObservableProperty[] = [
  ['pause', 'flag'],
  ['time-pos', 'double', 'none'],
  ['duration', 'double', 'none'],
];

// Singleton — populated by MpvProvider, accessed by usePluginMpv
let mpvApi: ReturnType<typeof createMpvApi> | null = null;

interface MpvApi {
  ready: boolean;
  paused: boolean;
  timePos: number;
  duration: number;
  status: string;
  loadUrl: (url: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  setVolume: (vol: number) => Promise<void>;
  stop: () => Promise<void>;
}

function createMpvApi(): MpvApi {
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [timePos, setTimePos] = useState(0);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState('init');
  const readyRef = useRef(false);
  const pendingUrlRef = useRef<string | null>(null);
  const statusRef = useRef('init');
  const unlistenRef = useRef<(() => void) | null>(null);

  // Keep refs in sync
  statusRef.current = status;

  // Init once on mount
  useEffect(() => {
    setStatus('initializing');

    const mpvConfig: MpvConfig = {
      initialOptions: {
        'vo': 'gpu-next',
        'hwdec': 'auto-safe',
        'keep-open': 'yes',
        'force-window': 'yes',
        'audio-fallback-to-null': 'yes',
        'cache': 'yes',
        'cache-secs': '120',
        'demuxer-max-bytes': '300M',
        'demuxer-lavf-probesize': '131072',
        'demuxer-lavf-analyzeduration': '0.5',
        'network-timeout': '10',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'terminal': 'yes',
        'msg-level': 'all=v',
        'load-scripts': 'no',
      },
      observedProperties: OBSERVED_PROPS,
    };

    init(mpvConfig)
      .then(() => {
        setReady(true);
        readyRef.current = true;
        setStatus('ready');
        // If a URL was queued while init was pending, load it now
        const pending = pendingUrlRef.current;
        if (pending) {
          pendingUrlRef.current = null;
          loadUrlDirect(pending);
        }

        observeProperties(OBSERVED_PROPS, ({ name, data }: { name: string; data: unknown }) => {
          switch (name) {
            case 'pause':
              setPaused(data as boolean);
              break;
            case 'time-pos':
              setTimePos((data as number) ?? 0);
              break;
            case 'duration':
              setDuration((data as number) ?? 0);
              break;
          }
        }).then((unlisten: () => void) => {
          unlistenRef.current = unlisten;
        }).catch((e: unknown) => {
          setStatus('obs-error');
        });
      })
      .catch((e: unknown) => {
        setStatus('init-error: ' + String(e));
      });

    return () => {
      if (unlistenRef.current) unlistenRef.current();
    };
  }, []);

  // Define loadUrlDirect before loadUrl to avoid reference issues
  const loadUrlDirect = async (url: string) => {
    setStatus('loading');
    try {
      await command('loadfile', [url]);
      await setProperty('pause', false);
      setStatus('playing');
    } catch (e: unknown) {
      setStatus('load-err: ' + String(e));
    }
  };

  const loadUrl = useCallback(async (url: string) => {
    if (!readyRef.current) {
      // Queue the URL — will be loaded when init completes
      pendingUrlRef.current = url;
      setStatus('waiting-init');
      return;
    }
    await loadUrlDirect(url);
  }, []);

  const pause = useCallback(async () => {
    await setProperty('pause', true);
  }, []);

  const resume = useCallback(async () => {
    await setProperty('pause', false);
  }, []);

  const seek = useCallback(async (seconds: number) => {
    await command('seek', [seconds, 'absolute']);
  }, []);

  const setVolume = useCallback(async (vol: number) => {
    await setProperty('volume', Math.round(vol));
  }, []);

  const stop = useCallback(async () => {
    try { await command('stop'); } catch {}
    setPaused(false);
    setTimePos(0);
    setDuration(0);
    setStatus('ready');
  }, []);

  return {
    ready, paused, timePos, duration, status,
    loadUrl, pause, resume, seek, setVolume, stop,
  };
}

/** Mount once in App.tsx — persists across navigations */
export function MpvProvider() {
  mpvApi = createMpvApi();
  return null;
}

/** Access the MPV plugin from any component */
export function usePluginMpv(): MpvApi {
  if (!mpvApi) {
    console.log('[PluginMpv] Provider not mounted yet');
    return {
      ready: false, paused: false, timePos: 0, duration: 0, status: 'unmounted',
      loadUrl: async () => {}, pause: async () => {}, resume: async () => {},
      seek: async () => {}, setVolume: async () => {}, stop: async () => {},
    };
  }
  return mpvApi;
}
