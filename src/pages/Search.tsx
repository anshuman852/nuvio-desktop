/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { fetchCatalog } from '../api/stremio';
import { searchTMDB, tmdbToMeta, hasTMDBKey } from '../api/tmdb';
import { Loader2, Search as SearchIcon } from 'lucide-react';

export default function Search() {
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';
  const { addons } = useStore();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    (async () => {
      const all: any[] = [];
      // Cerca su TMDB se disponibile
      if (hasTMDBKey()) {
        try {
          const tmdbResults = await searchTMDB(query);
          all.push(...tmdbResults.map(tmdbToMeta));
        } catch { }
      }
      // Cerca su addon Stremio con extra search
      for (const addon of addons) {
        for (const cat of addon.catalogs) {
          try {
            const items = await fetchCatalog(addon.url, cat.type, cat.id, `search=${encodeURIComponent(query)}`);
            all.push(...items);
          } catch { }
        }
      }
      // Deduplicazione per id
      const seen = new Set<string>();
      setResults(all.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; }));
      setLoading(false);
    })();
  }, [query]);

  return (
    <div className="px-6 py-6 overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-6">
        <SearchIcon size={18} className="text-white/40" />
        <h1 className="text-lg font-bold text-white">
          {query ? `Risultati per "${query}"` : 'Cerca'}
        </h1>
        {loading && <Loader2 size={16} className="animate-spin text-white/40" />}
      </div>

      {!query && <p className="text-white/40 text-sm">Usa la barra di ricerca in alto per cercare film e serie.</p>}

      {query && !loading && results.length === 0 && (
        <p className="text-white/40 text-sm">Nessun risultato trovato per "{query}".</p>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
        {results.map(item => (
          <Link key={item.id} to={`/detail/${item.type}/${encodeURIComponent(item.id)}`} className="group">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-[color:var(--accent)] transition-all group-hover:scale-[1.02]">
              {item.poster
                ? <img src={item.poster} alt={item.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-3xl">🎬</div>}
            </div>
            <p className="mt-1.5 text-xs text-white/70 group-hover:text-white truncate">{item.name}</p>
            {item.releaseInfo && <p className="text-xs text-white/30">{item.releaseInfo}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
