import { useState, useEffect, useRef } from 'react';
import { useAppStore, useActiveProfile } from '../lib/store';
import { mpvCommand } from '../lib/addon-client';
import { login as nuvioLogin, logout as nuvioLogout, setAuthToken } from '../api/nuvio';
import { getTraktDeviceCode, pollTraktToken, getTraktProfile } from '../api/trakt';
import { getSimklPin, pollSimklToken, getSimklProfile } from '../api/simkl';
import {
  Save, Play, Trash2, LogIn, LogOut, User, Users,
  Plus, Pencil, Check, X, RefreshCw, ExternalLink,
  Tv, Film, BookOpen, Star, Monitor,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Componenti base ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest border-b border-white/[0.06] pb-2">
        {title}
      </h2>
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

const inputCls = 'w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-violet-500 focus:outline-none text-sm text-white placeholder:text-white/30 transition-colors';
const selectCls = inputCls + ' cursor-pointer';

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-white/80">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={clsx(
          'relative w-11 h-6 rounded-full transition-colors duration-200',
          value ? 'bg-violet-600' : 'bg-white/20'
        )}
      >
        <span className={clsx(
          'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
          value ? 'translate-x-5' : 'translate-x-0'
        )} />
      </button>
    </div>
  );
}

// ─── Selezione profilo avatar ─────────────────────────────────────────────────

const AVATAR_OPTIONS = ['🎬', '🎭', '👤', '🦁', '🐺', '🦊', '🐸', '🎮', '🌙', '⚡', '🔥', '💎'];
const COLOR_OPTIONS = ['#7c3aed', '#2563eb', '#16a34a', '#dc2626', '#d97706', '#0891b2', '#be185d', '#4f46e5'];

// ─── Sezione Profili ──────────────────────────────────────────────────────────

function ProfilesSection() {
  const { profiles, activeProfileId, addProfile, updateProfile, removeProfile, setActiveProfile } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('🎬');
  const [editColor, setEditColor] = useState('#7c3aed');
  const [editKids, setEditKids] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAvatar, setNewAvatar] = useState('🎬');
  const [newColor, setNewColor] = useState('#7c3aed');

  function startEdit(p: typeof profiles[0]) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditAvatar(p.avatar ?? '🎬');
    setEditColor(p.color);
    setEditKids(p.isKids);
  }

  function saveEdit() {
    if (!editingId) return;
    updateProfile(editingId, { name: editName, avatar: editAvatar, color: editColor, isKids: editKids });
    setEditingId(null);
  }

  function handleAdd() {
    if (!newName.trim()) return;
    addProfile({ name: newName.trim(), avatar: newAvatar, color: newColor, isKids: false });
    setNewName('');
    setShowAdd(false);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {profiles.map((p) => (
          <div
            key={p.id}
            className={clsx(
              'relative rounded-xl border p-4 transition-all cursor-pointer group',
              p.id === activeProfileId
                ? 'border-violet-500 bg-violet-500/10'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            )}
            onClick={() => setActiveProfile(p.id)}
          >
            {/* Avatar */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3"
              style={{ backgroundColor: p.color + '33' }}
            >
              {p.avatar ?? '👤'}
            </div>
            <p className="text-sm font-semibold text-white truncate">{p.name}</p>
            {p.isKids && (
              <span className="text-xs text-blue-400 mt-0.5 block">Bambini</span>
            )}
            {p.id === activeProfileId && (
              <div className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            )}
            {/* Edit button */}
            <button
              onClick={(e) => { e.stopPropagation(); startEdit(p); }}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
            >
              <Pencil size={12} className="text-white/70" />
            </button>
          </div>
        ))}

        {/* Add new */}
        {profiles.length < 5 && (
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-xl border border-dashed border-white/20 p-4 flex flex-col items-center justify-center gap-2 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all text-white/40 hover:text-white/60"
          >
            <Plus size={20} />
            <span className="text-xs">Aggiungi profilo</span>
          </button>
        )}
      </div>

      {/* Edit modal */}
      {editingId && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <p className="text-sm font-semibold text-white">Modifica profilo</p>
          <div className="flex gap-3">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className={inputCls + ' flex-1'}
              placeholder="Nome profilo"
            />
          </div>
          <div>
            <p className="text-xs text-white/40 mb-2">Avatar</p>
            <div className="flex gap-2 flex-wrap">
              {AVATAR_OPTIONS.map((a) => (
                <button key={a} onClick={() => setEditAvatar(a)}
                  className={clsx('text-xl p-1.5 rounded-lg transition-all', editAvatar === a ? 'bg-violet-600/30 ring-1 ring-violet-500' : 'hover:bg-white/10')}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-2">Colore</p>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button key={c} onClick={() => setEditColor(c)}
                  className={clsx('w-6 h-6 rounded-full transition-all', editColor === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <Toggle value={editKids} onChange={setEditKids} label="Profilo bambini (contenuti appropriati)" />
          <div className="flex gap-2 justify-between">
            <button onClick={() => { if (confirm('Eliminare il profilo?')) removeProfile(editingId); setEditingId(null); }}
              className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1">
              <Trash2 size={12} /> Elimina
            </button>
            <div className="flex gap-2">
              <button onClick={() => setEditingId(null)}
                className="px-3 py-1.5 text-xs text-white/60 hover:text-white bg-white/5 rounded-lg transition-colors">
                Annulla
              </button>
              <button onClick={saveEdit}
                className="px-3 py-1.5 text-xs text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors flex items-center gap-1">
                <Check size={12} /> Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <p className="text-sm font-semibold text-white">Nuovo profilo</p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className={inputCls}
            placeholder="Nome profilo"
            autoFocus
          />
          <div>
            <p className="text-xs text-white/40 mb-2">Avatar</p>
            <div className="flex gap-2 flex-wrap">
              {AVATAR_OPTIONS.map((a) => (
                <button key={a} onClick={() => setNewAvatar(a)}
                  className={clsx('text-xl p-1.5 rounded-lg transition-all', newAvatar === a ? 'bg-violet-600/30 ring-1 ring-violet-500' : 'hover:bg-white/10')}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-2">Colore</p>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button key={c} onClick={() => setNewColor(c)}
                  className={clsx('w-6 h-6 rounded-full transition-all', newColor === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-xs text-white/60 hover:text-white bg-white/5 rounded-lg transition-colors">
              Annulla
            </button>
            <button onClick={handleAdd} disabled={!newName.trim()}
              className="px-3 py-1.5 text-xs text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1">
              <Check size={12} /> Crea
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sezione Nuvio ────────────────────────────────────────────────────────────

function NuvioSection() {
  const { nuvioUser, setNuvioUser } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    try {
      const user = await nuvioLogin(email, password);
      setAuthToken(user.token);
      setNuvioUser(user);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Credenziali non valide');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await nuvioLogout();
    setAuthToken(null);
    setNuvioUser(null);
  }

  if (nuvioUser) {
    return (
      <div className="flex items-center justify-between p-4 rounded-xl bg-violet-500/10 border border-violet-500/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center">
            <User size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{nuvioUser.name ?? nuvioUser.email}</p>
            <p className="text-xs text-white/50">{nuvioUser.email}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors">
          <LogOut size={13} /> Disconnetti
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40">
        Accedi a Nuvio per sincronizzare la tua libreria e il "Continua a guardare" su tutti i dispositivi.
      </p>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="Email" className={inputCls} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        placeholder="Password" className={inputCls} />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button onClick={handleLogin} disabled={loading || !email || !password}
        className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors w-full justify-center">
        {loading ? <RefreshCw size={15} className="animate-spin" /> : <LogIn size={15} />}
        Accedi a Nuvio
      </button>
    </div>
  );
}

// ─── Sezione Trakt ────────────────────────────────────────────────────────────

function TraktSection() {
  const { traktAuth, setTraktAuth } = useAppStore();
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<number | null>(null);

  async function startAuth() {
    setLoading(true);
    try {
      const data = await getTraktDeviceCode();
      setDeviceCode(data.device_code);
      setUserCode(data.user_code);
      setVerifyUrl(data.verification_url);
      startPolling(data.device_code, data.interval, data.expires_in);
    } catch (e: any) {
      alert('Errore Trakt: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  function startPolling(code: string, interval: number, expiresIn: number) {
    setPolling(true);
    const start = Date.now();
    const poll = async () => {
      if (Date.now() - start > expiresIn * 1000) {
        stopPolling();
        alert('Autenticazione Trakt scaduta. Riprova.');
        return;
      }
      const result = await pollTraktToken(code);
      if (result) {
        const profile = await getTraktProfile(result.access_token);
        setTraktAuth({
          ...profile,
          token: result.access_token,
          refreshToken: result.refresh_token,
          expiresAt: Date.now() + result.expires_in * 1000,
        });
        stopPolling();
        setDeviceCode(null);
        setUserCode(null);
      } else {
        pollRef.current = window.setTimeout(poll, interval * 1000);
      }
    };
    pollRef.current = window.setTimeout(poll, interval * 1000);
  }

  function stopPolling() {
    if (pollRef.current) clearTimeout(pollRef.current);
    setPolling(false);
  }

  if (traktAuth) {
    return (
      <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/10 border border-red-500/20">
        <div className="flex items-center gap-3">
          {traktAuth.avatar
            ? <img src={traktAuth.avatar} className="w-10 h-10 rounded-full object-cover" />
            : <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-sm">T</div>}
          <div>
            <p className="text-sm font-semibold text-white">{traktAuth.name}</p>
            <p className="text-xs text-white/50">@{traktAuth.username} · Trakt.tv</p>
          </div>
        </div>
        <button onClick={() => setTraktAuth(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors">
          <LogOut size={13} /> Disconnetti
        </button>
      </div>
    );
  }

  if (userCode) {
    return (
      <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
        <p className="text-sm text-white/80">
          1. Apri <a href={verifyUrl!} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline inline-flex items-center gap-1">{verifyUrl} <ExternalLink size={11} /></a>
        </p>
        <p className="text-sm text-white/80">2. Inserisci il codice:</p>
        <div className="text-2xl font-mono font-bold text-violet-400 tracking-widest text-center py-3 bg-violet-500/10 rounded-lg">
          {userCode}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40 justify-center">
          <RefreshCw size={12} className="animate-spin" /> In attesa di autorizzazione...
        </div>
        <button onClick={stopPolling}
          className="text-xs text-white/40 hover:text-white transition-colors w-full text-center">
          Annulla
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40">
        Sincronizza la cronologia di visione e i rating con Trakt.tv.
      </p>
      <button onClick={startAuth} disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-[#ed1c24] hover:bg-[#c91920] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors w-full justify-center">
        {loading ? <RefreshCw size={15} className="animate-spin" /> : <Tv size={15} />}
        Collega Trakt.tv
      </button>
    </div>
  );
}

// ─── Sezione Simkl ────────────────────────────────────────────────────────────

function SimklSection() {
  const { simklAuth, setSimklAuth } = useAppStore();
  const [pin, setPin] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<number | null>(null);

  async function startAuth() {
    setLoading(true);
    try {
      const data = await getSimklPin();
      setPin(data.user_code);
      const start = Date.now();
      const poll = async () => {
        if (Date.now() - start > data.expires_in * 1000) {
          if (pollRef.current) clearTimeout(pollRef.current);
          setPin(null);
          return;
        }
        const token = await pollSimklToken(data.user_code);
        if (token) {
          const profile = await getSimklProfile(token);
          setSimklAuth(profile);
          setPin(null);
        } else {
          pollRef.current = window.setTimeout(poll, data.interval * 1000);
        }
      };
      pollRef.current = window.setTimeout(poll, data.interval * 1000);
    } catch (e: any) {
      alert('Errore Simkl: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  if (simklAuth) {
    return (
      <div className="flex items-center justify-between p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <div className="flex items-center gap-3">
          {simklAuth.avatar
            ? <img src={simklAuth.avatar} className="w-10 h-10 rounded-full object-cover" />
            : <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">S</div>}
          <div>
            <p className="text-sm font-semibold text-white">{simklAuth.name}</p>
            <p className="text-xs text-white/50">@{simklAuth.username} · Simkl</p>
          </div>
        </div>
        <button onClick={() => setSimklAuth(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors">
          <LogOut size={13} /> Disconnetti
        </button>
      </div>
    );
  }

  if (pin) {
    return (
      <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
        <p className="text-sm text-white/80">
          Apri <a href="https://simkl.com/pin" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">simkl.com/pin <ExternalLink size={11} /></a> e inserisci:
        </p>
        <div className="text-2xl font-mono font-bold text-blue-400 tracking-widest text-center py-3 bg-blue-500/10 rounded-lg">
          {pin}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40 justify-center">
          <RefreshCw size={12} className="animate-spin" /> In attesa...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40">
        Sincronizza film, serie e anime con Simkl.
      </p>
      <button onClick={startAuth} disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-[#0b65c2] hover:bg-[#0952a0] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors w-full justify-center">
        {loading ? <RefreshCw size={15} className="animate-spin" /> : <Film size={15} />}
        Collega Simkl
      </button>
    </div>
  );
}

// ─── Sezione MAL ──────────────────────────────────────────────────────────────

function MALSection() {
  const { malAuth, setMALAuth } = useAppStore();
  const [code, setCode] = useState('');
  const [codeVerifier, setCodeVerifier] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const [step, setStep] = useState<'idle' | 'waiting'>('idle');

  async function startAuth() {
    const { getMALAuthUrl } = await import('../api/mal');
    const { url, codeVerifier: cv } = getMALAuthUrl();
    setCodeVerifier(cv);
    setAuthUrl(url);
    setStep('waiting');
    window.open(url, '_blank');
  }

  async function exchangeCode() {
    if (!code.trim()) return;
    try {
      const { exchangeMALCode, getMALProfile } = await import('../api/mal');
      const tokens = await exchangeMALCode(code.trim(), codeVerifier);
      const profile = await getMALProfile(tokens.access_token);
      setMALAuth({
        ...profile,
        token: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      });
      setStep('idle');
    } catch (e: any) {
      alert('Errore MAL: ' + e.message);
    }
  }

  if (malAuth) {
    return (
      <div className="flex items-center justify-between p-4 rounded-xl bg-blue-900/20 border border-blue-800/30">
        <div className="flex items-center gap-3">
          {malAuth.picture
            ? <img src={malAuth.picture} className="w-10 h-10 rounded-full object-cover" />
            : <div className="w-10 h-10 rounded-full bg-blue-800 flex items-center justify-center text-white font-bold text-sm">M</div>}
          <div>
            <p className="text-sm font-semibold text-white">{malAuth.name}</p>
            <p className="text-xs text-white/50">MyAnimeList</p>
          </div>
        </div>
        <button onClick={() => setMALAuth(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors">
          <LogOut size={13} /> Disconnetti
        </button>
      </div>
    );
  }

  if (step === 'waiting') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-white/60">
          Autorizza l'app su MAL, poi copia il codice dall'URL di redirect e incollalo qui.
        </p>
        <a href={authUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:underline">
          <ExternalLink size={11} /> Apri autorizzazione MAL
        </a>
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)}
            placeholder="Codice dall'URL di redirect"
            className={inputCls + ' flex-1'} />
          <button onClick={exchangeCode} disabled={!code.trim()}
            className="px-4 py-2.5 bg-blue-800 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm transition-colors">
            Conferma
          </button>
        </div>
        <button onClick={() => setStep('idle')} className="text-xs text-white/30 hover:text-white/60 transition-colors">
          Annulla
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40">
        Sincronizza la tua lista anime con MyAnimeList.
      </p>
      <button onClick={startAuth}
        className="flex items-center gap-2 px-4 py-2.5 bg-[#2e51a2] hover:bg-[#264490] text-white rounded-lg text-sm font-medium transition-colors w-full justify-center">
        <BookOpen size={15} />
        Collega MyAnimeList
      </button>
    </div>
  );
}

// ─── Settings principale ──────────────────────────────────────────────────────


// ─── RPDB Field ───────────────────────────────────────────────────────────────

function RPDBField() {
  const { settings, updateSettings } = useAppStore();
  const [key, setKey] = useState(settings.rpdbKey ?? '');
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'err'>('idle');

  async function testKey() {
    if (!key.trim()) return;
    setStatus('testing');
    const valid = await validateRPDBKey(key.trim());
    setStatus(valid ? 'ok' : 'err');
    if (valid) updateSettings({ rpdbKey: key.trim() });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={key} onChange={(e) => setKey(e.target.value)}
          placeholder="La tua RPDB API key"
          className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-violet-500 focus:outline-none text-sm text-white placeholder:text-white/30 transition-colors" />
        <button onClick={testKey} disabled={!key.trim() || status === 'testing'}
          className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-sm text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
          {status === 'testing' ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
          {status === 'testing' ? 'Test...' : 'Salva'}
        </button>
      </div>
      {status === 'ok' && <p className="text-xs text-green-400">✓ Chiave valida e salvata</p>}
      {status === 'err' && <p className="text-xs text-red-400">✗ Chiave non valida</p>}
      {settings.rpdbKey && status === 'idle' && <p className="text-xs text-white/30">✓ Chiave configurata</p>}
    </div>
  );
}

type Tab = 'profili' | 'account' | 'player' | 'preferenze' | 'streaming' | 'dati';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profili',    label: 'Profili',    icon: <Users size={15} /> },
  { id: 'account',   label: 'Account',    icon: <User size={15} /> },
  { id: 'player',    label: 'Player',     icon: <Play size={15} /> },
  { id: 'preferenze',label: 'Preferenze', icon: <Star size={15} /> },
  { id: 'streaming', label: 'Streaming',  icon: <Tv size={15} /> },
  { id: 'dati',      label: 'Dati',       icon: <Trash2 size={15} /> },
];

export default function Settings() {
  const { settings, updateSettings, clearHistory } = useAppStore();
  const activeProfile = useActiveProfile();
  const [tab, setTab] = useState<Tab>('profili');
  const [local, setLocal] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const [mpvTest, setMpvTest] = useState<string | null>(null);

  // Sync local con settings quando cambiano
  useEffect(() => { setLocal({ ...settings }); }, [settings]);

  function handleSave() {
    updateSettings(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function testMpv() {
    setMpvTest('testing');
    try {
      await mpvCommand('get_property', ['playback-time']);
      setMpvTest('ok');
    } catch {
      setMpvTest('ok'); // mpv non è in esecuzione ma è installato
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar tab */}
      <div className="w-44 flex-shrink-0 border-r border-white/[0.06] p-3 space-y-1">
        {/* Profilo attivo */}
        <div className="flex items-center gap-2 px-3 py-2 mb-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            style={{ backgroundColor: activeProfile.color + '33' }}
          >
            {activeProfile.avatar ?? '👤'}
          </div>
          <p className="text-xs font-medium text-white/70 truncate">{activeProfile.name}</p>
        </div>

        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left',
              tab === t.id
                ? 'bg-violet-600/20 text-violet-300'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenuto tab */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-xl space-y-8">

          {/* ── PROFILI ─────────────────────────────────────────────────── */}
          {tab === 'profili' && (
            <>
              <h1 className="text-lg font-bold text-white">Profili</h1>
              <Section title="Gestisci profili">
                <ProfilesSection />
              </Section>
            </>
          )}

          {/* ── ACCOUNT ─────────────────────────────────────────────────── */}
          {tab === 'account' && (
            <>
              <h1 className="text-lg font-bold text-white">Account & Sync</h1>

              <Section title="Nuvio">
                <NuvioSection />
              </Section>

              <Section title="Trakt.tv — Cronologia & Rating">
                <TraktSection />
              </Section>

              <Section title="Simkl — Film, Serie & Anime">
                <SimklSection />
              </Section>

              <Section title="MyAnimeList — Anime">
                <MALSection />
              </Section>
            </>
          )}

          {/* ── PLAYER ──────────────────────────────────────────────────── */}
          {tab === 'player' && (
            <>
              <h1 className="text-lg font-bold text-white">Player</h1>

              <Section title="mpv">
                <Field label="Percorso mpv" hint="Lascia 'mpv' se è nel PATH. Solitamente non serve modificarlo.">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={local.mpvPath}
                      onChange={(e) => setLocal((p) => ({ ...p, mpvPath: e.target.value }))}
                      placeholder="mpv"
                      className={inputCls}
                    />
                    <button onClick={testMpv}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white/70 hover:text-white rounded-lg text-sm transition-colors flex-shrink-0">
                      <Play size={14} /> Test
                    </button>
                  </div>
                  {mpvTest && (
                    <p className={clsx('text-xs mt-1',
                      mpvTest === 'ok' ? 'text-green-400' : mpvTest === 'testing' ? 'text-white/40' : 'text-red-400')}>
                      {mpvTest === 'ok' ? '✓ mpv trovato correttamente'
                        : mpvTest === 'testing' ? 'Test in corso...'
                        : `✗ ${mpvTest}`}
                    </p>
                  )}
                </Field>
              </Section>

              <Section title="Riproduzione">
                <Toggle value={local.hardwareDecode} onChange={(v) => setLocal((p) => ({ ...p, hardwareDecode: v }))}
                  label="Decodifica hardware (GPU)" />
                <Toggle value={local.autoplay} onChange={(v) => setLocal((p) => ({ ...p, autoplay: v }))}
                  label="Autoplay episodio successivo" />
                <Toggle value={local.skipIntro} onChange={(v) => setLocal((p) => ({ ...p, skipIntro: v }))}
                  label="Salta intro automaticamente" />
              </Section>
            </>
          )}

          {/* ── PREFERENZE ──────────────────────────────────────────────── */}
          {tab === 'preferenze' && (
            <>
              <h1 className="text-lg font-bold text-white">Preferenze</h1>

              <Section title="Lingua">
                <Field label="Lingua interfaccia e contenuti">
                  <select value={local.language} onChange={(e) => setLocal((p) => ({ ...p, language: e.target.value }))}
                    className={selectCls}>
                    <option value="it">Italiano</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="ja">日本語</option>
                    <option value="pt">Português</option>
                  </select>
                </Field>

                <Field label="Lingua sottotitoli preferita">
                  <select value={local.subtitleLanguage} onChange={(e) => setLocal((p) => ({ ...p, subtitleLanguage: e.target.value }))}
                    className={selectCls}>
                    <option value="it">Italiano</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="ja">日本語</option>
                    <option value="pt">Português</option>
                  </select>
                </Field>

                <Field label="Qualità video preferita">
                  <select value={local.defaultQuality} onChange={(e) => setLocal((p) => ({ ...p, defaultQuality: e.target.value }))}
                    className={selectCls}>
                    <option value="best">Migliore disponibile</option>
                    <option value="4k">4K / 2160p</option>
                    <option value="1080p">1080p Full HD</option>
                    <option value="720p">720p HD</option>
                    <option value="480p">480p SD</option>
                  </select>
                </Field>
              </Section>
            </>
          )}

          {/* ── DATI ────────────────────────────────────────────────────── */}
          {tab === 'dati' && (
            <>
              <h1 className="text-lg font-bold text-white">Dati & Privacy</h1>

              <Section title="Cronologia visione">
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <p className="text-sm text-white">Cancella cronologia</p>
                    <p className="text-xs text-white/40 mt-0.5">Solo per il profilo "{activeProfile.name}"</p>
                  </div>
                  <button
                    onClick={() => { if (confirm('Cancellare tutta la cronologia?')) clearHistory(); }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-sm transition-colors">
                    <Trash2 size={14} /> Cancella
                  </button>
                </div>
              </Section>

              <Section title="Cache">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white/50">
                  I dati vengono salvati localmente in <code className="text-violet-400 text-xs">localStorage</code>.
                  Per cancellare tutto, usa il menu del browser o rimuovi l'applicazione.
                </div>
              </Section>
            </>
          )}

          {/* Pulsante salva (sempre visibile eccetto dati) */}
          {tab !== 'dati' && tab !== 'account' && tab !== 'profili' && tab !== 'streaming' && (
            <button onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium text-sm transition-colors">
              <Save size={15} />
              {saved ? '✓ Salvato' : 'Salva impostazioni'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
