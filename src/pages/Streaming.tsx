/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { STREAMING_SERVICES, StreamingService, discoverByProvider, tmdbToMeta, hasTMDBKey, tmdbImg } from '../api/tmdb';
import { ArrowLeft, Film, Tv, Search, Loader2, AlertCircle, X, Star } from 'lucide-react';
import clsx from 'clsx';

// ─── Service Card (componente separato per evitare useState in map) ────────────
function ServiceCard({ s }: { s: StreamingService }) {
  const [logoErr, setLogoErr] = useState(false);
  return (
    <Link to={`/streaming/${s.id}`}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.06] hover:border-white/20 transition-all duration-200 hover:scale-[1.02] aspect-video bg-[#1a1a1f]">
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${s.color}40 0%, ${s.color}15 50%, #0f0f13 100%)` }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        {!logoErr && s.logo
          ? <img src={s.logo} alt={s.name} className="h-16 max-w-[80%] object-contain drop-shadow-2xl" onError={() => setLogoErr(true)} />
          : <span className="text-5xl drop-shadow-lg">{s.logoFallback}</span>}
        <p className="text-sm font-semibold text-white/70 group-hover:text-white transition-colors">{s.name}</p>
      </div>
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.04] transition-colors" />
    </Link>
  );
}

// ─── Content Card ─────────────────────────────────────────────────────────────
function ContentCard({ item }: { item: ReturnType<typeof tmdbToMeta> }) {
  const [err, setErr] = useState(false);
  return (
    <Link to={`/detail/${item.type}/${encodeURIComponent(item.id)}`} className="group">
      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/[0.06] group-hover:border-[color:var(--accent)] group-hover:scale-[1.04] transition-all duration-200 shadow-lg">
        {item.poster && !err
          ? <img src={item.poster} alt={item.name} className="w-full h-full object-cover" onError={() => setErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-4xl bg-white/5">🎬</div>}
        {item.imdbRating && (
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-xs font-bold text-yellow-400 flex items-center gap-0.5">
            <Star size={9} className="fill-yellow-400" />{item.imdbRating}
          </div>
        )}
      </div>
      <p className="mt-1.5 text-xs text-white/70 group-hover:text-white truncate">{item.name}</p>
      {item.releaseInfo && <p className="text-xs text-white/30">{item.releaseInfo}</p>}
    </Link>
  );
}

// ─── Service Detail ───────────────────────────────────────────────────────────
function ServiceDetail({ service }: { service: StreamingService }) {
  const navigate = useNavigate();
  const { settings } = useStore();
  const [tab, setTab] = useState<'movie' | 'tv'>('movie');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ReturnType<typeof tmdbToMeta>[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [logoErr, setLogoErr] = useState(false);

  useEffect(() => { setItems([]); setPage(1); load(1); }, [tab, service.id]);

  async function load(p = page) {
    if (!hasTMDBKey()) return;
    setLoading(true);
    try {
      const data = await discoverByProvider(service.tmdbId, tab, p);
      const mapped = (data.results ?? []).map(tmdbToMeta);
      setItems(prev => p === 1 ? mapped : [...prev, ...mapped]);
      setTotalPages(data.total_pages ?? 1);
    } catch { } finally { setLoading(false); }
  }

  const filtered = search ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())) : items;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Hero header */}
      <div className="relative flex-shrink-0 min-h-[200px] flex flex-col justify-end px-6 pb-5"
        style={{ background: `linear-gradient(135deg, ${service.color}22 0%, #0f0f13 100%)` }}>
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 20% 50%, ${service.color}30 0%, transparent 60%)` }} />

        <button onClick={() => navigate('/streaming')}
          className="absolute top-5 left-5 flex items-center gap-1.5 text-white/60 hover:text-white text-sm transition-colors z-10 bg-black/30 px-3 py-1.5 rounded-full backdrop-blur-sm">
          <ArrowLeft size={15} />Tutti i servizi
        </button>

        <div className="relative z-10 flex items-end gap-5 mt-12">
          <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center bg-black/40 border border-white/10">
            {!logoErr && service.logo
              ? <img src={service.logo} alt={service.name} className="w-14 h-14 object-contain" onError={() => setLogoErr(true)} />
              : <span className="text-4xl">{service.logoFallback}</span>}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{service.name}</h1>
            <p className="text-sm text-white/50 mt-0.5">{items.length > 0 ? `${items.length}+ contenuti` : 'Catalogo completo'}</p>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3 mt-5">
          <div className="flex gap-1 bg-white/10 rounded-full p-1">
            {(['movie', 'tv'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={clsx('flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                  tab === t ? 'bg-white text-black shadow' : 'text-white/70 hover:text-white')}>
                {t === 'movie' ? <><Film size={13} />Film</> : <><Tv size={13} />Serie</>}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={`Cerca in ${service.name}...`}
              className="w-full pl-8 pr-8 py-2 bg-white/10 border border-white/10 focus:border-white/30 rounded-full text-sm text-white placeholder:text-white/40 focus:outline-none" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X size={13} /></button>}
          </div>
        </div>
      </div>

      {/* Grid content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {!hasTMDBKey() ? (
          <div className="flex items-center gap-2 text-yellow-400/80 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
            <AlertCircle size={15} />Aggiungi la chiave API TMDB nelle <Link to="/settings" className="underline">Impostazioni</Link>.
          </div>
        ) : loading && filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 gap-2 text-white/40">
            <Loader2 size={20} className="animate-spin" />Caricamento...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm">Nessun contenuto trovato</div>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
              {filtered.map(item => <ContentCard key={item.id} item={item} />)}
            </div>
            {page < totalPages && !search && (
              <div className="flex justify-center mt-8">
                <button onClick={() => { const next = page + 1; setPage(next); load(next); }} disabled={loading}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-full text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                  {loading && <Loader2 size={14} className="animate-spin" />}Carica altri
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Streaming page ──────────────────────────────────────────────────────
export default function Streaming() {
  const { serviceId } = useParams<{ serviceId?: string }>();
  const { settings } = useStore();

  const service = serviceId ? STREAMING_SERVICES.find(s => s.id === serviceId) : null;
  if (service) return <ServiceDetail service={service} />;

  const visible = STREAMING_SERVICES.filter(s =>
    (settings.visibleServices ?? STREAMING_SERVICES.map(x => x.id)).includes(s.id)
  );

  return (
    <div className="px-6 py-6 overflow-y-auto h-full">
      <h1 className="text-xl font-bold text-white mb-6">Streaming</h1>
      {!hasTMDBKey() && (
        <div className="flex items-center gap-2 text-yellow-400/80 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 mb-6">
          <AlertCircle size={15} />
          <span>Configura la chiave API TMDB nelle <Link to="/settings" className="underline hover:text-yellow-300">Impostazioni → Integrazioni</Link> per vedere i cataloghi.</span>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {visible.map(s => <ServiceCard key={s.id} s={s} />)}
      </div>
    </div>
  );
}
