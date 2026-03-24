import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import { fetchCatalog } from '../lib/addon-client';
import { MetaItem } from '../lib/types';
import { Loader2, Search, Play } from 'lucide-react';

export default function SearchPage() {
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';
  const { addons } = useAppStore();

  const [results, setResults] = useState<MetaItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || addons.length === 0) {
      setResults([]);
      return;
    }

    setLoading(true);
    setResults([]);

    const seen = new Set<string>();

    const searches = addons.flatMap((addon) =>
      addon.catalogs
        .filter((c) => c.extra?.some((e) => e.name === 'search'))
        .map((catalog) =>
          fetchCatalog(addon.url, catalog.type, catalog.id, `search=${encodeURIComponent(query)}`)
            .then((items) => {
              setResults((prev) => {
                const fresh = items.filter((i) => !seen.has(i.id));
                fresh.forEach((i) => seen.add(i.id));
                return [...prev, ...fresh];
              });
            })
            .catch(() => {})
        )
    );

    Promise.allSettled(searches).then(() => setLoading(false));
  }, [query, addons]);

  if (!query) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-white/30">
        <Search size={32} />
        <p>Inserisci un termine di ricerca nella barra in alto</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 overflow-y-auto h-full">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-lg font-semibold text-white">
          Risultati per <span className="text-violet-400">"{query}"</span>
        </h1>
        {loading && <Loader2 size={16} className="animate-spin text-white/40" />}
      </div>

      {!loading && results.length === 0 && (
        <div className="text-center py-16 text-white/30">
          Nessun risultato trovato. Assicurati di avere addon con supporto alla ricerca.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
        {results.map((item) => (
          <Link
            key={item.id}
            to={`/detail/${item.type}/${encodeURIComponent(item.id)}`}
            className="group"
          >
            <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-white/5 border border-white/10 group-hover:border-violet-500 transition-all duration-200">
              {item.poster ? (
                <img
                  src={item.poster}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20">
                  <Play size={24} />
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play size={24} className="text-white fill-white" />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-white/70 truncate group-hover:text-white transition-colors">
              {item.name}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
