import React from 'react';
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { getPerson, tmdbImg, hasTMDBKey } from '../api/tmdb';
import { ArrowLeft, Loader2, AlertCircle, Film, Tv, Calendar } from 'lucide-react';
import clsx from 'clsx';

export default function PersonDetail() {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();
  const { settings } = useStore();
  const [person, setPerson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personId || !settings.tmdbApiKey) {
      setLoading(false);
      return;
    }

    const loadPerson = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPerson(parseInt(personId));
        setPerson(data);
      } catch (err) {
        console.error('Error loading person:', err);
        setError('Failed to load person details');
      } finally {
        setLoading(false);
      }
    };

    loadPerson();
  }, [personId, settings.tmdbApiKey]);

  if (!settings.tmdbApiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <p className="text-white/50">Configure TMDB API key in Settings</p>
        <Link to="/settings" className="px-5 py-2.5 rounded-xl text-white text-sm" style={{ backgroundColor: 'var(--accent)' }}>
          Go to Settings
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-white/40">
        <Loader2 size={28} className="animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-white/60 text-sm">{error || 'Person not found'}</p>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-white/10 text-white rounded-xl text-sm">Back</button>
      </div>
    );
  }

  const profilePhoto = tmdbImg(person.profile_path, 'w342');
  const knownFor = person.known_for_department;
  const birthday = person.birthday ? new Date(person.birthday).toLocaleDateString() : null;
  const deathday = person.deathday ? new Date(person.deathday).toLocaleDateString() : null;
  const placeOfBirth = person.place_of_birth;
  const biography = person.biography;
  const combinedCredits = person.combined_credits;
  
  // Filmography grouped by type
  const movies = (combinedCredits?.cast?.filter((c: any) => c.media_type === 'movie') || []).slice(0, 15);
  const tvShows = (combinedCredits?.cast?.filter((c: any) => c.media_type === 'tv') || []).slice(0, 15);

  return (
    <div className="overflow-y-auto h-full">
      <div className="relative">
        {/* Back button */}
        <button onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-10 flex items-center gap-1.5 text-white/60 hover:text-white bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm transition-colors">
          <ArrowLeft size={14} />Back
        </button>

        {/* Hero section */}
        <div className="flex flex-col md:flex-row gap-6 p-6 pt-16">
          {/* Profile photo */}
          <div className="flex-shrink-0">
            {profilePhoto ? (
              <img src={profilePhoto} alt={person.name} className="w-48 rounded-2xl shadow-2xl border border-white/10" />
            ) : (
              <div className="w-48 h-48 rounded-2xl bg-white/5 flex items-center justify-center">
                <span className="text-6xl text-white/20">{person.name?.charAt(0)}</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-2">{person.name}</h1>
            
            <div className="flex flex-wrap gap-3 text-sm text-white/60 mb-4">
              {knownFor && <span className="px-2 py-1 rounded-full bg-white/10">{knownFor}</span>}
              {birthday && (
                <span className="flex items-center gap-1">
                  <Calendar size={14} /> Born: {birthday}
                  {placeOfBirth && ` in ${placeOfBirth}`}
                </span>
              )}
              {deathday && <span className="text-red-400/60">Died: {deathday}</span>}
            </div>

            {biography && (
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Biography</p>
                <p className="text-sm text-white/70 leading-relaxed max-w-2xl">
                  {biography.length > 500 ? biography.slice(0, 500) + '...' : biography}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Filmography */}
        <div className="px-6 pb-8">
          {movies.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Film size={18} /> Movies
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {movies.map((movie: any) => (
                  <Link key={movie.id} to={`/detail/movie/tmdb:${movie.id}`} className="group">
                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-white/5 border border-white/10 group-hover:border-[color:var(--accent)] transition-all group-hover:scale-[1.02]">
                      {movie.poster_path ? (
                        <img src={tmdbImg(movie.poster_path, 'w342')} alt={movie.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20"><Film size={24} /></div>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-white/70 group-hover:text-white truncate">{movie.title}</p>
                    <p className="text-[10px] text-white/30">{movie.release_date?.slice(0, 4) || ''}</p>
                    <p className="text-[10px] text-white/40 truncate">{movie.character}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {tvShows.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Tv size={18} /> TV Shows
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {tvShows.map((show: any) => (
                  <Link key={show.id} to={`/detail/series/tmdb:${show.id}`} className="group">
                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-white/5 border border-white/10 group-hover:border-[color:var(--accent)] transition-all group-hover:scale-[1.02]">
                      {show.poster_path ? (
                        <img src={tmdbImg(show.poster_path, 'w342')} alt={show.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20"><Tv size={24} /></div>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-white/70 group-hover:text-white truncate">{show.name}</p>
                    <p className="text-[10px] text-white/30">{show.first_air_date?.slice(0, 4) || ''}</p>
                    <p className="text-[10px] text-white/40 truncate">{show.character}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}