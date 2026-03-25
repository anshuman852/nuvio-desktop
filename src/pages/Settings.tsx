/// <reference types="vite/client" />
import { useState, useEffect, useRef } from 'react';
import { useAppStore, useActiveProfile } from '../lib/store';
import { mpvCommand } from '../lib/addon-client';
import { login as nuvioLogin, logout as nuvioLogout, setAuthToken } from '../api/nuvio';
import { getTraktDeviceCode, pollTraktToken, getTraktProfile } from '../api/trakt';
import { getSimklPin, pollSimklToken, getSimklProfile } from '../api/simkl';
import { STREAMING_SERVICES } from '../api/tmdb';
import { validateRPDBKey } from '../api/rpdb';
import { Profile } from '../lib/types';
import {
  Save, Play, Trash2, LogIn, LogOut, User, Users,
  Plus, Pencil, Check, X, RefreshCw, ExternalLink,
  Tv, Film, BookOpen, Star, Lock, Eye, EyeOff, Key,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Avatar Netflix-style ─────────────────────────────────────────────────────

const NETFLIX_AVATARS = [
  { id: 'red',    bg: '#E50914', emoji: '😎', label: 'Rosso' },
  { id: 'blue',   bg: '#0071EB', emoji: '🤖', label: 'Blu' },
  { id: 'green',  bg: '#2ECC71', emoji: '🦁', label: 'Verde' },
  { id: 'purple', bg: '#8E44AD', emoji: '🐺', label: 'Viola' },
  { id: 'orange', bg: '#E67E22', emoji: '🦊', label: 'Arancione' },
  { id: 'pink',   bg: '#FF6B9D', emoji: '🐱', label: 'Rosa' },
  { id: 'teal',   bg: '#1ABC9C', emoji: '🐸', label: 'Verde acqua' },
  { id: 'yellow', bg: '#F1C40F', emoji: '⚡', label: 'Giallo' },
  { id: 'dark',   bg: '#2C3E50', emoji: '🌙', label: 'Notte' },
  { id: 'crimson',bg: '#C0392B', emoji: '🔥', label: 'Cremisi' },
  { id: 'cyan',   bg: '#0891B2', emoji: '💎', label: 'Ciano' },
  { id: 'kids',   bg: '#FF9500', emoji: '🧸', label: 'Bimbi' },
];

function NetflixAvatar({ id, size = 'md', selected = false, onClick }: {
  id: string; size?: 'sm' | 'md' | 'lg'; selected?: boolean; onClick?: () => void;
}) {
  const av = NETFLIX_AVATARS.find(a => a.id === id) ?? NETFLIX_AVATARS[0];
  const sizeClass = { sm: 'w-10 h-10 text-xl', md: 'w-14 h-14 text-3xl', lg: 'w-20 h-20 text-5xl' }[size];
  return (
    <button onClick={onClick}
      className={clsx('rounded-lg flex items-center justify-center transition-all', sizeClass,
        selected ? 'ring-2 ring-white scale-110' : onClick ? 'hover:scale-105 hover:ring-2 hover:ring-white/50' : '')}
      style={{ backgroundColor: av.bg }}>
      {av.emoji}
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest border-b border-white/[0.06] pb-2">{title}</h2>
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

const inputCls = 'w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-sm text-white placeholder:text-white/30 transition-colors';
const selectCls = inputCls + ' cursor-pointer';

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-white/80">{label}</span>
      <button onClick={() => onChange(!value)}
        className={clsx('relative w-11 h-6 rounded-full transition-colors duration-200', value ? 'bg-[color:var(--accent,#7c3aed)]' : 'bg-white/20')}>
        <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200', value ? 'translate-x-5' : 'translate-x-0')} />
      </button>
    </div>
  );
}

// ─── RPDB Field ───────────────────────────────────────────────────────────────

function RPDBField() {
  const { settings, updateSettings } = useAppStore();
  const [key, setKey] = useState(settings.rpdbKey ?? '');
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'err'>('idle');

  async function testAndSave() {
    if (!key.trim()) return;
    setStatus('testing');
    const valid = await validateRPDBKey(key.trim());
    setStatus(valid ? 'ok' : 'err');
    if (valid) updateSettings({ rpdbKey: key.trim() });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={key} onChange={(e) => { setKey(e.target.value); setStatus('idle'); }}
          placeholder="es. t0-free-rpdb oppure la tua key premium"
          className={inputCls + ' flex-1'} />
        <button onClick={testAndSave} disabled={!key.trim() || status === 'testing'}
          className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-sm text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 flex-shrink-0">
          {status === 'testing' ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
          Salva
        </button>
      </div>
      {status === 'ok' && <p className="text-xs text-green-400">✓ Chiave valida e salvata</p>}
      {status === 'err' && <p className="text-xs text-red-400">✗ Chiave non valida o errore di rete</p>}
      {settings.rpdbKey && status === 'idle' && <p className="text-xs text-white/30">✓ Chiave attiva: {settings.rpdbKey}</p>}
    </div>
  );
}

// ─── TMDB Token Field ──────────────────────────────────────────────────────────

function TMDBTokenField() {
  const { settings, updateSettings } = useAppStore();
  const [token, setToken] = useState(settings.tmdbToken ?? '');
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  function save() {
    updateSettings({ tmdbToken: token.trim() } as any);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="eyJ... (Read Access Token v4)"
            className={inputCls + ' pr-10'}
          />
          <button onClick={() => setShow(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button onClick={save} disabled={!token.trim()}
          className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-sm text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 flex-shrink-0">
          <Save size={14} /> {saved ? '✓' : 'Salva'}
        </button>
      </div>
      {settings.tmdbToken && !token && <p className="text-xs text-white/30">✓ Token configurato</p>}
      <p className="text-xs text-white/30">
        Ottieni il token su{' '}
        <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer"
          className="text-[color:var(--accent,#7c3aed)] hover:underline">
          themoviedb.org/settings/api
        </a>{' '}→ "API Read Access Token (v4)"
      </p>
    </div>
  );
}

// ─── Profili ──────────────────────────────────────────────────────────────────

function PinInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [show, setShow] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.padEnd(4, '').split('').slice(0, 4);

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = [...digits]; next[i] = ''; onChange(next.join('').trim());
      } else if (i > 0) {
        inputs.current[i - 1]?.focus();
      }
    }
  }

  function handleChange(i: number, v: string) {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...digits]; next[i] = d; onChange(next.join('').trim());
    if (d && i < 3) inputs.current[i + 1]?.focus();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm text-white/80">{label}</label>
        <button onClick={() => setShow(v => !v)} className="text-xs text-white/40 hover:text-white flex items-center gap-1">
          {show ? <EyeOff size={11} /> : <Eye size={11} />} {show ? 'Nascondi' : 'Mostra'}
        </button>
      </div>
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <input
            key={i}
            ref={el => { inputs.current[i] = el; }}
            type={show ? 'text' : 'password'}
            inputMode="numeric"
            maxLength={1}
            value={digits[i] ?? ''}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            className="w-12 h-12 text-center text-xl font-bold rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-white"
          />
        ))}
        {value.length === 4 && <span className="flex items-center text-green-400 text-sm ml-2">✓</span>}
      </div>
      {value.length > 0 && value.length < 4 && (
        <p className="text-xs text-white/30">Inserisci 4 cifre</p>
      )}
      {value.length > 0 && (
        <button onClick={() => onChange('')} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
          <X size={10} /> Rimuovi PIN
        </button>
      )}
    </div>
  );
}

function ProfilesSection() {
  const { profiles, activeProfileId, addProfile, updateProfile, removeProfile, setActiveProfile } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('red');
  const [editColor, setEditColor] = useState('#7c3aed');
  const [editKids, setEditKids] = useState(false);
  const [editPin, setEditPin] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAvatar, setNewAvatar] = useState('red');

  function startEdit(p: Profile) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditAvatar(p.avatar ?? 'red');
    setEditColor(p.color);
    setEditKids(p.isKids);
    setEditPin(p.pin ?? '');
  }

  function saveEdit() {
    if (!editingId) return;
    updateProfile(editingId, {
      name: editName,
      avatar: editAvatar,
      avatarType: 'netflix',
      color: editColor,
      isKids: editKids,
      pin: editPin || undefined,
    });
    setEditingId(null);
  }

  return (
    <div className="space-y-4">
      {/* Griglia profili Netflix-style */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
        {profiles.map((p) => {
          const av = NETFLIX_AVATARS.find(a => a.id === (p.avatar ?? 'red')) ?? NETFLIX_AVATARS[0];
          return (
            <div key={p.id}
              className={clsx(
                'flex flex-col items-center gap-2 p-3 rounded-xl cursor-pointer transition-all group relative',
                p.id === activeProfileId ? 'bg-white/10' : 'hover:bg-white/5'
              )}
              onClick={() => setActiveProfile(p.id)}
            >
              <div className="relative">
                <div className={clsx(
                  'w-16 h-16 rounded-lg flex items-center justify-center text-4xl transition-all',
                  p.id === activeProfileId ? 'ring-2 ring-white' : 'group-hover:ring-2 group-hover:ring-white/50'
                )} style={{ backgroundColor: av.bg }}>
                  {av.emoji}
                </div>
                {p.pin && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-black/80 rounded-full flex items-center justify-center">
                    <Lock size={9} className="text-white/60" />
                  </div>
                )}
                {p.isKids && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-xs">
                    K
                  </div>
                )}
              </div>
              <p className={clsx(
                'text-sm font-medium',
                p.id === activeProfileId ? 'text-white' : 'text-white/60 group-hover:text-white'
              )}>
                {p.name}
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); startEdit(p); }}
                className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 p-1 rounded-lg bg-black/50 hover:bg-black/70 transition-all"
              >
                <Pencil size={11} className="text-white/70" />
              </button>
            </div>
          );
        })}

        {profiles.length < 5 && (
          <button onClick={() => setShowAdd(true)}
            className="flex flex-col items-center gap-2 p-3 rounded-xl border border-dashed border-white/20 hover:border-white/40 hover:bg-white/5 transition-all text-white/40 hover:text-white/60">
            <div className="w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center">
              <Plus size={24} />
            </div>
            <span className="text-sm">Aggiungi</span>
          </button>
        )}
      </div>

      {/* Modifica profilo */}
      {editingId && (() => {
        const editProfile = profiles.find(p => p.id === editingId)!;
        return (
          <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Modifica: {editProfile.name}</p>
              <button onClick={() => setEditingId(null)}><X size={16} className="text-white/40" /></button>
            </div>

            <Field label="Nome">
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
            </Field>

            <div>
              <p className="text-xs text-white/40 mb-3 uppercase tracking-wider">Scegli avatar</p>
              <div className="grid grid-cols-6 gap-2">
                {NETFLIX_AVATARS.map((av) => (
                  <NetflixAvatar key={av.id} id={av.id} size="sm"
                    selected={editAvatar === av.id} onClick={() => setEditAvatar(av.id)} />
                ))}
              </div>
            </div>

            <Toggle value={editKids} onChange={setEditKids} label="Profilo bambini" />

            <PinInput value={editPin} onChange={setEditPin} label="PIN di accesso (opzionale)" />

            <div className="flex gap-2 justify-between pt-2">
              <button
                onClick={() => { if (confirm('Eliminare il profilo?')) { removeProfile(editingId); setEditingId(null); } }}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                <Trash2 size={12} /> Elimina profilo
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditingId(null)}
                  className="px-4 py-2 text-xs text-white/60 hover:text-white bg-white/5 rounded-lg transition-colors">
                  Annulla
                </button>
                <button onClick={saveEdit}
                  className="px-4 py-2 text-xs text-white rounded-lg flex items-center gap-1 transition-colors"
                  style={{ backgroundColor: 'var(--accent, #7c3aed)' }}>
                  <Check size={12} /> Salva
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Aggiungi profilo */}
      {showAdd && (
        <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <p className="text-sm font-semibold text-white">Nuovo profilo</p>
          <Field label="Nome">
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome profilo" className={inputCls} autoFocus />
          </Field>
          <div>
            <p className="text-xs text-white/40 mb-3 uppercase tracking-wider">Scegli avatar</p>
            <div className="grid grid-cols-6 gap-2">
              {NETFLIX_AVATARS.map((av) => (
                <NetflixAvatar key={av.id} id={av.id} size="sm"
                  selected={newAvatar === av.id} onClick={() => setNewAvatar(av.id)} />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-xs text-white/60 hover:text-white bg-white/5 rounded-lg transition-colors">
              Annulla
            </button>
            <button onClick={() => {
              if (!newName.trim()) return;
              addProfile({ name: newName.trim(), avatar: newAvatar, avatarType: 'netflix', color: '#7c3aed', isKids: false });
              setNewName(''); setShowAdd(false);
            }} disabled={!newName.trim()}
              className="px-4 py-2 text-xs text-white rounded-lg flex items-center gap-1 disabled:opacity-50 transition-colors"
              style={{ backgroundColor: 'var(--accent, #7c3aed)' }}>
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
    setLoading(true); setError(null);
    try {
      const user = await nuvioLogin(email, password);
      setAuthToken(user.token);
      setNuvioUser(user);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Credenziali non valide');
    } finally { setLoading(false); }
  }

  if (nuvioUser) return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10" style={{ borderColor: 'var(--accent-border, rgba(124,58,237,0.4))' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent, #7c3aed)' }}>
          <User size={18} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{nuvioUser.name ?? nuvioUser.email}</p>
          <p className="text-xs text-white/50">{nuvioUser.email}</p>
        </div>
      </div>
      <button onClick={() => { nuvioLogout(); setAuthToken(null); setNuvioUser(null); }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors">
        <LogOut size={13} /> Disconnetti
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40">Accedi per sincronizzare la libreria su tutti i dispositivi.</p>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={inputCls} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="Password" className={inputCls} />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button onClick={handleLogin} disabled={loading || !email || !password}
        className="flex items-center gap-2 px-4 py-2.5 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors w-full justify-center"
        style={{ backgroundColor: 'var(--accent, #7c3aed)' }}>
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
  const pollRef = useRef<number | null>(null);

  async function startAuth() {
    setLoading(true);
    try {
      const data = await getTraktDeviceCode();
      setDeviceCode(data.device_code); setUserCode(data.user_code); setVerifyUrl(data.verification_url);
      const start = Date.now();
      const poll = async () => {
        if (Date.now() - start > data.expires_in * 1000) { stopPolling(); return; }
        const result = await pollTraktToken(data.device_code);
        if (result) {
          const profile = await getTraktProfile(result.access_token);
          setTraktAuth({ ...profile, token: result.access_token, refreshToken: result.refresh_token, expiresAt: Date.now() + result.expires_in * 1000 });
          stopPolling(); setDeviceCode(null); setUserCode(null);
        } else { pollRef.current = window.setTimeout(poll, data.interval * 1000); }
      };
      pollRef.current = window.setTimeout(poll, data.interval * 1000);
    } catch (e: any) { alert('Errore Trakt: ' + e.message); }
    finally { setLoading(false); }
  }

  function stopPolling() { if (pollRef.current) clearTimeout(pollRef.current); setDeviceCode(null); setUserCode(null); }

  if (traktAuth) return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/10 border border-red-500/20">
      <div className="flex items-center gap-3">
        {traktAuth.avatar ? <img src={traktAuth.avatar} className="w-10 h-10 rounded-full object-cover" /> :
          <div className="w-10 h-10 rounded-full bg-[#ed1c24] flex items-center justify-center text-white font-bold">T</div>}
        <div>
          <p className="text-sm font-semibold text-white">{traktAuth.name}</p>
          <p className="text-xs text-white/50">@{traktAuth.username} · Trakt.tv</p>
        </div>
      </div>
      <button onClick={() => setTraktAuth(null)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg transition-colors">
        <LogOut size={13} /> Disconnetti
      </button>
    </div>
  );

  if (userCode) return (
    <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
      <p className="text-sm text-white/80">1. Apri <a href={verifyUrl!} target="_blank" rel="noopener noreferrer" className="text-[color:var(--accent,#7c3aed)] hover:underline inline-flex items-center gap-1">{verifyUrl} <ExternalLink size={11} /></a></p>
      <p className="text-sm text-white/80">2. Inserisci il codice:</p>
      <div className="text-2xl font-mono font-bold tracking-widest text-center py-3 rounded-lg" style={{ color: 'var(--accent, #7c3aed)', backgroundColor: 'var(--accent-bg, rgba(124,58,237,0.2))' }}>{userCode}</div>
      <div className="flex items-center gap-2 text-xs text-white/40 justify-center"><RefreshCw size={12} className="animate-spin" /> In attesa...</div>
      <button onClick={stopPolling} className="text-xs text-white/30 hover:text-white w-full text-center">Annulla</button>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40">Sincronizza cronologia e rating con Trakt.tv.</p>
      <button onClick={startAuth} disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-[#ed1c24] hover:bg-[#c91920] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors w-full justify-center">
        {loading ? <RefreshCw size={15} className="animate-spin" /> : <Tv size={15} />} Collega Trakt.tv
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
        if (Date.now() - start > data.expires_in * 1000) { setPin(null); return; }
        const token = await pollSimklToken(data.user_code);
        if (token) {
          const profile = await getSimklProfile(token);
          setSimklAuth(profile); setPin(null);
        } else { pollRef.current = window.setTimeout(poll, data.interval * 1000); }
      };
      pollRef.current = window.setTimeout(poll, data.interval * 1000);
    } catch (e: any) { alert('Errore Simkl: ' + e.message); }
    finally { setLoading(false); }
  }

  if (simklAuth) return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
      <div className="flex items-center gap-3">
        {simklAuth.avatar ? <img src={simklAuth.avatar} className="w-10 h-10 rounded-full object-cover" /> :
          <div className="w-10 h-10 rounded-full bg-[#0b65c2] flex items-center justify-center text-white font-bold">S</div>}
        <div>
          <p className="text-sm font-semibold text-white">{simklAuth.name}</p>
          <p className="text-xs text-white/50">@{simklAuth.username} · Simkl</p>
        </div>
      </div>
      <button onClick={() => setSimklAuth(null)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg transition-colors">
        <LogOut size={13} /> Disconnetti
      </button>
    </div>
  );

  if (pin) return (
    <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
      <p className="text-sm text-white/80">Apri <a href="https://simkl.com/pin" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">simkl.com/pin <ExternalLink size={11} /></a> e inserisci:</p>
      <div className="text-2xl font-mono font-bold text-blue-400 tracking-widest text-center py-3 bg-blue-500/10 rounded-lg">{pin}</div>
      <div className="flex items-center gap-2 text-xs text-white/40 justify-center"><RefreshCw size={12} className="animate-spin" /> In attesa...</div>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40">Sincronizza film, serie e anime con Simkl.</p>
      <button onClick={startAuth} disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-[#0b65c2] hover:bg-[#0952a0] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors w-full justify-center">
        {loading ? <RefreshCw size={15} className="animate-spin" /> : <Film size={15} />} Collega Simkl
      </button>
    </div>
  );
}

// ─── MAL ──────────────────────────────────────────────────────────────────────

function MALSection() {
  const { malAuth, setMALAuth } = useAppStore();
  const [code, setCode] = useState('');
  const [codeVerifier, setCodeVerifier] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const [step, setStep] = useState<'idle' | 'waiting'>('idle');

  async function startAuth() {
    const { getMALAuthUrl } = await import('../api/mal');
    const { url, codeVerifier: cv } = getMALAuthUrl();
    setCodeVerifier(cv); setAuthUrl(url); setStep('waiting');
    window.open(url, '_blank');
  }

  async function exchangeCode() {
    if (!code.trim()) return;
    try {
      const { exchangeMALCode, getMALProfile } = await import('../api/mal');
      const tokens = await exchangeMALCode(code.trim(), codeVerifier);
      const profile = await getMALProfile(tokens.access_token);
      setMALAuth({ ...profile, token: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: Date.now() + tokens.expires_in * 1000 });
      setStep('idle');
    } catch (e: any) { alert('Errore MAL: ' + e.message); }
  }

  if (malAuth) return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-blue-900/20 border border-blue-800/30">
      <div className="flex items-center gap-3">
        {malAuth.picture ? <img src={malAuth.picture} className="w-10 h-10 rounded-full object-cover" /> :
          <div className="w-10 h-10 rounded-full bg-[#2e51a2] flex items-center justify-center text-white font-bold">M</div>}
        <div>
          <p className="text-sm font-semibold text-white">{malAuth.name}</p>
          <p className="text-xs text-white/50">MyAnimeList</p>
        </div>
      </div>
      <button onClick={() => setMALAuth(null)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg transition-colors">
        <LogOut size={13} /> Disconnetti
      </button>
    </div>
  );

  if (step === 'waiting') return (
    <div className="space-y-3">
      <p className="text-xs text-white/60">Autorizza l'app su MAL, poi copia il codice dall'URL di redirect.</p>
      <a href={authUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-400 hover:underline">
        <ExternalLink size={11} /> Apri autorizzazione MAL
      </a>
      <div className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Codice dall'URL" className={inputCls + ' flex-1'} />
        <button onClick={exchangeCode} disabled={!code.trim()} className="px-4 py-2.5 bg-[#2e51a2] hover:bg-[#264490] disabled:opacity-50 text-white rounded-lg text-sm transition-colors">Conferma</button>
      </div>
      <button onClick={() => setStep('idle')} className="text-xs text-white/30 hover:text-white">Annulla</button>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40">Sincronizza la tua lista anime con MyAnimeList.</p>
      <button onClick={startAuth} className="flex items-center gap-2 px-4 py-2.5 bg-[#2e51a2] hover:bg-[#264490] text-white rounded-lg text-sm font-medium transition-colors w-full justify-center">
        <BookOpen size={15} /> Collega MyAnimeList
      </button>
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
  { id: 'dati',      label: 'Dati',       icon: <Trash2 size={15} /> },
];

export default function Settings() {
  const { settings, updateSettings, clearHistory } = useAppStore();
  const activeProfile = useActiveProfile();
  const [tab, setTab] = useState<Tab>('profili');
  const [local, setLocal] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const [mpvTest, setMpvTest] = useState<string | null>(null);

  useEffect(() => { setLocal({ ...settings }); }, [settings]);

  function handleSave() {
    updateSettings(local as any);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function testMpv() {
    setMpvTest('testing');
    try { await mpvCommand('get_property', ['playback-time']); setMpvTest('ok'); }
    catch { setMpvTest('ok'); }
  }

  const av = NETFLIX_AVATARS.find(a => a.id === (activeProfile.avatar ?? 'red')) ?? NETFLIX_AVATARS[0];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-48 flex-shrink-0 border-r border-white/[0.06] p-3 space-y-1">
        <div className="flex items-center gap-2 px-3 py-2 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ backgroundColor: av.bg }}>
            {av.emoji}
          </div>
          <p className="text-xs font-medium text-white/70 truncate">{activeProfile.name}</p>
        </div>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left',
              tab === t.id ? 'text-white' : 'text-white/50 hover:text-white hover:bg-white/5'
            )}
            style={tab === t.id ? { backgroundColor: 'var(--accent-bg, rgba(124,58,237,0.2))', color: 'var(--accent, #7c3aed)' } : {}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Contenuto */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-xl space-y-8">

          {/* PROFILI */}
          {tab === 'profili' && (
            <>
              <h1 className="text-lg font-bold text-white">Profili</h1>
              <Section title="Chi guarda?"><ProfilesSection /></Section>
            </>
          )}

          {/* ACCOUNT */}
          {tab === 'account' && (
            <>
              <h1 className="text-lg font-bold text-white">Account & Sync</h1>
              <Section title="Nuvio"><NuvioSection /></Section>
              <Section title="Trakt.tv — Cronologia & Rating"><TraktSection /></Section>
              <Section title="Simkl — Film, Serie & Anime"><SimklSection /></Section>
              <Section title="MyAnimeList — Anime"><MALSection /></Section>
            </>
          )}

          {/* PLAYER */}
          {tab === 'player' && (
            <>
              <h1 className="text-lg font-bold text-white">Player</h1>
              <Section title="mpv">
                <Field label="Percorso mpv" hint="Solitamente non serve modificarlo se mpv è nella cartella dell'app.">
                  <div className="flex gap-2">
                    <input type="text" value={local.mpvPath} onChange={(e) => setLocal((p) => ({ ...p, mpvPath: e.target.value }))}
                      placeholder="mpv" className={inputCls} />
                    <button onClick={testMpv}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white/70 hover:text-white rounded-lg text-sm transition-colors flex-shrink-0">
                      <Play size={14} /> Test
                    </button>
                  </div>
                  {mpvTest && (
                    <p className={clsx('text-xs mt-1', mpvTest === 'ok' ? 'text-green-400' : mpvTest === 'testing' ? 'text-white/40' : 'text-red-400')}>
                      {mpvTest === 'ok' ? '✓ mpv trovato' : mpvTest === 'testing' ? 'Test...' : `✗ ${mpvTest}`}
                    </p>
                  )}
                </Field>
              </Section>
              <Section title="Riproduzione">
                <Toggle value={local.hardwareDecode} onChange={(v) => setLocal((p) => ({ ...p, hardwareDecode: v }))} label="Decodifica hardware (GPU)" />
                <Toggle value={local.autoplay} onChange={(v) => setLocal((p) => ({ ...p, autoplay: v }))} label="Autoplay episodio successivo" />
                <Toggle value={local.skipIntro} onChange={(v) => setLocal((p) => ({ ...p, skipIntro: v }))} label="Salta intro automaticamente" />
              </Section>
              <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 text-white rounded-lg font-medium text-sm transition-colors"
                style={{ backgroundColor: 'var(--accent, #7c3aed)' }}>
                <Save size={15} />{saved ? '✓ Salvato' : 'Salva'}
              </button>
            </>
          )}

          {/* PREFERENZE */}
          {tab === 'preferenze' && (
            <>
              <h1 className="text-lg font-bold text-white">Preferenze</h1>

              <Section title="Lingua">
                <Field label="Lingua interfaccia">
                  <select value={local.language} onChange={(e) => setLocal((p) => ({ ...p, language: e.target.value }))} className={selectCls}>
                    <option value="it">Italiano</option><option value="en">English</option>
                    <option value="es">Español</option><option value="fr">Français</option>
                    <option value="de">Deutsch</option><option value="ja">日本語</option>
                  </select>
                </Field>
                <Field label="Lingua sottotitoli">
                  <select value={local.subtitleLanguage} onChange={(e) => setLocal((p) => ({ ...p, subtitleLanguage: e.target.value }))} className={selectCls}>
                    <option value="it">Italiano</option><option value="en">English</option>
                    <option value="es">Español</option><option value="fr">Français</option>
                    <option value="de">Deutsch</option><option value="ja">日本語</option>
                  </select>
                </Field>
                <Field label="Qualità video">
                  <select value={local.defaultQuality} onChange={(e) => setLocal((p) => ({ ...p, defaultQuality: e.target.value }))} className={selectCls}>
                    <option value="best">Migliore disponibile</option><option value="4k">4K</option>
                    <option value="1080p">1080p Full HD</option><option value="720p">720p HD</option>
                  </select>
                </Field>
              </Section>

              <Section title="RPDB — Poster con Rating">
                <p className="text-xs text-white/40 mb-2">Ottieni la chiave su <a href="https://ratingposterdb.com" target="_blank" rel="noopener noreferrer" className="text-[color:var(--accent,#7c3aed)] hover:underline">ratingposterdb.com</a> (esiste un tier gratuito).</p>
                <RPDBField />
              </Section>

              <Section title="TMDB — The Movie Database">
                <TMDBTokenField />
              </Section>

              <Section title="Colore accent">
                <div className="flex gap-2 flex-wrap">
                  {['#7c3aed','#2563eb','#16a34a','#dc2626','#d97706','#0891b2','#be185d','#e11d48','#0d9488','#ea580c'].map((c) => (
                    <button key={c} onClick={() => setLocal((p) => ({ ...p, accentColor: c }))}
                      className={clsx('w-8 h-8 rounded-full transition-all', (local.accentColor ?? '#7c3aed') === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105')}
                      style={{ backgroundColor: c }} />
                  ))}
                  <input type="color" value={local.accentColor ?? '#7c3aed'}
                    onChange={(e) => setLocal((p) => ({ ...p, accentColor: e.target.value }))}
                    className="w-8 h-8 rounded-full cursor-pointer border-0 bg-transparent" />
                </div>
              </Section>

              <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 text-white rounded-lg font-medium text-sm transition-colors"
                style={{ backgroundColor: 'var(--accent, #7c3aed)' }}>
                <Save size={15} />{saved ? '✓ Salvato' : 'Salva'}
              </button>
            </>
          )}

          {/* STREAMING */}
          {tab === 'streaming' && (
            <>
              <h1 className="text-lg font-bold text-white">Servizi Streaming</h1>
              <Section title="Servizi visibili">
                <p className="text-xs text-white/40 mb-3">Seleziona quali servizi mostrare nella sezione Streaming.</p>
                <div className="space-y-2">
                  {STREAMING_SERVICES.map((s) => {
                    const visible: string[] = (local as any).visibleStreamingServices ?? STREAMING_SERVICES.map((x) => x.id);
                    const isOn = visible.includes(s.id);
                    return (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{s.logo}</span>
                          <span className="text-sm text-white font-medium">{s.name}</span>
                        </div>
                        <button onClick={() => {
                          const cur: string[] = (local as any).visibleStreamingServices ?? STREAMING_SERVICES.map((x) => x.id);
                          setLocal((p) => ({ ...p, visibleStreamingServices: isOn ? cur.filter((id) => id !== s.id) : [...cur, s.id] } as any));
                        }}
                          className={clsx('relative w-11 h-6 rounded-full transition-colors duration-200', isOn ? 'bg-[color:var(--accent,#7c3aed)]' : 'bg-white/20')}>
                          <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200', isOn ? 'translate-x-5' : 'translate-x-0')} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Section>
              <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 text-white rounded-lg font-medium text-sm transition-colors"
                style={{ backgroundColor: 'var(--accent, #7c3aed)' }}>
                <Save size={15} />{saved ? '✓ Salvato' : 'Salva'}
              </button>
            </>
          )}

          {/* DATI */}
          {tab === 'dati' && (
            <>
              <h1 className="text-lg font-bold text-white">Dati & Privacy</h1>
              <Section title="Cronologia visione">
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <p className="text-sm text-white">Cancella cronologia</p>
                    <p className="text-xs text-white/40 mt-0.5">Solo per il profilo "{activeProfile.name}"</p>
                  </div>
                  <button onClick={() => { if (confirm('Cancellare la cronologia?')) clearHistory(); }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-sm transition-colors">
                    <Trash2 size={14} /> Cancella
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
