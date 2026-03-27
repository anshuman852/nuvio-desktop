/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { getPerson, tmdbImg, hasTMDBKey } from '../api/tmdb';
import { ArrowLeft, Loader2 } from 'lucide-react';
import clsx from 'clsx';

export default function PersonDetail() {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();
  const { settings } = useStore();
  const [person, setPerson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'cast' | 'crew'>('cast');

  useEffect(() => {
    if (!personId || !hasTMDBKey()) { setLoading(false); return; }
    (async () => {
      try { setPerson(await getPerson(parseInt(personId))); }
      catch { } finally { setLoading(false); }
    })();
  }, [personId]);

  if (!hasTMDBKey()) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <p className="text-white/50">Token TMDB richiesto.</p>
      <Link to="/settings" className="px-5 py-2.5 rounded-xl text-white text-sm" style={{ backgroundColor: 'var(--accent)' }}>Impostazioni</Link>
    </div>
  );

  if (loading) return <div className="flex items-center justify-center h-full gap-3 text-white/40"><Loader2 size={24} className="animate-spin" /></div>;

  const castCredits = (person?.combined_credits?.cast ?? [])
    .filter((c: any) => c.poster_path)
    .sort((a: any, b: any) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 60);

  const crewCredits = (person?.combined_credits?.crew ?? [])
    .filter((c: any) => c.poster_path)
    .sort((a: any, b: any) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 40);

  const credits = tab === 'cast' ? castCredits : crewCredits;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-6 py-5 border-b border-white/[0.06]">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-white/60 hover:text-white mb-4 text-sm"><ArrowLeft size={16} />Indietro</button>
        {person && (
          <div className="flex items-center gap-4">
            {person.profile_path && <img src={tmdbImg(person.profile_path, 'w185')} alt={person.name} className="w-16 h-16 rounded-full object-cover border-2 border-white/10" />}
            <div>
              <h1 className="text-xl font-bold text-white">{person.name}</h1>
              <p className="text-sm text-white/50">{person.known_for_department}</p>
            </div>
          </div>
        )}
        {person?.biography && <p className="mt-3 text-xs text-white/50 line-clamp-3">{person.biography}</p>}
        <div className="flex gap-2 mt-4">
          {(['cast', 'crew'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx('px-4 py-1.5 rounded-full text-sm font-medium transition-colors', tab === t ? 'text-white' : 'bg-white/10 text-white/50 hover:text-white')}
              style={tab === t ? { backgroundColor: 'var(--accent)' } : {}}>
              {t === 'cast' ? 'Come attore' : 'Come crew'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {credits.length === 0 ? <p className="text-white/30 text-sm text-center py-12">Nessun credito trovato</p> : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {credits.map((c: any) => {
              const isMovie = c.media_type === 'movie';
              return (
                <Link key={`${c.media_type}-${c.id}`} to={`/detail/${isMovie ? 'movie' : 'series'}/tmdb:${c.id}`} className="group">
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-[color:var(--accent)] transition-all group-hover:scale-[1.02]">
                    <img src={tmdbImg(c.poster_path, 'w185')} alt={c.title ?? c.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="mt-1 text-xs text-white/60 group-hover:text-white truncate">{c.title ?? c.name}</p>
                  <p className="text-xs text-white/30">{(c.release_date ?? c.first_air_date ?? '').slice(0, 4)} · {c.character ?? c.job}</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
