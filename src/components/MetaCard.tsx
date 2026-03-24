import { useState } from "react";
import type { MetaItem } from "../types";

interface Props {
  item: MetaItem;
  onClick?: (item: MetaItem) => void;
  size?: "sm" | "md" | "lg";
}

export default function MetaCard({ item, onClick, size = "md" }: Props) {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    sm: "w-28",
    md: "w-36",
    lg: "w-44",
  };

  return (
    <div
      className={`${sizeClasses[size]} flex-shrink-0 cursor-pointer group`}
      onClick={() => onClick?.(item)}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-nuvio-card
                      ring-1 ring-nuvio-border group-hover:ring-nuvio-accent
                      transition-all duration-200 group-hover:scale-105">
        {item.poster && !imgError ? (
          <img
            src={item.poster}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-nuvio-card">
            <span className="text-nuvio-muted text-3xl">🎬</span>
          </div>
        )}

        {/* Overlay hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100
                        transition-opacity duration-200 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-nuvio-accent/90 flex items-center justify-center">
            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Rating badge */}
        {item.imdbRating && (
          <div className="absolute top-1.5 right-1.5 bg-black/70 text-yellow-400
                          text-xs font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5">
            ★ {item.imdbRating}
          </div>
        )}
      </div>

      {/* Title */}
      <p className="mt-1.5 text-xs text-nuvio-text font-medium truncate px-0.5">
        {item.name}
      </p>
      {item.year && (
        <p className="text-xs text-nuvio-muted px-0.5">{item.year}</p>
      )}
    </div>
  );
}
