/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { getTraktHistory, getTraktWatchlist } from '../api/trakt';
import { getSimklHistory } from '../api/simkl';
import { getMALAnimeList } from '../api/mal';
import { Film, Tv, Star, BookOpen, List, Loader2, Search, X, Filter } from 'lucide-react';
import clsx from 'clsx';

interface LibItem {
  id: string; type: string; name: string;
  poster?: string; year?: string; rating?: number;
  status?: string; source: string; watchedAt?: number;
}

type Tab = 'film' | 'serie' | 'anime' | 'watchlist';

const TABS = [
  { id: 'film' as Tab,      label: 'Film',      icon: Film },
  { id: 'serie' as Tab,     label: 'Serie TV',  icon: Tv },
  { id: 'anime' as Tab,     label: 'Anime',     icon: BookOpen },
  { id: 'watchlist' as Tab, label: 'Watchlist', icon: List },
];

function ItemCard({ item }: { item: LibItem }) {
  const [err, setErr] = useState(false);
  return (
    <Link to={`/detail/${item.type === 'anime' ? 'series' : item.type}/${encodeURIComponent(item.id)}`} className="group">
      <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-[color:var(--accent)] transition-all group-hover:scale-[1.02] relative">
        {item.poster && !err
          ? <img src={item.poster} alt={item.name} className="w-full h-full object-cover" onError={() => setErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-4xl">{item.type === 'movie' ? '🎬' : item.type === 'anime' ? '🍥' : '📺'}</div>}
        {item.rating && (
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-xs font-bold text-yellow-400 flex items-center gap-1">
            <Star size={9} className="fill-yellow-400" />{item.rating}
          </div>
        )}
        {item.status && (
          <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 text-xs text-white/70 truncate">{item.status}</div>
        )}
        <span className={clsx('absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full font-medium',
          item.source === 'trakt' ? 'bg-red-500/80 text-white' : item.source === 'simkl' ? 'bg-blue-500/80 text-white' : 'bg-indigo-500/80 text-white')}>
          {item.source === 'trakt' ? 'T' : item.source === 'simkl' ? 'S' : 'M'}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-white/70 group-hover:text-white truncate">{item.name}</p>
      {item.year && <p className="text-xs text-white/30">{item.year}</p>}
    </Link>
  );
}

export default function Library() {
  const { traktAuth, simklAuth, malAuth } = useStore();
  const [tab, setTab] = useState<Tab>('film');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [data, setData] = useState<Record<Tab, LibItem[]>>({ film: [], serie: [], anime: [], watchlist: [] });

  useEffect(() => { loadAll(); }, [traktAuth?.token, simklAuth?.token, malAuth?.token]);

  async function loadAll() {
    setLoading(true);
    const film: LibItem[] = [], serie: LibItem[] = [], anime: LibItem[] = [], watchlist: LibItem[] = [];

    if (traktAuth?.token) {
      try {
        const history = await getTraktHistory(traktAuth.token, 500);
        const seenM = new Set<string>(), seenS = new Set<string>();
        for (const h of history) {
          if (h.type === 'movie' && h.movie) {
            const id = h.movie.ids?.imdb ?? `tmdb:${h.movie.ids?.tmdb}`;
            if (!seenM.has(id)) { seenM.add(id); film.push({ id, type: 'movie', name: h.movie.title, year: String(h.movie.year ?? ''), source: 'trakt', watchedAt: new Date(h.watched_at).getTime() }); }
          } else if (h.type === 'episode' && h.show) {
            const id = h.show.ids?.imdb ?? `tmdb:${h.show.ids?.tmdb}`;
            if (!seenS.has(id)) { seenS.add(id); serie.push({ id, type: 'series', name: h.show.title, year: String(h.show.year ?? ''), source: 'trakt', watchedAt: new Date(h.watched_at).getTime() }); }
          }
        }
        const [wm, ws] = await Promise.all([getTraktWatchlist(traktAuth.token, 'movies'), getTraktWatchlist(traktAuth.token, 'shows')]);
        for (const w of wm) if (w.movie) watchlist.push({ id: w.movie.ids?.imdb ?? `tmdb:${w.movie.ids?.tmdb}`, type: 'movie', name: w.movie.title, year: String(w.movie.year ?? ''), source: 'trakt' });
        for (const w of ws) if (w.show) watchlist.push({ id: w.show.ids?.imdb ?? `tmdb:${w.show.ids?.tmdb}`, type: 'series', name: w.show.title, year: String(w.show.year ?? ''), source: 'trakt' });
      } catch { }
    }

    if (simklAuth?.token) {
      try {
        const history = await getSimklHistory(simklAuth.token);
        for (const h of history) {
          const item = h.movie ?? h.show ?? h.anime;
          if (!item) continue;
          const id = item.ids?.imdb ?? `simkl:${item.ids?.simkl}`;
          const entry: LibItem = { id, type: h._type === 'movie' ? 'movie' : 'series', name: item.title, source: 'simkl', watchedAt: new Date(h.last_watched_at ?? 0).getTime() };
          if (h._type === 'movie') film.push(entry); else serie.push(entry);
        }
      } catch { }
    }

    if (malAuth?.token) {
      try {
        const list = await getMALAnimeList(malAuth.token);
        for (const entry of list) {
          const a = entry.node;
          if (!a) continue;
          anime.push({ id: `mal:${a.id}`, type: 'anime', name: a.title, poster: a.main_picture?.medium, status: entry.list_status?.status?.replace('_', ' '), source: 'mal' });
        }
      } catch { }
    }

    setData({ film, serie, anime, watchlist });
    setLoading(false);
  }

  const items = data[tab];
  const filtered = items
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === 'alpha' ? a.name.localeCompare(b.name) : sort === 'rating' ? (b.rating ?? 0) - (a.rating ?? 0) : (b.watchedAt ?? 0) - (a.watchedAt ?? 0));

  const noAuth = !traktAuth && !simklAuth && !malAuth;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-6 pt-5 pb-0 border-b border-white/[0.06]">
        <h1 className="text-lg font-bold text-white mb-4">Libreria</h1>
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map(({ id, label, icon: Icon }) => {
            const count = data[id]?.length ?? 0;
            return (
              <button key={id} onClick={() => setTab(id)}
                className={clsx('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2',
                  tab === id ? 'text-white border-[color:var(--accent)]' : 'text-white/50 border-transparent hover:text-white/70')}>
                <Icon size={14} />{label}
                {count > 0 && <span className={clsx('text-xs px-1.5 py-0.5 rounded-full', tab === id ? 'bg-[color:var(--accent-bg)] text-[color:var(--accent)]' : 'bg-white/10 text-white/40')}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {noAuth ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="text-5xl">📚</div>
            <h2 className="text-lg font-semibold text-white">Nessun account collegato</h2>
            <p className="text-white/50 text-sm max-w-sm">Collega Trakt, Simkl o MAL nelle impostazioni per vedere la tua libreria.</p>
            <Link to="/settings" className="px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: 'var(--accent)' }}>Impostazioni</Link>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-40 gap-3 text-white/40">
            <Loader2 size={20} className="animate-spin" />Caricamento libreria...
          </div>
        ) : (
          <>
            <div className="flex gap-3 items-center mb-5">
              <div className="flex gap-1.5">
                {traktAuth && <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">🔴 Trakt</span>}
                {simklAuth && <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">🔵 Simkl</span>}
                {malAuth && <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">🎌 MAL</span>}
              </div>
              <div className="relative flex-1 max-w-xs ml-auto">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca..." className="w-full pl-8 pr-8 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white placeholder:text-white/30" />
                {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X size={13} /></button>}
              </div>
              <select value={sort} onChange={e => setSort(e.target.value)} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none cursor-pointer">
                <option value="recent">Recenti</option>
                <option value="alpha">A-Z</option>
              </select>
            </div>
            {filtered.length === 0
              ? <div className="flex flex-col items-center justify-center h-40 gap-2 text-white/30"><div className="text-3xl">📭</div><p className="text-sm">{search ? `Nessun risultato per "${search}"` : 'Nessun elemento'}</p></div>
              : <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">{filtered.map(item => <ItemCard key={`${item.source}-${item.id}`} item={item} />)}</div>}
          </>
        )}
      </div>
    </div>
  );
}
