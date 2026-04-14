/// <reference types="vite/client" />
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { fetchCatalog } from '../api/stremio';
import { MetaItem } from '../lib/types';
import { Loader2, ArrowLeft, Film, Tv } from 'lucide-react';
import { tmdbImg, hasTMDBKey } from '../api/tmdb';
import { useT } from '../lib/i18n';
import clsx from 'clsx';

export default function CatalogPage() {
  const { t } = useT();
  const { addonId, catalogType, catalogId } = useParams<{ addonId: string; catalogType: string; catalogId: string }>();
  const navigate = useNavigate();
  const { addons, settings } = useStore();
  const [items, setItems] = useState<MetaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalogName, setCatalogName] = useState<string>('');

  useEffect(() => {
    if (!addonId || !catalogType || !catalogId) {
      setError('Invalid catalog');
      setLoading(false);
      return;
    }

    const addon = addons.find(a => a.id === addonId);
    if (!addon) {
      setError('Addon not found');
      setLoading(false);
      return;
    }

    // Trova il nome del catalogo
    const catalog = addon.catalogs?.find(c => c.type === catalogType && c.id === catalogId);
    setCatalogName(catalog?.name ?? catalogId ?? 'Catalog');

    const loadCatalog = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await fetchCatalog(addon.url, catalogType, catalogId);
        setItems(results || []);
      } catch (err) {
        console.error('Error loading catalog:', err);
        setError('Failed to load catalog');
      } finally {
        setLoading(false);
      }
    };

    loadCatalog();
  }, [addonId, catalogType, catalogId, addons]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-white/40">
        <Loader2 size={28} className="animate-spin" />
        <span className="text-sm">Loading catalog...</span>
      </div>
    );
  }

  if (error || !items.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-white/60 text-sm">{error || 'No items found'}</p>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-white/10 text-white rounded-xl text-sm">
          Go Back
        </button>
      </div>
    );
  }

  const isMovieCatalog = catalogType === 'movie';

  return (
    <div className="overflow-y-auto h-full p-6">
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">{catalogName}</h1>
          <p className="text-xs text-white/40 mt-0.5">{items.length} {isMovieCatalog ? 'movies' : 'series'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map((item) => (
          <Link 
            key={item.id} 
            to={`/detail/${item.type}/${encodeURIComponent(item.id)}`} 
            className="group"
          >
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-[color:var(--accent)] transition-all group-hover:scale-[1.02]">
              {item.poster ? (
                <img 
                  src={item.poster} 
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl text-white/20">
                  {isMovieCatalog ? '🎬' : '📺'}
                </div>
              )}
            </div>
            <p className="mt-1.5 text-xs text-white/70 group-hover:text-white truncate">{item.name}</p>
            {item.releaseInfo && <p className="text-xs text-white/30">{item.releaseInfo}</p>}
            {item.imdbRating && (
              <p className="text-[10px] text-yellow-500/70">⭐ {item.imdbRating}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}