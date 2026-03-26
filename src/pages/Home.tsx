/// <reference types="vite/client" />
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore, useActiveProfile } from '../lib/store';
import { fetchCatalog, normalizeAddonUrl } from '../lib/addon-client';
import { useContinueWatching } from '../hooks/useContinueWatching';
import { getRPDBPoster } from '../api/rpdb';
import { MetaItem, Addon, AddonCatalog } from '../lib/types';
import { Play, Clock, Plus, Zap, AlertCircle, RefreshCw, Bug, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';

const SOURCE_LABEL: Record<string, string> = {
  trakt: '🔴 Trakt', simkl: '🔵 Simkl', nuvio: '☁️ Nuvio', local: '💾 Locale',
};

// ─── Debug panel ──────────────────────────────────────────────────────────────

function DebugPanel({ addons }: { addons: Addon[] }) {
  const [open, setOpen] = useState(true);
  const [results, setResults] = useState<{ key: string; status: string; detail: string }[]>([]);
  const [testing, setTesting] = useState(false);

  async function runTest() {
    setTesting(true);
    setResults([]);
    const out: typeof results = [];

    for (const addon of addons) {
      const base = normalizeAddonUrl(addon.url);
      out.push({ key: addon.name + ' URL', status: 'info', detail: base });

      // Test manifest
      try {
        const r = await fetch(`${base}/manifest.json`);
        out.push({ key: addon.name + ' manifest', status: r.ok ? 'ok' : 'err', detail: `HTTP ${r.status}` });
      } catch (e: any) {
        out.push({ key: addon.name + ' manifest', status: 'err', detail: e.message });
      }

      // Test primo catalogo
      for (const cat of (addon.catalogs ?? []).slice(0, 1)) {
        const url = `${base}/catalog/${cat.type}/${cat.id}.json`;
        try {
          const r = await fetch(url);
          const text = await r.text();
          let count = 0;
          try { count = JSON.parse(text)?.metas?.length ?? 0; } catch {}
          out.push({
            key: `${addon.name}/${cat.type}/${cat.id}`,
            status: r.ok ? 'ok' : 'err',
            detail: r.ok ? `${count} items` : `HTTP ${r.status}: ${text.slice(0, 100)}`,
          });
        } catch (e: any) {
          out.push({ key: `${addon.name}/${cat.type}/${cat.id}`, status: 'err', detail: e.message });
        }
      }
    }

    setResults(out);
    setTesting(false);
  }

  return (
    <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5 overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
          <Bug size={14} /> Debug — Diagnostica cataloghi
        </div>
        {open ? <ChevronUp size={14} className="text-yellow-400/60" /> : <ChevronDown size={14} className="text-yellow-400/60" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="text-xs text-white/50">
            Addon nello store: <span className="text-white font-mono">{addons.length}</span>
            {addons.map(a => (
              <span key={a.id} className="ml-2 px-1.5 py-0.5 bg-white/10 rounded text-white/70">{a.name} ({a.catalogs?.length ?? 0} cat)</span>
            ))}
          </div>

          <button onClick={runTest} disabled={testing}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-xs transition-colors disabled:opacity-50">
            {testing ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
            {testing ? 'Test in corso...' : 'Testa connessione addon'}
          </button>

          {results.length > 0 && (
            <div className="space-y-1">
              {results.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs font-mono">
                  <span className={clsx(
                    'flex-shrink-0',
                    r.status === 'ok' ? 'text-green-400' : r.status === 'err' ? 'text-red-400' : 'text-white/40'
                  )}>
                    {r.status === 'ok' ? '✓' : r.status === 'err' ? '✗' : '·'}
                  </span>
                  <span className="text-white/60">{r.key}:</span>
                  <span className={r.status === 'err' ? 'text-red-300' : 'text-white/80'}>{r.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

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
      <p className="mt-1.5 text-xs text-white/80 truncate group-hover:text-white">{item.name}</p>
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
      <div className="mb-2 flex items-center gap-2 text-red-400/60 text-xs px-1">
        <AlertCircle size={11} />
        <span>{row.label}: {row.error.slice(0, 120)}</span>
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
          : row.items.map((item) => <MediaCard key={item.id} item={item} rpdbKey={rpdbKey} />)}
      </div>
    </section>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { addons, settings } = useAppStore();
  const { items: cwItems, loading: cwLoading, source: cwSource } = useContinueWatching();
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const rpdbKey = settings.rpdbKey || undefined;

  const addonsKey = addons.map(a => a.id).join('|');

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
      setShowDebug(true);
      setRows([]);
      return;
    }

    setRows(catalogList);

    catalogList.forEach(({ key, addon, catalog }) => {
      fetchCatalog(addon.url, catalog.type, catalog.id)
        .then((items) => setRows(prev => prev.map(r => r.key === key ? { ...r, items, loading: false } : r)))
        .catch((err: any) => {
          console.error('Catalog error:', addon.url, catalog.type, catalog.id, err);
          setRows(prev => prev.map(r => r.key === key ? { ...r, loading: false, error: String(err?.message ?? err) } : r));
          setShowDebug(true);
        });
    });
  }, [addonsKey]);

  if (addons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-bg, #7c3aed26)' }}>
          <Plus size={32} style={{ color: 'var(--accent, #7c3aed)' }} />
        </div>
        <h1 className="text-2xl font-bold text-white">Nessun addon installato</h1>
        <p className="text-white/50 max-w-sm">Vai nella sezione Addon e aggiungi Cinemeta.</p>
        <Link to="/addons" className="mt-2 px-6 py-2.5 text-white rounded-lg font-medium" style={{ backgroundColor: 'var(--accent, #7c3aed)' }}>
          Gestisci Addon
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 overflow-y-auto h-full">

      {/* Debug panel — si apre automaticamente se ci sono errori */}
      {(showDebug || rows.every(r => !r.loading && r.items.length === 0 && !r.error === false)) && (
        <DebugPanel addons={addons} />
      )}

      {/* Bottone debug manuale */}
      {!showDebug && (
        <button onClick={() => setShowDebug(true)}
          className="mb-4 flex items-center gap-1.5 text-xs text-white/20 hover:text-white/40 transition-colors">
          <Bug size={11} /> diagnostica
        </button>
      )}

      {/* Continue watching */}
      {(cwItems.length > 0 || cwLoading) && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Clock size={14} style={{ color: 'var(--accent, #7c3aed)' }} />
            <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Continua a guardare</h2>
            <span className="text-xs text-white/30">· {SOURCE_LABEL[cwSource] ?? cwSource}</span>
            {cwSource !== 'local' && <span className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--accent)' }}><Zap size={10} /> sync</span>}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {cwLoading
              ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex-shrink-0 w-36 h-52 rounded-lg bg-white/5 animate-pulse" />)
              : cwItems.map((entry) => (
                  <Link key={`${entry.id}-${entry.watchedAt}`} to={`/detail/${entry.type}/${encodeURIComponent(entry.id)}`} className="flex-shrink-0 w-36 group">
                    <div className="relative w-36 h-52 rounded-lg overflow-hidden bg-white/5 border border-white/10 group-hover:border-[color:var(--accent,#7c3aed)] transition-all">
                      {entry.poster ? <img src={entry.poster} alt={entry.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        : <div className="w-full h-full flex items-center justify-center text-white/20"><Play size={32} /></div>}
                      {entry.progress !== undefined && entry.progress > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                          <div className="h-full" style={{ width: `${Math.min(entry.progress * 100, 100)}%`, backgroundColor: 'var(--accent)' }} />
                        </div>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-white/80 truncate">{entry.name}</p>
                  </Link>
                ))}
          </div>
        </section>
      )}

      {rows.map((row) => <RowSection key={row.key} row={row} rpdbKey={rpdbKey} />)}
    </div>
  );
}