/// <reference types="vite/client" />
import { useState, useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import { Profile } from '../lib/types';
import { Plus, Lock, Pencil, X, QrCode, RefreshCw, Check, Shield, Loader2 } from 'lucide-react';
import { getAvatarCatalog, type SupabaseAvatar, nuvioLogin, setAuthToken } from '../api/nuvio';
import clsx from 'clsx';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

// ─── Fallback DiceBear se Supabase non disponibile ────────────────────────────
const DICEBEAR_FALLBACK = [
  { id: 'f_goku',    label: 'Goku',     url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=goku-warrior',    category: 'Anime' },
  { id: 'f_naruto',  label: 'Naruto',   url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=naruto-ninja',    category: 'Anime' },
  { id: 'f_levi',    label: 'Levi',     url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=levi-ackerman',   category: 'Anime' },
  { id: 'f_geralt',  label: 'Geralt',   url: 'https://api.dicebear.com/9.x/personas/svg?seed=geralt-witcher',    category: 'TV' },
  { id: 'f_jon',     label: 'Jon Snow', url: 'https://api.dicebear.com/9.x/personas/svg?seed=jon-got',           category: 'TV' },
  { id: 'f_kratos',  label: 'Kratos',   url: 'https://api.dicebear.com/9.x/personas/svg?seed=kratos-gow',        category: 'Gaming' },
];

type AvatarItem = { id: string; label: string; url: string; category: string };

function AvatarImg({ url, label, size = 64 }: { url: string; label: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (err || !url) {
    return (
      <div className="w-full h-full flex items-center justify-center font-bold text-white text-2xl rounded-full" style={{ background: 'var(--accent,#7c3aed)' }}>
        {label.charAt(0).toUpperCase()}
      </div>
    );
  }
  return <img src={url} alt={label} className="w-full h-full object-cover" onError={() => setErr(true)} loading="lazy" />;
}

// ─── QR Login ─────────────────────────────────────────────────────────────────
function QRLoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (user: any) => void }) {
  const [step, setStep] = useState<'loading' | 'show' | 'error'>('loading');
  const [code, setCode] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [qrSvg, setQrSvg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    startTvLogin();
    return () => clearInterval(pollRef.current);
  }, []);

  async function startTvLogin() {
    setStep('loading');
    try {
      // Chiama start_tv_login_session (RPC ufficiale dal schema)
      let sessionId: string;
      try {
        const startRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/start_tv_login_session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
          body: JSON.stringify({ p_device_name: 'Nuvio Desktop' }),
        });
        if (startRes.ok) {
          const data = await startRes.json();
          sessionId = data?.id ?? data?.session_id ?? crypto.randomUUID();
        } else {
          sessionId = crypto.randomUUID(); // fallback
        }
      } catch {
        sessionId = crypto.randomUUID();
      }
      const loginUrl = `https://web.nuvioapp.space/tv-login?session=${sessionId}&app=desktop`;
      setCode(sessionId.split('-')[0].toUpperCase());
      setWebUrl(loginUrl);

      // QR code
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(loginUrl)}&size=200x200&bgcolor=141418&color=ffffff&margin=8`;
      setQrSvg(qrUrl);
      setStep('show');

      // Poll usando RPC poll_tv_login_session (dal schema Supabase reale)
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        if (attempts > 80) { clearInterval(pollRef.current); setStep('error'); return; }

        try {
          // 1. Controlla stato sessione TV via RPC
          const pollRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/poll_tv_login_session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
            body: JSON.stringify({ p_session_id: sessionId }),
          });
          if (!pollRes.ok) return;
          const pollData = await pollRes.json();

          if (pollData?.status === 'approved' || pollData?.approved_user_id) {
            clearInterval(pollRef.current);
            // 2. Consuma la sessione per ottenere token
            const exchRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_tv_login_session`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
              body: JSON.stringify({ p_session_id: sessionId }),
            });
            if (!exchRes.ok) { setStep('error'); return; }
            const tokens = await exchRes.json();
            const accessToken = tokens?.access_token ?? tokens;
            if (!accessToken || typeof accessToken !== 'string') { setStep('error'); return; }
            setAuthToken(accessToken);
            const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
              headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${accessToken}` },
            });
            const user = await userRes.json();
            onSuccess({
              id: user.id, email: user.email, token: accessToken,
              name: user.user_metadata?.username ?? user.email?.split('@')[0],
              avatar: user.user_metadata?.avatar_url,
            });
          } else if (pollData?.status === 'expired') {
            clearInterval(pollRef.current);
            setStep('error');
          }
        } catch { /* continua polling */ }
      }, 3000);
    } catch {
      setStep('error');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#141418] rounded-3xl p-8 w-full max-w-sm border border-white/[0.08] space-y-5 text-center">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Accedi con QR</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/40"><X size={18} /></button>
        </div>
        {step === 'loading' && <div className="flex items-center justify-center h-40"><Loader2 size={28} className="animate-spin text-white/40" /></div>}
        {step === 'show' && (
          <>
            <p className="text-sm text-white/60">Scansiona con il telefono su <span className="text-[color:var(--accent)]">web.nuvioapp.space</span></p>
            <div className="flex justify-center">
              <div className="w-48 h-48 rounded-2xl overflow-hidden border border-white/10">
                <img src={qrSvg} alt="QR Code" className="w-full h-full" />
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl px-4 py-3">
              <p className="text-xs text-white/40 mb-1">Oppure vai su nuvioapp.space e inserisci:</p>
              <p className="text-3xl font-mono font-bold tracking-widest text-white">{code}</p>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-white/30">
              <RefreshCw size={11} className="animate-spin" />In attesa di autorizzazione...
            </div>
          </>
        )}
        {step === 'error' && (
          <>
            <p className="text-sm text-red-400">Codice scaduto o errore.</p>
            <button onClick={startTvLogin} className="px-4 py-2 text-sm text-white rounded-full" style={{ backgroundColor: 'var(--accent)' }}>Riprova</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── PIN Dialog ───────────────────────────────────────────────────────────────
function PinDialog({ profile, onSuccess, onCancel }: { profile: Profile; onSuccess: () => void; onCancel: () => void }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  function handleDigit(i: number, val: string) {
    const d = val.replace(/\D/g, '').slice(-1);
    const next = [...digits]; next[i] = d; setDigits(next); setError(false);
    if (d && i < 3) (document.getElementById(`pin-${i + 1}`) as HTMLInputElement)?.focus();
    if (d && i === 3) {
      setTimeout(() => {
        if ([...next.slice(0, 3), d].join('') === profile.pin) onSuccess();
        else { setError(true); setDigits(['', '', '', '']); (document.getElementById('pin-0') as HTMLInputElement)?.focus(); }
      }, 80);
    }
  }
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#141418] rounded-3xl p-8 w-full max-w-sm text-center space-y-6 border border-white/[0.08]">
        <div className="w-20 h-20 rounded-full overflow-hidden mx-auto"><AvatarImg url={profile.avatarUrl ?? ''} label={profile.name} size={80} /></div>
        <h2 className="text-xl font-bold text-white">{profile.name}</h2>
        <p className="text-sm text-white/40 flex items-center gap-1.5 justify-center"><Lock size={13} />Inserisci PIN</p>
        <div className="flex justify-center gap-3">
          {[0,1,2,3].map(i => (
            <input key={i} id={`pin-${i}`} type="password" inputMode="numeric" maxLength={1}
              value={digits[i]} autoFocus={i === 0}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => { if (e.key === 'Backspace' && !digits[i] && i > 0) (document.getElementById(`pin-${i-1}`) as HTMLInputElement)?.focus(); }}
              className={clsx('w-14 h-14 text-center text-2xl font-bold rounded-2xl border-2 bg-white/5 text-white focus:outline-none transition-all',
                error ? 'border-red-500' : digits[i] ? 'border-[color:var(--accent)]' : 'border-white/10 focus:border-white/30')} />
          ))}
        </div>
        {error && <p className="text-red-400 text-sm">PIN non corretto</p>}
        <button onClick={onCancel} className="text-xs text-white/30 hover:text-white">Annulla</button>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ profile, avatarCatalog, onClose }: { profile: Profile; avatarCatalog: AvatarItem[]; onClose: () => void }) {
  const { updateProfile, removeProfile } = useStore();
  const [name, setName] = useState(profile.name);
  const [avatarId, setAvatarId] = useState(profile.avatar ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? '');
  const [isKids, setIsKids] = useState(profile.isKids);
  const [category, setCategory] = useState('All');
  const categories = ['All', ...new Set(avatarCatalog.map(a => a.category))].filter(Boolean);

  const filtered = category === 'All' ? avatarCatalog : avatarCatalog.filter(a => a.category === category);

  function save() {
    updateProfile(profile.id, { name, avatar: avatarId, avatarUrl, isKids });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a1a1f] rounded-2xl w-full max-w-2xl border border-white/[0.08] my-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <p className="text-xs text-white/40 mb-0.5">Modifica profilo</p>
            <h2 className="text-2xl font-bold text-white">{profile.name}</h2>
          </div>
          <button onClick={save} className="px-6 py-2.5 bg-white text-black font-semibold rounded-full text-sm hover:bg-white/90">Salva</button>
        </div>
        <div className="flex gap-6 p-6">
          <div className="flex flex-col items-center gap-3 w-40 flex-shrink-0">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-[color:var(--accent,#7c3aed)]">
              <AvatarImg url={avatarUrl} label={name} size={112} />
            </div>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white text-center" />
            <button onClick={onClose} className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 text-sm">Annulla</button>
            {profile.id !== 'default' && (
              <button onClick={() => { if (confirm(`Eliminare "${profile.name}"?`)) { removeProfile(profile.id); onClose(); } }}
                className="text-xs text-red-400 hover:text-red-300">🗑️ Elimina</button>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Scegli Avatar</p>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {categories.map(cat => (
                <button key={cat} onClick={() => setCategory(cat)}
                  className={clsx('px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    category === cat ? 'bg-white text-black border-white' : 'border-white/20 text-white/50 hover:text-white')}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-6 gap-2 max-h-60 overflow-y-auto pr-1">
              {filtered.map(av => (
                <button key={av.id} onClick={() => { setAvatarId(av.id); setAvatarUrl(av.url); }} title={av.label}
                  className={clsx('w-14 h-14 rounded-full overflow-hidden border-2 transition-all hover:scale-105',
                    avatarId === av.id ? 'border-white scale-105' : 'border-transparent opacity-70 hover:opacity-100')}>
                  <AvatarImg url={av.url} label={av.label} size={56} />
                </button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-blue-400" />
                  <div><p className="text-sm text-white">Profilo bambini</p><p className="text-xs text-white/30">Filtra contenuti adulti</p></div>
                </div>
                <button onClick={() => setIsKids(v => !v)}
                  className={clsx('relative w-12 h-6 rounded-full transition-colors', isKids ? 'bg-blue-500' : 'bg-white/20')}>
                  <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', isKids ? 'translate-x-6' : '')} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ProfileSelect ────────────────────────────────────────────────────────────
export default function ProfileSelect() {
  const { profiles, setActiveProfile, setProfileSelected, addProfile, setNuvioUser } = useStore();
  const [pinProfile, setPinProfile] = useState<Profile | null>(null);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [newName, setNewName] = useState('');
  const [avatarCatalog, setAvatarCatalog] = useState<AvatarItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // Carica avatar da Supabase, fallback a DiceBear
  useEffect(() => {
    getAvatarCatalog()
      .then(remote => {
        if (remote.length > 0) {
          setAvatarCatalog(remote.map(a => ({ id: a.id, label: a.displayName, url: a.imageUrl, category: a.category })));
        } else {
          setAvatarCatalog(DICEBEAR_FALLBACK);
        }
      })
      .catch(() => setAvatarCatalog(DICEBEAR_FALLBACK))
      .finally(() => setCatalogLoading(false));
  }, []);

  function selectProfile(p: Profile) {
    if (editMode) { setEditProfile(p); return; }
    if (p.pin) { setPinProfile(p); return; }
    setActiveProfile(p.id); setProfileSelected(true);
  }

  const defaultAvatar = avatarCatalog[0];

  return (
    <div className="min-h-screen bg-[#0c0c10] flex flex-col items-center justify-center px-6 py-12">
      <div className="mb-10 flex items-center gap-3">
        <img src="/nuvio-icon.svg" alt="Nuvio" className="w-12 h-12" />
        <span className="text-3xl font-bold text-white">nuvio</span>
      </div>
      <h1 className="text-3xl font-bold text-white mb-2">{editMode ? 'Gestisci profili' : 'Chi guarda?'}</h1>
      <p className="text-white/30 text-sm mb-12">{editMode ? 'Tocca un profilo per modificarlo' : 'Seleziona il tuo profilo'}</p>

      <div className="flex flex-wrap justify-center gap-10 max-w-3xl mb-10">
        {profiles.map(p => (
          <button key={p.id} onClick={() => selectProfile(p)} className="flex flex-col items-center gap-3 group">
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden transition-all group-hover:ring-4 group-hover:ring-white group-hover:scale-105 shadow-2xl">
                <AvatarImg url={p.avatarUrl ?? ''} label={p.name} size={128} />
              </div>
              {p.pin && !editMode && <div className="absolute bottom-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center"><Lock size={11} className="text-white/70" /></div>}
              {p.isKids && <div className="absolute top-1 left-1 bg-blue-500 rounded-full px-1.5 py-0.5 text-xs font-bold text-white">K</div>}
              {editMode && <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Pencil size={28} className="text-white" /></div>}
            </div>
            <p className="text-base font-medium text-white/70 group-hover:text-white transition-colors">{p.name}</p>
          </button>
        ))}
        {profiles.length < 5 && !editMode && (
          <button onClick={() => setShowAdd(true)} className="flex flex-col items-center gap-3 group">
            <div className="w-32 h-32 rounded-full border-2 border-dashed border-white/15 flex items-center justify-center group-hover:border-white/40 group-hover:scale-105 transition-all">
              <Plus size={36} className="text-white/20 group-hover:text-white/50" />
            </div>
            <p className="text-base text-white/30 group-hover:text-white/60 font-medium">Aggiungi</p>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => setEditMode(v => !v)}
          className="px-6 py-2.5 rounded-full text-sm font-medium border border-white/10 text-white/40 hover:text-white/70 hover:border-white/25 transition-colors">
          {editMode ? '✓ Fine' : 'Gestisci profili'}
        </button>
        <button onClick={() => setShowQR(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border border-white/10 text-white/40 hover:text-white/70 hover:border-white/25 transition-colors">
          <QrCode size={15} />Login QR
        </button>
      </div>

      {/* Aggiungi profilo modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#141418] rounded-3xl p-6 w-full max-w-sm border border-white/[0.08] space-y-4">
            <h2 className="text-lg font-bold text-white">Nuovo profilo</h2>
            <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus placeholder="Nome profilo"
              className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/[0.08] focus:border-[color:var(--accent)] focus:outline-none text-white text-sm" />
            <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto">
              {(catalogLoading ? DICEBEAR_FALLBACK : avatarCatalog).slice(0, 24).map(av => (
                <button key={av.id} className="w-12 h-12 rounded-full overflow-hidden border-2 border-transparent hover:border-white hover:scale-105 transition-all">
                  <AvatarImg url={av.url} label={av.label} size={48} />
                </button>
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowAdd(false); setNewName(''); }} className="px-5 py-2.5 text-sm text-white/50 bg-white/5 rounded-2xl">Annulla</button>
              <button onClick={() => { if (!newName.trim()) return; addProfile({ name: newName.trim(), avatar: defaultAvatar?.id ?? 'f_goku', avatarUrl: defaultAvatar?.url, color: '#7c3aed', isKids: false }); setShowAdd(false); setNewName(''); }}
                disabled={!newName.trim()} className="px-5 py-2.5 text-sm text-white rounded-2xl disabled:opacity-40" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
                Crea
              </button>
            </div>
          </div>
        </div>
      )}

      {pinProfile && <PinDialog profile={pinProfile} onSuccess={() => { setActiveProfile(pinProfile.id); setProfileSelected(true); setPinProfile(null); }} onCancel={() => setPinProfile(null)} />}
      {editProfile && <EditModal profile={editProfile} avatarCatalog={avatarCatalog} onClose={() => setEditProfile(null)} />}
      {showQR && (
        <QRLoginModal
          onClose={() => setShowQR(false)}
          onSuccess={(user) => {
            setNuvioUser(user);
            setAuthToken(user.token);
            setShowQR(false);
          }}
        />
      )}
    </div>
  );
}
