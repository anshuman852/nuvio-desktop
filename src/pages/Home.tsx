import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore, useActiveHistory, useActiveProfile } from '../lib/store';
import { fetchCatalog } from '../lib/addon-client';
import { MetaItem, Addon, AddonCatalog } from '../lib/types';
import { Play, Clock, Plus } from 'lucide-react';
import clsx from 'clsx';

interface CatalogRow {
  key: string;
  label: string;
  addon: Addon;
  catalog: AddonCatalog;
  items: MetaItem[];
  loading: boolean;
}

function MediaCard({ item }: { item: MetaItem }) {
  const [imgError, setImgError] = useState(false);

  return (
    <Link to={`/detail/${item.type}/${encodeURIComponent(item.id)}`}
      className="flex-shrink-0 w-36 group">
      <div className="relative w-36 h-52 rounded-lg overflow-hidden bg-white/5 border border-white/10 group-hover:border-violet-500 transition-all duration-200">
        {item.poster && !imgError ? (
          <img src={item.poster} alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">
            <Play size={32} />
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play size={28} className="text-white fill-white" />
        </div>
      </div>
      <p className="mt-2 text-xs text-white/80 truncate group-hover:text-white transition-colors">{item.name}</p>
      {item.releaseInfo && <p className="text-xs text-white/40">{item.releaseInfo}</p>}
    </Link>
  );
}

function RowSection({ row }: { row: CatalogRow }) {
  if (!row.loading && row.items.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3 px-1">
        <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wider">{row.label}</h2>
        <span className="text-xs text-white/30">· {row.addon.name}</span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {row.loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-36 h-52 rounded-lg bg-white/5 animate-pulse" />
            ))
          : row.items.map((item) => <MediaCard key={item.id} item={item} />)}
      </div>
    </section>
  );
}

export default function Home() {
  const { addons } = useAppStore();
  const history = useActiveHistory();
  const activeProfile = useActiveProfile();
  const [rows, setRows] = useState<CatalogRow[]>([]);

  useEffect(() => {
    if (addons.length === 0) return;

    const initial: CatalogRow[] = addons.flatMap((addon) =>
      addon.catalogs.map((catalog) => ({
        key: `${addon.id}::${catalog.type}::${catalog.id}`,
        label: catalog.name,
        addon,
        catalog,
        items: [],
        loading: true,
      }))
    );
    setRows(initial);

    initial.forEach(({ key, addon, catalog }) => {
      fetchCatalog(addon.url, catalog.type, catalog.id)
        .then((items) => setRows((prev) => prev.map((r) => r.key === key ? { ...r, items, loading: false } : r)))
        .catch(() => setRows((prev) => prev.map((r) => r.key === key ? { ...r, loading: false } : r)));
    });
  }, [addons]);

  if (addons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-violet-600/20 flex items-center justify-center">
          <Plus size={32} className="text-violet-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Nessun addon installato</h1>
        <p className="text-white/50 max-w-sm">
          Vai nella sezione Addon e aggiungi il tuo primo addon Stremio per iniziare.
        </p>
        <Link to="/addons"
          className="mt-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors">
          Gestisci Addon
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 overflow-y-auto h-full">
      {/* Continue watching */}
      {history.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Clock size={14} className="text-violet-400" />
            <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wider">
              Continua a guardare
            </h2>
            <span className="text-xs text-white/30">· {activeProfile.name}</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {history.slice(0, 20).map((entry) => (
              <Link key={entry.id} to={`/detail/${entry.type}/${encodeURIComponent(entry.id)}`}
                className="flex-shrink-0 w-36 group">
                <div className="relative w-36 h-52 rounded-lg overflow-hidden bg-white/5 border border-white/10 group-hover:border-violet-500 transition-all duration-200">
                  {entry.poster
                    ? <img src={entry.poster} alt={entry.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    : <div className="w-full h-full flex items-center justify-center text-white/20"><Play size={32} /></div>}
                  {entry.progress !== undefined && entry.progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <div className="h-full bg-violet-500" style={{ width: `${Math.min(entry.progress * 100, 100)}%` }} />
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-white/80 truncate">{entry.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {rows.map((row) => <RowSection key={row.key} row={row} />)}
    </div>
  );
}
