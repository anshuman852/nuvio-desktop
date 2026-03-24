/**
 * useCatalog — carica e aggrega cataloghi da tutti gli addon abilitati
 */
import { useState, useEffect, useCallback } from "react";
import { useAddonStore } from "../store";
import { fetchCatalog } from "../api/stremio";
import type { MetaItem, ContentType } from "../types";

export interface CatalogRow {
  title: string;
  addonName: string;
  items: MetaItem[];
  loading: boolean;
  error?: string;
}

export function useCatalog(type: ContentType) {
  const { addons } = useAddonStore();
  const [rows, setRows] = useState<CatalogRow[]>([]);

  const load = useCallback(async () => {
    const enabledAddons = addons.filter((a) => a.enabled);

    // Costruisci le righe iniziali in loading
    const initial: CatalogRow[] = enabledAddons.flatMap((addon) =>
      addon.manifest.catalogs
        .filter((c) => c.type === type)
        .map((cat) => ({
          title: cat.name,
          addonName: addon.name,
          items: [],
          loading: true,
        }))
    );
    setRows(initial);

    // Carica ogni catalogo in parallelo
    const promises = enabledAddons.flatMap((addon) =>
      addon.manifest.catalogs
        .filter((c) => c.type === type)
        .map(async (cat, catIdx) => {
          const rowIndex = enabledAddons
            .slice(0, enabledAddons.indexOf(addon))
            .reduce(
              (acc, a) => acc + a.manifest.catalogs.filter((c) => c.type === type).length,
              0
            ) + catIdx;

          try {
            const items = await fetchCatalog(addon.transportUrl, type, cat.id);
            setRows((prev) => {
              const next = [...prev];
              if (next[rowIndex]) {
                next[rowIndex] = { ...next[rowIndex], items, loading: false };
              }
              return next;
            });
          } catch (err) {
            setRows((prev) => {
              const next = [...prev];
              if (next[rowIndex]) {
                next[rowIndex] = {
                  ...next[rowIndex],
                  loading: false,
                  error: "Errore caricamento",
                };
              }
              return next;
            });
          }
        })
    );

    await Promise.allSettled(promises);
  }, [addons, type]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, reload: load };
}
