import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CatalogRow from "../components/CatalogRow";
import { useCatalog } from "../hooks/useCatalog";
import { useContinueWatchingStore, useAddonStore } from "../store";
import { getContinueWatching } from "../api/nuvio";
import type { MetaItem } from "../types";

export default function Home() {
  const navigate = useNavigate();
  const { addons } = useAddonStore();
  const { rows: movieRows } = useCatalog("movie");
  const { rows: seriesRows } = useCatalog("series");
  const { items: cwItems, setItems } = useContinueWatchingStore();
  const [cwLoading, setCwLoading] = useState(true);

  useEffect(() => {
    getContinueWatching()
      .then(setItems)
      .catch(() => {})
      .finally(() => setCwLoading(false));
  }, [setItems]);

  const handleItemClick = (item: MetaItem) => {
    navigate(`/meta/${item.type}/${item.id}`);
  };

  if (addons.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
        <div className="text-6xl mb-4">🧩</div>
        <h2 className="text-nuvio-text font-semibold text-xl mb-2">Nessun addon installato</h2>
        <p className="text-nuvio-muted text-sm mb-6 max-w-xs">
          Aggiungi un addon Stremio per iniziare a vedere contenuti
        </p>
        <button
          onClick={() => navigate("/addons")}
          className="px-5 py-2 bg-nuvio-accent hover:bg-nuvio-accent-hover
                     text-white rounded-lg text-sm font-medium transition-colors"
        >
          Gestisci Addon
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 pb-24">
      {/* Continue Watching */}
      {(cwLoading || cwItems.length > 0) && (
        <section className="mb-8">
          <h2 className="text-nuvio-text font-semibold text-base mb-3 px-1">
            Continua a guardare
          </h2>
          {cwLoading ? (
            <div className="flex gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex-shrink-0">
                  <div className="w-52 h-28 rounded-lg bg-nuvio-card animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
              {cwItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/meta/${item.type}/${item.id}`)}
                  className="w-52 flex-shrink-0 cursor-pointer group"
                >
                  <div className="relative rounded-lg overflow-hidden bg-nuvio-card h-28
                                  group-hover:ring-2 ring-nuvio-accent transition-all">
                    {item.poster && (
                      <img src={item.poster} alt={item.name}
                           className="w-full h-full object-cover" />
                    )}
                    {/* Progress bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                      <div
                        className="h-full bg-nuvio-accent"
                        style={{ width: `${item.progress * 100}%` }}
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-nuvio-text font-medium truncate">{item.name}</p>
                  {item.episode && (
                    <p className="text-xs text-nuvio-muted">
                      S{item.season} E{item.episode}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Film catalogs */}
      {movieRows.map((row, i) => (
        <CatalogRow key={`movie-${i}`} {...row} onItemClick={handleItemClick} />
      ))}

      {/* Serie catalogs */}
      {seriesRows.map((row, i) => (
        <CatalogRow key={`series-${i}`} {...row} onItemClick={handleItemClick} />
      ))}
    </div>
  );
}
