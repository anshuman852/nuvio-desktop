/// <reference types="vite/client" />
import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { fetchCatalog } from '../api/stremio';
import { useContinueWatching } from '../hooks/useContinueWatching';
import { MetaItem, Addon, AddonCatalog } from '../lib/types';
import { Play, Clock, Plus, Zap, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import clsx from 'clsx';

const SOURCE_LABEL: Record<string, string> = {
  trakt: 'Trakt', simkl: 'Simkl', nuvio: 'Nuvio', local: 'Locale',
};

// ─── Hero featued (primo item del primo catalogo) ─────────────────────────────

function HeroSection({ item }: { item: MetaItem }) {
  const navigate = useNavigate();
  return (
    <div className="relative w-full h-[56vw] max-h-[420px] min-h-[280px] flex-shrink-0 overflow-hidden">
      {item.background
        ? <img src={item.background} alt={item.name} className="absolute inset-0 w-full h-full object-cover object-top" />
        : item.poster
        ? <img src={item.poster} alt={item.name} className="absolute inset-0 w-full h-full object-cover object-top blur-sm scale-105" />
        : <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-black" />}

      {/* Gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f13]/95 via-[#0f0f13]/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f13] via-transparent to-black/20" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-8">
        {item.logo
          ? <img src={item.logo} alt={item.name} className="h-16 max-w-xs object-contain mb-3 drop-shadow-2xl" />
          : <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-2xl mb-3 max-w-lg leading-tight">{item.name}</h1>}

        <div className="flex items-center gap-2 text-sm text-white/70 mb-3">
          {item.type === 'series' ? <span className="text-white/50">Serie</span> : <span className="text-white/50">Film</span>}
          {item.genres?.[0] && <><span className="w-1 h-1 rounded-full bg-white/40" /><span>{item.genres[0]}</span></>}
          {item.releaseInfo && <><span className="w-1 h-1 rounded-full bg-white/40" /><span>{item.releaseInfo}</span></>}
        </div>

        {item.description && (
          <p className="text-sm text-white/70 max-w-md line-clamp-2 mb-5">{item.description}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/detail/${item.type}/${encodeURIComponent(item.id)}`)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors shadow-xl">
            <Play size={16} className="fill-black" /> Riproduci
          </button>
          <button
            onClick={() => navigate(`/detail/${item.type}/${encodeURIComponent(item.id)}`)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/20 backdrop-blur-sm text-white font-semibold text-sm hover:bg-white/30 transition-colors border border-white/10">
            <Info size={16} /> Info
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Poster card ──────────────────────────────────────────────────────────────

function PosterCard({ item }: { item: any }) {
  const [imgErr, setImgErr] = useState(false);
  const [tmdbPoster, setTmdbPoster] = useState<string|null>(null);
  const { settings } = useStore();
  const progress = item.progress;

  // Carica poster da TMDB se mancante
  useEffect(() => {
    if (item.poster || !item.id || !settings.tmdbApiKey) return;
    const imdbId = item.id.startsWith('tt') ? item.id : null;
    if (!imdbId) return;
    fetch(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${settings.tmdbApiKey}&external_source=imdb_id`)
      .then(r => r.json())
      .then(d => {
        const r = (d.movie_results ?? d.tv_results ?? [])[0];
        if (r?.poster_path) setTmdbPoster(`https://image.tmdb.org/t/p/w342${r.poster_path}`);
      })
      .catch(() => {});
  }, [item.id, item.poster, settings.tmdbApiKey]);

  const posterSrc = item.poster || tmdbPoster;

  return (
    <Link to={`/detail/${item.type}/${encodeURIComponent(item.id)}`} className="flex-shrink-0 group">
      <div className="relative w-[120px] h-[180px] rounded-xl overflow-hidden bg-white/5 border border-white/[0.06] group-hover:border-white/20 transition-all duration-200 group-hover:scale-[1.04] shadow-lg">
        {posterSrc && !imgErr
          ? <img src={posterSrc} alt={item.name} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-white/10"><Play size={28} /></div>}

        {/* Hover play overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
            <Play size={18} className="text-white fill-white ml-1" />
          </div>
        </div>

        {/* Episode badge */}
        {item.season && item.episode && (
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs text-white/80 font-mono">
            S{item.season}E{item.episode}
          </div>
        )}

        {/* Progress bar */}
        {progress !== undefined && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
            <div className="h-full rounded-full" style={{ width: `${Math.min(progress * 100, 100)}%`, backgroundColor: 'var(--accent)' }} />
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-white/70 group-hover:text-white truncate w-[120px] transition-colors">{item.name}</p>
      {item.releaseInfo && <p className="text-xs text-white/30">{item.releaseInfo}</p>}
    </Link>
  );
}

// ─── Catalog row ──────────────────────────────────────────────────────────────

function CatalogRow({ title, subtitle, items, loading }: {
  title: string; subtitle?: string; items: any[]; loading: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  function scroll(dir: 'left' | 'right') {
    if (!rowRef.current) return;
    rowRef.current.scrollBy({ left: dir === 'right' ? 400 : -400, behavior: 'smooth' });
  }

  if (!loading && items.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-baseline gap-2 mb-3 px-6">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <span className="text-xs text-white/30">{subtitle}</span>}
      </div>
      <div className="relative group/row">
        {/* Scroll buttons */}
        <button onClick={() => scroll('left')}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-black/90">
          <ChevronLeft size={16} />
        </button>
        <button onClick={() => scroll('right')}
          className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-black/90">
          <ChevronRight size={16} />
        </button>

        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-4 w-8 bg-gradient-to-r from-[#0f0f13] to-transparent z-[5] pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-[#0f0f13] to-transparent z-[5] pointer-events-none" />

        <div ref={rowRef} 
          className="flex gap-3 overflow-x-auto px-6 pb-2 scrollbar-hide scroll-smooth"
          onWheel={e => { e.preventDefault(); if (rowRef.current) rowRef.current.scrollLeft += e.deltaY; }}
        >
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[120px] h-[180px] rounded-xl bg-white/5 animate-pulse" />
              ))
            : items.map(item => <PosterCard key={item.id} item={item} />)}
        </div>
      </div>
    </section>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────

interface Row { key: string; title: string; subtitle: string; items: MetaItem[]; loading: boolean }

export default function Home() {
  const { addons } = useStore();
  const { items: cwItems, loading: cwLoading, source: cwSource } = useContinueWatching();
  const [rows, setRows] = useState<Row[]>([]);
  const [heroItem, setHeroItem] = useState<MetaItem | null>(null);
  const addonsKey = addons.map(a => a.id).join('|');

  useEffect(() => {
    if (addons.length === 0) { setRows([]); return; }

    const list: Row[] = addons.flatMap(addon =>
      (addon.catalogs ?? []).filter(c => c.type && c.id).map(catalog => ({
        key: `${addon.id}::${catalog.type}::${catalog.id}`,
        title: catalog.name ?? catalog.id,
        subtitle: addon.name,
        items: [], loading: true,
      }))
    );

    setRows(list);

    list.forEach(({ key, ...row }, idx) => {
      const [addonId, type, catId] = key.split('::');
      const addon = addons.find(a => a.id === addonId)!;
      fetchCatalog(addon.url, type, catId)
        .then(items => {
          if (idx === 0 && items.length > 0) setHeroItem(items[0]);
          setRows(prev => prev.map(r => r.key === key ? { ...r, items, loading: false } : r));
        })
        .catch(() => setRows(prev => prev.map(r => r.key === key ? { ...r, loading: false } : r)));
    });
  }, [addonsKey]);

  if (addons.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-bg)' }}>
        <Plus size={32} style={{ color: 'var(--accent)' }} />
      </div>
      <h1 className="text-2xl font-bold text-white">Nessun addon installato</h1>
      <p className="text-white/50 max-w-sm">Vai nella sezione Addon e aggiungi Cinemeta.</p>
      <Link to="/addons" className="mt-2 px-6 py-2.5 text-white rounded-full font-medium" style={{ backgroundColor: 'var(--accent)' }}>
        Gestisci Addon
      </Link>
    </div>
  );

  return (
    <div className="overflow-y-auto h-full">
      {/* Hero */}
      {heroItem && <HeroSection item={heroItem} />}

      <div className="py-4">
        {/* Continue watching */}
        {(cwItems.length > 0 || cwLoading) && (
          <CatalogRow
            title="Continua a guardare"
            subtitle={SOURCE_LABEL[cwSource]}
            items={cwItems as any}
            loading={cwLoading}
          />
        )}

        {/* Catalog rows */}
        {rows.map(row => (
          <CatalogRow key={row.key} title={row.title} subtitle={row.subtitle} items={row.items} loading={row.loading} />
        ))}
      </div>
    </div>
  );
}
