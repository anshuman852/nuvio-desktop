import { useState } from "react";
import { useAddonStore } from "../store";

export default function Addons() {
  const { addons, addAddon, removeAddon, toggleAddon } = useAddonStore();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    try {
      await addAddon(url.trim());
      setUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore aggiunta addon");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 pb-24">
      <h1 className="text-nuvio-text font-bold text-xl mb-6">Addon</h1>

      {/* Add addon */}
      <div className="bg-nuvio-card border border-nuvio-border rounded-2xl p-4 mb-6">
        <h2 className="text-nuvio-text font-semibold text-sm mb-3">Installa addon</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="https://addon.example.com/manifest.json"
            className="flex-1 bg-nuvio-surface border border-nuvio-border rounded-xl
                       px-3 py-2 text-nuvio-text text-sm placeholder-nuvio-muted
                       focus:outline-none focus:border-nuvio-accent transition-colors"
          />
          <button
            onClick={handleAdd}
            disabled={loading || !url.trim()}
            className="px-4 py-2 bg-nuvio-accent hover:bg-nuvio-accent-hover disabled:opacity-50
                       text-white rounded-xl text-sm font-medium transition-colors whitespace-nowrap"
          >
            {loading ? "..." : "Aggiungi"}
          </button>
        </div>
        {error && <p className="mt-2 text-red-400 text-xs">{error}</p>}
      </div>

      {/* Addon list */}
      {addons.length === 0 ? (
        <div className="text-center py-12 text-nuvio-muted">
          <div className="text-4xl mb-3">🧩</div>
          <p className="text-sm">Nessun addon installato</p>
        </div>
      ) : (
        <div className="space-y-2">
          {addons.map((addon) => (
            <div
              key={addon.id}
              className="bg-nuvio-card border border-nuvio-border rounded-2xl
                         p-4 flex items-center gap-4"
            >
              {addon.logo ? (
                <img src={addon.logo} alt="" className="w-10 h-10 rounded-xl object-contain" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-nuvio-border flex items-center
                                justify-center text-nuvio-muted text-lg">
                  🧩
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-nuvio-text font-medium text-sm">{addon.name}</p>
                <p className="text-nuvio-muted text-xs truncate mt-0.5">
                  {addon.description ?? addon.transportUrl}
                </p>
                <p className="text-nuvio-muted text-xs mt-0.5">v{addon.version}</p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Toggle */}
                <button
                  onClick={() => toggleAddon(addon.id)}
                  className={`w-10 h-5 rounded-full transition-colors relative
                               ${addon.enabled ? "bg-nuvio-accent" : "bg-nuvio-border"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white
                                    transition-transform shadow-sm
                                    ${addon.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>

                {/* Remove */}
                <button
                  onClick={() => removeAddon(addon.id)}
                  className="w-7 h-7 rounded-full bg-nuvio-surface hover:bg-red-500/20
                             text-nuvio-muted hover:text-red-400 flex items-center
                             justify-center transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
