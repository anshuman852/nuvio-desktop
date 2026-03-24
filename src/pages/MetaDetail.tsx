import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import StreamPicker from "../components/StreamPicker";
import { useAddonStore } from "../store";
import { fetchMeta } from "../api/stremio";
import { useStreams } from "../hooks/useStreams";
import { usePlayer } from "../hooks/usePlayer";
import type { MetaItem, Stream, ContentType, Video } from "../types";

export default function MetaDetail() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const { addons } = useAddonStore();
  const { streams, loading: streamsLoading, loadStreams } = useStreams();
  const { play } = usePlayer();

  const [meta, setMeta] = useState<MetaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [_selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [selectedSeason, setSelectedSeason] = useState(1);

  useEffect(() => {
    if (!type || !id) return;
    setLoading(true);
    // Prova tutti gli addon abilitati finché uno risponde
    const tryAddons = async () => {
      for (const addon of addons.filter((a) => a.enabled)) {
        const m = await fetchMeta(addon.transportUrl, type as ContentType, id);
        if (m) { setMeta(m); break; }
      }
      setLoading(false);
    };
    tryAddons();
  }, [type, id, addons]);

  const handlePlay = async (video?: Video) => {
    setSelectedVideo(video ?? null);
    const streamId = video ? `${id}:${video.season}:${video.episode}` : id!;
    await loadStreams(type as ContentType, streamId);
    setShowPicker(true);
  };

  const handleStreamSelect = async (stream: Stream) => {
    setShowPicker(false);
    const url = stream.url ?? (stream.infoHash ? `magnet:?xt=urn:btih:${stream.infoHash}` : "");
    if (!url) return;
    await play(url, meta?.name ?? "Video", meta ?? undefined, stream);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-nuvio-accent
                        border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-nuvio-muted">
        <p>Contenuto non trovato</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-nuvio-accent text-sm">
          ← Indietro
        </button>
      </div>
    );
  }

  const seasons = meta.videos
    ? [...new Set(meta.videos.filter((v) => v.season).map((v) => v.season!))]
    : [];
  const episodes = meta.videos?.filter((v) => v.season === selectedSeason) ?? [];

  return (
    <div className="flex-1 overflow-y-auto pb-24">
      {/* Hero */}
      <div className="relative h-72">
        {meta.background ? (
          <img src={meta.background} alt="" className="w-full h-full object-cover" />
        ) : meta.poster ? (
          <img src={meta.poster} alt="" className="w-full h-full object-cover blur-sm scale-110 opacity-50" />
        ) : (
          <div className="w-full h-full bg-nuvio-card" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-nuvio-bg via-nuvio-bg/60 to-transparent" />

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 text-white/80 hover:text-white
                     bg-black/40 rounded-full p-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="px-6 -mt-20 relative z-10">
        <div className="flex gap-6">
          {/* Poster */}
          {meta.poster && (
            <img src={meta.poster} alt={meta.name}
                 className="w-28 flex-shrink-0 rounded-xl shadow-2xl ring-1 ring-nuvio-border" />
          )}

          <div className="flex-1 pt-16">
            <h1 className="text-nuvio-text text-2xl font-bold">{meta.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-nuvio-muted text-sm">
              {meta.year && <span>{meta.year}</span>}
              {meta.runtime && <span>· {meta.runtime}</span>}
              {meta.imdbRating && (
                <span className="text-yellow-400">★ {meta.imdbRating}</span>
              )}
            </div>
            {meta.genres && meta.genres.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {meta.genres.map((g) => (
                  <span key={g} className="text-xs px-2 py-0.5 bg-nuvio-card
                                           border border-nuvio-border rounded-full text-nuvio-muted">
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Play button (film) */}
            {type === "movie" && (
              <button
                onClick={() => handlePlay()}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-nuvio-accent
                           hover:bg-nuvio-accent-hover text-white rounded-xl font-medium
                           text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Guarda ora
              </button>
            )}
          </div>
        </div>

        {/* Descrizione */}
        {meta.description && (
          <p className="mt-5 text-nuvio-muted text-sm leading-relaxed max-w-2xl">
            {meta.description}
          </p>
        )}

        {/* Episodi (serie) */}
        {type === "series" && seasons.length > 0 && (
          <div className="mt-8">
            {/* Season tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {seasons.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSeason(s)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap
                               transition-colors flex-shrink-0
                               ${selectedSeason === s
                                ? "bg-nuvio-accent text-white"
                                : "bg-nuvio-card text-nuvio-muted hover:text-nuvio-text"
                              }`}
                >
                  Stagione {s}
                </button>
              ))}
            </div>

            {/* Episode list */}
            <div className="space-y-1">
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  className="flex items-center gap-4 p-3 rounded-xl bg-nuvio-card/50
                             hover:bg-nuvio-card border border-transparent
                             hover:border-nuvio-border transition-all cursor-pointer group"
                  onClick={() => handlePlay(ep)}
                >
                  {ep.thumbnail ? (
                    <img src={ep.thumbnail} alt=""
                         className="w-24 h-14 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-24 h-14 rounded-lg bg-nuvio-border flex items-center
                                    justify-center flex-shrink-0 text-nuvio-muted text-lg">
                      ▶
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-nuvio-text text-sm font-medium truncate">
                      {ep.episode}. {ep.title}
                    </p>
                    {ep.overview && (
                      <p className="text-nuvio-muted text-xs mt-0.5 line-clamp-2">{ep.overview}</p>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-nuvio-muted group-hover:text-nuvio-accent
                                  transition-colors flex-shrink-0"
                       fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stream Picker */}
      {showPicker && (
        <StreamPicker
          streams={streams}
          loading={streamsLoading}
          onSelect={handleStreamSelect}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
