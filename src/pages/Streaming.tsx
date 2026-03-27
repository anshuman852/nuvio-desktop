/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { STREAMING_SERVICES, StreamingService, discoverByProvider, tmdbToMeta, hasTMDBKey } from '../api/tmdb';
import { ArrowLeft, Film, Tv, Search, Loader2, AlertCircle, X } from 'lucide-react';
import clsx from 'clsx';

function ContentCard({ item }: { item: ReturnType<typeof tmdbToMeta> }) {
  const [err, setErr] = useState(false);
  return (
    <Link to={`/detail/${item.type}/${encodeURIComponent(item.id)}`} className="flex-shrink-0 group">
      <div className="w-40 h-60 rounded-xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-[color:var(--accent)] transition-all group-hover:scale-[1.03]">
        {item.poster && !err
          ? <img src={item.poster} alt={item.name} className="w-full h-full object-cover" onError={() => setErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-4xl">🎬</div>}
        {item.imdbRating && (
          <div className="absolute top-2 right-2 bg-black/70 px-1.5 py-0.5 rounded-full text-xs font-bold text-yellow-400">★ {item.imdbRating}</div>
        )}
      </div>
      <p className="mt-1.5 text-xs text-white/70 group-hover:text-white truncate w-40">{item.name}</p>
      {item.releaseInfo && <p className="text-xs text-white/30">{item.releaseInfo}</p>}
    </Link>
  );
}

function ServiceDetail({ service }: { service: StreamingService }) {
  const navigate = useNavigate();
  const { settings } = useStore();
  const [tab, setTab] = useState<'movie' | 'tv'>('movie');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ReturnType<typeof tmdbToMeta>[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => { setItems([]); setPage(1); }, [tab, service.id]);
  useEffect(() => { load(); }, [tab, page, service.id]);

  async function load() {
    setLoading(true);
    try {
      const data = await discoverByProvider(service.tmdbId, tab, page);
      const mapped = (data.results ?? []).map(tmdbToMeta);
      setItems(prev => page === 1 ? mapped : [...prev, ...mapped]);
      setTotalPages(data.total_pages ?? 1);
    } catch { } finally { setLoading(false); }
  }

  const filtered = search.trim()
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={clsx('flex-shrink-0 px-6 pt-6 pb-4 bg-gradient-to-b', service.gradient)}>
        <button onClick={() => navigate('/streaming')} className="flex items-center gap-1.5 text-white/70 hover:text-white mb-4 text-sm">
          <ArrowLeft size={16} />Tutti i servizi
        </button>
        <div className="flex items-center gap-4">
          <span className="text-4xl">{service.logo}</span>
          <div>
            <h1 className="text-2xl font-bold text-white">{service.name}</h1>
            <p className="text-sm text-white/50">{items.length > 0 ? `${items.length}+ contenuti` : 'Catalogo'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <div className="flex gap-1 bg-black/30 rounded-lg p-1">
            {(['movie', 'tv'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setPage(1); setItems([]); }}
                className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  tab === t ? 'bg-white text-black' : 'text-white/60 hover:text-white')}>
                {t === 'movie' ? <><Film size={13} />Film</> : <><Tv size={13} />Serie</>}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Cerca in ${service.name}...`}
              className="w-full pl-8 pr-8 py-1.5 bg-black/30 border border-white/10 focus:border-white/30 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X size={13} /></button>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {!hasTMDBKey() && (
          <div className="flex items-center gap-2 text-yellow-400/80 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 mb-4">
            <AlertCircle size={15} />Aggiungi la chiave API TMDB nelle impostazioni per vedere i contenuti.
          </div>
        )}
        {filtered.length === 0 && loading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-white/40">
            <Loader2 size={20} className="animate-spin" />Caricamento...
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-4">
              {filtered.map(item => <ContentCard key={item.id} item={item} />)}
            </div>
            {page < totalPages && !search && (
              <div className="flex justify-center mt-8">
                <button onClick={() => setPage(p => p + 1)} disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm disabled:opacity-50">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : null}Carica altri
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function Streaming() {
  const { serviceId } = useParams<{ serviceId?: string }>();
  const { settings } = useStore();
  const service = serviceId ? STREAMING_SERVICES.find(s => s.id === serviceId) : null;
  if (service) return <ServiceDetail service={service} />;

  const visible = STREAMING_SERVICES.filter(s => (settings.visibleServices ?? STREAMING_SERVICES.map(x => x.id)).includes(s.id));

  return (
    <div className="px-6 py-6 overflow-y-auto h-full">
      <h1 className="text-lg font-bold text-white mb-6">Servizi Streaming</h1>
      {!hasTMDBKey() && (
        <div className="flex items-center gap-2 text-yellow-400/80 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 mb-6">
          <AlertCircle size={15} />
          <span>Configura la chiave API TMDB nelle <Link to="/settings" className="underline hover:text-yellow-300">Impostazioni → Preferenze</Link> per vedere i cataloghi dei servizi streaming.</span>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {visible.map(s => (
          <Link key={s.id} to={`/streaming/${s.id}`}
            className="group relative overflow-hidden rounded-2xl border border-white/10 hover:border-white/30 transition-all hover:scale-[1.02] aspect-video flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${s.color}33, ${s.color}11)` }}>
            <div className={clsx('absolute inset-0 bg-gradient-to-br opacity-60', s.gradient)} />
            <div className="relative z-10 text-center">
              <div className="text-4xl mb-2">{s.logo}</div>
              <p className="text-sm font-bold text-white drop-shadow">{s.name}</p>
            </div>
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </div>
  );
}
