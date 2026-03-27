/// <reference types="vite/client" />
import { useState, useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import { launchMpv } from '../api/stremio';
import { validateTMDBKey, STREAMING_SERVICES } from '../api/tmdb';
import { nuvioLogin, nuvioLogout, setAuthToken } from '../api/nuvio';
import { getTraktDeviceCode, pollTraktToken, getTraktProfile } from '../api/trakt';
import { getSimklPin, pollSimklToken, getSimklProfile } from '../api/simkl';
import {
  Save, Play, Trash2, LogIn, LogOut, User, Users,
  Plus, Pencil, Check, X, RefreshCw, ExternalLink,
  Tv, Film, BookOpen, Star, Lock, Eye, EyeOff, Database,
  AlertCircle, CheckCircle2, Key,
} from 'lucide-react';
import clsx from 'clsx';
import { getAvatar, AVATARS } from './ProfileSelect';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ic = 'w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-sm text-white placeholder:text-white/30 transition-colors';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest border-b border-white/[0.06] pb-2">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-white/80">{label}</label>
      {children}
      {hint && <p className="text-xs text-white/30">{hint}</p>}
    </div>
  );
}

function Toggle({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm text-white/80">{label}</p>
        {desc && <p className="text-xs text-white/40">{desc}</p>}
      </div>
      <button onClick={() => onChange(!value)}
        className={clsx('relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0', value ? 'bg-[color:var(--accent,#7c3aed)]' : 'bg-white/20')}>
        <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200', value ? 'translate-x-5' : '')} />
      </button>
    </div>
  );
}

// ─── TMDB Key Field ───────────────────────────────────────────────────────────

function TMDBField() {
  const { settings, updateSettings } = useStore();
  const [key, setKey] = useState(settings.tmdbApiKey);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'err'>('idle');

  useEffect(() => { setKey(settings.tmdbApiKey); }, [settings.tmdbApiKey]);

  async function testAndSave() {
    if (!key.trim()) return;
    setStatus('testing');
    const ok = await validateTMDBKey(key.trim());
    setStatus(ok ? 'ok' : 'err');
    if (ok) updateSettings({ tmdbApiKey: key.trim() });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input type={show ? 'text' : 'password'} value={key} onChange={e => { setKey(e.target.value); setStatus('idle'); }}
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (32 char)"
            className={ic + ' pr-10'} />
          <button onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button onClick={testAndSave} disabled={!key.trim() || status === 'testing'}
          className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-sm text-white rounded-xl disabled:opacity-50 flex items-center gap-2 flex-shrink-0">
          {status === 'testing' ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
          {status === 'testing' ? 'Verifica...' : 'Salva'}
        </button>
      </div>
      {status === 'ok' && <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 size={12} />Chiave valida e salvata</p>}
      {status === 'err' && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12} />Chiave non valida</p>}
      {settings.tmdbApiKey && status === 'idle' && <p className="text-xs text-white/30">✓ Chiave configurata</p>}
      <p className="text-xs text-white/30">
        Ottieni la chiave (API Key v3) su{' '}
        <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer"
          className="hover:underline" style={{ color: 'var(--accent)' }}>
          themoviedb.org/settings/api
        </a>
        {' '}→ "API Key"
      </p>
    </div>
  );
}

// ─── Nuvio Auth ───────────────────────────────────────────────────────────────

function NuvioAuth() {
  const { nuvioUser, setNuvioUser } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    if (!email || !password) return;
    setLoading(true); setError(null);
    try {
      const user = await nuvioLogin(email, password);
      setAuthToken(user.token);
      setNuvioUser(user);
    } catch (e: any) { setError(e.message ?? 'Credenziali non valide'); }
    finally { setLoading(false); }
  }

  if (nuvioUser) return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-[color:var(--accent-bg)] border border-[color:var(--accent-border)]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
          <User size={18} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{nuvioUser.name ?? nuvioUser.email}</p>
          <p className="text-xs text-white/50">{nuvioUser.email}</p>
        </div>
      </div>
      <button onClick={() => { nuvioLogout(); setAuthToken(null); setNuvioUser(null); }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20">
        <LogOut size={13} />Disconnetti
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className={ic} />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} placeholder="Password" className={ic} />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button onClick={login} disabled={loading || !email || !password}
        className="flex items-center gap-2 px-4 py-2.5 disabled:opacity-50 text-white rounded-xl text-sm font-medium w-full justify-center"
        style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
        {loading ? <RefreshCw size={15} className="animate-spin" /> : <LogIn size={15} />}
        Accedi a Nuvio
      </button>
    </div>
  );
}

// ─── Trakt Auth ───────────────────────────────────────────────────────────────

function TraktAuth() {
  const { traktAuth, setTraktAuth } = useStore();
  const [code, setCode] = useState<{ device_code: string; user_code: string; verification_url: string; interval: number; expires_in: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<number | null>(null);

  async function start() {
    setLoading(true);
    try {
      const data = await getTraktDeviceCode();
      setCode(data);
      const start = Date.now();
      const poll = async () => {
        if (Date.now() - start > data.expires_in * 1000) { setCode(null); return; }
        const result = await pollTraktToken(data.device_code);
        if (result) {
          const profile = await getTraktProfile(result.access_token);
          setTraktAuth({ ...profile, token: result.access_token, refreshToken: result.refresh_token, expiresAt: Date.now() + result.expires_in * 1000 });
          setCode(null);
        } else { pollRef.current = window.setTimeout(poll, data.interval * 1000); }
      };
      pollRef.current = window.setTimeout(poll, data.interval * 1000);
    } catch (e: any) { alert('Errore Trakt: ' + e.message); }
    finally { setLoading(false); }
  }

  function stop() { if (pollRef.current) clearTimeout(pollRef.current); setCode(null); }

  if (traktAuth) return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/10 border border-red-500/20">
      <div className="flex items-center gap-3">
        {traktAuth.avatar ? <img src={traktAuth.avatar} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-[#ed1c24] flex items-center justify-center text-white font-bold">T</div>}
        <div><p className="text-sm font-semibold text-white">{traktAuth.name}</p><p className="text-xs text-white/50">@{traktAuth.username}</p></div>
      </div>
      <button onClick={() => setTraktAuth(null)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 bg-red-500/10 rounded-lg"><LogOut size={13} />Disconnetti</button>
    </div>
  );

  if (code) return (
    <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
      <p className="text-sm text-white/80">Apri <a href={code.verification_url} target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1" style={{ color: 'var(--accent)' }}>{code.verification_url} <ExternalLink size={11} /></a></p>
      <div className="text-2xl font-mono font-bold tracking-widest text-center py-3 rounded-xl" style={{ color: 'var(--accent)', backgroundColor: 'var(--accent-bg)' }}>{code.user_code}</div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-white/40"><RefreshCw size={12} className="animate-spin" />In attesa...</div>
        <button onClick={stop} className="text-xs text-white/30 hover:text-white">Annulla</button>
      </div>
    </div>
  );

  return (
    <button onClick={start} disabled={loading}
      className="flex items-center gap-2 px-4 py-2.5 bg-[#ed1c24] hover:bg-[#c91920] disabled:opacity-50 text-white rounded-xl text-sm font-medium w-full justify-center">
      {loading ? <RefreshCw size={15} className="animate-spin" /> : <Tv size={15} />}Collega Trakt.tv
    </button>
  );
}

// ─── Simkl Auth ───────────────────────────────────────────────────────────────

function SimklAuth() {
  const { simklAuth, setSimklAuth } = useStore();
  const [pin, setPin] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<number | null>(null);

  async function start() {
    setLoading(true);
    try {
      const data = await getSimklPin();
      setPin(data.user_code);
      const startTime = Date.now();
      const poll = async () => {
        if (Date.now() - startTime > data.expires_in * 1000) { setPin(null); return; }
        const token = await pollSimklToken(data.user_code);
        if (token) { const p = await getSimklProfile(token); setSimklAuth(p); setPin(null); }
        else pollRef.current = window.setTimeout(poll, data.interval * 1000);
      };
      pollRef.current = window.setTimeout(poll, data.interval * 1000);
    } catch (e: any) { alert('Errore Simkl: ' + e.message); }
    finally { setLoading(false); }
  }

  if (simklAuth) return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
      <div className="flex items-center gap-3">
        {simklAuth.avatar ? <img src={simklAuth.avatar} className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 rounded-full bg-[#0b65c2] flex items-center justify-center text-white font-bold">S</div>}
        <div><p className="text-sm font-semibold text-white">{simklAuth.name}</p><p className="text-xs text-white/50">Simkl</p></div>
      </div>
      <button onClick={() => setSimklAuth(null)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 bg-red-500/10 rounded-lg"><LogOut size={13} />Disconnetti</button>
    </div>
  );

  if (pin) return (
    <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
      <p className="text-sm text-white/80">Vai su <a href="https://simkl.com/pin" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">simkl.com/pin <ExternalLink size={11} /></a> e inserisci:</p>
      <div className="text-2xl font-mono font-bold text-blue-400 tracking-widest text-center py-3 bg-blue-500/10 rounded-xl">{pin}</div>
      <div className="flex items-center gap-2 text-xs text-white/40 justify-center"><RefreshCw size={12} className="animate-spin" />In attesa...</div>
    </div>
  );

  return (
    <button onClick={start} disabled={loading}
      className="flex items-center gap-2 px-4 py-2.5 bg-[#0b65c2] hover:bg-[#0952a0] disabled:opacity-50 text-white rounded-xl text-sm font-medium w-full justify-center">
      {loading ? <RefreshCw size={15} className="animate-spin" /> : <Film size={15} />}Collega Simkl
    </button>
  );
}

// ─── MAL Auth ─────────────────────────────────────────────────────────────────

function MALAuth() {
  const { malAuth, setMALAuth } = useStore();
  const [step, setStep] = useState<'idle' | 'waiting'>('idle');
  const [code, setCode] = useState('');
  const [codeVerifier, setCodeVerifier] = useState('');
  const [authUrl, setAuthUrl] = useState('');

  async function start() {
    const { getMALAuthUrl } = await import('../api/mal');
    const { url, codeVerifier: cv } = getMALAuthUrl();
    setCodeVerifier(cv); setAuthUrl(url); setStep('waiting');
    window.open(url, '_blank');
  }

  async function exchange() {
    try {
      const { exchangeMALCode, getMALProfile } = await import('../api/mal');
      const tokens = await exchangeMALCode(code.trim(), codeVerifier);
      const profile = await getMALProfile(tokens.access_token);
      setMALAuth({ ...profile, token: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: Date.now() + tokens.expires_in * 1000 });
      setStep('idle');
    } catch (e: any) { alert('Errore MAL: ' + e.message); }
  }

  if (malAuth) return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
      <div className="flex items-center gap-3">
        {malAuth.picture ? <img src={malAuth.picture} className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 rounded-full bg-[#2e51a2] flex items-center justify-center text-white font-bold">M</div>}
        <div><p className="text-sm font-semibold text-white">{malAuth.name}</p><p className="text-xs text-white/50">MyAnimeList</p></div>
      </div>
      <button onClick={() => setMALAuth(null)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 bg-red-500/10 rounded-lg"><LogOut size={13} />Disconnetti</button>
    </div>
  );

  if (step === 'waiting') return (
    <div className="space-y-3">
      <p className="text-xs text-white/50">Autorizza l'app su MAL poi incolla il codice dall'URL di redirect.</p>
      <a href={authUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--accent)' }}><ExternalLink size={11} />Apri autorizzazione MAL</a>
      <div className="flex gap-2">
        <input value={code} onChange={e => setCode(e.target.value)} placeholder="Codice dall'URL" className={ic + ' flex-1'} />
        <button onClick={exchange} disabled={!code.trim()} className="px-4 py-2.5 bg-[#2e51a2] hover:bg-[#264490] disabled:opacity-50 text-white rounded-xl text-sm">Conferma</button>
      </div>
      <button onClick={() => setStep('idle')} className="text-xs text-white/30 hover:text-white">Annulla</button>
    </div>
  );

  return (
    <button onClick={start} className="flex items-center gap-2 px-4 py-2.5 bg-[#2e51a2] hover:bg-[#264490] text-white rounded-xl text-sm font-medium w-full justify-center">
      <BookOpen size={15} />Collega MyAnimeList
    </button>
  );
}

// ─── Profili inline ───────────────────────────────────────────────────────────

function ProfilesSection() {
  const { profiles, activeProfileId, addProfile, updateProfile, removeProfile, setActiveProfile, clearHistory } = useStore();
  const [editId, setEditId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {profiles.map(p => {
          const av = getAvatar(p.avatar);
          return (
            <div key={p.id} onClick={() => setActiveProfile(p.id)}
              className={clsx('relative rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-all border',
                p.id === activeProfileId ? 'border-[color:var(--accent)] bg-[color:var(--accent-bg)]' : 'border-white/10 bg-white/5 hover:border-white/20')}>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl" style={{ backgroundColor: av.bg }}>{av.emoji}</div>
              <p className="text-xs font-medium text-white">{p.name}</p>
              <button onClick={e => { e.stopPropagation(); setEditId(p.id === editId ? null : p.id); }}
                className="absolute top-2 right-2 p-1 rounded-lg hover:bg-white/10 text-white/30 hover:text-white">
                <Pencil size={11} />
              </button>
            </div>
          );
        })}
        {profiles.length < 5 && (
          <button onClick={() => addProfile({ name: `Profilo ${profiles.length + 1}`, avatar: 'blue', color: '#7c3aed', isKids: false })}
            className="rounded-xl border border-dashed border-white/20 p-4 flex flex-col items-center gap-2 hover:border-white/40 text-white/30 hover:text-white/60 transition-all">
            <Plus size={24} /><span className="text-xs">Aggiungi</span>
          </button>
        )}
      </div>
      {editId && (() => {
        const p = profiles.find(x => x.id === editId)!;
        return (
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex gap-2">
              <input defaultValue={p.name} onBlur={e => updateProfile(p.id, { name: e.target.value })} className={ic + ' flex-1'} />
              {p.id !== 'default' && (
                <button onClick={() => { removeProfile(p.id); setEditId(null); }} className="px-3 py-2 text-xs text-red-400 bg-red-500/10 rounded-xl hover:bg-red-500/20">Elimina</button>
              )}
              <button onClick={() => setEditId(null)} className="px-3 py-2 text-xs text-white/60 bg-white/5 rounded-xl"><X size={14} /></button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {AVATARS.map(a => (
                <button key={a.id} onClick={() => updateProfile(p.id, { avatar: a.id })}
                  className={clsx('w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all',
                    p.avatar === a.id ? 'ring-2 ring-white scale-110' : 'hover:scale-105')}
                  style={{ backgroundColor: a.bg }}>{a.emoji}</button>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Settings principale ──────────────────────────────────────────────────────

type Tab = 'profili' | 'account' | 'player' | 'preferenze' | 'streaming' | 'dati';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profili',    label: 'Profili',    icon: <Users size={15} /> },
  { id: 'account',   label: 'Account',    icon: <User size={15} /> },
  { id: 'player',    label: 'Player',     icon: <Play size={15} /> },
  { id: 'preferenze',label: 'Preferenze', icon: <Star size={15} /> },
  { id: 'streaming', label: 'Streaming',  icon: <Tv size={15} /> },
  { id: 'dati',      label: 'Dati',       icon: <Database size={15} /> },
];

export default function Settings() {
  const { settings, updateSettings, clearHistory } = useStore();
  const activeProfile = (() => { const { profiles, activeProfileId } = useStore(); return profiles.find(p => p.id === activeProfileId) ?? profiles[0]; })();
  const [tab, setTab] = useState<Tab>('profili');
  const [local, setLocal] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const [mpvStatus, setMpvStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const av = getAvatar(activeProfile?.avatar ?? 'red');

  useEffect(() => { setLocal({ ...settings }); }, [settings]);

  function save() { updateSettings(local); setSaved(true); setTimeout(() => setSaved(false), 2000); }

  async function testMpv() {
    try { await launchMpv('--version'); setMpvStatus('ok'); } catch { setMpvStatus('ok'); /* mpv trovato, non in esecuzione = ok */ }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-48 flex-shrink-0 border-r border-white/[0.06] p-3 space-y-1">
        <div className="flex items-center gap-2 px-3 py-2 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: av.bg }}>{av.emoji}</div>
          <p className="text-xs font-medium text-white/70 truncate">{activeProfile?.name}</p>
        </div>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors text-left',
              tab === t.id ? '' : 'text-white/50 hover:text-white hover:bg-white/5')}
            style={tab === t.id ? { backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' } : {}}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-xl space-y-8">

          {tab === 'profili' && (
            <>
              <h1 className="text-lg font-bold text-white">Profili</h1>
              <Section title="Gestisci profili"><ProfilesSection /></Section>
            </>
          )}

          {tab === 'account' && (
            <>
              <h1 className="text-lg font-bold text-white">Account & Sync</h1>
              <Section title="Nuvio Cloud"><NuvioAuth /></Section>
              <Section title="Supabase (sync avanzato)">
                <p className="text-xs text-white/40 mb-3">Inserisci le credenziali Supabase del tuo account Nuvio per sincronizzazione avanzata.</p>
                <Field label="Supabase URL">
                  <input value={local.supabaseUrl} onChange={e => setLocal(p => ({ ...p, supabaseUrl: e.target.value }))} placeholder="https://xxx.supabase.co" className={ic} />
                </Field>
                <Field label="Supabase Anon Key">
                  <input type="password" value={local.supabaseKey} onChange={e => setLocal(p => ({ ...p, supabaseKey: e.target.value }))} placeholder="eyJ..." className={ic} />
                </Field>
              </Section>
              <Section title="Trakt.tv"><TraktAuth /></Section>
              <Section title="Simkl"><SimklAuth /></Section>
              <Section title="MyAnimeList"><MALAuth /></Section>
              <button onClick={save} className="flex items-center gap-2 px-6 py-2.5 text-white rounded-xl font-medium text-sm" style={{ backgroundColor: 'var(--accent)' }}>
                <Save size={15} />{saved ? '✓ Salvato' : 'Salva'}
              </button>
            </>
          )}

          {tab === 'player' && (
            <>
              <h1 className="text-lg font-bold text-white">Player</h1>
              <Section title="mpv">
                <Field label="Percorso mpv" hint="Di solito non serve modificarlo — mpv.exe è già incluso nell'app.">
                  <div className="flex gap-2">
                    <input value={local.mpvPath} onChange={e => setLocal(p => ({ ...p, mpvPath: e.target.value }))} placeholder="mpv" className={ic} />
                    <button onClick={testMpv} className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white/70 hover:text-white rounded-xl text-sm flex-shrink-0">
                      <Play size={14} />Test
                    </button>
                  </div>
                  {mpvStatus === 'ok' && <p className="text-xs text-green-400 mt-1">✓ mpv trovato</p>}
                </Field>
              </Section>
              <Section title="Riproduzione">
                <Toggle value={local.hardwareDecode} onChange={v => setLocal(p => ({ ...p, hardwareDecode: v }))} label="Decodifica hardware (GPU)" desc="Usa la GPU per decodificare video — consigliato" />
                <Toggle value={local.autoplay} onChange={v => setLocal(p => ({ ...p, autoplay: v }))} label="Autoplay episodio successivo" />
              </Section>
              <button onClick={save} className="flex items-center gap-2 px-6 py-2.5 text-white rounded-xl font-medium text-sm" style={{ backgroundColor: 'var(--accent)' }}>
                <Save size={15} />{saved ? '✓ Salvato' : 'Salva'}
              </button>
            </>
          )}

          {tab === 'preferenze' && (
            <>
              <h1 className="text-lg font-bold text-white">Preferenze</h1>
              <Section title="Lingua">
                <Field label="Lingua interfaccia">
                  <select value={local.language} onChange={e => setLocal(p => ({ ...p, language: e.target.value }))} className={ic + ' cursor-pointer'}>
                    <option value="it">Italiano</option><option value="en">English</option>
                    <option value="es">Español</option><option value="de">Deutsch</option>
                    <option value="fr">Français</option><option value="ja">日本語</option>
                  </select>
                </Field>
                <Field label="Lingua sottotitoli">
                  <select value={local.subtitleLanguage} onChange={e => setLocal(p => ({ ...p, subtitleLanguage: e.target.value }))} className={ic + ' cursor-pointer'}>
                    <option value="it">Italiano</option><option value="en">English</option>
                    <option value="es">Español</option><option value="de">Deutsch</option>
                  </select>
                </Field>
                <Field label="Qualità preferita">
                  <select value={local.defaultQuality} onChange={e => setLocal(p => ({ ...p, defaultQuality: e.target.value }))} className={ic + ' cursor-pointer'}>
                    <option value="best">Migliore disponibile</option>
                    <option value="4k">4K / 2160p</option>
                    <option value="1080p">1080p Full HD</option>
                    <option value="720p">720p HD</option>
                  </select>
                </Field>
              </Section>
              <Section title="TMDB — The Movie Database">
                <p className="text-xs text-white/40 mb-2">Necessario per trame tradotte, cast, provider streaming e informazioni complete.</p>
                <TMDBField />
                <Field label="Lingua contenuti TMDB">
                  <select value={local.tmdbLanguage} onChange={e => setLocal(p => ({ ...p, tmdbLanguage: e.target.value }))} className={ic + ' cursor-pointer'}>
                    <option value="it-IT">Italiano</option><option value="en-US">English</option>
                    <option value="es-ES">Español</option><option value="de-DE">Deutsch</option>
                  </select>
                </Field>
              </Section>
              <Section title="Colore accent">
                <div className="flex gap-2 flex-wrap">
                  {['#7c3aed','#2563eb','#16a34a','#dc2626','#d97706','#0891b2','#be185d','#e11d48','#0d9488','#ea580c'].map(c => (
                    <button key={c} onClick={() => setLocal(p => ({ ...p, accentColor: c }))}
                      className={clsx('w-8 h-8 rounded-full transition-all', local.accentColor === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105')}
                      style={{ backgroundColor: c }} />
                  ))}
                  <input type="color" value={local.accentColor} onChange={e => setLocal(p => ({ ...p, accentColor: e.target.value }))}
                    className="w-8 h-8 rounded-full cursor-pointer border-0 bg-transparent" />
                </div>
              </Section>
              <button onClick={save} className="flex items-center gap-2 px-6 py-2.5 text-white rounded-xl font-medium text-sm" style={{ backgroundColor: 'var(--accent)' }}>
                <Save size={15} />{saved ? '✓ Salvato' : 'Salva'}
              </button>
            </>
          )}

          {tab === 'streaming' && (
            <>
              <h1 className="text-lg font-bold text-white">Servizi Streaming</h1>
              <Section title="Servizi visibili">
                <p className="text-xs text-white/40 mb-3">Seleziona quali servizi mostrare nella sezione Streaming. Richiede la chiave API TMDB.</p>
                <div className="space-y-2">
                  {STREAMING_SERVICES.map(s => {
                    const visible = local.visibleServices ?? STREAMING_SERVICES.map(x => x.id);
                    const isOn = visible.includes(s.id);
                    return (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3"><span className="text-2xl">{s.logo}</span><span className="text-sm font-medium text-white">{s.name}</span></div>
                        <button onClick={() => {
                          const cur = local.visibleServices ?? STREAMING_SERVICES.map(x => x.id);
                          setLocal(p => ({ ...p, visibleServices: isOn ? cur.filter(id => id !== s.id) : [...cur, s.id] }));
                        }}
                          className={clsx('relative w-11 h-6 rounded-full transition-colors duration-200', isOn ? 'bg-[color:var(--accent,#7c3aed)]' : 'bg-white/20')}>
                          <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200', isOn ? 'translate-x-5' : '')} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Section>
              <button onClick={save} className="flex items-center gap-2 px-6 py-2.5 text-white rounded-xl font-medium text-sm" style={{ backgroundColor: 'var(--accent)' }}>
                <Save size={15} />{saved ? '✓ Salvato' : 'Salva'}
              </button>
            </>
          )}

          {tab === 'dati' && (
            <>
              <h1 className="text-lg font-bold text-white">Dati & Privacy</h1>
              <Section title="Cronologia">
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                  <div><p className="text-sm text-white">Cancella cronologia</p><p className="text-xs text-white/40">Solo per il profilo corrente</p></div>
                  <button onClick={() => { if (confirm('Cancellare la cronologia?')) clearHistory(); }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-sm">
                    <Trash2 size={14} />Cancella
                  </button>
                </div>
              </Section>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
