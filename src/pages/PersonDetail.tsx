import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import { tmdbImg } from '../api/tmdb';
import { ArrowLeft, Film, Tv, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface Credit {
  id: number;
  title: string;
  type: 'movie' | 'tv';
  poster?: string;
  year?: string;
  character?: string;
  job?: string;
  voteAverage?: number;
}

export default function PersonDetail() {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();
  const { settings } = useAppStore();
  const [person, setPerson] = useState<any>(null);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'cast' | 'crew'>('cast');

  useEffect(() => {
    if (!personId || !settings.tmdbToken) { setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/person/${personId}?language=it-IT&append_to_response=combined_credits`,
          { headers: { Authorization: `Bearer ${settings.tmdbToken}` } }
        );
        if (!res.ok) return;
        const data = await res.json();
        setPerson(data);

        const castCredits: Credit[] = (data.combined_credits?.cast ?? [])
          .filter((c: any) => c.poster_path || c.vote_average > 5)
          .sort((a: any, b: any) => (b.popularity ?? 0) - (a.popularity ?? 0))
          .slice(0, 60)
          .map((c: any): Credit => ({
            id: c.id, type: c.media_type,
            title: c.title ?? c.name,
            poster: c.poster_path ? tmdbImg(c.poster_path, 'w300') : undefined,
            year: (c.release_date ?? c.first_air_date ?? '').slice(0, 4),
            character: c.character,
            voteAverage: c.vote_average,
          }));

        const crewCredits: Credit[] = (data.combined_credits?.crew ?? [])
          .filter((c: any) => c.poster_path || c.vote_average > 5)
          .sort((a: any, b: any) => (b.popularity ?? 0) - (a.popularity ?? 0))
          .slice(0, 40)
          .map((c: any): Credit => ({
            id: c.id, type: c.media_type,
            title: c.title ?? c.name,
            poster: c.poster_path ? tmdbImg(c.poster_path, 'w300') : undefined,
            year: (c.release_date ?? c.first_air_date ?? '').slice(0, 4),
            job: c.job,
            voteAverage: c.vote_average,
          }));

        setCredits(tab === 'cast' ? castCredits : crewCredits);
      } catch { } finally { setLoading(false); }
    })();
  }, [personId, settings.tmdbToken, tab]);

  if (!settings.tmdbToken) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <p className="text-white/50">Token TMDB richiesto per vedere la filmografia.</p>
        <Link to="/settings" className="px-5 py-2.5 rounded-lg text-white text-sm" style={{ backgroundColor: 'var(--accent)' }}>Impostazioni</Link>
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full gap-3 text-white/40">
      <Loader2 size={24} className="animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-white/[0.06]">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-white/60 hover:text-white mb-4 text-sm">
          <ArrowLeft size={16} /> Indietro
        </button>
        {person && (
          <div className="flex items-center gap-4">
            {person.profile_path && (
              <img src={tmdbImg(person.profile_path, 'w300')} alt={person.name}
                className="w-16 h-16 rounded-full object-cover object-top border-2 border-white/10" />
            )}
            <div>
              <h1 className="text-xl font-bold text-white">{person.name}</h1>
              <p className="text-sm text-white/50 mt-0.5">{person.known_for_department}</p>
            </div>
          </div>
        )}

        {person?.biography && (
          <p className="mt-3 text-xs text-white/50 line-clamp-3">{person.biography}</p>
        )}

        <div className="flex gap-2 mt-4">
          {(['cast', 'crew'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx('px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                tab === t ? 'text-white' : 'bg-white/10 text-white/50 hover:text-white')}
              style={tab === t ? { backgroundColor: 'var(--accent)' } : {}}>
              {t === 'cast' ? 'Come attore' : 'Come regista/crew'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid filmografia */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {credits.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-12">Nessun credito trovato</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {credits.map((c) => (
              <Link key={`${c.type}-${c.id}`}
                to={`/detail/${c.type === 'tv' ? 'series' : 'movie'}/tmdb:${c.id}`}
                className="group">
                <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-[color:var(--accent)] transition-all group-hover:scale-[1.02]">
                  {c.poster
                    ? <img src={c.poster} alt={c.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-3xl">
                        {c.type === 'movie' ? '🎬' : '📺'}
                      </div>}
                </div>
                <p className="mt-1.5 text-xs text-white/70 group-hover:text-white truncate">{c.title}</p>
                <p className="text-xs text-white/30">{c.year} · {c.character ?? c.job}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
