/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { installAddon, openExternal, normalizeUrl } from '../api/stremio';
import { Addon } from '../lib/types';
import {
  Plus, Trash2, ArrowUp, ArrowDown, ExternalLink, Loader2,
  AlertCircle, CheckCircle2, Search, Settings2, Globe, Grid,
  X, RefreshCw, Star, Package,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Tipi per il catalogo stremio-addons.net ──────────────────────────────────

interface CatalogAddon {
  transportUrl: string;
  transportName: string;
  manifest: {
    id: string;
    name: string;
    description?: string;
    version?: string;
    logo?: string;
    types?: string[];
    catalogs?: any[];
  };
  flags?: { official?: boolean; protected?: boolean };
}

// ─── Fetch addon da stremio-addons.net ────────────────────────────────────────
// API ufficiale: https://stremio-addons.net/api/v2/list
async function fetchAddonCatalog(search = '', page = 1): Promise<{ addons: CatalogAddon[]; total: number }> {
  try {
    const params = new URLSearchParams({ take: '30', skip: String((page - 1) * 30) });
    if (search) params.set('search', search);
    const res = await fetch(`https://stremio-addons.net/api/v2/list?${params}`);
    if (!res.ok) return { addons: [], total: 0 };
    const data = await res.json();
    return { addons: data.addons ?? [], total: data.total ?? 0 };
  } catch {
    return { addons: [], total: 0 };
  }
}

// ─── Gear dialog per configurazione addon ────────────────────────────────────

function AddonGearDialog({ addon, onClose }: { addon: Addon; onClose: () => void }) {
  const { updateAddon } = useStore();
  const [name, setName] = useState(addon.name);
  const [logo, setLogo] = useState(addon.logo ?? '');
  const [saved, setSaved] = useState(false);

  // URL configurazione: molti addon Stremio hanno /configure come pagina web
  const configUrl = `${normalizeUrl(addon.url)}/configure`;

  function save() {
    updateAddon(addon.id, { name, logo: logo || undefined });
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1000);
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Settings2 size={16} style={{ color: 'var(--accent)' }} />
            Configura addon
          </h2>
          <button onClick={onClose}><X size={18} className="text-white/40 hover:text-white" /></button>
        </div>

        {/* Info base */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">Nome</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">URL Logo</label>
            <input value={logo} onChange={e => setLogo(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white placeholder:text-white/30" />
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">URL Addon</label>
            <input value={addon.url} readOnly
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/5 text-sm text-white/50 font-mono cursor-default" />
          </div>
        </div>

        {/* Pagina configurazione esterna */}
        <div className="border-t border-white/[0.06] pt-4">
          <p className="text-xs text-white/40 mb-2">Molti addon hanno una pagina di configurazione web (token, filtri, ecc.):</p>
          <button onClick={() => openExternal(configUrl)}
            className="flex items-center gap-2 w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-sm text-white/70 hover:text-white transition-colors">
            <ExternalLink size={14} />
            Apri pagina configurazione
          </button>
          <p className="text-xs text-white/30 mt-1 font-mono">{configUrl}</p>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/50 hover:text-white bg-white/5 rounded-xl">Annulla</button>
          <button onClick={save} className="px-4 py-2 text-sm text-white rounded-xl flex items-center gap-2" style={{ backgroundColor: 'var(--accent)' }}>
            {saved ? <><CheckCircle2 size={14} />Salvato!</> : <><Settings2 size={14} />Salva</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card addon dal catalogo ──────────────────────────────────────────────────

function CatalogCard({ item, installed, onInstall }: {
  item: CatalogAddon;
  installed: boolean;
  onInstall: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const logo = item.manifest.logo;
  const types = item.manifest.types?.join(', ') ?? '';

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/10 overflow-hidden flex items-center justify-center">
        {logo && !imgErr
          ? <img src={logo} alt={item.manifest.name} className="w-full h-full object-contain p-1" onError={() => setImgErr(true)} />
          : <Package size={22} className="text-white/30" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white truncate">{item.manifest.name}</p>
          {item.flags?.official && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 flex-shrink-0">✓ Ufficiale</span>
          )}
        </div>
        {item.manifest.description && (
          <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{item.manifest.description}</p>
        )}
        {types && <p className="text-xs text-white/30 mt-1">{types}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => openExternal(item.transportUrl)}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-colors"
          title="Apri pagina addon"
        >
          <ExternalLink size={14} />
        </button>
        <button
          onClick={onInstall}
          disabled={installed}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            installed
              ? 'bg-green-500/20 text-green-400 cursor-default'
              : 'text-white cursor-pointer hover:opacity-90'
          )}
          style={installed ? {} : { backgroundColor: 'var(--accent)' }}
        >
          {installed ? '✓ Installato' : 'Installa'}
        </button>
      </div>
    </div>
  );
}

// ─── Addons page ──────────────────────────────────────────────────────────────

export default function Addons() {
  const { addons, addAddon, removeAddon, reorderAddon } = useStore();
  const [url, setUrl] = useState('');
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [gearAddon, setGearAddon] = useState<Addon | null>(null);

  // Catalogo stremio-addons.net
  const [catalogTab, setCatalogTab] = useState<'installed' | 'catalog'>('installed');
  const [catalogItems, setCatalogItems] = useState<CatalogAddon[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [searchDebounce, setSearchDebounce] = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(catalogSearch), 400);
    return () => clearTimeout(t);
  }, [catalogSearch]);

  useEffect(() => {
    if (catalogTab === 'catalog') {
      setCatalogPage(1);
      loadCatalog(searchDebounce, 1);
    }
  }, [catalogTab, searchDebounce]);

  async function loadCatalog(search = searchDebounce, page = catalogPage) {
    setCatalogLoading(true);
    const { addons: items, total } = await fetchAddonCatalog(search, page);
    if (page === 1) setCatalogItems(items);
    else setCatalogItems(prev => [...prev, ...items]);
    setCatalogTotal(total);
    setCatalogLoading(false);
  }

  async function install(rawUrl = url) {
    if (!rawUrl.trim()) return;
    setInstalling(true); setError(null); setSuccess(null);
    try {
      const addon = await installAddon(rawUrl.trim());
      addAddon(addon);
      setUrl('');
      setSuccess(`✓ ${addon.name} installato`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e.message ?? 'Impossibile installare');
    } finally { setInstalling(false); }
  }

  const isInstalled = (id: string) => addons.some(a => a.id === id);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tabs */}
      <div className="flex-shrink-0 px-6 pt-5 pb-0 border-b border-white/[0.06]">
        <h1 className="text-lg font-bold text-white mb-4">Addon</h1>
        <div className="flex gap-1">
          {([
            { id: 'installed', label: `Installati (${addons.length})`, icon: Package },
            { id: 'catalog', label: 'Catalogo Stremio', icon: Globe },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setCatalogTab(id)}
              className={clsx('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                catalogTab === id ? 'text-white border-[color:var(--accent)]' : 'text-white/50 border-transparent hover:text-white/70')}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* ── TAB: INSTALLATI ─────────────────────────────────────────── */}
        {catalogTab === 'installed' && (
          <>
            {/* Installa manuale */}
            <section>
              <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">Aggiungi tramite URL</h2>
              <div className="flex gap-2">
                <input value={url} onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && install()}
                  placeholder="https://... oppure stremio://..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white placeholder:text-white/30" />
                <button onClick={() => install()} disabled={!url.trim() || installing}
                  className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-medium text-sm disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent)' }}>
                  {installing ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  Installa
                </button>
              </div>
              {error && <p className="mt-2 flex items-center gap-2 text-red-400 text-xs"><AlertCircle size={13} />{error}</p>}
              {success && <p className="mt-2 flex items-center gap-2 text-green-400 text-xs"><CheckCircle2 size={13} />{success}</p>}
            </section>

            {/* Lista installati */}
            <section>
              <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">Addon attivi</h2>
              {addons.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-white/10 rounded-xl text-white/30 text-sm">
                  Nessun addon. Vai al tab "Catalogo Stremio" per aggiungerne.
                </div>
              ) : (
                <div className="space-y-2">
                  {addons.map((addon, i) => (
                    <div key={addon.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                      {/* Logo */}
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {addon.logo
                          ? <img src={addon.logo} alt={addon.name} className="w-full h-full object-contain p-1"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          : <Package size={18} className="text-white/30" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{addon.name}</p>
                        <p className="text-xs text-white/40">
                          v{addon.version} · {addon.catalogs.length} cataloghi
                          {addon.types.length > 0 && ` · ${addon.types.join(', ')}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Gear - configurazione */}
                        <button onClick={() => setGearAddon(addon)}
                          title="Configura"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                          <Settings2 size={15} />
                        </button>
                        {/* Apri pagina web addon */}
                        <button onClick={() => openExternal(`${normalizeUrl(addon.url)}/manifest.json`)}
                          title="Apri URL"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                          <ExternalLink size={14} />
                        </button>
                        {/* Riordina */}
                        <button onClick={() => reorderAddon(addon.id, 'up')} disabled={i === 0}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-20">
                          <ArrowUp size={14} />
                        </button>
                        <button onClick={() => reorderAddon(addon.id, 'down')} disabled={i === addons.length - 1}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-20">
                          <ArrowDown size={14} />
                        </button>
                        {/* Rimuovi */}
                        <button onClick={() => { if (confirm(`Rimuovere ${addon.name}?`)) removeAddon(addon.id); }}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* ── TAB: CATALOGO STREMIO ───────────────────────────────────── */}
        {catalogTab === 'catalog' && (
          <>
            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                placeholder="Cerca addon (es. Torrentio, OpenSubtitles, RPDB...)"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white placeholder:text-white/30"
              />
              {catalogSearch && (
                <button onClick={() => setCatalogSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>

            {catalogLoading && catalogItems.length === 0 ? (
              <div className="flex items-center justify-center h-40 gap-3 text-white/40">
                <Loader2 size={20} className="animate-spin" />Caricamento catalogo...
              </div>
            ) : catalogItems.length === 0 ? (
              <div className="text-center py-10 text-white/30 text-sm">
                <Globe size={32} className="mx-auto mb-3 opacity-30" />
                <p>Nessun addon trovato{catalogSearch ? ` per "${catalogSearch}"` : ''}.</p>
                <p className="text-xs mt-1">Controlla la connessione internet.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-white/30">{catalogTotal} addon disponibili{catalogSearch ? ` · filtrati per "${catalogSearch}"` : ''}</p>
                <div className="space-y-2">
                  {catalogItems.map(item => (
                    <CatalogCard
                      key={item.manifest.id}
                      item={item}
                      installed={isInstalled(item.manifest.id)}
                      onInstall={() => install(item.transportUrl)}
                    />
                  ))}
                </div>

                {/* Load more */}
                {catalogItems.length < catalogTotal && (
                  <button
                    onClick={() => {
                      const nextPage = catalogPage + 1;
                      setCatalogPage(nextPage);
                      loadCatalog(searchDebounce, nextPage);
                    }}
                    disabled={catalogLoading}
                    className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/60 hover:text-white flex items-center justify-center gap-2 transition-colors"
                  >
                    {catalogLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                    Carica altri ({catalogTotal - catalogItems.length} rimanenti)
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Gear dialog */}
      {gearAddon && <AddonGearDialog addon={gearAddon} onClose={() => setGearAddon(null)} />}
    </div>
  );
}
