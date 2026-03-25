import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import { STREAMING_SERVICES, StreamingService, discoverByProvider, tmdbToMeta, hasTMDBToken } from '../api/tmdb';
import { ArrowLeft, Film, Tv, Search, Loader2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

// ─── Card film/serie ──────────────────────────────────────────────────────────

function ContentCard({ item }: { item: ReturnType<typeof tmdbToMeta> }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <Link to={`/detail/${item.type}/${encodeURIComponent(item.id)}`} className="group flex-shrink-0">
      <div className="relative w-40 h-60 rounded-xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-white/30 transition-all duration-200 group-hover:scale-[1.02]">
        {item.poster && !imgErr
          ? <img src={item.poster} alt={item.name} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-white/20 text-4xl">🎬</div>}
        {/* Rating overlay */}
        {item.imdbRating && (
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-bold text-yellow-400">
            ★ {item.imdbRating}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
          <p className="text-xs text-white font-medium line-clamp-2">{item.name}</p>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-white/60 group-hover:text-white truncate w-40 transition-colors">{item.name}</p>
      {item.releaseInfo && <p className="text-xs text-white/30">{item.releaseInfo}</p>}
    </Link>
  );
}

// ─── Pagina dettaglio servizio ────────────────────────────────────────────────

function ServiceDetail({ service }: { service: StreamingService }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'movie' | 'tv'>('movie');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ReturnType<typeof tmdbToMeta>[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQ, setSearchQ] = useState('');
  const { settings } = useAppStore();
  const lang = settings.language === 'it' ? 'it-IT' : 'en-US';

  useEffect(() => {
    loadContent();
  }, [tab, page, service.id]);

  async function loadContent() {
    setLoading(true);
    try {
      const data = await discoverByProvider(service.tmdbId, tab, page, lang);
      const mapped = (data.results ?? []).map(tmdbToMeta);
      setItems(page === 1 ? mapped : (prev) => [...prev, ...mapped]);
      setTotalPages(data.total_pages ?? 1);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  const filtered = searchQ.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(searchQ.toLowerCase()))
    : items;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className={clsx('relative flex-shrink-0 px-6 pt-6 pb-4 bg-gradient-to-b', service.gradient)}>
        <button onClick={() => navigate('/streaming')}
          className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors mb-4">
          <ArrowLeft size={16} /><span className="text-sm">Tutti i servizi</span>
        </button>
        <div className="flex items-center gap-4">
          <span className="text-4xl">{service.logo}</span>
          <div>
            <h1 className="text-2xl font-bold text-white">{service.name}</h1>
            <p className="text-sm text-white/50 mt-0.5">
              {items.length > 0 ? `${items.length}+ contenuti` : 'Catalogo completo'}
            </p>
          </div>
        </div>

        {/* Tab + search */}
        <div className="flex items-center gap-3 mt-5">
          <div className="flex gap-1 bg-black/30 rounded-lg p-1">
            {(['movie', 'tv'] as const).map((t) => (
              <button key={t} onClick={() => { setTab(t); setPage(1); setItems([]); }}
                className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  tab === t ? 'bg-white text-black' : 'text-white/60 hover:text-white')}>
                {t === 'movie' ? <><Film size={13} /> Film</> : <><Tv size={13} /> Serie</>}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
              placeholder={`Cerca in ${service.name}...`}
              className="w-full pl-8 pr-3 py-1.5 bg-black/30 border border-white/10 focus:border-white/30 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {!hasTMDBToken() && (
          <div className="flex items-center gap-2 text-yellow-400/80 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 mb-4">
            <AlertCircle size={15} />
            Aggiungi il tuo TMDB API Token nelle impostazioni per vedere i contenuti.
          </div>
        )}

        {filtered.length === 0 && loading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-white/40">
            <Loader2 size={20} className="animate-spin" /> Caricamento...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
              {filtered.map((item) => <ContentCard key={item.id} item={item} />)}
            </div>

            {/* Load more */}
            {page < totalPages && !searchQ && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-lg text-sm transition-colors disabled:opacity-50">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : null}
                  Carica altri
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Pagina principale streaming ──────────────────────────────────────────────

export default function StreamingPage() {
  const { serviceId } = useParams<{ serviceId?: string }>();
  const { settings } = useAppStore();
  const visibleServices = settings.visibleStreamingServices ?? STREAMING_SERVICES.map((s) => s.id);

  const service = serviceId ? STREAMING_SERVICES.find((s) => s.id === serviceId) : null;
  if (service) return <ServiceDetail service={service} />;

  const visible = STREAMING_SERVICES.filter((s) => visibleServices.includes(s.id));

  return (
    <div className="px-6 py-6 overflow-y-auto h-full">
      <h1 className="text-lg font-bold text-white mb-6">Servizi Streaming</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {visible.map((service) => (
          <Link
            key={service.id}
            to={`/streaming/${service.id}`}
            className="group relative overflow-hidden rounded-2xl border border-white/10 hover:border-white/30 transition-all duration-200 hover:scale-[1.02] aspect-video flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${service.color}33, ${service.color}11)` }}
          >
            <div className={clsx('absolute inset-0 bg-gradient-to-br opacity-60', service.gradient)} />
            <div className="relative z-10 text-center">
              <div className="text-4xl mb-2">{service.logo}</div>
              <p className="text-sm font-bold text-white drop-shadow">{service.name}</p>
            </div>
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </div>
  );
}
