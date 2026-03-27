/// <reference types="vite/client" />
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import {
  getTraktWatchedMovies, getTraktWatchedShows, getTraktWatchlist,
  getTraktRatings, markTraktWatched, removeTraktWatched, toggleTraktWatchlist,
} from '../api/trakt';
import { getSimklHistory } from '../api/simkl';
import { getMALAnimeList } from '../api/mal';
import { getAllWatchedItems, markNuvioWatched, removeNuvioWatched } from '../api/nuvio';
import { hasTMDBKey, tmdbImg } from '../api/tmdb';
import {
  Film, Tv, BookOpen, List, Search, X, Filter, Loader2,
  Eye, EyeOff, Star, CheckCircle2, Circle, Heart, HeartOff,
  RefreshCw, AlertCircle, ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface LibItem {
  id: string;
  type: 'movie' | 'series' | 'anime' | string;
  name: string;
  poster?: string;
  year?: string;
  rating?: number;        // voto utente Trakt (1-10)
  traktRating?: number;   // voto pubblico
  status?: string;
  source: string;
  watchedAt?: number;
  watchCount?: number;    // n. volte vista (Trakt)
  inWatchlist?: boolean;
  watched: boolean;
  // IDs per le azioni
  traktId?: number;
  imdbId?: string;
  tmdbId?: number;
  slug?: string;
}

type Tab = 'film' | 'serie' | 'anime' | 'watchlist';

// ─── Star rating ──────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5,6,7,8,9,10].map(n => (
        <button key={n} onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110">
          <Star size={12}
            className={clsx((hover || value) >= n ? 'text-yellow-400 fill-yellow-400' : 'text-white/20')} />
        </button>
      ))}
      {value > 0 && <span className="text-xs text-white/40 ml-1">{value}/10</span>}
    </div>
  );
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({ item, onToggleWatched, onToggleWatchlist, onRate }: {
  item: LibItem;
  onToggleWatched: (item: LibItem) => void;
  onToggleWatchlist: (item: LibItem) => void;
  onRate: (item: LibItem, rating: number) => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);

  async function toggleWatched(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (pending) return;
    setPending(true);
    await onToggleWatched(item);
    setPending(false);
  }

  async function toggleWL(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    await onToggleWatchlist(item);
  }

  return (
    <div className="group relative">
      <Link to={`/detail/${item.type === 'anime' ? 'series' : item.type}/${encodeURIComponent(item.imdbId ?? item.id)}`}>
        <div className={clsx(
          'aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border transition-all group-hover:scale-[1.02]',
          item.watched
            ? 'border-[color:var(--accent-border,#7c3aed55)]'
            : 'border-white/10 group-hover:border-[color:var(--accent)]'
        )}>
          {item.poster && !imgErr
            ? <img src={item.poster} alt={item.name} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
            : <div className="w-full h-full flex items-center justify-center text-3xl bg-white/5">
                {item.type === 'movie' ? '🎬' : item.type === 'anime' ? '🍥' : '📺'}
              </div>}

          {/* Watched overlay - sottile bordo e overlay scuro invece del pallino */}
          {item.watched && (
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />
          )}
          {item.watched && (
            <div className="absolute bottom-1.5 right-1.5 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 size={10} style={{color:'var(--accent)'}} className="fill-[color:var(--accent)]" />
              <span className="text-xs font-medium" style={{color:'var(--accent)'}}>Visto</span>
            </div>
          )}

          {/* Rating badge */}
          {item.rating && (
            <div className="absolute top-1.5 right-1.5 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-xs font-bold text-yellow-400 flex items-center gap-0.5">
              <Star size={9} className="fill-yellow-400" />{item.rating}
            </div>
          )}

          {/* Hover actions */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
            <button onClick={toggleWatched}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors w-full justify-center',
                item.watched ? 'bg-white/20 hover:bg-white/30 text-white' : 'text-white hover:opacity-90')}
              style={!item.watched ? { backgroundColor: 'var(--accent)' } : {}}>
              {pending ? <Loader2 size={12} className="animate-spin" /> : item.watched ? <EyeOff size={12} /> : <Eye size={12} />}
              {item.watched ? 'Da vedere' : 'Visto'}
            </button>
            <button onClick={toggleWL}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white w-full justify-center">
              {item.inWatchlist ? <HeartOff size={12} /> : <Heart size={12} />}
              {item.inWatchlist ? 'Rimuovi' : 'Watchlist'}
            </button>
          </div>
        </div>
      </Link>

      <p className="mt-1.5 text-xs text-white/70 group-hover:text-white truncate leading-tight">{item.name}</p>
      <p className="text-xs text-white/30">{item.year}</p>

      {/* Mini star rating */}
      {item.type !== 'anime' && (
        <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <StarRating value={item.rating ?? 0} onChange={(r) => onRate(item, r)} />
        </div>
      )}
    </div>
  );
}

// ─── Library page ─────────────────────────────────────────────────────────────

export default function Library() {
  const { traktAuth, simklAuth, malAuth, nuvioUser } = useStore();
  const [tab, setTab] = useState<Tab>('film');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'recent' | 'alpha' | 'rating'>('recent');
  const [showOnlyWatched, setShowOnlyWatched] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'trakt' | 'nuvio' | 'simkl' | 'mal'>('all');

  const [data, setData] = useState<Record<Tab, LibItem[]>>({
    film: [], serie: [], anime: [], watchlist: [],
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const film: LibItem[] = [];
    const serie: LibItem[] = [];
    const anime: LibItem[] = [];
    const watchlist: LibItem[] = [];

    // Raccogli IDs visti da Nuvio per cross-reference
    const nuvioWatched = new Set<string>();
    if (nuvioUser?.token && nuvioUser.id) {
      try {
        const items = await getAllWatchedItems(nuvioUser.id);
        items.forEach(i => nuvioWatched.add(i.id));
      } catch { /* non bloccante */ }
    }

    // ── Trakt ────────────────────────────────────────────────────────────────
    if (traktAuth?.token) {
      try {
        // Film visti (lista completa con conteggio)
        const [watchedMovies, watchedShows, wlMovies, wlShows, ratingsM, ratingsS] = await Promise.all([
          getTraktWatchedMovies(traktAuth.token),
          getTraktWatchedShows(traktAuth.token),
          getTraktWatchlist(traktAuth.token, 'movies'),
          getTraktWatchlist(traktAuth.token, 'shows'),
          getTraktRatings(traktAuth.token, 'movies'),
          getTraktRatings(traktAuth.token, 'shows'),
        ]);

        // Mappa rating per ID
        const movieRatings = new Map<string, number>();
        const showRatings = new Map<string, number>();
        ratingsM.forEach((r: any) => { if (r.movie?.ids?.imdb) movieRatings.set(r.movie.ids.imdb, r.rating); });
        ratingsS.forEach((r: any) => { if (r.show?.ids?.imdb) showRatings.set(r.show.ids.imdb, r.rating); });

        // Watchlist IDs
        const wlMovieIds = new Set(wlMovies.map((w: any) => w.movie?.ids?.imdb).filter(Boolean));
        const wlShowIds = new Set(wlShows.map((w: any) => w.show?.ids?.imdb).filter(Boolean));

        // Film
        for (const w of watchedMovies) {
          const m = w.movie;
          if (!m) continue;
          const imdb = m.ids?.imdb;
          film.push({
            id: imdb ?? `trakt:${m.ids?.trakt}`,
            imdbId: imdb,
            traktId: m.ids?.trakt,
            tmdbId: m.ids?.tmdb,
            type: 'movie',
            name: m.title ?? '',
            year: String(m.year ?? ''),
            poster: m.images?.poster?.['1280'] ?? m.images?.poster?.full,
            rating: imdb ? movieRatings.get(imdb) : undefined,
            source: 'trakt',
            watchedAt: new Date(w.last_watched_at ?? 0).getTime(),
            watchCount: w.plays ?? 1,
            inWatchlist: imdb ? wlMovieIds.has(imdb) : false,
            watched: true,
          });
        }

        // Watchlist film non ancora visti
        for (const w of wlMovies) {
          const m = w.movie;
          if (!m) continue;
          const imdb = m.ids?.imdb;
          const alreadyInFilm = film.some(f => f.id === imdb);
          if (alreadyInFilm) continue;
          film.push({
            id: imdb ?? `trakt:${m.ids?.trakt}`,
            imdbId: imdb,
            traktId: m.ids?.trakt,
            type: 'movie',
            name: m.title ?? '',
            year: String(m.year ?? ''),
            source: 'trakt',
            inWatchlist: true,
            watched: nuvioWatched.has(imdb ?? ''),
          });
          watchlist.push({
            id: imdb ?? `trakt:${m.ids?.trakt}`,
            imdbId: imdb,
            traktId: m.ids?.trakt,
            type: 'movie',
            name: m.title ?? '',
            year: String(m.year ?? ''),
            source: 'trakt',
            inWatchlist: true,
            watched: nuvioWatched.has(imdb ?? ''),
          });
        }

        // Serie
        for (const w of watchedShows) {
          const s = w.show;
          if (!s) continue;
          const imdb = s.ids?.imdb;
          serie.push({
            id: imdb ?? `trakt:${s.ids?.trakt}`,
            imdbId: imdb,
            traktId: s.ids?.trakt,
            tmdbId: s.ids?.tmdb,
            slug: s.ids?.slug,
            type: 'series',
            name: s.title ?? '',
            year: String(s.year ?? ''),
            poster: s.images?.poster?.['1280'] ?? s.images?.poster?.full,
            rating: imdb ? showRatings.get(imdb) : undefined,
            source: 'trakt',
            watchedAt: new Date(w.last_watched_at ?? 0).getTime(),
            watchCount: w.plays ?? 1,
            inWatchlist: imdb ? wlShowIds.has(imdb) : false,
            watched: true,
          });
        }

        // Watchlist serie
        for (const w of wlShows) {
          const s = w.show;
          if (!s) continue;
          const imdb = s.ids?.imdb;
          const alreadyInSerie = serie.some(x => x.id === imdb);
          if (!alreadyInSerie) {
            serie.push({
              id: imdb ?? `trakt:${s.ids?.trakt}`,
              imdbId: imdb,
              traktId: s.ids?.trakt,
              type: 'series',
              name: s.title ?? '',
              year: String(s.year ?? ''),
              source: 'trakt',
              inWatchlist: true,
              watched: false,
            });
          }
          watchlist.push({
            id: imdb ?? `trakt:${s.ids?.trakt}`,
            imdbId: imdb,
            traktId: s.ids?.trakt,
            type: 'series',
            name: s.title ?? '',
            year: String(s.year ?? ''),
            source: 'trakt',
            inWatchlist: true,
            watched: false,
          });
        }
      } catch (e: any) {
        setError(`Errore Trakt: ${e.message}`);
      }
    }

    // ── Nuvio watched (integra poster mancanti da Trakt) ─────────────────────
    if (nuvioUser?.token && nuvioUser.id) {
      try {
        const items = await getAllWatchedItems(nuvioUser.id);
        for (const i of items) {
          const isMovie = i.type === 'movie';
          const target = isMovie ? film : serie;
          const existing = target.find(x => x.id === i.id);
          if (existing) {
            // Aggiorna poster se mancante
            if (!existing.poster && i.poster) existing.poster = i.poster;
            existing.watched = true;
          } else {
            target.push({
              id: i.id, type: i.type as any, name: i.name, poster: i.poster,
              source: 'nuvio', watchedAt: new Date(i.watchedAt).getTime(),
              watched: true, inWatchlist: false,
            });
          }
        }
      } catch { /* non bloccante */ }
    }

    // ── Simkl ─────────────────────────────────────────────────────────────────
    if (simklAuth?.token) {
      try {
        const history = await getSimklHistory(simklAuth.token);
        for (const h of history) {
          const item = h.movie ?? h.show;
          if (!item) continue;
          const id = item.ids?.imdb ?? `simkl:${item.ids?.simkl}`;
          const isMovie = h._type === 'movie';
          const target = isMovie ? film : serie;
          if (!target.find(x => x.id === id)) {
            target.push({
              id, type: isMovie ? 'movie' : 'series',
              name: item.title, source: 'simkl',
              watchedAt: new Date(h.last_watched_at ?? 0).getTime(),
              watched: true,
            });
          }
        }
      } catch { /* non bloccante */ }
    }

    // ── MAL ───────────────────────────────────────────────────────────────────
    if (malAuth?.token) {
      try {
        const list = await getMALAnimeList(malAuth.token);
        for (const entry of list) {
          const a = entry.node;
          if (!a) continue;
          anime.push({
            id: `mal:${a.id}`, type: 'anime',
            name: a.title, poster: a.main_picture?.medium,
            status: entry.list_status?.status?.replace('_', ' '),
            source: 'mal',
            watched: entry.list_status?.status === 'completed',
          });
        }
      } catch { /* non bloccante */ }
    }

    setData({ film, serie, anime, watchlist });
    setLoading(false);

    // Fetch poster mancanti da TMDB in background
    if (hasTMDBKey()) {
      const fetchPoster = async (item: LibItem) => {
        if (item.poster || !item.imdbId) return;
        try {
          const { getDetails, tmdbImg: tImg } = await import('../api/tmdb');
          // Cerca per IMDb ID tramite find endpoint
          const res = await fetch(`https://api.themoviedb.org/3/find/${item.imdbId}?api_key=${(await import('../lib/store')).useStore.getState().settings.tmdbApiKey}&external_source=imdb_id`);
          if (!res.ok) return;
          const d = await res.json();
          const result = (d.movie_results ?? d.tv_results ?? [])[0];
          if (result?.poster_path) {
            const poster = tImg(result.poster_path, 'w342');
            setData(prev => ({
              film: prev.film.map(x => x.id === item.id ? { ...x, poster } : x),
              serie: prev.serie.map(x => x.id === item.id ? { ...x, poster } : x),
              anime: prev.anime.map(x => x.id === item.id ? { ...x, poster } : x),
              watchlist: prev.watchlist.map(x => x.id === item.id ? { ...x, poster } : x),
            }));
          }
        } catch { /* non critico */ }
      };

      // Fetch i primi 30 senza poster (batch limitato per non sovraccaricare)
      const withoutPoster = [...film, ...serie].filter(i => !i.poster && i.imdbId).slice(0, 30);
      // Batch di 5 alla volta
      for (let i = 0; i < withoutPoster.length; i += 5) {
        await Promise.allSettled(withoutPoster.slice(i, i + 5).map(fetchPoster));
        await new Promise(r => setTimeout(r, 200)); // delay tra batch
      }
    }
  }, [traktAuth?.token, simklAuth?.token, malAuth?.token, nuvioUser?.token]);

  useEffect(() => { load(); }, [load]);

  // ── Azioni mark as watched ─────────────────────────────────────────────────

  async function handleToggleWatched(item: LibItem) {
    const nowWatched = !item.watched;

    // Ottimistic update
    setData(prev => {
      const update = (arr: LibItem[]) => arr.map(x =>
        x.id === item.id ? { ...x, watched: nowWatched } : x
      );
      return { film: update(prev.film), serie: update(prev.serie), anime: update(prev.anime), watchlist: update(prev.watchlist) };
    });

    // Trakt
    if (traktAuth?.token) {
      try {
        const ids = { trakt: item.traktId, imdb: item.imdbId, tmdb: item.tmdbId };
        const traktType = item.type === 'movie' ? 'movie' : 'show';
        if (nowWatched) {
          await markTraktWatched(traktAuth.token, traktType, ids);
        } else {
          await removeTraktWatched(traktAuth.token, traktType, ids);
        }
      } catch { /* non critico */ }
    }

    // Nuvio
    if (nuvioUser?.token && nuvioUser.id) {
      try {
        if (nowWatched) {
          await markNuvioWatched(nuvioUser.id, { id: item.id, type: item.type, name: item.name, poster: item.poster });
        } else {
          await removeNuvioWatched(nuvioUser.id, item.id);
        }
      } catch { /* non critico */ }
    }
  }

  async function handleToggleWatchlist(item: LibItem) {
    const add = !item.inWatchlist;
    setData(prev => {
      const update = (arr: LibItem[]) => arr.map(x =>
        x.id === item.id ? { ...x, inWatchlist: add } : x
      );
      return { film: update(prev.film), serie: update(prev.serie), anime: update(prev.anime), watchlist: update(prev.watchlist) };
    });
    if (traktAuth?.token && (item.traktId || item.imdbId)) {
      try {
        const ids = { trakt: item.traktId, imdb: item.imdbId };
        await toggleTraktWatchlist(traktAuth.token, item.type === 'movie' ? 'movie' : 'show', ids, add);
      } catch { /* non critico */ }
    }
  }

  async function handleRate(item: LibItem, rating: number) {
    setData(prev => {
      const update = (arr: LibItem[]) => arr.map(x => x.id === item.id ? { ...x, rating } : x);
      return { film: update(prev.film), serie: update(prev.serie), anime: update(prev.anime), watchlist: update(prev.watchlist) };
    });
    if (traktAuth?.token && (item.traktId || item.imdbId)) {
      try {
        await import('../api/trakt').then(m =>
          m.rateTraktItem(traktAuth!.token, item.type === 'movie' ? 'movie' : 'show', { trakt: item.traktId, imdb: item.imdbId }, rating)
        );
      } catch { /* non critico */ }
    }
  }

  // ── Filtri ────────────────────────────────────────────────────────────────

  const baseItems = data[tab];
  const filtered = baseItems
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))
    .filter(i => !showOnlyWatched || i.watched)
    .filter(i => sourceFilter === 'all' || i.source === sourceFilter)
    .sort((a, b) => {
      if (sort === 'alpha') return a.name.localeCompare(b.name);
      if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
      return (b.watchedAt ?? 0) - (a.watchedAt ?? 0);
    });

  const watchedCount = baseItems.filter(i => i.watched).length;
  const noAuth = !traktAuth && !simklAuth && !malAuth && !nuvioUser;

  const TABS = [
    { id: 'film' as Tab,      label: 'Film',      icon: Film,     count: data.film.length },
    { id: 'serie' as Tab,     label: 'Serie TV',  icon: Tv,       count: data.serie.length },
    { id: 'anime' as Tab,     label: 'Anime',     icon: BookOpen, count: data.anime.length },
    { id: 'watchlist' as Tab, label: 'Watchlist', icon: List,     count: data.watchlist.length },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-0 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-white">Libreria</h1>
          <button onClick={load} disabled={loading}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors disabled:opacity-40">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map(({ id, label, icon: Icon, count }) => (
            <button key={id} onClick={() => setTab(id)}
              className={clsx('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                tab === id ? 'text-white border-[color:var(--accent)]' : 'text-white/50 border-transparent hover:text-white/70')}>
              <Icon size={14} />{label}
              {count > 0 && (
                <span className={clsx('text-xs px-1.5 py-0.5 rounded-full',
                  tab === id ? 'bg-[color:var(--accent-bg)] text-[color:var(--accent)]' : 'bg-white/10 text-white/40')}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">

        {noAuth ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="text-5xl">📚</div>
            <h2 className="text-lg font-semibold text-white">Nessun account collegato</h2>
            <p className="text-white/50 text-sm max-w-sm">Collega Trakt, Simkl, MAL o Nuvio nelle impostazioni per importare la tua libreria.</p>
            <Link to="/settings" className="px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: 'var(--accent)' }}>
              Impostazioni
            </Link>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-40 gap-3 text-white/40">
            <Loader2 size={20} className="animate-spin" />Importazione libreria...
          </div>
        ) : (
          <>
            {error && (
              <div className="flex items-center gap-2 text-red-400/80 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-4">
                <AlertCircle size={13} />{error}
              </div>
            )}

            {/* Fonti attive + statistiche */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              {traktAuth && <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">🔴 Trakt</span>}
              {simklAuth && <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">🔵 Simkl</span>}
              {malAuth && <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">🎌 MAL</span>}
              {nuvioUser && <span className="text-xs px-2 py-1 rounded-full bg-[color:var(--accent-bg)] border border-[color:var(--accent-border)] text-[color:var(--accent)]">☁️ Nuvio</span>}
              <span className="text-xs text-white/30 ml-auto">
                {watchedCount} visti · {baseItems.length - watchedCount} da vedere
              </span>
            </div>

            {/* Filtri */}
            <div className="flex gap-2 items-center mb-5 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Cerca..."
                  className="w-full pl-8 pr-8 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white placeholder:text-white/30" />
                {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X size={13} /></button>}
              </div>

              <select value={sort} onChange={e => setSort(e.target.value as any)}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none cursor-pointer">
                <option value="recent">Recenti</option>
                <option value="alpha">A-Z</option>
                <option value="rating">Voto</option>
              </select>

              {/* Filtro fonte */}
              {['all','trakt','nuvio','simkl','mal'].map(s => {
                const labels: Record<string, string> = { all: 'Tutti', trakt: '🔴 Trakt', nuvio: '☁️ Nuvio', simkl: '🔵 Simkl', mal: '🎌 MAL' };
                const sources = new Set(baseItems.map(i => i.source));
                if (s !== 'all' && !sources.has(s)) return null;
                return (
                  <button key={s} onClick={() => setSourceFilter(s as any)}
                    className={clsx('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors',
                      sourceFilter === s ? 'border-[color:var(--accent)] bg-[color:var(--accent-bg)] text-[color:var(--accent)]' : 'border-white/10 text-white/50 hover:text-white hover:border-white/20')}>
                    {labels[s]}
                  </button>
                );
              })}

              <button onClick={() => setShowOnlyWatched(v => !v)}
                className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-colors',
                  showOnlyWatched
                    ? 'border-[color:var(--accent)] bg-[color:var(--accent-bg)] text-[color:var(--accent)]'
                    : 'border-white/10 text-white/50 hover:text-white hover:border-white/20')}>
                <Eye size={13} />Solo visti
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-white/30">
                <div className="text-3xl">📭</div>
                <p className="text-sm">{search ? `Nessun risultato per "${search}"` : 'Nessun elemento in questa sezione'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3">
                {filtered.map(item => (
                  <ItemCard
                    key={`${item.source}-${item.id}`}
                    item={item}
                    onToggleWatched={handleToggleWatched}
                    onToggleWatchlist={handleToggleWatchlist}
                    onRate={handleRate}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
