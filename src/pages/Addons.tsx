/// <reference types="vite/client" />
import { useState } from 'react';
import { useStore } from '../lib/store';
import { installAddon } from '../api/stremio';
import { Addon } from '../lib/types';
import { Plus, Trash2, ArrowUp, ArrowDown, ExternalLink, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const POPULAR = [
  { name: 'Cinemeta', url: 'https://v3-cinemeta.strem.io', desc: 'Metadata ufficiali Stremio (film & serie)' },
  { name: 'Torrentio', url: 'https://torrentio.strem.fun', desc: 'Stream torrent da molteplici provider' },
  { name: 'OpenSubtitles', url: 'https://opensubtitles-v3.strem.io', desc: 'Sottotitoli da OpenSubtitles' },
];

export default function Addons() {
  const { addons, addAddon, removeAddon, reorderAddon } = useStore();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function install(rawUrl = url) {
    if (!rawUrl.trim()) return;
    setLoading(true); setError(null); setSuccess(null);
    try {
      const addon = await installAddon(rawUrl.trim());
      addAddon(addon);
      setUrl('');
      setSuccess(`✓ ${addon.name} installato con successo`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e.message ?? 'Impossibile installare l\'addon');
    } finally { setLoading(false); }
  }

  return (
    <div className="px-6 py-6 overflow-y-auto h-full">
      <h1 className="text-lg font-bold text-white mb-6">Addon</h1>

      {/* Installa */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Aggiungi Addon</h2>
        <div className="flex gap-2">
          <input value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && install()}
            placeholder="https://... oppure stremio://..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-sm text-white placeholder:text-white/30" />
          <button onClick={() => install()} disabled={!url.trim() || loading}
            className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-medium text-sm disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}Installa
          </button>
        </div>
        {error && <div className="mt-2 flex items-center gap-2 text-red-400 text-xs"><AlertCircle size={13} />{error}</div>}
        {success && <div className="mt-2 flex items-center gap-2 text-green-400 text-xs"><CheckCircle2 size={13} />{success}</div>}
      </section>

      {/* Popolari */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Addon Popolari</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {POPULAR.map(p => {
            const installed = addons.some(a => a.url.includes(p.url.replace('https://', '')));
            return (
              <div key={p.url} className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-semibold text-white">{p.name}</p>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white"><ExternalLink size={13} /></a>
                </div>
                <p className="text-xs text-white/50 mb-3">{p.desc}</p>
                <button onClick={() => !installed && install(p.url)} disabled={installed || loading}
                  className={clsx('w-full py-2 rounded-lg text-sm font-medium transition-colors',
                    installed ? 'bg-green-500/20 text-green-400 cursor-default' : 'text-white')}
                  style={installed ? {} : { backgroundColor: 'var(--accent,#7c3aed)' }}>
                  {installed ? '✓ Installato' : 'Installa'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Installati */}
      <section>
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Installati ({addons.length})</h2>
        {addons.length === 0
          ? <div className="text-center py-8 text-white/30 text-sm border border-dashed border-white/10 rounded-xl">Nessun addon installato</div>
          : (
            <div className="space-y-2">
              {addons.map((addon, i) => (
                <div key={addon.id} className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  {addon.logo && <img src={addon.logo} alt={addon.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{addon.name}</p>
                    <p className="text-xs text-white/40">{addon.version} · {addon.catalogs.length} cataloghi · {addon.types.join(', ')}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => reorderAddon(addon.id, 'up')} disabled={i === 0} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-20"><ArrowUp size={14} /></button>
                    <button onClick={() => reorderAddon(addon.id, 'down')} disabled={i === addons.length - 1} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-20"><ArrowDown size={14} /></button>
                    <button onClick={() => { if (confirm(`Rimuovere ${addon.name}?`)) removeAddon(addon.id); }} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </section>
    </div>
  );
}

function clsx(...args: any[]): string {
  return args.filter(Boolean).join(' ');
}
