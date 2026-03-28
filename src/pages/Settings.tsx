/// <reference types="vite/client" />
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { launchPlayer, openExternal } from '../api/stremio';
import { validateTMDBKey, STREAMING_SERVICES } from '../api/tmdb';
import { nuvioLogin, nuvioLogout, setAuthToken } from '../api/nuvio';
import { getTraktDeviceCode, pollTraktToken, getTraktProfile } from '../api/trakt';
import { getSimklPin, pollSimklToken, getSimklProfile } from '../api/simkl';
import {
  ChevronRight, User, Users, Globe, Eye, Tv, Database, Palette,
  Play, Trash2, LogIn, LogOut, RefreshCw, ExternalLink,
  Key, CheckCircle2, AlertCircle, Shield, Info, Zap, Film,
  BookOpen, Save, X, Lock,
} from 'lucide-react';
import clsx from 'clsx';
import { getAvatar, AVATARS } from './ProfileSelect';

// ─── Section row (stile Nuvio) ────────────────────────────────────────────────

function SettingRow({ icon, title, subtitle, onClick, children, danger }: {
  icon: React.ReactNode; title: string; subtitle?: string;
  onClick?: () => void; children?: React.ReactNode; danger?: boolean;
}) {
  const isButton = Boolean(onClick) && !children;
  return (
    <div
      onClick={isButton ? onClick : undefined}
      className={clsx(
        'flex items-center gap-4 px-4 py-3.5 transition-colors',
        isButton ? 'cursor-pointer hover:bg-white/5' : '',
        danger ? 'hover:bg-red-500/5' : ''
      )}>
      <div className={clsx('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0',
        danger ? 'bg-red-500/15 text-red-400' : 'bg-white/8 text-white/60')}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={clsx('text-sm font-medium', danger ? 'text-red-400' : 'text-white')}>{title}</p>
        {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
      </div>
      {children ?? (isButton && <ChevronRight size={16} className="text-white/20 flex-shrink-0" />)}
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-white/30 uppercase tracking-widest px-4 mb-2">{title}</p>
      <div className="rounded-2xl bg-[#1a1a1f] border border-white/[0.06] overflow-hidden divide-y divide-white/[0.04]">
        {children}
      </div>
    </div>
  );
}

// ─── Sub-pages ────────────────────────────────────────────────────────────────

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4 border-b border-white/[0.06]">
      <button onClick={onBack} className="p-1.5 rounded-xl hover:bg-white/10 text-white/50 hover:text-white">
        <X size={18} />
      </button>
      <h2 className="text-base font-bold text-white">{title}</h2>
    </div>
  );
}

function ProfileSettingsPage({ onBack }: { onBack: () => void }) {
  const { profiles, activeProfileId, updateProfile, removeProfile, addProfile } = useStore();
  const [editId, setEditId] = useState<string | null>(null);
  const p = profiles.find(x => x.id === editId);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <BackHeader title="Profili" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {profiles.map(prof => {
            const av = getAvatar(prof.avatar);
            return (
              <button key={prof.id} onClick={() => setEditId(editId === prof.id ? null : prof.id)}
                className={clsx('flex flex-col items-center gap-2 p-3 rounded-2xl transition-all border',
                  editId === prof.id || prof.id === activeProfileId
                    ? 'border-[color:var(--accent)] bg-[color:var(--accent-bg)]'
                    : 'border-white/[0.06] bg-[#1a1a1f] hover:border-white/20')}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ backgroundColor: av.bg }}>{av.emoji}</div>
                <p className="text-xs font-medium text-white">{prof.name}</p>
                {prof.pin && <Lock size={10} className="text-white/40" />}
              </button>
            );
          })}
          {profiles.length < 5 && (
            <button onClick={() => addProfile({ name: `Profilo ${profiles.length + 1}`, avatar: 'blue', color: '#7c3aed', isKids: false })}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-dashed border-white/20 hover:border-white/40 text-white/30 hover:text-white/60 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-2xl">+</div>
              <p className="text-xs">Aggiungi</p>
            </button>
          )}
        </div>

        {editId && p && (
          <div className="rounded-2xl bg-[#1a1a1f] border border-white/[0.06] p-4 space-y-4">
            <p className="text-sm font-semibold text-white">Modifica: {p.name}</p>
            <input defaultValue={p.name} onBlur={e => updateProfile(p.id, { name: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white" />
            <div className="grid grid-cols-6 gap-2">
              {AVATARS.map(a => (
                <button key={a.id} onClick={() => updateProfile(p.id, { avatar: a.id })}
                  className={clsx('w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all',
                    p.avatar === a.id ? 'ring-2 ring-white scale-110' : 'hover:scale-105')}
                  style={{ backgroundColor: a.bg }}>{a.emoji}</button>
              ))}
            </div>
            {p.id !== 'default' && (
              <button onClick={() => { removeProfile(p.id); setEditId(null); }}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                <Trash2 size={12} />Elimina profilo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NuvioSyncPage({ onBack }: { onBack: () => void }) {
  const { nuvioUser, setNuvioUser } = useStore();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    if (!email || !pw) return;
    setLoading(true); setError(null);
    try { const u = await nuvioLogin(email, pw); setAuthToken(u.token); setNuvioUser(u); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <BackHeader title="Nuvio Sync" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {nuvioUser ? (
          <div className="rounded-2xl bg-[#1a1a1f] border border-white/[0.06] p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'var(--accent)' }}>
                <User size={22} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-white">{nuvioUser.name}</p>
                <p className="text-xs text-white/50">{nuvioUser.email}</p>
              </div>
            </div>
            <p className="text-xs text-white/40">Sincronizzazione attiva: CW, libreria e addon.</p>
            <button onClick={() => { nuvioLogout(); setAuthToken(null); setNuvioUser(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-xl text-sm hover:bg-red-500/15 transition-colors">
              <LogOut size={14} />Disconnetti
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl bg-[#1a1a1f] border border-white/[0.06] p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Accedi a Nuvio</p>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white placeholder:text-white/30" />
              <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} placeholder="Password"
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white placeholder:text-white/30" />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button onClick={login} disabled={loading || !email || !pw}
                className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-medium w-full justify-center disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}>
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <LogIn size={14} />}Accedi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TraktPage({ onBack }: { onBack: () => void }) {
  const { traktAuth, setTraktAuth } = useStore();
  const [code, setCode] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<number | null>(null);

  async function start() {
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
    <div className="flex flex-col h-full overflow-hidden">
      <BackHeader title="Trakt.tv" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {traktAuth ? (
          <div className="rounded-2xl bg-[#1a1a1f] border border-white/[0.06] p-5 space-y-4">
            <div className="flex items-center gap-3">
              {traktAuth.avatar ? <img src={traktAuth.avatar} className="w-12 h-12 rounded-full" /> : <div className="w-12 h-12 rounded-full bg-[#ed1c24] flex items-center justify-center text-white font-bold text-lg">T</div>}
              <div><p className="font-semibold text-white">{traktAuth.name}</p><p className="text-xs text-white/50">@{traktAuth.username}</p></div>
            </div>
            <button onClick={() => setTraktAuth(null)} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-xl text-sm"><LogOut size={14} />Disconnetti</button>
          </div>
        ) : code ? (
          <div className="rounded-2xl bg-[#1a1a1f] border border-white/[0.06] p-5 space-y-4">
            <p className="text-sm text-white/70">1. Apri <button onClick={() => openExternal(code.verification_url)} className="underline" style={{ color: 'var(--accent)' }}>{code.verification_url}</button></p>
            <p className="text-sm text-white/70">2. Inserisci:</p>
            <div className="text-3xl font-mono font-bold tracking-widest text-center py-4 rounded-2xl" style={{ color: 'var(--accent)', backgroundColor: 'var(--accent-bg)' }}>{code.user_code}</div>
            <div className="flex items-center justify-center gap-2 text-xs text-white/40"><RefreshCw size={12} className="animate-spin" />In attesa di autorizzazione...</div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-white/50 mb-4">Sincronizza cronologia, voti e watchlist con Trakt.tv.</p>
            <button onClick={start} disabled={loading} className="flex items-center gap-2 px-5 py-3 bg-[#ed1c24] hover:bg-[#c91920] text-white rounded-2xl text-sm font-medium w-full justify-center disabled:opacity-50">
              {loading ? <RefreshCw size={15} className="animate-spin" /> : <Tv size={15} />}Collega Trakt.tv
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SimklPage({ onBack }: { onBack: () => void }) {
  const { simklAuth, setSimklAuth } = useStore();
  const [pin, setPin] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<number | null>(null);

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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <BackHeader title="Simkl" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {simklAuth ? (
          <div className="rounded-2xl bg-[#1a1a1f] border border-white/[0.06] p-5 space-y-4">
            <div className="flex items-center gap-3">
              {simklAuth.avatar ? <img src={simklAuth.avatar} className="w-12 h-12 rounded-full" /> : <div className="w-12 h-12 rounded-full bg-[#0b65c2] flex items-center justify-center text-white font-bold">S</div>}
              <div><p className="font-semibold text-white">{simklAuth.name}</p><p className="text-xs text-white/50">Simkl</p></div>
            </div>
            <button onClick={() => setSimklAuth(null)} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-xl text-sm"><LogOut size={14} />Disconnetti</button>
          </div>
        ) : pin ? (
          <div className="rounded-2xl bg-[#1a1a1f] border border-white/[0.06] p-5 space-y-4">
            <p className="text-sm text-white/70">Apri <button onClick={() => openExternal('https://simkl.com/pin')} className="text-blue-400 underline">simkl.com/pin</button> e inserisci:</p>
            <div className="text-3xl font-mono font-bold text-blue-400 tracking-widest text-center py-4 bg-blue-500/10 rounded-2xl">{pin.user_code}</div>
            <div className="flex items-center justify-center gap-2 text-xs text-white/40"><RefreshCw size={12} className="animate-spin" />In attesa...</div>
          </div>
        ) : (
          <button onClick={start} disabled={loading} className="flex items-center gap-2 px-5 py-3 bg-[#0b65c2] hover:bg-[#0952a0] text-white rounded-2xl text-sm font-medium w-full justify-center">
            {loading ? <RefreshCw size={15} className="animate-spin" /> : <Film size={15} />}Collega Simkl
          </button>
        )}
      </div>
    </div>
  );
}

function MALPage({ onBack }: { onBack: () => void }) {
  const { malAuth, setMALAuth } = useStore();
  const [step, setStep] = useState<'idle' | 'waiting'>('idle');
  const [code, setCode] = useState('');
  const [cv, setCv] = useState('');
  const [authUrl, setAuthUrl] = useState('');

  async function start() {
    const { getMALAuthUrl } = await import('../api/mal');
    const { url, codeVerifier } = getMALAuthUrl();
    setCv(codeVerifier); setAuthUrl(url); setStep('waiting');
    openExternal(url);
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <BackHeader title="MyAnimeList" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {malAuth ? (
          <div className="rounded-2xl bg-[#1a1a1f] border border-white/[0.06] p-5 space-y-4">
            <div className="flex items-center gap-3">
              {malAuth.picture ? <img src={malAuth.picture} className="w-12 h-12 rounded-full" /> : <div className="w-12 h-12 rounded-full bg-[#2e51a2] flex items-center justify-center text-white font-bold">M</div>}
              <div><p className="font-semibold text-white">{malAuth.name}</p><p className="text-xs text-white/50">MyAnimeList</p></div>
            </div>
            <button onClick={() => setMALAuth(null)} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-xl text-sm"><LogOut size={14} />Disconnetti</button>
          </div>
        ) : step === 'waiting' ? (
          <div className="rounded-2xl bg-[#1a1a1f] border border-white/[0.06] p-5 space-y-3">
            <p className="text-xs text-white/50">Autorizza su MAL, poi incolla il codice dall'URL:</p>
            <div className="flex gap-2">
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="Codice dall'URL"
                className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white placeholder:text-white/30" />
              <button onClick={exchange} disabled={!code.trim()} className="px-4 py-2.5 bg-[#2e51a2] text-white rounded-xl text-sm disabled:opacity-50">OK</button>
            </div>
            <button onClick={() => setStep('idle')} className="text-xs text-white/30 hover:text-white">Annulla</button>
          </div>
        ) : (
          <button onClick={start} className="flex items-center gap-2 px-5 py-3 bg-[#2e51a2] hover:bg-[#264490] text-white rounded-2xl text-sm font-medium w-full justify-center">
            <BookOpen size={15} />Collega MyAnimeList
          </button>
        )}
      </div>
    </div>
  );
}

function PreferencePage({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings } = useStore();
  const [local, setLocal] = useState({ ...settings });
  const [tmdbStatus, setTmdbStatus] = useState<'idle' | 'testing' | 'ok' | 'err'>('idle');
  const [saved, setSaved] = useState(false);

  async function testTMDB() {
    if (!local.tmdbApiKey.trim()) return;
    setTmdbStatus('testing');
    const ok = await validateTMDBKey(local.tmdbApiKey.trim());
    setTmdbStatus(ok ? 'ok' : 'err');
    if (ok) updateSettings({ tmdbApiKey: local.tmdbApiKey.trim() });
  }

  function save() { updateSettings(local as any); setSaved(true); setTimeout(() => setSaved(false), 2000); }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <BackHeader title="Preferenze" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        <div className="rounded-2xl bg-[#1a1a1f] border border-white/[0.06] p-4 space-y-3">
          <p className="text-sm font-semibold text-white">TMDB API Key</p>
          <p className="text-xs text-white/40">Necessaria per trame in italiano, cast, copertine e info complete. Ottieni su <button onClick={() => openExternal('https://www.themoviedb.org/settings/api')} className="underline" style={{ color: 'var(--accent)' }}>themoviedb.org</button></p>
          <div className="flex gap-2">
            <input value={local.tmdbApiKey} onChange={e => { setLocal(p => ({ ...p, tmdbApiKey: e.target.value })); setTmdbStatus('idle'); }}
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white font-mono placeholder:text-white/30" />
            <button onClick={testTMDB} disabled={!local.tmdbApiKey.trim() || tmdbStatus === 'testing'}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm disabled:opacity-50">
              {tmdbStatus === 'testing' ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
            </button>
          </div>
          {tmdbStatus === 'ok' && <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 size={12} />Chiave valida e salvata</p>}
          {tmdbStatus === 'err' && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12} />Chiave non valida</p>}
          {settings.tmdbApiKey && tmdbStatus === 'idle' && <p className="text-xs text-white/30">✓ Configurata</p>}
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Lingua contenuti</label>
            <select value={local.tmdbLanguage} onChange={e => setLocal(p => ({ ...p, tmdbLanguage: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none cursor-pointer">
              <option value="it-IT">Italiano</option><option value="en-US">English</option>
              <option value="es-ES">Español</option><option value="de-DE">Deutsch</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl bg-[#1a1a1f] border border-white/[0.06] p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Lingua interfaccia</p>
          <select value={local.language} onChange={e => setLocal(p => ({ ...p, language: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none cursor-pointer">
            <option value="it">Italiano</option><option value="en">English</option>
            <option value="es">Español</option><option value="de">Deutsch</option>
          </select>
        </div>

        <div className="rounded-2xl bg-[#1a1a1f] border border-white/[0.06] p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Colore accent</p>
          <div className="flex gap-2 flex-wrap">
            {['#7c3aed','#2563eb','#16a34a','#dc2626','#d97706','#0891b2','#be185d','#ea580c','#0d9488','#6366f1'].map(c => (
              <button key={c} onClick={() => setLocal(p => ({ ...p, accentColor: c }))}
                className={clsx('w-9 h-9 rounded-full transition-all', local.accentColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1a1a1f] scale-110' : 'hover:scale-105')}
                style={{ backgroundColor: c }} />
            ))}
            <input type="color" value={local.accentColor} onChange={e => setLocal(p => ({ ...p, accentColor: e.target.value }))}
              className="w-9 h-9 rounded-full cursor-pointer border-0 bg-transparent" />
          </div>
        </div>

        <button onClick={save} className="w-full flex items-center gap-2 px-4 py-3 text-white rounded-2xl font-medium text-sm justify-center"
          style={{ backgroundColor: 'var(--accent)' }}>
          <Save size={15} />{saved ? '✓ Salvato' : 'Salva preferenze'}
        </button>
      </div>
    </div>
  );
}

function PlayerPage({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings } = useStore();
  const [local, setLocal] = useState({ ...settings });
  const [saved, setSaved] = useState(false);

  function save() { updateSettings(local as any); setSaved(true); setTimeout(() => setSaved(false), 2000); }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <BackHeader title="Riproduzione" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="rounded-2xl bg-[#1a1a1f] border border-white/[0.06] divide-y divide-white/[0.04]">
          <div className="p-4 space-y-2">
            <label className="text-xs text-white/40 uppercase tracking-wider block">Player (default: mpv incluso)</label>
            <input value={local.customPlayerPath ?? ''} onChange={e => setLocal(p => ({ ...p, customPlayerPath: e.target.value }))}
              placeholder="Lascia vuoto per mpv · oppure es. C:\Program Files\VLC\vlc.exe"
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white placeholder:text-white/30 font-mono" />
            <div className="flex gap-1.5 flex-wrap">
              {['mpv (default)', 'VLC', 'MPC-HC', 'Potplayer'].map(p => (
                <button key={p} onClick={() => setLocal(prev => ({ ...prev, customPlayerPath: p === 'mpv (default)' ? '' : '' }))}
                  className="text-xs px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors border border-white/10">
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <div><p className="text-sm text-white">Decodifica hardware</p><p className="text-xs text-white/40">Usa GPU per video</p></div>
            <button onClick={() => setLocal(p => ({ ...p, hardwareDecode: !p.hardwareDecode }))}
              className={clsx('relative w-11 h-6 rounded-full transition-colors', local.hardwareDecode ? 'bg-[color:var(--accent)]' : 'bg-white/20')}>
              <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', local.hardwareDecode ? 'translate-x-5' : '')} />
            </button>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <div><p className="text-sm text-white">Autoplay</p><p className="text-xs text-white/40">Episodio successivo automatico</p></div>
            <button onClick={() => setLocal(p => ({ ...p, autoplay: !p.autoplay }))}
              className={clsx('relative w-11 h-6 rounded-full transition-colors', local.autoplay ? 'bg-[color:var(--accent)]' : 'bg-white/20')}>
              <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', local.autoplay ? 'translate-x-5' : '')} />
            </button>
          </div>
        </div>
        <button onClick={save} className="w-full flex items-center gap-2 px-4 py-3 text-white rounded-2xl font-medium text-sm justify-center"
          style={{ backgroundColor: 'var(--accent)' }}>
          <Save size={15} />{saved ? '✓ Salvato' : 'Salva'}
        </button>
      </div>
    </div>
  );
}

function StreamingServicesPage({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings } = useStore();
  const [visible, setVisible] = useState<string[]>(settings.visibleServices ?? STREAMING_SERVICES.map(s => s.id));

  function toggle(id: string) {
    setVisible(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function save() { updateSettings({ visibleServices: visible } as any); }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <BackHeader title="Servizi Streaming" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <p className="text-xs text-white/40">Seleziona i servizi da mostrare nella sezione Streaming.</p>
        <div className="rounded-2xl bg-[#1a1a1f] border border-white/[0.06] overflow-hidden divide-y divide-white/[0.04]">
          {STREAMING_SERVICES.map(s => {
            const [logoErr, setLogoErr] = useState(false);
            const on = visible.includes(s.id);
            return (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3">
                <div className="w-8 h-8 flex items-center justify-center">
                  {!logoErr && s.logo ? <img src={s.logo} alt={s.name} className="h-6 object-contain" onError={() => setLogoErr(true)} /> : <span className="text-xl">{s.logoFallback}</span>}
                </div>
                <p className="flex-1 text-sm font-medium text-white">{s.name}</p>
                <button onClick={() => toggle(s.id)}
                  className={clsx('relative w-11 h-6 rounded-full transition-colors', on ? 'bg-[color:var(--accent)]' : 'bg-white/20')}>
                  <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', on ? 'translate-x-5' : '')} />
                </button>
              </div>
            );
          })}
        </div>
        <button onClick={save} className="w-full flex items-center gap-2 px-4 py-3 text-white rounded-2xl font-medium text-sm justify-center"
          style={{ backgroundColor: 'var(--accent)' }}>
          <Save size={15} />Salva
        </button>
      </div>
    </div>
  );
}

// ─── Main Settings ────────────────────────────────────────────────────────────

type SubPage = null | 'profiles' | 'nuvio' | 'trakt' | 'simkl' | 'mal' | 'preferences' | 'player' | 'streaming' | 'data';

export default function Settings() {
  const { traktAuth, simklAuth, malAuth, nuvioUser, clearHistory } = useStore();
  const activeProfile = (() => { const { profiles, activeProfileId } = useStore(); return profiles.find(p => p.id === activeProfileId) ?? profiles[0]; })();
  const [sub, setSub] = useState<SubPage>(null);
  const av = getAvatar(activeProfile?.avatar ?? 'red');

  if (sub === 'profiles') return <ProfileSettingsPage onBack={() => setSub(null)} />;
  if (sub === 'nuvio')    return <NuvioSyncPage onBack={() => setSub(null)} />;
  if (sub === 'trakt')    return <TraktPage onBack={() => setSub(null)} />;
  if (sub === 'simkl')    return <SimklPage onBack={() => setSub(null)} />;
  if (sub === 'mal')      return <MALPage onBack={() => setSub(null)} />;
  if (sub === 'preferences') return <PreferencePage onBack={() => setSub(null)} />;
  if (sub === 'player')   return <PlayerPage onBack={() => setSub(null)} />;
  if (sub === 'streaming') return <StreamingServicesPage onBack={() => setSub(null)} />;

  return (
    <div className="overflow-y-auto h-full px-4 py-5 space-y-6">
      <h1 className="text-xl font-bold text-white px-0">Impostazioni</h1>

      {/* Account */}
      <SettingsGroup title="Account">
        <SettingRow icon={<Users size={16} />} title="Profili" subtitle={`${activeProfile?.name} · ${useStore.getState().profiles.length} profili`} onClick={() => setSub('profiles')} />
        <SettingRow icon={<div className="text-base">{av.emoji}</div>} title="Profilo attivo" subtitle={activeProfile?.name} onClick={() => setSub('profiles')} />
        <SettingRow
          icon={<Zap size={16} />}
          title="Nuvio Sync"
          subtitle={nuvioUser ? `Connesso: ${nuvioUser.email}` : 'Sincronizza dati tra dispositivi'}
          onClick={() => setSub('nuvio')}
        />
        <SettingRow
          icon={<span className="text-sm font-bold text-[#ed1c24]">T</span>}
          title="Impostazioni Trakt"
          subtitle={traktAuth ? `@${traktAuth.username}` : 'Non connesso'}
          onClick={() => setSub('trakt')}
        />
        <SettingRow
          icon={<span className="text-sm font-bold text-[#0b65c2]">S</span>}
          title="Simkl"
          subtitle={simklAuth ? `@${simklAuth.username}` : 'Traccia ciò che guardi'}
          onClick={() => setSub('simkl')}
        />
        <SettingRow
          icon={<span className="text-sm font-bold text-[#2e51a2]">M</span>}
          title="MyAnimeList"
          subtitle={malAuth ? malAuth.name : 'Sync con MyAnimeList'}
          onClick={() => setSub('mal')}
        />
      </SettingsGroup>

      {/* General */}
      <SettingsGroup title="Generale">
        <SettingRow icon={<Globe size={16} />} title="Preferenze" subtitle="TMDB, lingua, colori" onClick={() => setSub('preferences')} />
        <SettingRow icon={<Tv size={16} />} title="Servizi Streaming" subtitle="Netflix, Disney+, ecc." onClick={() => setSub('streaming')} />
        <SettingRow icon={<Play size={16} />} title="Riproduzione" subtitle="Player, qualità, autoplay" onClick={() => setSub('player')} />
      </SettingsGroup>

      {/* Data */}
      <SettingsGroup title="Dati">
        <SettingRow icon={<Trash2 size={16} />} title="Cancella cronologia" subtitle="Solo profilo corrente" danger
          onClick={() => { if (confirm('Cancellare la cronologia?')) clearHistory(); }} />
      </SettingsGroup>

      {/* Info */}
      <SettingsGroup title="Informazioni">
        <SettingRow icon={<Info size={16} />} title="Informazioni su Nuvio" subtitle="v0.4.0 · Nuvio Desktop" onClick={() => openExternal('https://github.com/Davako94/nuvio-desktop')} />
      </SettingsGroup>
    </div>
  );
}
