import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import { getTraktHistory, getTraktWatchlist } from '../api/trakt';
import { getSimklHistory } from '../api/simkl';
import { getMALAnimeList } from '../api/mal';
import { Film, Tv, Star, BookOpen, List, Heart, Clock, Loader2, Search, Filter, X } from 'lucide-react';
import clsx from 'clsx';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface LibItem {
  id: string;
  type: 'movie' | 'series' | 'anime' | string;
  name: string;
  poster?: string;
  year?: string;
  rating?: number;
  status?: string;
  source: 'trakt' | 'simkl' | 'mal' | 'local';
  watchedAt?: number;
  progress?: number;
}

type Section = 'film' | 'serie' | 'anime' | 'watchlist' | 'collezioni';

const SECTION_LABELS: Record<Section, { label: string; icon: React.ReactNode }> = {
  film:       { label: 'Film',       icon: <Film size={14} /> },
  serie:      { label: 'Serie TV',   icon: <Tv size={14} /> },
  anime:      { label: 'Anime',      icon: <BookOpen size={14} /> },
  watchlist:  { label: 'Watchlist',  icon: <List size={14} /> },
  collezioni: { label: 'Collezioni', icon: <Heart size={14} /> },
};

// ─── Card ─────────────────────────────────────────────────────────────────────

function LibCard({ item }: { item: LibItem }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <Link to={`/detail/${item.type}/${encodeURIComponent(item.id)}`} className="group">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-[color:var(--accent)] transition-all duration-200 group-hover:scale-[1.02]">
        {item.poster && !imgErr
          ? <img src={item.poster} alt={item.name} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-4xl">
              {item.type === 'movie' ? '🎬' : item.type === 'anime' ? '🍥' : '📺'}
            </div>}
        {item.rating && (
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-xs font-bold text-yellow-400 flex items-center gap-1">
            <Star size={9} className="fill-yellow-400" /> {item.rating}
          </div>
        )}
        {item.status && (
          <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded text-xs text-white/70 truncate">
            {item.status}
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="mt-1.5 text-xs text-white/70 group-hover:text-white truncate transition-colors">{item.name}</p>
      {item.year && <p className="text-xs text-white/30">{item.year}</p>}
    </Link>
  );
}

// ─── Filtri ───────────────────────────────────────────────────────────────────

function FilterBar({ search, setSearch, sort, setSort }: {
  search: string; setSearch: (v: string) => void;
  sort: string; setSort: (v: string) => void;
}) {
  return (
    <div className="flex gap-3 items-center">
      <div className="relative flex-1 max-w-xs">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca nella libreria..."
          className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white placeholder:text-white/30 transition-colors" />
        {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X size={13} /></button>}
      </div>
      <div className="flex items-center gap-2">
        <Filter size={13} className="text-white/30" />
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none cursor-pointer">
          <option value="recent">Recenti</option>
          <option value="alpha">A-Z</option>
          <option value="rating">Rating</option>
        </select>
      </div>
    </div>
  );
}

// ─── Library principale ───────────────────────────────────────────────────────

export default function Library() {
  const { traktAuth, simklAuth, malAuth } = useAppStore();
  const [section, setSection] = useState<Section>('film');
  const [items, setItems] = useState<LibItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [sources, setSources] = useState<Record<Section, LibItem[]>>({
    film: [], serie: [], anime: [], watchlist: [], collezioni: [],
  });

  useEffect(() => { loadAll(); }, [traktAuth?.token, simklAuth?.token, malAuth?.token]);

  async function loadAll() {
    setLoading(true);
    const film: LibItem[] = [];
    const serie: LibItem[] = [];
    const anime: LibItem[] = [];
    const watchlist: LibItem[] = [];
    const collezioni: LibItem[] = [];

    // ── Trakt ────────────────────────────────────────────────────────────────
    if (traktAuth?.token) {
      try {
        const history = await getTraktHistory(traktAuth.token, 200);
        const seenMovies = new Set<string>();
        const seenShows = new Set<string>();

        for (const h of history) {
          if (h.type === 'movie' && h.movie) {
            const id = h.movie.ids?.imdb ?? `tmdb:${h.movie.ids?.tmdb}`;
            if (seenMovies.has(id)) continue;
            seenMovies.add(id);
            film.push({
              id, type: 'movie', name: h.movie.title,
              year: String(h.movie.year ?? ''),
              source: 'trakt',
              watchedAt: new Date(h.watched_at).getTime(),
            });
          } else if (h.type === 'episode' && h.show) {
            const id = h.show.ids?.imdb ?? `tmdb:${h.show.ids?.tmdb}`;
            if (seenShows.has(id)) continue;
            seenShows.add(id);
            serie.push({
              id, type: 'series', name: h.show.title,
              year: String(h.show.year ?? ''),
              source: 'trakt',
              watchedAt: new Date(h.watched_at).getTime(),
            });
          }
        }

        // Watchlist Trakt
        try {
          const [wMovies, wShows] = await Promise.all([
            getTraktWatchlist(traktAuth.token, 'movies'),
            getTraktWatchlist(traktAuth.token, 'shows'),
          ]);
          for (const w of wMovies) {
            if (w.movie) watchlist.push({
              id: w.movie.ids?.imdb ?? `tmdb:${w.movie.ids?.tmdb}`,
              type: 'movie', name: w.movie.title,
              year: String(w.movie.year ?? ''), source: 'trakt',
            });
          }
          for (const w of wShows) {
            if (w.show) watchlist.push({
              id: w.show.ids?.imdb ?? `tmdb:${w.show.ids?.tmdb}`,
              type: 'series', name: w.show.title,
              year: String(w.show.year ?? ''), source: 'trakt',
            });
          }
        } catch { /* ignore watchlist errors */ }

      } catch { /* ignore trakt errors */ }
    }

    // ── Simkl ─────────────────────────────────────────────────────────────────
    if (simklAuth?.token) {
      try {
        const history = await getSimklHistory(simklAuth.token);
        const seenSimkl = new Set<string>();
        for (const h of history) {
          const isMovie = !!(h as any).movie;
          const isAnime = !!(h as any).anime;
          const item = (h as any).movie ?? (h as any).show ?? (h as any).anime;
          if (!item) continue;
          const id = item.ids?.imdb ?? `simkl:${item.ids?.simkl}`;
          if (seenSimkl.has(id)) continue;
          seenSimkl.add(id);
          const entry: LibItem = {
            id, type: isAnime ? 'anime' : isMovie ? 'movie' : 'series',
            name: item.title ?? 'Sconosciuto',
            source: 'simkl',
            watchedAt: new Date(h.last_watched_at).getTime(),
          };
          if (isAnime) anime.push(entry);
          else if (isMovie) film.push(entry);
          else serie.push(entry);
        }
      } catch { /* ignore */ }
    }

    // ── MAL ──────────────────────────────────────────────────────────────────
    if (malAuth?.token) {
      try {
        const list = await getMALAnimeList(malAuth.token);
        for (const entry of list) {
          const a = entry.node;
          if (!a) continue;
          anime.push({
            id: `mal:${a.id}`, type: 'anime',
            name: a.title ?? 'Sconosciuto',
            poster: a.main_picture?.medium,
            status: entry.list_status?.status?.replace('_', ' '),
            progress: entry.list_status?.num_watched_episodes && a.num_episodes
              ? entry.list_status.num_watched_episodes / a.num_episodes
              : undefined,
            source: 'mal',
          });
        }
      } catch { /* ignore */ }
    }

    setSources({ film, serie, anime, watchlist, collezioni });
    setLoading(false);
  }

  // Applica filtri e sort
  const baseItems = sources[section] ?? [];
  const filtered = baseItems
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'alpha') return a.name.localeCompare(b.name);
      if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
      return (b.watchedAt ?? 0) - (a.watchedAt ?? 0);
    });

  const noAuth = !traktAuth && !simklAuth && !malAuth;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-0 border-b border-white/[0.06]">
        <h1 className="text-lg font-bold text-white mb-4">Libreria</h1>

        {/* Tab sezioni */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0">
          {(Object.keys(SECTION_LABELS) as Section[]).map((s) => {
            const { label, icon } = SECTION_LABELS[s];
            const count = sources[s]?.length ?? 0;
            return (
              <button key={s} onClick={() => setSection(s)}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2.5 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors border-b-2',
                  section === s
                    ? 'text-white border-[color:var(--accent)]'
                    : 'text-white/50 border-transparent hover:text-white/70'
                )}>
                {icon} {label}
                {count > 0 && (
                  <span className={clsx('text-xs px-1.5 py-0.5 rounded-full', section === s ? 'bg-[color:var(--accent-bg)] text-[color:var(--accent)]' : 'bg-white/10 text-white/40')}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenuto */}
      <div className="flex-1 overflow-y-auto px-6 py-5">

        {noAuth ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="text-5xl">📚</div>
            <h2 className="text-lg font-semibold text-white">Nessun account collegato</h2>
            <p className="text-white/50 text-sm max-w-sm">
              Collega Trakt, Simkl o MAL nelle impostazioni per vedere la tua libreria sincronizzata.
            </p>
            <Link to="/settings" className="px-5 py-2.5 rounded-lg text-white text-sm font-medium transition-colors"
              style={{ backgroundColor: 'var(--accent)' }}>
              Vai alle Impostazioni
            </Link>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-40 gap-3 text-white/40">
            <Loader2 size={20} className="animate-spin" /> Caricamento libreria...
          </div>
        ) : (
          <>
            {/* Barra filtri */}
            <div className="mb-5">
              <FilterBar search={search} setSearch={setSearch} sort={sort} setSort={setSort} />
            </div>

            {/* Fonti attive */}
            <div className="flex gap-2 mb-5">
              {traktAuth && <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">🔴 Trakt</span>}
              {simklAuth && <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">🔵 Simkl</span>}
              {malAuth && <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">🎌 MAL</span>}
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-white/30">
                <div className="text-3xl">{section === 'watchlist' ? '📋' : section === 'anime' ? '🍥' : section === 'film' ? '🎬' : '📺'}</div>
                <p className="text-sm">
                  {search ? 'Nessun risultato per "' + search + '"' : `Nessun ${SECTION_LABELS[section].label.toLowerCase()} trovato`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                {filtered.map((item) => <LibCard key={`${item.source}-${item.id}`} item={item} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
