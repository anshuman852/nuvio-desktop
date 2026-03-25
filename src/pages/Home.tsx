import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore, useActiveProfile } from '../lib/store';
import { fetchCatalog } from '../lib/addon-client';
import { useContinueWatching } from '../hooks/useContinueWatching';
import { getRPDBPoster } from '../api/rpdb';
import { MetaItem, Addon, AddonCatalog } from '../lib/types';
import { Play, Clock, Plus, Zap, AlertCircle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

const SOURCE_LABEL: Record<string, string> = {
  trakt: '🔴 Trakt', simkl: '🔵 Simkl', nuvio: '☁️ Nuvio', local: '💾 Locale',
};

function MediaCard({ item, rpdbKey }: { item: MetaItem; rpdbKey?: string }) {
  const imdbId = item.id?.startsWith('tt') ? item.id : undefined;
  const poster = getRPDBPoster(imdbId, rpdbKey, item.poster);
  const [imgErr, setImgErr] = useState(false);
  return (
    <Link to={`/detail/${item.type}/${encodeURIComponent(item.id)}`} className="flex-shrink-0 w-36 group">
      <div className="relative w-36 h-52 rounded-lg overflow-hidden bg-white/5 border border-white/10 group-hover:border-[color:var(--accent,#7c3aed)] transition-all duration-200">
        {poster && !imgErr
          ? <img src={poster} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={() => setImgErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-white/20"><Play size={32} /></div>}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play size={24} className="text-white fill-white" />
        </div>
      </div>
      <p className="mt-1.5 text-xs text-white/80 truncate group-hover:text-white transition-colors">{item.name}</p>
      {item.releaseInfo && <p className="text-xs text-white/40">{item.releaseInfo}</p>}
    </Link>
  );
}

interface CatalogRow {
  key: string; label: string; addon: Addon;
  catalog: AddonCatalog; items: MetaItem[]; loading: boolean; error?: string;
}

function RowSection({ row, rpdbKey }: { row: CatalogRow; rpdbKey?: string }) {
  if (!row.loading && row.items.length === 0) {
    if (row.error) return (
      <section className="mb-4">
        <div className="flex items-center gap-2 text-red-400/70 text-xs">
          <AlertCircle size={12} />
          <span>{row.label} (errore: {row.error.slice(0, 80)})</span>
        </div>
      </section>
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
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-36 h-52 rounded-lg bg-white/5 animate-pulse" />
            ))
          : row.items.map((item) => <MediaCard key={item.id} item={item} rpdbKey={rpdbKey} />)}
      </div>
    </section>
  );
}

export default function Home() {
  const { addons, settings } = useAppStore();
  const activeProfile = useActiveProfile();
  const { items: cwItems, loading: cwLoading, source: cwSource } = useContinueWatching();
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const rpdbKey = settings.rpdbKey || undefined;

  // Chiave che cambia quando cambiano gli addon → trigga reload
  const addonsKey = addons.map(a => `${a.id}:${a.catalogs?.length}`).join('|');

  useEffect(() => {
    if (addons.length === 0) { setRows([]); return; }

    const catalogList: CatalogRow[] = addons.flatMap((addon) =>
      (addon.catalogs ?? []).filter(c => c.type && c.id).map((catalog) => ({
        key: `${addon.id}::${catalog.type}::${catalog.id}`,
        label: catalog.name ?? catalog.id,
        addon, catalog, items: [], loading: true,
      }))
    );

    if (catalogList.length === 0) {
      setRows([{ key: 'err', label: 'Nessun catalogo', addon: addons[0], catalog: { type: '', id: '', name: '' }, items: [], loading: false, error: 'Gli addon non hanno cataloghi — prova a rimuoverli e reinstallarli.' }]);
      return;
    }

    setRows(catalogList);
    setLoadingAll(true);

    let completed = 0;
    catalogList.forEach(({ key, addon, catalog }) => {
      fetchCatalog(addon.url, catalog.type, catalog.id)
        .then((items) => {
          setRows((prev) => prev.map((r) =>
            r.key === key ? { ...r, items: items.slice(0, 40), loading: false } : r
          ));
        })
        .catch((err: any) => {
          setRows((prev) => prev.map((r) =>
            r.key === key ? { ...r, loading: false, error: String(err?.message ?? err) } : r
          ));
        })
        .finally(() => {
          completed++;
          if (completed >= catalogList.length) setLoadingAll(false);
        });
    });
  }, [addonsKey]);

  if (addons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-bg)' }}>
          <Plus size={32} style={{ color: 'var(--accent)' }} />
        </div>
        <h1 className="text-2xl font-bold text-white">Nessun addon installato</h1>
        <p className="text-white/50 max-w-sm">Vai nella sezione Addon e aggiungi Cinemeta per iniziare.</p>
        <Link to="/addons" className="mt-2 px-6 py-2.5 text-white rounded-lg font-medium transition-colors" style={{ backgroundColor: 'var(--accent)' }}>
          Gestisci Addon
        </Link>
      </div>
    );
  }

  const allFailed = rows.length > 0 && !loadingAll && rows.every(r => !r.loading && r.items.length === 0);

  return (
    <div className="px-6 py-6 overflow-y-auto h-full">

      {/* Debug: mostra se tutti i cataloghi hanno fallito */}
      {allFailed && (
        <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <AlertCircle size={16} className="text-yellow-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-yellow-400 font-medium">I cataloghi non caricano</p>
            <p className="text-xs text-yellow-400/60 mt-0.5">
              {rows.find(r => r.error)?.error ?? 'Prova a rimuovere e reinstallare gli addon.'}
            </p>
          </div>
          <button onClick={() => {
            setRows(prev => prev.map(r => ({ ...r, loading: true, error: undefined, items: [] })));
            rows.forEach(({ key, addon, catalog }) => {
              fetchCatalog(addon.url, catalog.type, catalog.id)
                .then(items => setRows(prev => prev.map(r => r.key === key ? { ...r, items, loading: false } : r)))
                .catch(err => setRows(prev => prev.map(r => r.key === key ? { ...r, loading: false, error: String(err) } : r)));
            });
          }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-yellow-400 bg-yellow-500/10 rounded-lg hover:bg-yellow-500/20 transition-colors">
            <RefreshCw size={12} /> Riprova
          </button>
        </div>
      )}

      {/* Continue watching */}
      {(cwItems.length > 0 || cwLoading) && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Clock size={14} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Continua a guardare</h2>
            <span className="text-xs text-white/30">· {SOURCE_LABEL[cwSource] ?? cwSource}</span>
            {cwSource !== 'local' && <span className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--accent)' }}><Zap size={10} /> sync</span>}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {cwLoading
              ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex-shrink-0 w-36 h-52 rounded-lg bg-white/5 animate-pulse" />)
              : cwItems.map((entry) => (
                  <Link key={`${entry.id}-${entry.watchedAt}`}
                    to={`/detail/${entry.type}/${encodeURIComponent(entry.id)}`}
                    className="flex-shrink-0 w-36 group">
                    <div className="relative w-36 h-52 rounded-lg overflow-hidden bg-white/5 border border-white/10 group-hover:border-[color:var(--accent)] transition-all duration-200">
                      {entry.poster
                        ? <img src={entry.poster} alt={entry.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        : <div className="w-full h-full flex items-center justify-center text-white/20"><Play size={32} /></div>}
                      {entry.progress !== undefined && entry.progress > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                          <div className="h-full" style={{ width: `${Math.min(entry.progress * 100, 100)}%`, backgroundColor: 'var(--accent)' }} />
                        </div>
                      )}
                      {entry.episode && (
                        <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs text-white/80 font-mono">
                          S{entry.season}E{entry.episode}
                        </div>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-white/80 truncate group-hover:text-white">{entry.name}</p>
                  </Link>
                ))}
          </div>
        </section>
      )}

      {rows.map((row) => <RowSection key={row.key} row={row} rpdbKey={rpdbKey} />)}
    </div>
  );
}
