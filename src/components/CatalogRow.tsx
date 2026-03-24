import { useRef } from "react";
import MetaCard from "./MetaCard";
import type { MetaItem } from "../types";

interface Props {
  title: string;
  addonName: string;
  items: MetaItem[];
  loading?: boolean;
  error?: string;
  onItemClick?: (item: MetaItem) => void;
}

export default function CatalogRow({
  title, addonName, items, loading, error, onItemClick
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "right" ? 320 : -320, behavior: "smooth" });
  };

  return (
    <section className="mb-8">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-3 px-1">
        <div>
          <h2 className="text-nuvio-text font-semibold text-base">{title}</h2>
          <p className="text-nuvio-muted text-xs mt-0.5">{addonName}</p>
        </div>
        {!loading && items.length > 0 && (
          <div className="flex gap-1.5">
            <button
              onClick={() => scroll("left")}
              className="w-7 h-7 rounded-full bg-nuvio-card border border-nuvio-border
                         text-nuvio-muted hover:text-nuvio-text hover:border-nuvio-accent
                         flex items-center justify-center transition-colors"
            >
              ‹
            </button>
            <button
              onClick={() => scroll("right")}
              className="w-7 h-7 rounded-full bg-nuvio-card border border-nuvio-border
                         text-nuvio-muted hover:text-nuvio-text hover:border-nuvio-accent
                         flex items-center justify-center transition-colors"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-36 flex-shrink-0">
              <div className="aspect-[2/3] rounded-lg bg-nuvio-card animate-pulse" />
              <div className="mt-1.5 h-3 bg-nuvio-card animate-pulse rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="h-16 flex items-center text-nuvio-muted text-sm">
          ⚠ {error}
        </div>
      ) : items.length === 0 ? (
        <div className="h-16 flex items-center text-nuvio-muted text-sm">
          Nessun contenuto
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollbarWidth: "none" }}
        >
          {items.map((item) => (
            <MetaCard key={item.id} item={item} onClick={onItemClick} />
          ))}
        </div>
      )}
    </section>
  );
}
