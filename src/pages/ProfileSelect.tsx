/// <reference types="vite/client" />
import { useState, useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import { Profile } from '../lib/types';
import { Plus, Lock, Pencil, X, QrCode, RefreshCw, Check, Shield, Loader2 } from 'lucide-react';
import { getAvatarCatalog, type SupabaseAvatar, nuvioLogin, setAuthToken } from '../api/nuvio';
import clsx from 'clsx';
import { useT } from '../lib/i18n';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

// ─── Fallback DiceBear se Supabase non disponibile ────────────────────────────
const DICEBEAR_FALLBACK = [
  // Anime
  { id: 'a1', label: 'Goku',       url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=goku&eyes=variant01&hair=short01&hairColor=black', category: 'Anime' },
  { id: 'a2', label: 'Naruto',     url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=naruto&eyes=variant02&hair=short02&hairColor=blonde', category: 'Anime' },
  { id: 'a3', label: 'Levi',       url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=levi&eyes=variant03&hair=short03&hairColor=black', category: 'Anime' },
  { id: 'a4', label: 'Zero Two',   url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=zerotwo&eyes=variant04&hair=long01&hairColor=pink', category: 'Anime' },
  { id: 'a5', label: 'Mikasa',     url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=mikasa&eyes=variant05&hair=short05&hairColor=black', category: 'Anime' },
  { id: 'a6', label: 'Ichigo',     url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=ichigo&eyes=variant06&hair=medium01&hairColor=orange', category: 'Anime' },
  { id: 'a7', label: 'Sasuke',     url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=sasuke&eyes=variant07&hair=short06&hairColor=black', category: 'Anime' },
  { id: 'a8', label: 'Nezuko',     url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=nezuko&eyes=variant08&hair=long02&hairColor=black', category: 'Anime' },
  // TV
  { id: 't1', label: 'Jon Snow',   url: 'https://api.dicebear.com/9.x/personas/svg?seed=jonsnow&hair=short01&eyes=happy', category: 'TV' },
  { id: 't2', label: 'Walter',     url: 'https://api.dicebear.com/9.x/personas/svg?seed=walterwhite&hair=none&eyes=squint', category: 'TV' },
  { id: 't3', label: 'Eleven',     url: 'https://api.dicebear.com/9.x/personas/svg?seed=eleven&hair=short02&eyes=happy', category: 'TV' },
  { id: 't4', label: 'Tony Stark', url: 'https://api.dicebear.com/9.x/personas/svg?seed=tonystark&hair=short03&eyes=squint', category: 'TV' },
  { id: 't5', label: 'Daenerys',   url: 'https://api.dicebear.com/9.x/personas/svg?seed=daenerys&hair=long01&eyes=happy', category: 'TV' },
  { id: 't6', label: 'Sherlock',   url: 'https://api.dicebear.com/9.x/personas/svg?seed=sherlock&hair=short04&eyes=squint', category: 'TV' },
  // Gaming
  { id: 'g1', label: 'Kratos',     url: 'https://api.dicebear.com/9.x/personas/svg?seed=kratos&hair=none&eyes=squint', category: 'Gaming' },
  { id: 'g2', label: 'Geralt',     url: 'https://api.dicebear.com/9.x/personas/svg?seed=geralt&hair=long02&eyes=squint', category: 'Gaming' },
  { id: 'g3', label: 'Master Chief',url: 'https://api.dicebear.com/9.x/personas/svg?seed=masterchief&hair=short05&eyes=happy', category: 'Gaming' },
  { id: 'g4', label: 'Lara Croft', url: 'https://api.dicebear.com/9.x/personas/svg?seed=laracroft&hair=long03&eyes=happy', category: 'Gaming' },
  { id: 'g5', label: 'Arthur Morgan',url: 'https://api.dicebear.com/9.x/personas/svg?seed=arthurmorgon&hair=medium02&eyes=squint', category: 'Gaming' },
  { id: 'g6', label: 'Aloy',       url: 'https://api.dicebear.com/9.x/personas/svg?seed=aloy&hair=long04&eyes=happy', category: 'Gaming' },
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
  const { t } = useT();
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
    clearInterval(pollRef.current);
    try {
      // STEP 1: Ottieni un JWT anonimo VERO (auth.uid() deve essere non-null per la RPC)
      // L'anon key da sola NON basta - serve una sessione Supabase reale
      let anonJwt = useStore.getState().nuvioUser?.token ?? '';
      if (!anonJwt) {
        // Crea sessione anonima - prova signup anonimo prima
        for (const endpoint of ['/auth/v1/signup', '/auth/v1/token?grant_type=anonymous']) {
          try {
            const r = await fetch(`${SUPABASE_URL}${endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` },
              body: JSON.stringify({}),
            });
            if (r.ok) {
              const d = await r.json();
              const tok = d.access_token ?? d.session?.access_token;
              if (tok) { anonJwt = tok; break; }
            }
          } catch { }
        }
      }
      if (!anonJwt) { setStep('error'); return; }

      const deviceNonce = crypto.randomUUID();
      let sessionData: any = null;

      // STEP 2: Chiama start_tv_login_session con il JWT anonimo
      for (const body of [
        { p_device_nonce: deviceNonce, p_redirect_base_url: 'https://web.nuvioapp.space', p_device_name: 'Nuvio Desktop' },
        { p_device_nonce: deviceNonce, p_device_name: 'Nuvio Desktop' },
        { p_device_nonce: deviceNonce },
      ]) {
        try {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/start_tv_login_session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${anonJwt}` },
            body: JSON.stringify(body),
          });
          if (r.ok) {
            const data = await r.json();
            sessionData = Array.isArray(data) ? data[0] : data;
            if (sessionData?.code) break;
          } else {
            console.error('QR start failed:', await r.text());
          }
        } catch (e) { console.error('QR start error:', e); }
      }

      if (!sessionData?.code) { setStep('error'); return; }

      const qrCode = sessionData.code;
      const loginUrl = sessionData.qr_content ?? sessionData.web_url ?? `https://web.nuvioapp.space/tv-login?code=${qrCode}`;
      const qrImageUrl = sessionData.qr_image_url ?? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(loginUrl)}&size=220x220&bgcolor=141418&color=ffffff&margin=10`;
      const pollMs = Math.max(2000, (sessionData.poll_interval_seconds ?? 3) * 1000);

      setCode(qrCode); setWebUrl(loginUrl); setQrSvg(qrImageUrl); setStep('show');

      let pollCount = 0;
      pollRef.current = setInterval(async () => {
        pollCount++;
        if (pollCount > 100) { clearInterval(pollRef.current); setStep('error'); return; }
        try {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/poll_tv_login_session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${anonJwt}` },
            body: JSON.stringify({ p_code: qrCode, p_device_nonce: deviceNonce }),
          });
          if (!r.ok) return;
          const d = await r.json();
          const status = (Array.isArray(d) ? d[0] : d)?.status;
          if (status === 'approved') {
            clearInterval(pollRef.current);
            try {
              const exchR = await fetch(`${SUPABASE_URL}/functions/v1/tv-logins-exchange`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${anonJwt}` },
                body: JSON.stringify({ code: qrCode, device_nonce: deviceNonce }),
              });
              if (exchR.ok) { const res = await exchR.json(); const tok = res?.access_token ?? res?.session?.access_token; if (tok) { await finalizeLogin(tok); return; } }
            } catch { }
            const cR = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_tv_login_session`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${anonJwt}` },
              body: JSON.stringify({ p_code: qrCode, p_device_nonce: deviceNonce }),
            });
            if (cR.ok) { const cd = await cR.json(); const tok2 = (Array.isArray(cd) ? cd[0] : cd)?.access_token; if (tok2) { await finalizeLogin(tok2); return; } }
            setStep('error');
          } else if (status === 'expired') { clearInterval(pollRef.current); setStep('error'); }
        } catch { }
      }, pollMs);
    } catch { setStep('error'); }
  }

  async function finalizeLogin(accessToken: string) {
    setAuthToken(accessToken);
    try {
      const userR = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${accessToken}` } });
      const user = await userR.json();
      let name = user.email?.split('@')[0] ?? 'User';
      let avatar: string | undefined;
      try {
        const pR = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=name,avatar_id&user_id=eq.${user.id}&limit=1`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${accessToken}` } });
        const prof = (await pR.json())?.[0];
        if (prof?.name) name = prof.name;
        if (prof?.avatar_id) {
          const aR = await fetch(`${SUPABASE_URL}/rest/v1/avatar_catalog?select=storage_path&id=eq.${prof.avatar_id}&limit=1`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${accessToken}` } });
          const sp = (await aR.json())?.[0]?.storage_path;
          if (sp) avatar = `${SUPABASE_URL}/storage/v1/object/public/avatars/${sp}`;
        }
      } catch { }
      onSuccess({ id: user.id, email: user.email, token: accessToken, name, avatar });
    } catch { setStep('error'); }
  }


  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#141418] rounded-3xl p-8 w-full max-w-sm border border-white/[0.08] space-y-5 text-center">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{t('qr_login_title')}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/40"><X size={18} /></button>
        </div>
        {step === 'loading' && <div className="flex items-center justify-center h-40"><Loader2 size={28} className="animate-spin text-white/40" /></div>}
        {step === 'show' && (
          <>
            <p className="text-sm text-white/60">{t('qr_scan_hint')}</p>
            <div className="flex justify-center">
              <div className="w-48 h-48 rounded-2xl overflow-hidden border border-white/10">
                <img src={qrSvg} alt="QR Code" className="w-full h-full" />
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl px-4 py-3">
              <p className="text-xs text-white/40 mb-1">{t('qr_enter_code')}</p>
              <p className="text-3xl font-mono font-bold tracking-widest text-white">{code}</p>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-white/30">
              <RefreshCw size={11} className="animate-spin" />{t('qr_waiting')}
            </div>
          </>
        )}
        {step === 'error' && (
          <>
            <p className="text-sm text-red-400">{t('qr_error')}</p>
            <button onClick={startTvLogin} className="px-4 py-2 text-sm text-white rounded-full" style={{ backgroundColor: 'var(--accent)' }}>{t('retry')}</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── PIN Dialog ───────────────────────────────────────────────────────────────
function PinDialog({ profile, onSuccess, onCancel }: { profile: Profile; onSuccess: () => void; onCancel: () => void }) {
  const { t } = useT();
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
        <p className="text-sm text-white/40 flex items-center gap-1.5 justify-center"><Lock size={13} />{t('enter_pin')}</p>
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
        {error && <p className="text-red-400 text-sm">{t('pin_incorrect')}</p>}
        <button onClick={onCancel} className="text-xs text-white/30 hover:text-white">{t('cancel')}</button>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ profile, avatarCatalog, onClose }: { profile: Profile; avatarCatalog: AvatarItem[]; onClose: () => void }) {
  const { t } = useT();
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
            <p className="text-xs text-white/40 mb-0.5">{t('edit_profile')}</p>
            <h2 className="text-2xl font-bold text-white">{profile.name}</h2>
          </div>
          <button onClick={save} className="px-6 py-2.5 bg-white text-black font-semibold rounded-full text-sm hover:bg-white/90">{t('save')}</button>
        </div>
        <div className="flex gap-6 p-6">
          <div className="flex flex-col items-center gap-3 w-40 flex-shrink-0">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-[color:var(--accent,#7c3aed)]">
              <AvatarImg url={avatarUrl} label={name} size={112} />
            </div>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent)] focus:outline-none text-sm text-white text-center" />
            <button onClick={onClose} className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 text-sm">{t('cancel')}</button>
            {profile.id !== 'default' && (
              <button onClick={() => { if (confirm(t('confirm_delete'))) { removeProfile(profile.id); onClose(); } }}
                className="text-xs text-red-400 hover:text-red-300">🗑️ {t('delete')}</button>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">{t('choose_avatar')}</p>
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
                  <div><p className="text-sm text-white">{t('kids_profile')}</p><p className="text-xs text-white/30">{t('filters_adult_content')}</p></div>
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
  const { t } = useT();
  const { profiles, setActiveProfile, setProfileSelected, addProfile, setNuvioUser } = useStore();
  const [pinProfile, setPinProfile] = useState<Profile | null>(null);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [newName, setNewName] = useState('');
  const [avatarCatalog, setAvatarCatalog] = useState<AvatarItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // Carica avatar: mostra subito i DiceBear, poi sovrascrive con Supabase
  useEffect(() => {
    setAvatarCatalog(DICEBEAR_FALLBACK); // mostra subito
    getAvatarCatalog()
      .then(remote => {
        if (remote.length > 0) {
          // Combina Supabase + DiceBear
          const supabaseItems = remote.map(a => ({
            id: String(a.id),
            label: a.display_name,
            url: a.storage_path?.startsWith('http')
              ? a.storage_path
              : `https://dpyhjjcoabcglfmgecug.supabase.co/storage/v1/object/public/avatars/${a.storage_path}`,
            category: a.category ?? 'Nuvio',
          }));
          setAvatarCatalog([...supabaseItems, ...DICEBEAR_FALLBACK]);
        }
        // else keep DICEBEAR_FALLBACK already set
      })
      .catch(() => { /* mantieni DICEBEAR_FALLBACK */ })
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
      <h1 className="text-3xl font-bold text-white mb-2">{editMode ? t('manage_profiles') : t('who_is_watching')}</h1>
      <p className="text-white/30 text-sm mb-12">{editMode ? t('tap_to_edit') : t('select_profile')}</p>

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
            <p className="text-base text-white/30 group-hover:text-white/60 font-medium">{t('add')}</p>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => setEditMode(v => !v)}
          className="px-6 py-2.5 rounded-full text-sm font-medium border border-white/10 text-white/40 hover:text-white/70 hover:border-white/25 transition-colors">
          {editMode ? `✓ ${t('done')}` : t('manage_profiles')}
        </button>
        <button onClick={() => setShowQR(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border border-white/10 text-white/40 hover:text-white/70 hover:border-white/25 transition-colors">
          <QrCode size={15} />{t('qr_login')}
        </button>
      </div>

      {/* Aggiungi profilo modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#141418] rounded-3xl p-6 w-full max-w-sm border border-white/[0.08] space-y-4">
            <h2 className="text-lg font-bold text-white">{t('new_profile')}</h2>
            <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus placeholder={t('profile_name')}
              className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/[0.08] focus:border-[color:var(--accent)] focus:outline-none text-white text-sm" />
            <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto">
              {(catalogLoading ? DICEBEAR_FALLBACK : avatarCatalog).slice(0, 24).map(av => (
                <button key={av.id} className="w-12 h-12 rounded-full overflow-hidden border-2 border-transparent hover:border-white hover:scale-105 transition-all">
                  <AvatarImg url={av.url} label={av.label} size={48} />
                </button>
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowAdd(false); setNewName(''); }} className="px-5 py-2.5 text-sm text-white/50 bg-white/5 rounded-2xl">{t('cancel')}</button>
              <button onClick={() => { if (!newName.trim()) return; addProfile({ name: newName.trim(), avatar: defaultAvatar?.id ?? 'f_goku', avatarUrl: defaultAvatar?.url, color: '#7c3aed', isKids: false }); setShowAdd(false); setNewName(''); }}
                disabled={!newName.trim()} className="px-5 py-2.5 text-sm text-white rounded-2xl disabled:opacity-40" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
                {t('create')}
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
