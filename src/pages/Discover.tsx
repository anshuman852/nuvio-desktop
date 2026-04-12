/// <reference types="vite/client" />
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { STREAMING_SERVICES, getDiscoverMovies, getDiscoverTV, getGenres, tmdbImg } from '../api/tmdb';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useT } from '../lib/i18n';

type MediaType = 'movie' | 'tv';
type SortOption = 'popularity.desc' | 'vote_average.desc' | 'release_date.desc' | 'revenue.desc';

export default function Discover() {
  const { t } = useT();
  const { settings } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [type, setType] = useState<MediaType>('movie');
  const [genreId, setGenreId] = useState<number | null>(null);
  const [year, setYear] = useState<string>('');
  const [serviceId, setServiceId] = useState<string | null>(searchParams.get('service') || null);
  const [sortBy, setSortBy] = useState<SortOption>('popularity.desc');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);

  const years = Array.from({ length: 2026 - 1950 + 1 }, (_, i) => (1950 + i).toString()).reverse();

  useEffect(() => {
    if (!settings.tmdbApiKey) return;
    getGenres(settings.tmdbApiKey, type).then(setGenres).catch(() => {});
  }, [settings.tmdbApiKey, type]);

  useEffect(() => {
    if (!settings.tmdbApiKey) return;
    setLoading(true);
    setItems([]);
    setPage(1);
    fetchItems(1);
  }, [type, genreId, year, serviceId, sortBy, settings.tmdbApiKey]);

  const fetchItems = async (pageNum: number) => {
    if (!settings.tmdbApiKey) return;
    try {
      const options: any = {
        apiKey: settings.tmdbApiKey,
        page: pageNum,
        sortBy,
      };
      if (genreId) options.withGenres = genreId.toString();
      if (year) options.primaryReleaseYear = year;
      if (serviceId) {
        const service = STREAMING_SERVICES.find(s => s.id === serviceId);
        if (service) {
          options.withWatchProviders = service.tmdbId.toString();
          if (service.forceRegion) {
            options.watchRegion = service.forceRegion;
          }
        }
      }
      
      console.log('Fetching with options:', options);
      
      const data = type === 'movie' 
        ? await getDiscoverMovies(options)
        : await getDiscoverTV(options);
      
      console.log('Results:', data.results?.length || 0);
      
      setItems(prev => pageNum === 1 ? data.results : [...prev, ...data.results]);
      setTotalPages(Math.min(data.total_pages, 500));
    } catch (err) {
      console.error('Discover fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (page < totalPages) {
      const next = page + 1;
      setPage(next);
      fetchItems(next);
    }
  };

  const selectedService = STREAMING_SERVICES.find(s => s.id === serviceId);

  if (!settings.tmdbApiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <p className="text-white/50">{t('configure_tmdb_key')}</p>
        <Link to="/settings" className="px-5 py-2.5 rounded-xl text-white text-sm" style={{ backgroundColor: 'var(--accent)' }}>{t('go_to_settings')}</Link>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-6">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-white">{t('discover')}</h1>
        {selectedService && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10">
            {selectedService.logo && <img src={selectedService.logo} alt={selectedService.name} className="h-4 w-auto" />}
            <span className="text-sm text-white/70">{selectedService.name}</span>
            <button onClick={() => { setServiceId(null); setSearchParams({}); }} className="text-white/30 hover:text-white">✕</button>
          </div>
        )}
      </div>
      
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex bg-white/5 rounded-xl p-1">
          <button onClick={() => setType('movie')} className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-colors', type === 'movie' ? 'bg-[color:var(--accent)] text-white' : 'text-white/60')}>🎬 {t('film')}</button>
          <button onClick={() => setType('tv')} className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-colors', type === 'tv' ? 'bg-[color:var(--accent)] text-white' : 'text-white/60')}>📺 {t('series_tv')}</button>
        </div>

        <select value={genreId ?? ''} onChange={e => setGenreId(e.target.value ? Number(e.target.value) : null)} className="bg-white/10 text-white text-sm px-3 py-1.5 rounded-xl border border-white/10 focus:outline-none focus:border-[color:var(--accent)]">
          <option value="">{t('all_genres')}</option>
          {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        <select value={year} onChange={e => setYear(e.target.value)} className="bg-white/10 text-white text-sm px-3 py-1.5 rounded-xl border border-white/10 focus:outline-none focus:border-[color:var(--accent)]">
          <option value="">{t('all_years')}</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select value={serviceId ?? ''} onChange={e => setServiceId(e.target.value || null)} className="bg-white/10 text-white text-sm px-3 py-1.5 rounded-xl border border-white/10 focus:outline-none focus:border-[color:var(--accent)]">
          <option value="">{t('all_platforms')}</option>
          {STREAMING_SERVICES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)} className="bg-white/10 text-white text-sm px-3 py-1.5 rounded-xl border border-white/10 focus:outline-none focus:border-[color:var(--accent)]">
          <option value="popularity.desc">{t('most_popular')}</option>
          <option value="vote_average.desc">{t('top_rated')}</option>
          <option value="release_date.desc">{t('most_recent')}</option>
          <option value="revenue.desc">{t('revenue')}</option>
        </select>
      </div>

      {loading && items.length === 0 && (
        <div className="flex justify-center py-12"><Loader2 size={32} className="animate-spin text-white/30" /></div>
      )}
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map(item => (
          <Link key={item.id} to={`/detail/${type}/${item.id}`} className="group block">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-[color:var(--accent)] transition-all group-hover:scale-[1.02]">
              {item.poster_path ? (
                <img src={tmdbImg(item.poster_path, 'w342')} alt={item.title || item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20 text-4xl">{type === 'movie' ? '🎬' : '📺'}</div>
              )}
            </div>
            <p className="mt-2 text-xs text-white/70 group-hover:text-white truncate">{item.title || item.name}</p>
            <p className="text-xs text-white/30">{item.release_date?.slice(0,4) || item.first_air_date?.slice(0,4) || ''}</p>
            {item.vote_average && (
              <p className="text-[10px] text-yellow-500/70">⭐ {item.vote_average.toFixed(1)}</p>
            )}
          </Link>
        ))}
      </div>
      
      {items.length > 0 && page < totalPages && (
        <div className="flex justify-center mt-8">
          <button onClick={loadMore} disabled={loading} className="px-6 py-2 rounded-full bg-white/10 text-white text-sm hover:bg-white/20 transition-colors">
            {loading ? <Loader2 size={16} className="animate-spin" /> : t('load_more')}
          </button>
        </div>
      )}
    </div>
  );
}