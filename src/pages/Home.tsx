/// <reference types="vite/client" />
import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { removeCW, markWatched, getProfilesFromCloud } from '../api/nuvio';
import { fetchCatalog } from '../api/stremio';
import { useContinueWatching } from '../hooks/useContinueWatching';
import { MetaItem } from '../lib/types';
import { STREAMING_SERVICES, getDiscoverMovies } from '../api/tmdb';
import { Play, Plus, ChevronLeft, ChevronRight, Info, ChevronRight as MoreIcon } from 'lucide-react';
import clsx from 'clsx';
import { useT } from '../lib/i18n';
import { showContextMenu } from '../lib/contextMenu';

function HeroSection({ item }: { item: MetaItem }) {
  const { t } = useT();
  const navigate = useNavigate();
  const { settings } = useStore();
  if (!settings.showHero) return null;
  return (
    <div className="relative w-full h-[56vw] max-h-[420px] min-h-[280px] flex-shrink-0 overflow-hidden">
      {item.background
        ? <img src={item.background} alt={item.name} className="absolute inset-0 w-full h-full object-cover object-top" />
        : item.poster
        ? <img src={item.poster} alt={item.name} className="absolute inset-0 w-full h-full object-cover object-top blur-sm scale-105" />
        : <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-black" />}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f13]/95 via-[#0f0f13]/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f13] via-transparent to-black/20" />
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-8">
        {item.logo
          ? <img src={item.logo} alt={item.name} className="h-16 max-w-xs object-contain mb-3 drop-shadow-2xl" />
          : <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-2xl mb-3 max-w-lg leading-tight">{item.name}</h1>}
        <div className="flex items-center gap-2 text-sm text-white/70 mb-3">
          {item.type === 'series' ? <span className="text-white/50">{t('series_tv')}</span> : <span className="text-white/50">{t('film')}</span>}
          {item.genres?.[0] && <><span className="w-1 h-1 rounded-full bg-white/40" /><span>{item.genres[0]}</span></>}
          {item.releaseInfo && <><span className="w-1 h-1 rounded-full bg-white/40" /><span>{item.releaseInfo}</span></>}
        </div>
        {item.description && <p className="text-sm text-white/70 max-w-md line-clamp-2 mb-5">{item.description}</p>}
        <div className="flex gap-3">
          <button onClick={() => navigate(`/detail/${item.type}/${encodeURIComponent(item.id)}`)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors shadow-xl">
            <Play size={16} className="fill-black" /> {t('watch_now')}
          </button>
          <button onClick={() => navigate(`/detail/${item.type}/${encodeURIComponent(item.id)}`)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/20 backdrop-blur-sm text-white font-semibold text-sm hover:bg-white/30 transition-colors border border-white/10">
            <Info size={16} /> {t('info_btn')}
          </button>
        </div>
      </div>
    </div>
  );
}

function StreamingServicesBar() {
  const navigate = useNavigate();
  const { settings, streamingCustomImages } = useStore();
  const streamingServices = settings.streamingServices || [];
  
  const visible = STREAMING_SERVICES.filter(s => {
    const setting = streamingServices.find((ss: any) => ss.id === s.id);
    return setting ? setting.enabled !== false : true;
  });
  
  const getServiceImage = (service: any) => {
    const customImg = streamingCustomImages[service.id];
    if (customImg) return customImg;
    const setting = streamingServices.find((ss: any) => ss.id === service.id);
    if (setting?.customImage) return setting.customImage;
    return service.logo;
  };
  
  return (
    <section className="mb-6">
      <div className="flex gap-4 overflow-x-auto px-6 pb-1 scrollbar-hide">
        {visible.map(s => {
          const [logoErr, setLogoErr] = useState(false);
          const imageUrl = getServiceImage(s);
          const hasCustom = streamingCustomImages[s.id] || streamingServices.find((ss: any) => ss.id === s.id)?.customImage;
          return (
            <button key={s.id} onClick={() => navigate(`/streaming/${s.id}`)}
              className="flex-shrink-0 group relative overflow-hidden rounded-xl border border-white/10 hover:border-white/30 transition-all hover:scale-[1.04] shadow-lg"
              style={{ width: 140, height: 70, background: s.logoBg ?? s.color }}>
              {hasCustom && (
                <img src={imageUrl} alt={s.name} className="absolute inset-0 w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors" />
              {!hasCustom && (
                <div className="absolute inset-0 flex items-center justify-center p-3">
                  {!logoErr && imageUrl
                    ? <img src={imageUrl} alt={s.name} className="w-full h-full object-contain drop-shadow filter brightness-110"
                        onError={() => setLogoErr(true)} />
                    : <span className="text-2xl">{s.logoFallback}</span>}
                </div>
              )}
              {hasCustom && (
                <div className="absolute bottom-1 left-0 right-0 flex justify-center">
                  <span className="text-[10px] text-white/80 bg-black/60 px-2 py-0.5 rounded-full font-medium">{s.name}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PosterCard({ item, onRemove, showWatched }: { item: any; onRemove?: (id: string) => void; showWatched?: boolean }) {
  const { t } = useT();
  const [imgErr, setImgErr] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [tmdbPoster, setTmdbPoster] = useState<string|null>(null);
  const { settings, nuvioUser, removeWatch, posterOrientation, setPosterOrientation } = useStore();
  const navigate = useNavigate();
  const progress = typeof item.progress === 'number' ? item.progress : (item.progressPct ? item.progressPct / 100 : undefined);
  const isWatched = showWatched && ((progress ?? 0) >= 0.90 || item.watched);
  const savedOrientation = posterOrientation[item.id];
  const isHorizontal = savedOrientation ? savedOrientation === 'horizontal' : (settings.horizontalPosters || false);
  const aspectClass = isHorizontal ? 'aspect-video' : 'aspect-[2/3]';
  const posterSrc = item.poster || tmdbPoster;
  
  useEffect(() => {
    if (item.poster || !item.id || !settings.tmdbApiKey) return;
    const imdbId = item.id.startsWith('tt') ? item.id : null;
    if (!imdbId) return;
    fetch(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${settings.tmdbApiKey}&external_source=imdb_id`)
      .then(r => r.json()).then(d => {
        const r = (d.movie_results ?? d.tv_results ?? [])[0];
        if (r?.poster_path) setTmdbPoster(`https://image.tmdb.org/t/p/w342${r.poster_path}`);
      }).catch(() => {});
  }, [item.id, item.poster, settings.tmdbApiKey]);
  
  if (removed) return null;
  
  function doRemove() {
    setRemoved(true); onRemove?.(item.id); removeWatch(item.id);
    if (nuvioUser?.id) removeCW(nuvioUser.id, item.id).catch(() => {});
  }
  
  function doMarkWatched() {
    setRemoved(true); onRemove?.(item.id); removeWatch(item.id);
    if (nuvioUser?.id) {
      markWatched(nuvioUser.id, item.id, item.type, item.season, item.episode).catch(() => {});
      removeCW(nuvioUser.id, item.id).catch(() => {});
    }
  }
  
  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    showContextMenu([
      { id: 'info', text: t('ctx_info'), accelerator: 'Enter', action: () => navigate(`/detail/${item.type}/${encodeURIComponent(item.id)}`) },
      '---' as const,
      { id: 'watched', text: t('ctx_mark_watched'), action: () => doMarkWatched() },
      { id: 'orientation', text: isHorizontal ? t('ctx_switch_vertical') : t('ctx_switch_horizontal'), action: () => setPosterOrientation(item.id, isHorizontal ? 'vertical' : 'horizontal') },
      ...(onRemove ? ['---' as const, { id: 'remove', text: t('ctx_remove'), action: () => doRemove() }] : []),
    ]);
  }
  
  return (
    <div className="flex-shrink-0 group relative">
      <div className="cursor-pointer"
        onClick={() => navigate(`/detail/${item.type}/${encodeURIComponent(item.id)}`)}
        onContextMenu={handleContextMenu}>
        <div className={`relative ${aspectClass} w-[150px] rounded-xl overflow-hidden bg-white/5 transition-all duration-200 group-hover:scale-[1.04] shadow-lg ${isWatched ? 'border-2 border-green-500' : 'border border-white/[0.06] group-hover:border-white/20'}`}>
          {posterSrc && !imgErr
            ? <img src={posterSrc} alt={item.name} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
            : <div className="w-full h-full flex items-center justify-center text-white/10"><Play size={28} /></div>}
          {isWatched && (
            <>
              <div className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                <span className="text-white text-xs font-black">✓</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 z-20 bg-green-500/90 py-0.5">
                <p className="text-[10px] text-white font-bold text-center tracking-wide">{t('watched')}</p>
              </div>
            </>
          )}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <Play size={18} className="text-white fill-white ml-1" />
            </div>
          </div>
          {item.season && item.episode && (
            <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs text-white/80 font-mono">
              S{item.season}E{item.episode}
            </div>
          )}
          {progress !== undefined && progress > 0 && !isWatched && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
              <div className="h-full rounded-full" style={{ width: `${Math.min(progress * 100, 100)}%`, backgroundColor: 'var(--accent)' }} />
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-white/70 group-hover:text-white truncate w-[150px] transition-colors">{item.name}</p>
        {item.releaseInfo && <p className="text-xs text-white/30">{item.releaseInfo}</p>}
      </div>
    </div>
  );
}

function CatalogRow({ title, subtitle, items, loading, onRemoveItem, catalogId, catalogType, addonId }: { 
  title: string; 
  subtitle?: string; 
  items: any[]; 
  loading: boolean; 
  onRemoveItem?: (id: string) => void;
  catalogId?: string;
  catalogType?: string;
  addonId?: string;
}) {
  const { t } = useT();
  const rowRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  function scroll(dir: 'left' | 'right') {
    if (!rowRef.current) return;
    rowRef.current.scrollBy({ left: dir === 'right' ? 400 : -400, behavior: 'smooth' });
  }

  const handleViewAll = () => {
    if (catalogId && catalogType && addonId) {
      navigate(`/catalog/${addonId}/${catalogType}/${catalogId}`);
    }
  };
  
  if (!loading && items.length === 0) return null;
  
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3 px-6">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {subtitle && <span className="text-xs text-white/30">{subtitle}</span>}
        </div>
        {catalogId && items.length > 6 && (
          <button 
            onClick={handleViewAll}
            className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors"
          >
            View All <MoreIcon size={12} />
          </button>
        )}
      </div>
      <div className="relative group/row">
        <button onClick={() => scroll('left')}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-black/90">
          <ChevronLeft size={16} />
        </button>
        <button onClick={() => scroll('right')}
          className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-black/90">
          <ChevronRight size={16} />
        </button>
        <div className="absolute left-0 top-0 bottom-4 w-8 bg-gradient-to-r from-[#0f0f13] to-transparent z-[5] pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-[#0f0f13] to-transparent z-[5] pointer-events-none" />
        <div ref={rowRef} className="flex gap-4 overflow-x-auto px-6 pb-2 scrollbar-hide scroll-smooth"
          onWheel={e => { e.preventDefault(); if (rowRef.current) rowRef.current.scrollLeft += e.deltaY; }}>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="flex-shrink-0 w-[150px] h-[225px] rounded-xl bg-white/5 animate-pulse" />)
            : items.map(item => <PosterCard key={item.id} item={item} onRemove={onRemoveItem} />)}
        </div>
      </div>
    </section>
  );
}

interface Row { 
  key: string; 
  title: string; 
  subtitle: string; 
  items: MetaItem[]; 
  loading: boolean;
  catalogId: string;
  catalogType: string;
  addonId: string;
}

export default function Home() {
  const { t } = useT();
  const { addons, settings, nuvioUser, updateProfile, profiles, activeProfileId } = useStore();
  const { items: cwItems, loading: cwLoading, removeItem: removeCWItem } = useContinueWatching();
  const { removeWatch } = useStore();
  const [rows, setRows] = useState<Row[]>([]);
  const [heroItem, setHeroItem] = useState<MetaItem | null>(null);
  const addonsKey = addons.map(a => a.id).join('|');

  useEffect(() => {
    if (nuvioUser?.id && nuvioUser.token) {
      getProfilesFromCloud(nuvioUser.id, nuvioUser.token).then(cloudProfiles => {
        if (cloudProfiles && cloudProfiles.length > 0) {
          const mainProfile = cloudProfiles[0];
          const activeProfile = profiles.find(p => p.id === activeProfileId);
          if (activeProfile) {
            updateProfile(activeProfile.id, {
              name: mainProfile.name || activeProfile.name,
              avatarUrl: mainProfile.avatar_url || activeProfile.avatarUrl,
            });
          }
        }
      }).catch(() => {});
    }
  }, [nuvioUser?.id, nuvioUser?.token]);

  useEffect(() => {
    if (addons.length === 0) { setRows([]); return; }
    const list: Row[] = addons.flatMap(addon =>
      (addon.catalogs ?? []).filter(c => c.type && c.id).map(catalog => ({
        key: `${addon.id}::${catalog.type}::${catalog.id}`,
        title: catalog.name ?? catalog.id,
        subtitle: addon.name,
        items: [], 
        loading: true,
        catalogId: catalog.id,
        catalogType: catalog.type,
        addonId: addon.id,
      }))
    );
    setRows(list);
    list.forEach(({ key }, idx) => {
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
      <h1 className="text-2xl font-bold text-white">{t('no_addons')}</h1>
      <p className="text-white/50 max-w-sm">Vai nella sezione Addon e aggiungi Cinemeta.</p>
      <Link to="/addons" className="mt-2 px-6 py-2.5 text-white rounded-full font-medium" style={{ backgroundColor: 'var(--accent)' }}>
        {t('manage_addons')}
      </Link>
    </div>
  );

  return (
    <div className="overflow-y-auto h-full">
      {heroItem && <HeroSection item={heroItem} />}
      <div className="py-4">
        {(cwItems.length > 0 || cwLoading) && (
          <CatalogRow
            title={t('continue_watching')}
            subtitle={t('in_progress')}
            items={cwItems as any}
            loading={cwLoading}
            onRemoveItem={async (id) => {
              removeCWItem(id);
              removeWatch(id);
              if (nuvioUser?.id) removeCW(nuvioUser.id, id).catch(() => {});
            }}
          />
        )}
        <StreamingServicesBar />
        {rows.map(row => (
          <CatalogRow 
            key={row.key} 
            title={row.title} 
            subtitle={row.subtitle} 
            items={row.items} 
            loading={row.loading}
            catalogId={row.catalogId}
            catalogType={row.catalogType}
            addonId={row.addonId}
          />
        ))}
      </div>
    </div>
  );
}