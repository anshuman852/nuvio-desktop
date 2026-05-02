/// <reference types="vite/client" />
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { searchTMDB, tmdbImg, hasTMDBKey } from '../api/tmdb';
import { Loader2, Search as SearchIcon, Film, Tv, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { useT } from '../lib/i18n';

type Category = 'all' | 'movie' | 'tv';

export default function SearchPage() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { settings } = useStore();
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [movies, setMovies] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setMovies([]);
      setSeries([]);
      return;
    }

    if (!settings.tmdbApiKey || !hasTMDBKey()) {
      setError(t('configure_tmdb_key'));
      return;
    }

    const search = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const results = await searchTMDB(query);
        
        const moviesList: any[] = [];
        const seriesList: any[] = [];
        
        for (const item of results) {
          // Determina il tipo corretto
          const isMovie = item.media_type === 'movie' || (item.title !== undefined && item.media_type !== 'tv');
          const isSeries = item.media_type === 'tv' || (item.name !== undefined && item.media_type !== 'movie');
          
          // Salta le persone
          if (item.media_type === 'person') continue;
          
          const title = item.title || item.name;
          if (!title) continue;
          
          const resultItem = {
            id: item.id,
            type: isMovie ? 'movie' : 'tv',
            title: title,
            poster: item.poster_path,
            year: (item.release_date || item.first_air_date || '').slice(0, 4),
            overview: item.overview,
            vote_average: item.vote_average,
            media_type: item.media_type,
          };
          
          if (isMovie) {
            moviesList.push(resultItem);
          } else if (isSeries) {
            seriesList.push(resultItem);
          }
        }
        
        console.log(`[Search] Found: ${moviesList.length} movies, ${seriesList.length} series for "${query}"`);
        
        setMovies(moviesList);
        setSeries(seriesList);
      } catch (err: any) {
        console.error('Search error:', err);
        setError(err.message || t('error_loading'));
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [query, settings.tmdbApiKey]);

  const categories = [
    { id: 'all', label: t('all'), icon: SearchIcon, count: movies.length + series.length },
    { id: 'movie', label: t('movies'), icon: Film, count: movies.length },
    { id: 'tv', label: t('series_tv'), icon: Tv, count: series.length },
  ];

  const getCurrentItems = () => {
    switch (activeCategory) {
      case 'movie': return movies;
      case 'tv': return series;
      default: return [...movies, ...series];
    }
  };

  const currentItems = getCurrentItems();

  if (!settings.tmdbApiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <p className="text-white/50">{t('configure_tmdb_key')}</p>
        <Link to="/settings" className="px-5 py-2.5 rounded-xl text-white text-sm" style={{ backgroundColor: 'var(--accent)' }}>
          {t('go_to_settings')}
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-6">
      <div className="flex items-center gap-2 mb-4">
        <SearchIcon size={18} className="text-white/40" />
        <h1 className="text-lg font-bold text-white">
          {query ? `${t('results_for')} "${query}"` : t('search')}
        </h1>
        {loading && <Loader2 size={16} className="animate-spin text-white/40" />}
      </div>

      {!query && (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
            <SearchIcon size={32} className="text-white/20" />
          </div>
          <p className="text-white/40 text-sm">{t('search_hint')}</p>
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {query && !loading && (
        <>
          <div className="flex gap-2 flex-wrap mb-6 border-b border-white/10 pb-3">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as Category)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all',
                  activeCategory === cat.id
                    ? 'bg-[color:var(--accent)] text-white'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                )}
              >
                <cat.icon size={14} />
                {cat.label}
                <span className={clsx(
                  'text-xs ml-1',
                  activeCategory === cat.id ? 'text-white/80' : 'text-white/40'
                )}>
                  ({cat.count})
                </span>
              </button>
            ))}
          </div>

          {currentItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/40 text-sm">{t('no_results')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {currentItems.map(item => (
                // FIX: Usa il formato tmdb:${id} per il routing
                <Link key={`${item.type}-${item.id}`} to={`/detail/${item.type}/tmdb:${item.id}`} className="group">
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-[color:var(--accent)] transition-all group-hover:scale-[1.02]">
                    {item.poster ? (
                      <img 
                        src={tmdbImg(item.poster, 'w342')} 
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl text-white/20">
                        {item.type === 'movie' ? '🎬' : '📺'}
                      </div>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-white/70 group-hover:text-white truncate">{item.title}</p>
                  {item.year && <p className="text-xs text-white/30">{item.year}</p>}
                  {item.vote_average && item.vote_average > 0 && (
                    <p className="text-[10px] text-yellow-500/70">⭐ {item.vote_average.toFixed(1)}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {loading && query && (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="animate-spin text-white/30" />
        </div>
      )}
    </div>
  );
}