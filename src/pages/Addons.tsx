import { useState } from 'react';
import { useAppStore } from '../lib/store';
import { installAddon, normalizeAddonUrl } from '../lib/addon-client';
import { Addon } from '../lib/types';
import {
  Plus, Trash2, ChevronUp, ChevronDown,
  Loader2, Package, AlertCircle, CheckCircle2, ExternalLink, Link,
} from 'lucide-react';
import clsx from 'clsx';

const POPULAR_ADDONS = [
  {
    name: 'Cinemeta',
    url: 'https://v3-cinemeta.strem.io',
    desc: 'Metadata ufficiali Stremio (film & serie)',
  },
  {
    name: 'Torrentio',
    url: 'https://torrentio.strem.fun',
    desc: 'Stream torrent da molteplici provider',
  },
  {
    name: 'OpenSubtitles',
    url: 'https://opensubtitles-v3.strem.io',
    desc: 'Sottotitoli da OpenSubtitles',
  },
];

function AddonCard({
  addon, onRemove, onUp, onDown, isFirst, isLast,
}: {
  addon: Addon; onRemove: () => void;
  onUp: () => void; onDown: () => void;
  isFirst: boolean; isLast: boolean;
}) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {addon.logo
          ? <img src={addon.logo} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          : <Package size={18} className="text-violet-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white">{addon.name}</p>
          <span className="text-xs text-white/30">v{addon.version}</span>
        </div>
        <p className="text-xs text-white/40 mt-0.5 truncate">{addon.description || addon.url}</p>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {addon.types.map((t) => (
            <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-violet-600/20 text-violet-300 border border-violet-500/30">
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <button onClick={onUp} disabled={isFirst}
          className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
          <ChevronUp size={14} />
        </button>
        <button onClick={onDown} disabled={isLast}
          className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
          <ChevronDown size={14} />
        </button>
        <button onClick={onRemove}
          className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors mt-1">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Addons() {
  const { addons, addAddon, removeAddon, reorderAddon } = useAppStore();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  // Mostra preview dell'URL normalizzato mentre si digita
  const normalizedPreview = url.trim() ? normalizeAddonUrl(url.trim()) : '';
  const showPreview = url.trim() && normalizedPreview !== url.trim();

  async function handleInstall(targetUrl?: string) {
    const installUrl = targetUrl ?? url.trim();
    if (!installUrl) return;
    setLoading(true);
    setFeedback(null);
    try {
      const addon = await installAddon(installUrl);
      addAddon(addon);
      setFeedback({ type: 'ok', msg: `"${addon.name}" installato con successo!` });
      if (!targetUrl) setUrl('');
    } catch (e: any) {
      setFeedback({
        type: 'err',
        msg: e.toString().includes('fetch') || e.toString().includes('network')
          ? 'Impossibile raggiungere l\'addon. Verifica l\'URL.'
          : `Errore: ${e.message ?? e}`,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-6 py-6 overflow-y-auto h-full space-y-8">

      {/* Aggiungi addon */}
      <section>
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">
          Aggiungi Addon
        </h2>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInstall()}
              placeholder="https://… oppure stremio://…"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-violet-500 focus:outline-none text-sm text-white placeholder:text-white/30 transition-colors"
            />
            {showPreview && (
              <div className="flex items-center gap-1.5 mt-1.5 px-1">
                <Link size={11} className="text-violet-400/70" />
                <p className="text-xs text-violet-400/70 truncate">{normalizedPreview}</p>
              </div>
            )}
          </div>
          <button
            onClick={() => handleInstall()}
            disabled={loading || !url.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors flex-shrink-0"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Installa
          </button>
        </div>

        {feedback && (
          <div className={clsx(
            'flex items-center gap-2 mt-3 px-4 py-2.5 rounded-lg text-sm border',
            feedback.type === 'ok'
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          )}>
            {feedback.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {feedback.msg}
          </div>
        )}
      </section>

      {/* Popolari */}
      <section>
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
          Addon popolari
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {POPULAR_ADDONS.map((p) => {
            const installed = addons.some((a) => a.url === p.url);
            return (
              <div key={p.url} className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-2">
                <p className="text-sm font-semibold text-white">{p.name}</p>
                <p className="text-xs text-white/40 flex-1">{p.desc}</p>
                <div className="flex items-center gap-2 mt-1">
                  {installed ? (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Installato
                    </span>
                  ) : (
                    <button
                      onClick={() => handleInstall(p.url)}
                      disabled={loading}
                      className="text-xs px-3 py-1.5 bg-violet-600/80 hover:bg-violet-600 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      Installa
                    </button>
                  )}
                  <a href={p.url} target="_blank" rel="noopener noreferrer"
                    className="text-white/30 hover:text-white/60 transition-colors ml-auto">
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Installati */}
      <section>
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
          Installati ({addons.length})
        </h2>
        {addons.length === 0 ? (
          <div className="py-12 text-center text-white/30 text-sm border border-dashed border-white/10 rounded-xl">
            Nessun addon installato
          </div>
        ) : (
          <div className="space-y-2">
            {addons.map((addon, i) => (
              <AddonCard
                key={addon.id}
                addon={addon}
                isFirst={i === 0}
                isLast={i === addons.length - 1}
                onRemove={() => removeAddon(addon.id)}
                onUp={() => reorderAddon(addon.id, 'up')}
                onDown={() => reorderAddon(addon.id, 'down')}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
