/// <reference types="vite/client" />
import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../lib/store';
import { installAddon, openExternal, normalizeUrl } from '../api/stremio';
import { Addon } from '../lib/types';
import {
  Plus, Trash2, ArrowUp, ArrowDown, ExternalLink, Loader2,
  AlertCircle, CheckCircle2, Search, Settings2, Globe,
  X, RefreshCw, Package, Star, Tag,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Lista addon popolari hardcoded (fallback quando stremio-addons.net non è raggiungibile) ──

const POPULAR_ADDONS = [
  {
    id: 'com.linvo.cinemeta',
    name: 'Cinemeta',
    description: 'Metadata ufficiali Stremio per film e serie',
    url: 'https://v3-cinemeta.strem.io/manifest.json',
    logo: 'https://v3-cinemeta.strem.io/static/imgs/logo.png',
    types: ['movie', 'series'],
    official: true,
    category: 'Metadata',
  },
  {
    id: 'com.stremio.torrentio',
    name: 'Torrentio',
    description: 'Stream torrent da più provider. Supporta Real-Debrid, AllDebrid e altri',
    url: 'https://torrentio.strem.fun/manifest.json',
    logo: 'https://torrentio.strem.fun/static/imgs/logo.png',
    types: ['movie', 'series'],
    official: false,
    category: 'Stream',
    configUrl: 'https://torrentio.strem.fun',
  },
  {
    id: 'org.opensubtitles.v3',
    name: 'OpenSubtitles v3',
    description: 'Sottotitoli in tutte le lingue da OpenSubtitles.com',
    url: 'https://opensubtitles-v3.strem.io/manifest.json',
    logo: 'https://opensubtitles-v3.strem.io/static/imgs/logo.png',
    types: ['movie', 'series'],
    official: true,
    category: 'Sottotitoli',
  },
  {
    id: 'com.stremio.rpdb',
    name: 'RPDB Posters',
    description: 'Copertine con rating sovrapposto (richiede API key gratuita)',
    url: 'https://rpdb.strem.io/manifest.json',
    logo: 'https://rpdb.strem.io/static/imgs/logo.png',
    types: ['movie', 'series'],
    official: false,
    category: 'Metadata',
    configUrl: 'https://ratingposterdb.com',
  },
  {
    id: 'com.stremio.kitsu',
    name: 'Anime Kitsu',
    description: 'Catalogo e metadata anime da Kitsu.io',
    url: 'https://anime-kitsu.strem.fun/manifest.json',
    logo: 'https://anime-kitsu.strem.fun/static/imgs/logo.png',
    types: ['series', 'anime'],
    official: false,
    category: 'Anime',
  },
  {
    id: 'community.thepiratebay',
    name: 'The Pirate Bay+',
    description: 'Stream torrent da The Pirate Bay',
    url: 'https://thepiratebay.strem.fun/manifest.json',
    logo: '',
    types: ['movie', 'series'],
    official: false,
    category: 'Stream',
  },
  {
    id: 'com.stremio.imvdb',
    name: 'IMVDb',
    description: 'Video musicali da IMVDb',
    url: 'https://imvdb.strem.io/manifest.json',
    logo: '',
    types: ['movie'],
    official: false,
    category: 'Musica',
  },
  {
    id: 'community.subsource',
    name: 'SubSource',
    description: 'Sottotitoli italiani e multilingua da SubSource',
    url: 'https://subsource.strem.fun/manifest.json',
    logo: '',
    types: ['movie', 'series'],
    official: false,
    category: 'Sottotitoli',
  },
  {
    id: 'community.dlive',
    name: 'DLive',
    description: 'Stream live da DLive',
    url: 'https://dlive.strem.fun/manifest.json',
    logo: '',
    types: ['tv'],
    official: false,
    category: 'Live TV',
  },
  {
    id: 'community.stremio-jackett',
    name: 'Jackett Addon',
    description: 'Stream da Jackett (richiede server locale)',
    url: 'https://stremio-jackett.strem.fun/manifest.json',
    logo: '',
    types: ['movie', 'series'],
    official: false,
    category: 'Stream',
  },
];

const CATEGORIES = ['Tutti', ...Array.from(new Set(POPULAR_ADDONS.map(a => a.category)))];

// ─── Fetch da stremio-addons.net con fallback ─────────────────────────────────

async function fetchFromStremioNet(search = '', page = 1): Promise<{ addons: any[]; total: number; fromNet: boolean }> {
  // Prova vari endpoint
  const endpoints = [
    `https://stremio-addons.net/api/v2/list?take=30&skip=${(page-1)*30}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
    `https://stremio-addons.net/api/v1/list?page=${page}${search ? `&q=${encodeURIComponent(search)}` : ''}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const d = await res.json();
        const addons = d.addons ?? d.items ?? d.data ?? [];
        if (Array.isArray(addons) && addons.length > 0) {
          return { addons, total: d.total ?? d.count ?? addons.length, fromNet: true };
        }
      }
    } catch { /* prova prossimo endpoint */ }
  }

  // Fallback: lista locale filtrata
  const filtered = POPULAR_ADDONS.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase())
  );
  return { addons: filtered, total: filtered.length, fromNet: false };
}

// ─── Gear dialog ──────────────────────────────────────────────────────────────

function GearDialog({ addon, onClose }: { addon: Addon; onClose: () => void }) {
  const { updateAddon } = useStore();
  const [name, setName] = useState(addon.name);
  const [logo, setLogo] = useState(addon.logo ?? '');
  const [saved, setSaved] = useState(false);
  const configUrl = `${normalizeUrl(addon.url)}/configure`;

  function save() {
    updateAddon(addon.id, { name, logo: logo || undefined });
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 800);
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Settings2 size={16} style={{ color: 'var(--accent)' }} /> Configura: {addon.name}
          </h2>
          <button onClick={onClose}><X size={18} className="text-white/40 hover:text-white" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider mb-1.5 block">Nome visualizzato</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider mb-1.5 block">URL Logo</label>
            <input value={logo} onChange={e => setLogo(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white placeholder:text-white/30" />
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider mb-1.5 block">URL Manifest</label>
            <div className="flex gap-2">
              <input value={`${addon.url}/manifest.json`} readOnly
                className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-white/40 font-mono" />
              <button onClick={() => openExternal(`${addon.url}/manifest.json`)}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white">
                <ExternalLink size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-4">
          <p className="text-xs text-white/40 mb-2">Pagina di configurazione dell'addon (per impostare token, filtri, ecc.):</p>
          <div className="space-y-2">
            <button onClick={() => openExternal(configUrl)}
              className="flex items-center gap-2 w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 hover:text-white transition-colors">
              <Globe size={14} />Apri /configure nel browser
            </button>
            <button onClick={() => openExternal(`${normalizeUrl(addon.url)}/manifest.json`)}
              className="flex items-center gap-2 w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 hover:text-white transition-colors">
              <ExternalLink size={14} />Apri manifest.json
            </button>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/50 bg-white/5 rounded-xl hover:bg-white/10">Annulla</button>
          <button onClick={save} className="px-4 py-2 text-sm text-white rounded-xl flex items-center gap-2" style={{ backgroundColor: 'var(--accent)' }}>
            {saved ? <><CheckCircle2 size={14} />Salvato</> : <><Settings2 size={14} />Salva</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Addon Card (catalogo) ────────────────────────────────────────────────────

function CatalogAddonCard({ item, installed, onInstall, installing }: {
  item: any; installed: boolean; onInstall: () => void; installing: boolean;
}) {
  const [imgErr, setImgErr] = useState(false);
  const logo = item.logo ?? item.manifest?.logo;
  const name = item.name ?? item.manifest?.name ?? 'Unknown';
  const description = item.description ?? item.manifest?.description ?? '';
  const types: string[] = item.types ?? item.manifest?.types ?? [];
  const official = item.official ?? item.flags?.official ?? false;
  const category = item.category ?? '';
  const configUrl = item.configUrl;

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors group">
      {/* Logo */}
      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
        {logo && !imgErr
          ? <img src={logo} alt={name} className="w-full h-full object-contain p-1.5" onError={() => setImgErr(true)} />
          : <Package size={20} className="text-white/30" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-white">{name}</p>
          {official && <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">✓ Ufficiale</span>}
          {category && <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">{category}</span>}
        </div>
        {description && <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{description}</p>}
        {types.length > 0 && <p className="text-xs text-white/30 mt-1">{types.join(' · ')}</p>}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {configUrl && (
          <button onClick={() => openExternal(configUrl)} title="Configura"
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-colors">
            <Settings2 size={13} />
          </button>
        )}
        <button onClick={() => openExternal(item.url ?? item.transportUrl ?? '')} title="Apri pagina"
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-colors">
          <ExternalLink size={13} />
        </button>
        <button onClick={onInstall} disabled={installed || installing}
          className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-w-[80px] text-center',
            installed ? 'bg-green-500/15 text-green-400 border border-green-500/20 cursor-default'
            : installing ? 'bg-white/10 text-white/50 cursor-wait'
            : 'text-white cursor-pointer hover:opacity-90')}
          style={!installed && !installing ? { backgroundColor: 'var(--accent)' } : {}}>
          {installed ? '✓ Installato' : installing ? 'Installo...' : 'Installa'}
        </button>
      </div>
    </div>
  );
}

// ─── Addons page ──────────────────────────────────────────────────────────────

export default function Addons() {
  const { addons, addAddon, removeAddon, reorderAddon } = useStore();
  const [url, setUrl] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [gearAddon, setGearAddon] = useState<Addon | null>(null);
  const [catalogTab, setCatalogTab] = useState<'installed' | 'catalog' | 'web'>('installed');

  // Catalogo
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('Tutti');
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogFromNet, setCatalogFromNet] = useState(false);
  const [searchDebounce, setSearchDebounce] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(catalogSearch), 400);
    return () => clearTimeout(t);
  }, [catalogSearch]);

  useEffect(() => {
    if (catalogTab === 'catalog') { //
      setCatalogPage(1);
      loadCatalog(searchDebounce, 1, true);
    }
  }, [catalogTab, searchDebounce]);

  const loadCatalog = useCallback(async (search: string, page: number, reset = false) => {
    setCatalogLoading(true);
    const { addons: items, total, fromNet } = await fetchFromStremioNet(search, page);
    if (reset || page === 1) setCatalogItems(items);
    else setCatalogItems(prev => [...prev, ...items]);
    setCatalogTotal(total);
    setCatalogFromNet(fromNet);
    setCatalogLoading(false);
  }, []);

  async function install(rawUrl = url) {
    const cleanUrl = rawUrl.trim();
    if (!cleanUrl) return;
    setInstalling(cleanUrl);
    setError(null); setSuccess(null);
    try {
      const addon = await installAddon(cleanUrl);
      addAddon(addon);
      if (rawUrl === url) setUrl('');
      setSuccess(`✓ ${addon.name} installato con successo`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e.message ?? 'Impossibile installare l\'addon');
    } finally { setInstalling(null); }
  }

  const isInstalled = (id: string) => addons.some(a => a.id === id);

  // Filtro per categoria (solo lista locale)
  const displayItems = catalogCategory === 'Tutti'
    ? catalogItems
    : catalogItems.filter(i => (i.category ?? '') === catalogCategory);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tabs */}
      <div className="flex-shrink-0 px-6 pt-5 pb-0 border-b border-white/[0.06]">
        <h1 className="text-lg font-bold text-white mb-4">Addon</h1>
        <div className="flex gap-1">
          {[
            { id: 'installed' as const, label: `Installati (${addons.length})`, icon: Package },
            { id: 'catalog' as const, label: 'Catalogo', icon: Globe },
            { id: 'web' as const, label: 'Stremio Web', icon: ExternalLink },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setCatalogTab(id)}
              className={clsx('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                catalogTab === id ? 'text-white border-[color:var(--accent)]' : 'text-white/50 border-transparent hover:text-white/70')}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* ── INSTALLATI ─────────────────────────────────────────────────── */}
        {catalogTab !== 'web' && catalogTab === 'installed' && (
          <>
            <div>
              <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">Aggiungi tramite URL</h2>
              <div className="flex gap-2">
                <input value={url} onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && install()}
                  placeholder="https://... oppure stremio://..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white placeholder:text-white/30" />
                <button onClick={() => install()} disabled={!url.trim() || !!installing}
                  className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-medium text-sm disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent)' }}>
                  {installing ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}Installa
                </button>
              </div>
              {error && <p className="mt-2 flex items-center gap-2 text-red-400 text-xs"><AlertCircle size={13} />{error}</p>}
              {success && <p className="mt-2 flex items-center gap-2 text-green-400 text-xs"><CheckCircle2 size={13} />{success}</p>}
            </div>

            {addons.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-white/10 rounded-xl text-white/30">
                <Package size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nessun addon installato</p>
                <p className="text-xs mt-1">Vai al tab "Catalogo Stremio" per aggiungere addon</p>
              </div>
            ) : (
              <div className="space-y-2">
                {addons.map((addon, i) => (
                  <div key={addon.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {addon.logo
                        ? <img src={addon.logo} alt={addon.name} className="w-full h-full object-contain p-1" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                        : <Package size={18} className="text-white/30" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{addon.name}</p>
                      <p className="text-xs text-white/40">v{addon.version} · {addon.catalogs.length} cataloghi · {addon.types.join(', ')}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setGearAddon(addon)} title="Configura"
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                        <Settings2 size={15} />
                      </button>
                      <button onClick={() => openExternal(`${normalizeUrl(addon.url)}/configure`)} title="Apri configurazione"
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                        <ExternalLink size={14} />
                      </button>
                      <button onClick={() => reorderAddon(addon.id, 'up')} disabled={i === 0}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-20 transition-colors">
                        <ArrowUp size={14} />
                      </button>
                      <button onClick={() => reorderAddon(addon.id, 'down')} disabled={i === addons.length - 1}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-20 transition-colors">
                        <ArrowDown size={14} />
                      </button>
                      <button onClick={() => { if (confirm(`Rimuovere ${addon.name}?`)) removeAddon(addon.id); }}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── CATALOGO ───────────────────────────────────────────────────── */}
        {catalogTab !== 'web' && catalogTab === 'catalog' && (
          <>
            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)}
                placeholder="Cerca addon (es. Torrentio, OpenSubtitles, Jackett...)"
                className="w-full pl-10 pr-8 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white placeholder:text-white/30" />
              {catalogSearch && <button onClick={() => setCatalogSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X size={14} /></button>}
            </div>

            {/* Fonte + categorie */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-1.5 flex-wrap">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setCatalogCategory(cat)}
                    className={clsx('text-xs px-3 py-1.5 rounded-full border transition-colors',
                      catalogCategory === cat
                        ? 'border-[color:var(--accent)] bg-[color:var(--accent-bg)] text-[color:var(--accent)]'
                        : 'border-white/10 text-white/50 hover:text-white hover:border-white/20')}>
                    {cat}
                  </button>
                ))}
              </div>
              <span className="text-xs text-white/30 flex items-center gap-1.5">
                {catalogFromNet ? <><Globe size={11} className="text-green-400" />stremio-addons.net</> : <><Package size={11} />Lista locale</>}
              </span>
            </div>

            {catalogLoading && displayItems.length === 0 ? (
              <div className="flex items-center justify-center h-40 gap-3 text-white/40">
                <Loader2 size={20} className="animate-spin" />Caricamento...
              </div>
            ) : displayItems.length === 0 ? (
              <div className="text-center py-10 text-white/30">
                <Globe size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nessun addon trovato{catalogSearch ? ` per "${catalogSearch}"` : ''}</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {displayItems.map((item: any) => {
                    const id = item.id ?? item.manifest?.id ?? '';
                    const url = item.url ?? item.transportUrl ?? '';
                    return (
                      <CatalogAddonCard
                        key={id}
                        item={item}
                        installed={isInstalled(id)}
                        onInstall={() => install(url)}
                        installing={installing === url}
                      />
                    );
                  })}
                </div>

                {catalogFromNet && catalogItems.length < catalogTotal && (
                  <button onClick={() => { const next = catalogPage + 1; setCatalogPage(next); loadCatalog(searchDebounce, next); }}
                    disabled={catalogLoading}
                    className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/60 hover:text-white flex items-center justify-center gap-2 transition-colors">
                    {catalogLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                    Carica altri ({catalogTotal - catalogItems.length} rimanenti)
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── WEB TAB ───────────────────────────────────────────────────── */}
        {catalogTab === 'web' && (
          <div className="flex flex-col h-full -mx-6 -mt-5 absolute inset-0 top-[48px]">
            <div className="flex items-center gap-3 px-4 py-2 border-b border-white/[0.06] flex-shrink-0 bg-[#1a1a1f]">
              <span className="text-xs text-white/40 truncate">stremio-addons.net — installa addon, poi copia l'URL manifest nel tab Installati</span>
              <button onClick={() => openExternal('https://stremio-addons.net')}
                className="flex items-center gap-1 text-xs text-[color:var(--accent)] hover:underline ml-auto flex-shrink-0 whitespace-nowrap">
                <ExternalLink size={11} />Apri nel browser
              </button>
            </div>
            <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
              <iframe
                src="https://stremio-addons.net"
                className="w-full h-full border-0"
                style={{ display: 'block', height: '100%' }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                title="Stremio Addons"
                allow="fullscreen"
              />
            </div>
          </div>
        )}

      {gearAddon && <GearDialog addon={gearAddon} onClose={() => setGearAddon(null)} />}
    </div>
  );
}
