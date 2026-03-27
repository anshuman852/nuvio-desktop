/// <reference types="vite/client" />
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { fetchCatalog } from '../api/stremio';
import { useContinueWatching } from '../hooks/useContinueWatching';
import { MetaItem, Addon, AddonCatalog } from '../lib/types';
import { Play, Clock, Plus, Zap, AlertCircle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

const SOURCE_LABEL: Record<string, string> = {
  trakt: '🔴 Trakt', simkl: '🔵 Simkl', nuvio: '☁️ Nuvio', local: '💾 Locale',
};

function PosterCard({ item }: { item: MetaItem | { id: string; type: string; name: string; poster?: string; episode?: number; season?: number; progress?: number } }) {
  const [imgErr, setImgErr] = useState(false);
  const progress = (item as any).progress;
  return (
    <Link
      to={`/detail/${item.type}/${encodeURIComponent(item.id)}`}
      className="flex-shrink-0 w-36 group"
    >
      <div className="relative w-36 h-52 rounded-lg overflow-hidden bg-white/5 border border-white/10 group-hover:border-[color:var(--accent,#7c3aed)] transition-all duration-200">
        {item.poster && !imgErr
          ? <img src={item.poster} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={() => setImgErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-white/20"><Play size={32} /></div>}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Play size={20} className="text-white fill-white ml-1" />
          </div>
        </div>
        {(item as any).episode && (
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs text-white/80 font-mono">
            S{(item as any).season}E{(item as any).episode}
          </div>
        )}
        {progress !== undefined && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div className="h-full" style={{ width: `${Math.min(progress * 100, 100)}%`, backgroundColor: 'var(--accent, #7c3aed)' }} />
          </div>
        )}
      </div>
      <p className="mt-1.5 text-xs text-white/80 truncate group-hover:text-white transition-colors leading-tight">{item.name}</p>
      {(item as MetaItem).releaseInfo && <p className="text-xs text-white/40">{(item as MetaItem).releaseInfo}</p>}
    </Link>
  );
}

interface CatalogRow { key: string; label: string; addon: Addon; catalog: AddonCatalog; items: MetaItem[]; loading: boolean; error?: string }

function CatalogSection({ row }: { row: CatalogRow }) {
  if (!row.loading && row.items.length === 0) {
    if (row.error) return (
      <div className="mb-2 flex items-center gap-2 text-red-400/60 text-xs px-1">
        <AlertCircle size={11} /><span>{row.label}: {row.error.slice(0, 100)}</span>
      </div>
    );
    return null;
  }
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3 px-1">
        <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wider">{row.label}</h2>
        <span className="text-xs text-white/30">· {row.addon.name}</span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {row.loading
          ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="flex-shrink-0 w-36 h-52 rounded-lg bg-white/5 animate-pulse" />)
          : row.items.map((item) => <PosterCard key={item.id} item={item} />)}
      </div>
    </section>
  );
}

export default function Home() {
  const { addons } = useStore();
  const { items: cwItems, loading: cwLoading, source: cwSource, reload } = useContinueWatching();
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [allFailed, setAllFailed] = useState(false);
  const addonsKey = addons.map(a => a.id).join('|');

  function loadCatalogs() {
    if (addons.length === 0) { setRows([]); return; }
    const list: CatalogRow[] = addons.flatMap((addon) =>
      (addon.catalogs ?? []).filter(c => c.type && c.id).map((catalog) => ({
        key: `${addon.id}::${catalog.type}::${catalog.id}`,
        label: catalog.name ?? catalog.id,
        addon, catalog, items: [], loading: true,
      }))
    );
    if (list.length === 0) { setRows([]); return; }
    setRows(list);
    setAllFailed(false);
    let failCount = 0;
    list.forEach(({ key, addon, catalog }) => {
      fetchCatalog(addon.url, catalog.type, catalog.id)
        .then((items) => setRows(prev => prev.map(r => r.key === key ? { ...r, items, loading: false } : r)))
        .catch((err: any) => {
          failCount++;
          if (failCount === list.length) setAllFailed(true);
          setRows(prev => prev.map(r => r.key === key ? { ...r, loading: false, error: String(err?.message ?? err) } : r));
        });
    });
  }

  useEffect(() => { loadCatalogs(); }, [addonsKey]);

  if (addons.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-bg)' }}>
        <Plus size={32} style={{ color: 'var(--accent)' }} />
      </div>
      <h1 className="text-2xl font-bold text-white">Nessun addon installato</h1>
      <p className="text-white/50 max-w-sm">Vai nella sezione Addon e aggiungi Cinemeta per iniziare.</p>
      <Link to="/addons" className="mt-2 px-6 py-2.5 text-white rounded-lg font-medium" style={{ backgroundColor: 'var(--accent)' }}>Gestisci Addon</Link>
    </div>
  );

  return (
    <div className="px-6 py-6 overflow-y-auto h-full">

      {allFailed && (
        <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-400 font-medium">Impossibile caricare i cataloghi</p>
            <p className="text-xs text-red-400/60 mt-0.5">Controlla la connessione internet. Gli addon Stremio richiedono accesso a internet.</p>
          </div>
          <button onClick={loadCatalogs} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors">
            <RefreshCw size={12} /> Riprova
          </button>
        </div>
      )}

      {/* Continue Watching */}
      {(cwItems.length > 0 || cwLoading) && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Clock size={14} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Continua a guardare</h2>
            <span className="text-xs text-white/30">· {SOURCE_LABEL[cwSource] ?? cwSource}</span>
            {cwSource !== 'local' && <span className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--accent)' }}><Zap size={10} />sync</span>}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {cwLoading
              ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex-shrink-0 w-36 h-52 rounded-lg bg-white/5 animate-pulse" />)
              : cwItems.map((e) => <PosterCard key={`${e.id}-${e.watchedAt}`} item={e as any} />)}
          </div>
        </section>
      )}

      {rows.map((row) => <CatalogSection key={row.key} row={row} />)}
    </div>
  );
}
