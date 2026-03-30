import React from 'react';
/// <reference types="vite/client" />
import { useState, useRef, useEffect } from 'react';
import { useStore } from '../lib/store';
import { openExternal } from '../api/stremio';
import { validateTMDBKey, STREAMING_SERVICES } from '../api/tmdb';
import { nuvioLogin, nuvioLogout, setAuthToken, getNuvioAddons, getContinueWatching, getAllWatchedItems, getAccountStats, getAvatarCatalog, type AccountStats, type SupabaseAvatar } from '../api/nuvio';
import { getTraktDeviceCode, pollTraktToken, getTraktProfile } from '../api/trakt';
import { getSimklPin, pollSimklToken, getSimklProfile } from '../api/simkl';
// avatar imports removed - use avatarUrl directly
import {
  User, Users, Palette, Grid, Link2, Play, Info, ChevronRight, ChevronDown, ChevronUp,
  LogIn, LogOut, RefreshCw, ExternalLink, Save, Trash2, Key, AlertCircle,
  CheckCircle2, Shield, BookOpen, Tv, Film, Globe, Lock, Eye, EyeOff, X, Star,
  Download, Package,
} from 'lucide-react';
import clsx from 'clsx';

const ic = 'w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/[0.08] focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-sm text-white placeholder:text-white/30 transition-colors';

// ─── Componenti base ──────────────────────────────────────────────────────────

function AvatarImg({ url, label, size = 40 }: { url?: string; label?: string; size?: number }) {
  const [err, setErr] = React.useState(false);
  if (!url || err) {
    return <div className="w-full h-full flex items-center justify-center font-bold text-white rounded-full text-lg" style={{ background: 'var(--accent,#7c3aed)' }}>{(label ?? 'U').charAt(0)}</div>;
  }
  return <img src={url} alt={label ?? ''} className="w-full h-full object-cover" onError={() => setErr(true)} loading="lazy" />;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={clsx('relative w-12 h-6 rounded-full transition-colors flex-shrink-0', value ? 'bg-[color:var(--accent,#7c3aed)]' : 'bg-white/20')}>
      <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', value ? 'translate-x-6' : '')} />
    </button>
  );
}

function Accordion({ title, subtitle, defaultOpen = false, children }: {
  title: string; subtitle?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors text-left">
        <div>
          <p className="text-base font-semibold text-white">{title}</p>
          {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/30">{open ? 'Aperto' : 'Chiuso'}</span>
          {open ? <ChevronUp size={16} className="text-white/30" /> : <ChevronDown size={16} className="text-white/30" />}
        </div>
      </button>
      {open && <div className="px-5 pb-5 space-y-3 border-t border-white/[0.04] pt-4">{children}</div>}
    </div>
  );
}

function Row({ title, subtitle, children, danger }: {
  title: string; subtitle?: string; children?: React.ReactNode; danger?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] flex items-center justify-between px-5 py-4">
      <div className="flex-1 min-w-0 mr-4">
        <p className={clsx('text-base font-semibold', danger ? 'text-red-400' : 'text-white')}>{title}</p>
        {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function NavRow({ icon, title, subtitle, onClick, badge }: {
  icon: React.ReactNode; title: string; subtitle?: string; onClick: () => void; badge?: string;
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-[#1e1e24] border border-white/[0.06] hover:bg-white/[0.04] transition-colors text-left">
      <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0 text-white/60">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white">{title}</p>
          {badge && <span className="text-xs px-2 py-0.5 rounded-full bg-[color:var(--accent-bg)] text-[color:var(--accent)] border border-[color:var(--accent-border)]">{badge}</span>}
        </div>
        {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
      </div>
      <ChevronRight size={16} className="text-white/20 flex-shrink-0" />
    </button>
  );
}

// ─── Sub-pages ────────────────────────────────────────────────────────────────

function AccountPage() {
  const { nuvioUser, setNuvioUser, addons, setAddons } = useStore();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [syncMsg, setSyncMsg] = useState<string|null>(null);
  const [stats, setStats] = useState<AccountStats | null>(null);

  useEffect(() => {
    if (nuvioUser?.id) {
      getAccountStats(nuvioUser.id).then(setStats).catch(() => {});
    }
  }, [nuvioUser?.id]);

  async function login() {
    if (!email || !pw) return;
    setLoading(true); setError(null);
    try {
      const u = await nuvioLogin(email, pw);
      setAuthToken(u.token);
      setNuvioUser(u);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function syncAll() {
    if (!nuvioUser) return;
    setSyncing(true); setSyncMsg(null);
    try {
      const cloudAddons = await getNuvioAddons(nuvioUser.id);
      if (cloudAddons.length > 0) {
        const currentIds = new Set(addons.map((a: any) => a.id));
        const newAddons = cloudAddons.filter((a: any) => !currentIds.has(a.id));
        if (newAddons.length > 0) setAddons([...addons, ...newAddons]);
      }
      const s = await getAccountStats(nuvioUser.id);
      setStats(s);
      setSyncMsg('✓ Sync completato');
      setTimeout(() => setSyncMsg(null), 3000);
    } catch (e: any) { setSyncMsg(`Errore: ${e.message}`); }
    finally { setSyncing(false); }
  }

  if (nuvioUser) return (
    <div className="space-y-4">
      {/* Header account */}
      <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] overflow-hidden">
        <div className="p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-[color:var(--accent)] flex items-center justify-center flex-shrink-0">
            {nuvioUser.avatar
              ? <img src={nuvioUser.avatar} className="w-full h-full object-cover" alt={nuvioUser.name} />
              : <User size={28} className="text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold text-white">{nuvioUser.name}</p>
            <p className="text-xs text-white/40 mt-0.5">{nuvioUser.email}</p>
            <p className="text-xs text-white/25 mt-0.5 font-mono">{nuvioUser.id?.slice(0,8)}…</p>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 border-t border-white/[0.06]">
            {[
              { label: 'Film visti', value: stats.totalMovies, icon: '🎬' },
              { label: 'Episodi', value: stats.totalEpisodes, icon: '📺' },
              { label: 'In libreria', value: stats.librarySize, icon: '📚' },
              { label: 'Ore viste', value: stats.watchTimeHours, icon: '⏱️' },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center py-4 border-r border-white/[0.06] last:border-r-0">
                <span className="text-lg">{s.icon}</span>
                <span className="text-xl font-bold text-white mt-1">{s.value}</span>
                <span className="text-xs text-white/35 mt-0.5">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 p-4 border-t border-white/[0.06]">
          <button onClick={syncAll} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-xl disabled:opacity-50 flex-1 justify-center" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
            {syncing ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            Sincronizza da cloud
          </button>
          <button onClick={() => { nuvioLogout(); setAuthToken(null); setNuvioUser(null); }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 bg-red-500/10 rounded-xl">
            <LogOut size={14} />Esci
          </button>
        </div>
        {syncMsg && <p className="text-xs text-green-400 px-5 pb-3">{syncMsg}</p>}
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-5 space-y-3">
      <p className="text-base font-semibold text-white">Accedi a Nuvio</p>
      <p className="text-xs text-white/40">Sincronizza CW, libreria e addon con il tuo account Nuvio.</p>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className={ic} />
      <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} placeholder="Password" className={ic} />
      {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
      <button onClick={login} disabled={loading || !email || !pw}
        className="w-full flex items-center gap-2 justify-center py-3 text-white rounded-2xl text-sm font-medium disabled:opacity-50"
        style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
        {loading ? <RefreshCw size={15} className="animate-spin" /> : <LogIn size={15} />}Accedi
      </button>
    </div>
  );
}

function ProfilesPage() {
  const { profiles, updateProfile, removeProfile, addProfile, activeProfileId } = useStore();
  const [editId, setEditId] = useState<string|null>(null);
  
  const ep = profiles.find(p => p.id === editId);

  return (
    <div className="space-y-3">
      {!editId ? (
        <>
          {profiles.map(p => (
            <button key={p.id} onClick={() => setEditId(p.id)}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-[#1e1e24] border border-white/[0.06] hover:border-white/20 text-left transition-colors">
              <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0"><AvatarImg url={p.avatarUrl} label={p.name} size={48} /></div>
              <div className="flex-1">
                <p className="font-semibold text-white">{p.name}</p>
                <p className="text-xs text-white/40">{p.isKids ? '🧸 Bambini' : 'Adulti'}{p.pin ? ' · 🔒 PIN' : ''}{p.id === activeProfileId ? ' · Attivo' : ''}</p>
              </div>
              <ChevronRight size={16} className="text-white/20" />
            </button>
          ))}
          {profiles.length < 5 && (
            <button onClick={() => addProfile({ name: `Profilo ${profiles.length + 1}`, avatar: 'default', color: '#7c3aed', isKids: false })}
              className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl border-2 border-dashed border-white/10 hover:border-white/25 transition-colors text-white/40 hover:text-white/60 text-sm">
              + Aggiungi profilo
            </button>
          )}
        </>
      ) : ep ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
            <button onClick={() => setEditId(null)} className="p-1.5 rounded-xl hover:bg-white/10 text-white/40 hover:text-white"><X size={18} /></button>
            <h3 className="text-lg font-bold text-white flex-1">{ep.name}</h3>
            <button onClick={() => setEditId(null)} className="px-5 py-2 bg-white text-black rounded-full text-sm font-semibold">Salva</button>
          </div>
          <div className="flex gap-5">
            <div className="flex flex-col items-center gap-2 w-32 flex-shrink-0">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[color:var(--accent,#7c3aed)]"><AvatarImg url={ep.avatarUrl} label={ep.name} size={96} /></div>
              <input defaultValue={ep.name} onBlur={e => updateProfile(ep.id, { name: e.target.value })}
                className={ic + ' text-center text-xs py-2'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Avatar</p>
              <div className="bg-white/5 rounded-xl px-4 py-3 text-xs text-white/40">
                Modifica l'avatar dalla schermata principale Profili.
              </div>
            </div>
          </div>
          <Row title="Profilo bambini" subtitle="Filtra contenuti per adulti">
            <Toggle value={ep.isKids} onChange={v => updateProfile(ep.id, { isKids: v })} />
          </Row>
          {ep.id !== 'default' && ep.id !== activeProfileId && (
            <button onClick={() => { if (confirm(`Eliminare il profilo "${ep.name}"?`)) { removeProfile(ep.id); setEditId(null); } }}
              className="w-full py-3 rounded-2xl text-red-400 bg-red-500/10 border border-red-500/20 text-sm font-medium hover:bg-red-500/15 transition-colors">
              🗑️ Elimina profilo definitivamente
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function AspettoPage() {
  const { settings, updateSettings } = useStore();
  const colors = ['#7c3aed','#2563eb','#16a34a','#dc2626','#d97706','#0891b2','#be185d','#ea580c','#0d9488','#4f46e5','#db2777','#0284c7'];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-5 space-y-4">
        <p className="text-base font-semibold text-white">Colore accent</p>
        <div className="flex gap-3 flex-wrap">
          {colors.map(col => (
            <button key={col} onClick={() => updateSettings({ accentColor: col })}
              className={clsx('w-10 h-10 rounded-full transition-all hover:scale-110',
                settings.accentColor === col ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1e1e24] scale-110' : '')}
              style={{ backgroundColor: col }} />
          ))}
          <input type="color" value={settings.accentColor ?? '#7c3aed'}
            onChange={e => updateSettings({ accentColor: e.target.value })}
            className="w-10 h-10 rounded-full cursor-pointer border-0 bg-transparent p-0" />
        </div>
        <p className="text-xs text-white/30">Il colore viene applicato immediatamente.</p>
      </div>
    </div>
  );
}

function LayoutPage() {
  const { settings, updateSettings } = useStore();
  const s = settings as any;
  const T = ({ k, title, desc }: { k: string; title: string; desc: string }) => (
    <Row title={title} subtitle={desc}>
      <Toggle value={!!s[k]} onChange={v => updateSettings({ [k]: v } as any)} />
    </Row>
  );
  return (
    <div className="space-y-3">
      <Accordion title="Layout Home" subtitle="Struttura della home" defaultOpen>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { id: 'classic', label: 'Classica', desc: 'Righe orizzontali' },
            { id: 'modern',  label: 'Moderna',  desc: 'Hero + riga attiva' },
            { id: 'grid',    label: 'Griglia',   desc: 'Grid verticale' },
          ].map(l => (
            <button key={l.id} onClick={() => updateSettings({ homeLayout: l.id } as any)}
              className={clsx('p-3 rounded-2xl border-2 text-left transition-all',
                s.homeLayout === l.id ? 'border-white bg-white/5' : 'border-white/10 hover:border-white/25')}>
              <p className="text-xs font-semibold text-white">{l.label}</p>
              <p className="text-xs text-white/40 mt-0.5">{l.desc}</p>
            </button>
          ))}
        </div>
      </Accordion>
      <T k="showHero"              title="Mostra sezione Hero"         desc="Visualizza il carosello hero nella parte superiore" />
      <T k="horizontalPosters"     title="Locandine Orizzontali"       desc="Passa tra schede verticali e orizzontali" />
      <T k="showCatalogType"       title="Mostra tipo di catalogo"     desc="Mostra il suffisso Film/Serie accanto al catalogo" />
      <T k="hideUnavailable"       title="Nascondi contenuti non disponibili" desc="Nascondi film e serie non ancora pubblici" />
      <T k="reduceSidebar"         title="Riduci barra laterale"       desc="Comprimi la sidebar di default" />
      <Accordion title="Pagina Dettagli" subtitle="Impostazioni per la pagina dei dettagli">
        <T k="blurUnwatched"       title="Sfoca episodi non visti"     desc="Sfoca le miniature per evitare spoiler" />
        <T k="showTrailerBtn"      title="Mostra pulsante Trailer"     desc="Mostra il pulsante trailer nella pagina dettagli" />
        <T k="preferExternalMeta"  title="Preferisci meta da addon esterni" desc="Usa i metadati degli addon invece di quelli del catalogo" />
      </Accordion>
    </div>
  );
}

function IntegrazioniPage() {
  const { settings, updateSettings } = useStore();
  const [tmdbStatus, setTmdbStatus] = useState<'idle'|'testing'|'ok'|'err'>('idle');
  const [showKey, setShowKey] = useState(false);
  const [mdbKey, setMdbKey] = useState((settings as any).mdblistKey ?? '');
  const [mdbSaved, setMdbSaved] = useState(false);
  const s = settings as any;

  async function testTMDB() {
    if (!settings.tmdbApiKey?.trim()) return;
    setTmdbStatus('testing');
    const { validateTMDBKey } = await import('../api/tmdb');
    const ok = await validateTMDBKey(settings.tmdbApiKey.trim());
    setTmdbStatus(ok ? 'ok' : 'err');
  }

  return (
    <div className="space-y-3">
      <Accordion title="TMDB" subtitle="Controlli per l'arricchimento dei metadati" defaultOpen>
        <p className="text-xs text-white/40">API Key v3 da <button onClick={() => openExternal('https://www.themoviedb.org/settings/api')} className="underline" style={{ color: 'var(--accent)' }}>themoviedb.org/settings/api</button></p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input type={showKey ? 'text' : 'password'} value={settings.tmdbApiKey ?? ''}
              onChange={e => updateSettings({ tmdbApiKey: e.target.value })}
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" className={ic + ' pr-10 font-mono'} />
            <button onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button onClick={testTMDB} disabled={!settings.tmdbApiKey || tmdbStatus === 'testing'}
            className="px-4 py-3 bg-white/8 hover:bg-white/12 rounded-2xl text-sm text-white disabled:opacity-50 border border-white/[0.08] flex items-center gap-1.5">
            {tmdbStatus === 'testing' ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
            {tmdbStatus === 'testing' ? '...' : 'Verifica'}
          </button>
        </div>
        {tmdbStatus === 'ok' && <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 size={12} />Valida</p>}
        {tmdbStatus === 'err' && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12} />Non valida</p>}
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Lingua</label>
          <select value={settings.tmdbLanguage ?? 'it-IT'} onChange={e => updateSettings({ tmdbLanguage: e.target.value })}
            className={ic + ' cursor-pointer'}>
            <option value="it-IT">Italiano</option>
            <option value="en-US">English</option>
            <option value="es-ES">Español</option>
            <option value="de-DE">Deutsch</option>
          </select>
        </div>
      </Accordion>

      <Accordion title="Valutazioni MDBList" subtitle="Provider esterni per le valutazioni">
        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-xs text-white/40 mb-2">
          <button onClick={() => openExternal('https://mdblist.com/preferences/api')} className="underline" style={{ color: 'var(--accent)' }}>Ottieni chiave API da mdblist.com</button>
        </div>
        <Row title="Abilita valutazioni MDBList" subtitle="Recupera valutazioni da provider esterni">
          <Toggle value={!!s.mdblistEnabled} onChange={v => updateSettings({ mdblistEnabled: v } as any)} />
        </Row>
        <div className="flex gap-2">
          <input value={mdbKey} onChange={e => setMdbKey(e.target.value)}
            placeholder="API Key MDBList" className={ic + ' font-mono flex-1'} />
          <button onClick={() => { updateSettings({ mdblistKey: mdbKey } as any); setMdbSaved(true); setTimeout(() => setMdbSaved(false), 2000); }}
            className="px-4 py-3 rounded-2xl text-sm text-white" style={{ backgroundColor: 'var(--accent)' }}>
            {mdbSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
          </button>
        </div>
      </Accordion>

      <Accordion title="Anime Skip" subtitle="Salta inizio/fine Anime (introdb.app)">
        <Row title="Abilita Anime Skip" subtitle="Usa introdb.app per rilevare intro e riassunti">
          <Toggle value={!!s.animeSkip} onChange={v => updateSettings({ animeSkip: v } as any)} />
        </Row>
        <Row title="Salta automaticamente" subtitle="Salta senza chiedere conferma">
          <Toggle value={!!s.animeSkipAuto} onChange={v => updateSettings({ animeSkipAuto: v } as any)} />
        </Row>
      </Accordion>
    </div>
  );
}

function RiproducibilePage() {
  const { settings, updateSettings } = useStore();
  const s = settings as any;
  const T = ({ k, title, desc }: { k: string; title: string; desc: string }) => (
    <Row title={title} subtitle={desc}>
      <Toggle value={!!s[k]} onChange={v => updateSettings({ [k]: v } as any)} />
    </Row>
  );
  return (
    <div className="space-y-3">
      <Accordion title="Generale" subtitle="Comportamento principale" defaultOpen>
        <T k="autoplay"            title="Riproduci automaticamente il prossimo episodio" desc="Avvia automaticamente il prossimo episodio" />
        <T k="skipIntro"           title="Salta intro" desc="Usa introdb.app per rilevare intro e riassunti" />
        <T k="hardwareDecode"      title="Decodifica hardware" desc="Usa GPU per decodificare video (consigliato)" />
      </Accordion>
      <Accordion title="Streaming & Qualità" subtitle="Qualità e filtraggio sorgenti">
        <Row title="Qualità preferita" subtitle="Scegli la qualità predefinita">
          <select value={s.preferredQuality ?? 'auto'}
            onChange={e => updateSettings({ preferredQuality: e.target.value } as any)}
            className="bg-white/10 text-white text-sm px-3 py-1.5 rounded-xl border border-white/10 focus:outline-none cursor-pointer">
            <option value="auto">Auto</option>
            <option value="4k">4K / 2160p</option>
            <option value="1080">1080p</option>
            <option value="720">720p</option>
            <option value="480">480p</option>
          </select>
        </Row>
        <Row title="Ordine stream default" subtitle="Come ordinare gli stream nella lista">
          <select value={s.streamSort ?? 'default'}
            onChange={e => updateSettings({ streamSort: e.target.value } as any)}
            className="bg-white/10 text-white text-sm px-3 py-1.5 rounded-xl border border-white/10 focus:outline-none cursor-pointer">
            <option value="default">Default</option>
            <option value="quality">Qualità</option>
            <option value="size">Dimensione</option>
          </select>
        </Row>
      </Accordion>
      <Accordion title="Audio & Trailer" subtitle="Comportamento dei trailer e controlli audio">
        <T k="autoplayTrailer"     title="Riproduzione automatica trailer" desc="Riproduci i trailer nella pagina dettagli" />
        <Row title="Lingua audio preferita" subtitle="Scegli la lingua audio predefinita">
          <select value={s.audioLanguage ?? 'system'}
            onChange={e => updateSettings({ audioLanguage: e.target.value } as any)}
            className="bg-white/10 text-white text-sm px-3 py-1.5 rounded-xl border border-white/10 focus:outline-none cursor-pointer">
            <option value="system">Sistema</option>
            <option value="it">Italiano</option>
            <option value="en">English</option>
          </select>
        </Row>
      </Accordion>
      <Accordion title="Sottotitoli" subtitle="Lingua, stile e modalità di rendering">
        <T k="subtitlesEnabled"    title="Abilita sottotitoli" desc="Attiva i sottotitoli di default" />
        <Row title="Lingua preferita" subtitle="Lingua preferita dei sottotitoli">
          <select value={s.subtitleLanguage ?? 'off'}
            onChange={e => updateSettings({ subtitleLanguage: e.target.value } as any)}
            className="bg-white/10 text-white text-sm px-3 py-1.5 rounded-xl border border-white/10 focus:outline-none cursor-pointer">
            <option value="off">Off</option>
            <option value="it">Italiano</option>
            <option value="en">English</option>
          </select>
        </Row>
      </Accordion>
      <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-5 space-y-3">
        <p className="text-sm font-semibold text-white">Player esterno (opzionale)</p>
        <p className="text-xs text-white/40">Lascia vuoto per usare il player interno.</p>
        <input value={s.customPlayerPath ?? ''} onChange={e => updateSettings({ customPlayerPath: e.target.value } as any)}
          placeholder="C:\Program Files\VLC\vlc.exe" className={ic + ' font-mono'} />
      </div>
    </div>
  );
}

function TraktPage() {
  const { traktAuth, setTraktAuth, simklAuth, setSimklAuth, malAuth, setMALAuth } = useStore();
  const [code, setCode] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<number|null>(null);

  async function startTrakt() {
    setLoading(true);
    try {
      const d = await getTraktDeviceCode(); setCode(d);
      const poll = async () => {
        const r = await pollTraktToken(d.device_code);
        if (r) { const p = await getTraktProfile(r.access_token); setTraktAuth({ ...p, token: r.access_token, refreshToken: r.refresh_token, expiresAt: Date.now() + r.expires_in * 1000 }); setCode(null); }
        else pollRef.current = window.setTimeout(poll, d.interval * 1000);
      };
      pollRef.current = window.setTimeout(poll, d.interval * 1000);
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      {/* Trakt */}
      {traktAuth ? (
        <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {traktAuth.avatar ? <img src={traktAuth.avatar} className="w-12 h-12 rounded-full" /> : <div className="w-12 h-12 rounded-full bg-[#ed1c24] flex items-center justify-center text-white font-bold">T</div>}
            <div><p className="font-semibold text-white">{traktAuth.name}</p><p className="text-xs text-white/40">@{traktAuth.username} · Trakt.tv</p></div>
          </div>
          <button onClick={() => setTraktAuth(null)} className="px-4 py-2 text-sm text-red-400 bg-red-500/10 rounded-xl flex items-center gap-1.5"><LogOut size={14} />Esci</button>
        </div>
      ) : code ? (
        <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-6 space-y-4 text-center">
          <p className="text-sm text-white/70">Apri <button onClick={() => openExternal(code.verification_url)} className="underline" style={{ color: 'var(--accent)' }}>{code.verification_url}</button></p>
          <div className="text-3xl font-mono font-bold tracking-widest py-4 rounded-2xl" style={{ color: 'var(--accent)', backgroundColor: 'var(--accent-bg)' }}>{code.user_code}</div>
          <div className="flex items-center justify-center gap-2 text-xs text-white/40"><RefreshCw size={12} className="animate-spin" />In attesa...</div>
        </div>
      ) : (
        <button onClick={startTrakt} disabled={loading} className="w-full flex items-center gap-2 justify-center py-3 bg-[#ed1c24] hover:bg-[#c91920] text-white rounded-2xl font-medium">
          {loading ? <RefreshCw size={15} className="animate-spin" /> : <Tv size={15} />}Collega Trakt.tv
        </button>
      )}

      {/* Simkl inline */}
      {simklAuth ? (
        <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {simklAuth.avatar ? <img src={simklAuth.avatar} className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 rounded-full bg-[#0b65c2] flex items-center justify-center text-white font-bold">S</div>}
            <div><p className="text-sm font-semibold text-white">{simklAuth.name}</p><p className="text-xs text-white/40">Simkl</p></div>
          </div>
          <button onClick={() => setSimklAuth(null)} className="px-3 py-1.5 text-xs text-red-400 bg-red-500/10 rounded-xl"><LogOut size={13} /></button>
        </div>
      ) : (
        <SimklConnect />
      )}

      {/* MAL inline */}
      {malAuth ? (
        <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {malAuth.picture ? <img src={malAuth.picture} className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 rounded-full bg-[#2e51a2] flex items-center justify-center text-white font-bold">M</div>}
            <div><p className="text-sm font-semibold text-white">{malAuth.name}</p><p className="text-xs text-white/40">MyAnimeList</p></div>
          </div>
          <button onClick={() => setMALAuth(null)} className="px-3 py-1.5 text-xs text-red-400 bg-red-500/10 rounded-xl"><LogOut size={13} /></button>
        </div>
      ) : (
        <MALConnect />
      )}
    </div>
  );
}

function SimklConnect() {
  const { setSimklAuth } = useStore();
  const [pin, setPin] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<number|null>(null);

  async function start() {
    setLoading(true);
    try {
      const d = await getSimklPin(); setPin(d);
      const poll = async () => {
        const t = await pollSimklToken(d.user_code);
        if (t) { const p = await getSimklProfile(t); setSimklAuth(p); setPin(null); }
        else pollRef.current = window.setTimeout(poll, d.interval * 1000);
      };
      pollRef.current = window.setTimeout(poll, d.interval * 1000);
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  }

  if (pin) return (
    <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-4 space-y-3 text-center">
      <p className="text-sm text-white/70">Apri <button onClick={() => openExternal('https://simkl.com/pin')} className="text-blue-400 underline">simkl.com/pin</button> e inserisci:</p>
      <div className="text-2xl font-mono font-bold text-blue-400 tracking-widest bg-blue-500/10 py-3 rounded-xl">{pin.user_code}</div>
      <div className="flex items-center justify-center gap-2 text-xs text-white/40"><RefreshCw size={12} className="animate-spin" />In attesa...</div>
    </div>
  );
  return (
    <button onClick={start} disabled={loading} className="w-full flex items-center gap-2 justify-center py-3 bg-[#0b65c2] hover:bg-[#0952a0] text-white rounded-2xl text-sm font-medium">
      {loading ? <RefreshCw size={14} className="animate-spin" /> : <Film size={14} />}Collega Simkl
    </button>
  );
}

function MALConnect() {
  const { setMALAuth } = useStore();
  const [step, setStep] = useState<'idle'|'waiting'>('idle');
  const [code, setCode] = useState('');
  const [cv, setCv] = useState('');

  async function start() {
    const { getMALAuthUrl } = await import('../api/mal');
    const { url, codeVerifier } = getMALAuthUrl();
    setCv(codeVerifier); setStep('waiting'); openExternal(url);
  }

  async function exchange() {
    try {
      const { exchangeMALCode, getMALProfile } = await import('../api/mal');
      const t = await exchangeMALCode(code.trim(), cv);
      const p = await getMALProfile(t.access_token);
      setMALAuth({ ...p, token: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000 });
      setStep('idle');
    } catch (e: any) { alert(e.message); }
  }

  if (step === 'waiting') return (
    <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-4 space-y-2">
      <p className="text-xs text-white/40">Autorizza su MAL, poi incolla il codice dall'URL di redirect:</p>
      <div className="flex gap-2">
        <input value={code} onChange={e => setCode(e.target.value)} placeholder="Codice dall'URL" className={ic + ' flex-1'} />
        <button onClick={exchange} disabled={!code.trim()} className="px-4 py-2.5 bg-[#2e51a2] text-white rounded-2xl text-sm disabled:opacity-50">OK</button>
      </div>
      <button onClick={() => setStep('idle')} className="text-xs text-white/30 hover:text-white">Annulla</button>
    </div>
  );
  return (
    <button onClick={start} className="w-full flex items-center gap-2 justify-center py-3 bg-[#2e51a2] hover:bg-[#264490] text-white rounded-2xl text-sm font-medium">
      <BookOpen size={14} />Collega MyAnimeList
    </button>
  );
}

// ─── Settings principale ──────────────────────────────────────────────────────

type SubPage = null | 'account' | 'profiles' | 'aspetto' | 'layout' | 'integrazioni' | 'riproduzione' | 'trakt';

const MENU: { id: SubPage; icon: React.ReactNode; label: string; desc?: string }[] = [
  { id: 'account',       icon: <User size={18} />,  label: 'Account',        desc: '' },
  { id: 'profiles',      icon: <Users size={18} />, label: 'Profili',        desc: '' },
  { id: 'aspetto',       icon: <Palette size={18}/>, label: 'Aspetto',       desc: '' },
  { id: 'layout',        icon: <Grid size={18} />,  label: 'Layout',         desc: '' },
  { id: 'integrazioni',  icon: <Link2 size={18} />, label: 'Integrazioni',   desc: '' },
  { id: 'riproduzione',  icon: <Play size={18} />,  label: 'Riproduzione',   desc: '' },
  { id: 'trakt',         icon: <Star size={18} />,  label: 'Trakt',          desc: '' },
  { id: null,            icon: <Info size={18} />,  label: 'Informazioni',   desc: '' },
];

export default function Settings() {
  const { clearHistory } = useStore();
  const [sub, setSub] = useState<SubPage>(null);
  const activeProfile = (() => { const { profiles, activeProfileId } = useStore(); return profiles.find(p => p.id === activeProfileId) ?? profiles[0]; })();

  function handleMenu(id: SubPage, label: string) {
    if (label === 'Informazioni') { openExternal('https://github.com/Davako94/nuvio-desktop'); return; }
    setSub(id);
  }

  const TITLES: Record<string, string> = {
    account: 'Account', profiles: 'Profili', aspetto: 'Aspetto', layout: 'Layout',
    integrazioni: 'Integrazioni', riproduzione: 'Riproduzione', trakt: 'Trakt'
  };
  const SUBTITLES: Record<string, string> = {
    account: 'Gestisci il tuo account Nuvio e il sync.',
    profiles: 'Crea e modifica i profili utente.',
    aspetto: 'Personalizza colori e tema.',
    layout: 'Struttura della home e stili delle locandine.',
    integrazioni: 'Scegli le impostazioni TMDB o MDBList.',
    riproduzione: 'Player, sottotitoli e riproduzione automatica.',
    trakt: 'Collega Trakt, Simkl e MyAnimeList.',
  };

  return (
    <div className="flex h-full overflow-hidden bg-[#0f0f13]">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 overflow-y-auto px-4 py-6 space-y-1.5 border-r border-white/[0.05]">
        {MENU.map(item => (
          <button key={item.label} onClick={() => handleMenu(item.id, item.label)}
            className={clsx('w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-left transition-all border',
              sub === item.id && item.id !== null
                ? 'bg-[#1e1e24] border-white/10 text-white'
                : 'bg-transparent border-transparent text-white/60 hover:text-white hover:bg-white/[0.04]')}>
            <span className={sub === item.id && item.id !== null ? 'text-white' : 'text-white/40'}>{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
            <ChevronRight size={14} className="ml-auto text-white/20" />
          </button>
        ))}
        <div className="pt-4 border-t border-white/[0.06] mt-4">
          <button onClick={() => { if (confirm('Cancellare la cronologia locale?')) clearHistory(); }}
            className="w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-left text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-all">
            <Trash2 size={18} className="text-red-400/50" />
            <span className="text-sm font-medium">Cancella cronologia</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {sub === null ? (
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Impostazioni</h1>
            <p className="text-sm text-white/40 mb-6">Seleziona una voce dal menu.</p>
            {activeProfile && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#1e1e24] border border-white/[0.06] w-fit">
                <div className="w-12 h-12 rounded-full overflow-hidden"><AvatarImg url={activeProfile.avatarUrl} label={activeProfile.name} size={48} /></div>
                <div><p className="font-semibold text-white">{activeProfile.name}</p><p className="text-xs text-white/40">Profilo attivo</p></div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-white">{TITLES[sub!]}</h1>
              <p className="text-sm text-white/40 mt-1">{SUBTITLES[sub!]}</p>
            </div>
            {sub === 'account'      && <AccountPage />}
            {sub === 'profiles'     && <ProfilesPage />}
            {sub === 'aspetto'      && <AspettoPage />}
            {sub === 'layout'       && <LayoutPage />}
            {sub === 'integrazioni' && <IntegrazioniPage />}
            {sub === 'riproduzione' && <RiproducibilePage />}
            {sub === 'trakt'        && <TraktPage />}
          </>
        )}
      </div>
    </div>
  );
}
