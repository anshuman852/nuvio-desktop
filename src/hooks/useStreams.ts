import { useState, useCallback } from 'react';
import { useAddonStore } from '../store';
import { fetchStreams } from '../api/stremio';
import type { EnrichedStream, ContentType } from '../types';

export function useStreams() {
  const { addons } = useAddonStore();
  const [streams, setStreams] = useState<EnrichedStream[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (type: ContentType, id: string) => {
      setLoading(true);
      setStreams([]);

      const enabledAddons = addons.filter(
        (a) => a.enabled && a.manifest.resources.includes('stream')
      );

      const results = await Promise.allSettled(
        enabledAddons.map(async (addon) => {
          const s = await fetchStreams(addon.transportUrl, type, id);
          return s.map((stream): EnrichedStream => ({
            ...stream,
            addonId: addon.id,
            addonName: addon.name,
          }));
        })
      );

      const allStreams = results
        .filter((r): r is PromiseFulfilledResult<EnrichedStream[]> => r.status === 'fulfilled')
        .flatMap((r) => r.value);

      setStreams(allStreams);
      setLoading(false);
      return allStreams;
    },
    [addons]
  );

  return { streams, loading, loadStreams: load };
}
