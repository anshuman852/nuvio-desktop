import type { Stream } from "../types";

interface Props {
  streams: Stream[];
  loading: boolean;
  onSelect: (stream: Stream) => void;
  onClose: () => void;
}

export default function StreamPicker({ streams, loading, onSelect, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
         onClick={onClose}>
      <div className="bg-nuvio-surface border border-nuvio-border rounded-2xl
                      w-full max-w-lg mx-4 max-h-[70vh] flex flex-col overflow-hidden"
           onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-nuvio-border">
          <h3 className="text-nuvio-text font-semibold">Scegli sorgente</h3>
          <button onClick={onClose}
                  className="text-nuvio-muted hover:text-nuvio-text text-xl leading-none">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-2">
          {loading ? (
            <div className="py-8 text-center text-nuvio-muted">
              <div className="animate-spin w-8 h-8 border-2 border-nuvio-accent
                              border-t-transparent rounded-full mx-auto mb-3" />
              Ricerca sorgenti...
            </div>
          ) : streams.length === 0 ? (
            <div className="py-8 text-center text-nuvio-muted text-sm">
              Nessuna sorgente trovata
            </div>
          ) : (
            <div className="space-y-1">
              {streams.map((stream, i) => (
                <button
                  key={i}
                  onClick={() => onSelect(stream)}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-nuvio-card
                             transition-colors group flex items-center gap-3"
                >
                  {/* Icona tipo stream */}
                  <div className="w-8 h-8 rounded-lg bg-nuvio-card group-hover:bg-nuvio-border
                                  flex items-center justify-center flex-shrink-0 text-sm transition-colors">
                    {stream.infoHash ? "🧲" : stream.ytId ? "▶" : "🔗"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-nuvio-text text-sm font-medium truncate">
                      {stream.name ?? "Stream"}
                    </p>
                    {stream.description && (
                      <p className="text-nuvio-muted text-xs truncate mt-0.5">
                        {stream.description}
                      </p>
                    )}
                    <p className="text-nuvio-accent text-xs mt-0.5">{stream.addonName}</p>
                  </div>

                  <svg className="w-4 h-4 text-nuvio-muted group-hover:text-nuvio-text
                                  transition-colors flex-shrink-0"
                       fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                          strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
