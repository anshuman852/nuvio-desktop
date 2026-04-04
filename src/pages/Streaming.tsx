/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { STREAMING_SERVICES, StreamingService, discoverByProvider, tmdbToMeta, hasTMDBKey, tmdbImg } from '../api/tmdb';
import { ArrowLeft, Film, Tv, Search, Loader2, AlertCircle, X, Star } from 'lucide-react';
import clsx from 'clsx';

// ─── Hook: carica backdrop immagini per il servizio ───────────────────────────
function useServiceBackdrops(service: StreamingService, skip = false) {
  const { settings } = useStore();
  const [backdrops, setBackdrops] = useState<string[]>([]);

  useEffect(() => {
    if (skip || !hasTMDBKey()) return;
    discoverByProvider(service.tmdbId, 'movie', 1)
      .then(data => {
        const imgs = (data.results ?? [])
          .filter((r: any) => r.backdrop_path)
          .slice(0, 8)
          .map((r: any) => tmdbImg(r.backdrop_path, 'w780')).filter(Boolean) as string[];
        setBackdrops(imgs);
      })
      .catch(() => {});
  }, [service.id, settings.tmdbApiKey]);

  return backdrops;
}

// ─── Service card — logo riempie tutta la card ───────────────────────────────
function ServiceCard({ s }: { s: StreamingService }) {
  const [logoErr, setLogoErr] = useState(false);
  const backdrops = useServiceBackdrops(s);
  const bg = (s as any).logoBg ?? s.color;

  return (
    <Link to={`/streaming/${s.id}`}
      className="group relative overflow-hidden rounded-2xl cursor-pointer block transition-all duration-200 hover:scale-[1.03] hover:shadow-2xl"
      style={{ aspectRatio: '16/9' }}>

      {/* Layer 1: collage backdrop TMDB se disponibile */}
      {backdrops.length >= 4 && (
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-2 gap-0">
          {backdrops.slice(0, 8).map((src, i) => (
            <img key={i} src={src} alt="" className="w-full h-full object-cover" />
          ))}
        </div>
      )}

      {/* Layer 2: sfondo solido del brand (sempre presente, visibile quando no TMDB) */}
      <div className="absolute inset-0 transition-opacity"
        style={{
          background: `linear-gradient(135deg, ${bg}cc 0%, ${bg}66 50%, #0a0a12 100%)`,
          opacity: backdrops.length >= 4 ? 0 : 1
        }} />

      {/* Layer 3: overlay semitrasparente su tutto */}
      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/25 transition-colors" />

      {/* Logo al centro — object-cover per riempire TUTTO (come vuole l'utente) */}
      <div className="absolute inset-0 flex items-center justify-center p-5">
        {!logoErr && s.logo ? (
          <img
            src={s.logo}
            alt={s.name}
            className="w-full h-full object-contain drop-shadow-2xl group-hover:scale-105 transition-transform duration-300 filter brightness-110"
            onError={() => setLogoErr(true)}
          />
        ) : (
          <span className="text-6xl drop-shadow-2xl group-hover:scale-105 transition-transform">{s.logoFallback}</span>
        )}
      </div>

      {/* Nome in basso — visibile sempre */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-2.5"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}>
        <p className="text-sm font-bold text-white drop-shadow">{s.name}</p>
      </div>
    </Link>
  );
}

// ─── Content card ─────────────────────────────────────────────────────────────
function ContentCard({ item }: { item: ReturnType<typeof tmdbToMeta> }) {
  const [err, setErr] = useState(false);
  return (
    <Link to={`/detail/${item.type}/${encodeURIComponent(item.id)}`} className="group">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/[0.06] group-hover:border-[color:var(--accent)] group-hover:scale-[1.04] transition-all duration-200">
        {item.poster && !err
          ? <img src={item.poster} alt={item.name} className="w-full h-full object-cover" onError={() => setErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-4xl">🎬</div>}
        {item.imdbRating && (
          <div className="absolute top-2 right-2 bg-black/70 px-1.5 py-0.5 rounded-full text-xs font-bold text-yellow-400 flex items-center gap-0.5">
            <Star size={9} className="fill-yellow-400" />{item.imdbRating}
          </div>
        )}
      </div>
      <p className="mt-1.5 text-xs text-white/70 group-hover:text-white truncate">{item.name}</p>
      {item.releaseInfo && <p className="text-xs text-white/30">{item.releaseInfo}</p>}
    </Link>
  );
}

// ─── Service detail ───────────────────────────────────────────────────────────
function ServiceDetail({ service }: { service: StreamingService }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'movie' | 'tv'>('movie');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ReturnType<typeof tmdbToMeta>[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [logoErr, setLogoErr] = useState(false);
  const backdrops = useServiceBackdrops(service);

  useEffect(() => { setItems([]); setPage(1); load(1); }, [tab, service.id]);

  async function load(p = page) {
    if (!hasTMDBKey()) return;
    setLoading(true);
    try {
      const data = await discoverByProvider(service.tmdbId, tab, p);
      const mapped = (data.results ?? []).map(item => {
        const meta = tmdbToMeta(item);
        // Per le serie, il tipo deve essere 'series' per navigare correttamente
        if (tab === 'tv') meta.type = 'series';
        return meta;
      });
      setItems(prev => p === 1 ? mapped : [...prev, ...mapped]);
      setTotalPages(data.total_pages ?? 1);
    } catch { } finally { setLoading(false); }
  }

  const filtered = search ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())) : items;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="relative flex-shrink-0 flex flex-col justify-end px-6 pb-5" style={{ minHeight: 200 }}>
        {/* Backdrop */}
        {backdrops[0] && <img src={backdrops[0]} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(15,15,19,0.3) 0%, rgba(15,15,19,0.95) 100%)' }} />

        <button onClick={() => navigate('/streaming')}
          className="absolute top-5 left-5 flex items-center gap-1.5 text-white/60 hover:text-white text-sm bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm z-10">
          <ArrowLeft size={15} />Streaming
        </button>

        <div className="relative z-10 flex items-end gap-5 mt-14">
          <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center bg-black/60 border border-white/10 shadow-2xl flex-shrink-0">
            {!logoErr && service.logo
              ? <img src={service.logo} alt={service.name} className="w-14 h-14 object-contain" onError={() => setLogoErr(true)} />
              : <span className="text-4xl">{service.logoFallback}</span>}
          </div>
          <div><h1 className="text-2xl font-bold text-white">{service.name}</h1><p className="text-sm text-white/50 mt-0.5">{items.length > 0 ? `${items.length}+ contenuti` : 'Catalogo'}</p></div>
        </div>

        <div className="relative z-10 flex items-center gap-3 mt-4">
          <div className="flex gap-1 bg-white/10 rounded-full p-1">
            {(['movie', 'tv'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setPage(1); setItems([]); }}
                className={clsx('flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all', tab === t ? 'bg-white text-black shadow' : 'text-white/70 hover:text-white')}>
                {t === 'movie' ? <><Film size={13} />Film</> : <><Tv size={13} />Serie</>}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Cerca in ${service.name}...`}
              className="w-full pl-8 pr-8 py-2 bg-white/10 border border-white/10 focus:border-white/30 rounded-full text-sm text-white placeholder:text-white/40 focus:outline-none" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X size={13} /></button>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {!hasTMDBKey() ? (
          <div className="flex items-center gap-2 text-yellow-400/80 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
            <AlertCircle size={15} />Configura TMDB in <Link to="/settings" className="underline ml-1">Impostazioni</Link>.
          </div>
        ) : loading && filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 gap-2 text-white/40"><Loader2 size={20} className="animate-spin" />Caricamento...</div>
        ) : (
          <>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-3">
              {filtered.map(item => <ContentCard key={item.id} item={item} />)}
            </div>
            {page < totalPages && !search && (
              <div className="flex justify-center mt-6">
                <button onClick={() => { const n = page + 1; setPage(n); load(n); }} disabled={loading}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-full text-sm font-medium flex items-center gap-2">
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

// ─── Main ─────────────────────────────────────────────────────────────────────
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
      <h1 className="text-xl font-bold text-white mb-5">Streaming</h1>
      {!hasTMDBKey() && (
        <div className="flex items-center gap-2 text-yellow-400/80 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 mb-5">
          <AlertCircle size={15} />
          Aggiungi TMDB in <Link to="/settings" className="underline ml-1 hover:text-yellow-300">Impostazioni → Integrazioni</Link> per vedere i cataloghi con immagini.
        </div>
      )}
      {/* Griglia uniforme 4 colonne — tutte identiche */}
      <div className="grid grid-cols-4 gap-3">
        {visible.map(s => <ServiceCard key={s.id} s={s} />)}
      </div>
    </div>
  );
}
