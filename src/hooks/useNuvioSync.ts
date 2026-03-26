import { useEffect, useRef } from 'react';
import { useAppStore } from '../lib/store';
import { updateProgress } from '../api/nuvio';

export function useNuvioSync(position: number, duration: number, isPlaying: boolean, currentItem: any) {
  const { nuvioUser } = useAppStore();
  const lastSentRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!nuvioUser || !isPlaying || !currentItem) return;
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      if (now - lastSentRef.current > 10000 && position > 0) {
        lastSentRef.current = now;
        updateProgress(
          currentItem.id,
          currentItem.type,
          currentItem.videoId || currentItem.id,
          position,
          duration,
          { name: currentItem.name, poster: currentItem.poster }
        ).catch(console.error);
      }
    }, 10000);
    return () => clearInterval(intervalRef.current);
  }, [nuvioUser, isPlaying, currentItem, position, duration]);

  return null;
}