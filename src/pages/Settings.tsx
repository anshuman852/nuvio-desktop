import React from 'react';
/// <reference types="vite/client" />
import { useState, useRef, useEffect } from 'react';
import { useStore } from '../lib/store';
import { openExternal } from '../api/stremio';
import { validateTMDBKey, STREAMING_SERVICES } from '../api/tmdb';
import { nuvioLogin, nuvioLogout, setAuthToken, getNuvioAddons, getContinueWatching, getAllWatchedItems, getAccountStats, getAvatarCatalog, type AccountStats, type SupabaseAvatar } from '../api/nuvio';
import { getTraktDeviceCode, pollTraktToken, getTraktProfile } from '../api/trakt';
import { getSimklPin, pollSimklToken, getSimklProfile } from '../api/simkl';
import {
  User, Users, Palette, Grid, Link2, Play, Info, ChevronRight, ChevronDown, ChevronUp,
  LogIn, LogOut, RefreshCw, ExternalLink, Save, Trash2, Key, AlertCircle,
  CheckCircle2, Shield, BookOpen, Tv, Film, Globe, Lock, Eye, EyeOff, X, Star,
  Download, Package, QrCode,
} from 'lucide-react';
import clsx from 'clsx';
import { useT } from '../lib/i18n';


const ic = 'w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/[0.08] focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-sm text-white placeholder:text-white/30 transition-colors';
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
        {open ? <ChevronUp size={16} className="text-white/30" /> : <ChevronDown size={16} className="text-white/30" />}
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

// ─── Account Page ─────────────────────────────────────────────────────────────

function AccountPage() {
  const { t } = useT();
  const { nuvioUser, setNuvioUser, addons, setAddons } = useStore();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [syncMsg, setSyncMsg] = useState<string|null>(null);
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<string | null>(null);
  const [qrPolling, setQrPolling] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const NUVIO_API_URL = 'https://web.nuvioapp.space';
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

  useEffect(() => {
    if (nuvioUser?.id) {
      getAccountStats(nuvioUser.id, nuvioUser.token).then(setStats).catch(() => {});
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [nuvioUser?.id]);

  const generateQRCode = async () => {
    setQrStatus(null);
    setQrCode(null);
    setQrSessionId(null);
    
    try {
      const response = await fetch(`${NUVIO_API_URL}/api/auth/qr/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceName: `Nuvio Desktop (${navigator.platform || 'Windows'})`,
          deviceId: `desktop_${Date.now()}`,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.sessionId && data.qrCode) {
          setQrSessionId(data.sessionId);
          setQrCode(data.qrCode);
          startPolling(data.sessionId);
          return;
        }
      }
      throw new Error('Risposta non valida');
    } catch (err) {
      console.error('QR generation error:', err);
      setQrCode(NUVIO_API_URL);
      setQrStatus('Apri il link sul telefono');
    }
  };

  const startPolling = (sessionId: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    setQrPolling(true);
    
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${NUVIO_API_URL}/api/auth/qr/status?sessionId=${sessionId}`);
        const data = await response.json();
        
        if (data.status === 'approved' && data.token) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          setQrStatus('✅ Accesso riuscito! Caricamento dati...');
          
          const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${data.token}`,
            },
          });
          const userData = await userResponse.json();
          
          if (userData.email) {
            const nuvioUserData = {
              id: userData.id,
              email: userData.email,
              token: data.token,
              name: userData.email?.split('@')[0] || 'User',
            };
            setAuthToken(data.token);
            setNuvioUser(nuvioUserData);
            setShowQR(false);
            setQrCode(null);
            setQrStatus(null);
            
            const s = await getAccountStats(userData.id, data.token);
            setStats(s);
          }
          setQrPolling(false);
        } else if (data.status === 'expired') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          setQrStatus('QR scaduto. Generane uno nuovo.');
          setQrPolling(false);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setQrPolling(false);
  };

  const resetQR = () => {
    stopPolling();
    setShowQR(false);
    setQrCode(null);
    setQrSessionId(null);
    setQrStatus(null);
  };

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
      const cloudAddons = await getNuvioAddons(nuvioUser.id, nuvioUser.token);
      if (cloudAddons.length > 0) {
        const cloudUrls = new Set(cloudAddons.map((a: any) =>
          (a.url ?? '').replace(/\/+$/, '').replace(/\/manifest\.json$/, '')
        ));
        const cloudIds = new Set(cloudAddons.map((a: any) => a.id));
        const localOnly = addons.filter((a: any) => {
          const normalUrl = (a.url ?? '').replace(/\/+$/, '').replace(/\/manifest\.json$/, '');
          return !cloudUrls.has(normalUrl) && !cloudIds.has(a.id);
        });
        setAddons([...localOnly, ...cloudAddons]);
      }
      const s = await getAccountStats(nuvioUser.id, nuvioUser.token);
      setStats(s);
      setSyncMsg('✓ Sync completato');
      setTimeout(() => setSyncMsg(null), 3000);
    } catch (e: any) { setSyncMsg(`Errore: ${e.message}`); }
    finally { setSyncing(false); }
  }

  if (nuvioUser) return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] overflow-hidden">
        <div className="p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-[color:var(--accent)] flex items-center justify-center flex-shrink-0">
            {nuvioUser.avatar ? <img src={nuvioUser.avatar} className="w-full h-full object-cover" alt={nuvioUser.name} /> : <User size={28} className="text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold text-white">{nuvioUser.name}</p>
            <p className="text-xs text-white/40 mt-0.5">{nuvioUser.email}</p>
            <p className="text-xs text-white/25 mt-0.5 font-mono">{nuvioUser.id?.slice(0,8)}…</p>
          </div>
        </div>
        {stats && (
          <div className="grid grid-cols-4 border-t border-white/[0.06]">
            {[
              { label: t('movies'), value: stats.totalMovies, icon: '🎬' },
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
            {t('sync_from_cloud')}
          </button>
          <button onClick={() => { nuvioLogout(); setAuthToken(null); setNuvioUser(null); }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 bg-red-500/10 rounded-xl">
            <LogOut size={14} />{t('logout')}
          </button>
        </div>
        {syncMsg && <p className="text-xs text-green-400 px-5 pb-3">{syncMsg}</p>}
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-5 space-y-3">
      <p className="text-base font-semibold text-white">{t('login')}</p>
      <p className="text-xs text-white/40">Sincronizza CW, libreria e addon con il tuo account Nuvio.</p>
      
      <div className="flex gap-3">
        <div className="flex-1">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('email')} className={ic} />
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} placeholder={t('password')} className={ic + ' mt-2'} />
        </div>
        <button 
          onClick={() => {
            resetQR();
            setShowQR(!showQR);
            if (!showQR) {
              setTimeout(generateQRCode, 100);
            }
          }}
          className="px-4 py-3 rounded-2xl bg-white/5 border border-white/[0.08] text-white/60 hover:text-white transition-colors"
          title="Accedi con QR Code"
        >
          <QrCode size={20} />
        </button>
      </div>
      
      {showQR && (
        <div className="flex flex-col items-center gap-3 py-4 border-t border-white/10 mt-2">
          {qrCode && (
            <>
              <div className="bg-white p-3 rounded-xl">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`}
                  alt="QR Code per login Nuvio"
                  className="w-48 h-48"
                />
              </div>
              <p className="text-xs text-white/40 text-center font-mono break-all">
                {qrCode.length > 50 ? qrCode.slice(0, 50) + '...' : qrCode}
              </p>
              {qrStatus && (
                <p className={`text-xs ${qrStatus.includes('Errore') || qrStatus.includes('scaduto') ? 'text-red-400' : 'text-green-400'} text-center`}>
                  {qrStatus}
                </p>
              )}
              {qrPolling && (
                <p className="text-xs text-white/40 animate-pulse">
                  In attesa della scansione...
                </p>
              )}
              <p className="text-xs text-white/40 text-center">
                Scansiona con l'app Nuvio mobile<br/>
                o apri <button onClick={() => openExternal(qrCode)} className="underline text-[color:var(--accent)]">web.nuvioapp.space</button>
              </p>
              <button 
                onClick={resetQR}
                className="text-xs text-white/50 hover:text-white"
              >
                {t('cancel')}
              </button>
            </>
          )}
          {!qrCode && (
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-white/40">Generazione QR Code...</p>
            </div>
          )}
        </div>
      )}
      
      {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
      <button onClick={login} disabled={loading || !email || !pw}
        className="w-full flex items-center gap-2 justify-center py-3 text-white rounded-2xl text-sm font-medium disabled:opacity-50"
        style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
        {loading ? <RefreshCw size={15} className="animate-spin" /> : <LogIn size={15} />}{t('login')}
      </button>
    </div>
  );
}

function ProfilesPage() {
  const { t } = useT();
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
                <p className="text-xs text-white/40">{p.isKids ? '🧸 ' + t('kids_profile') : t('profile')}{p.pin ? ' · 🔒 PIN' : ''}{p.id === activeProfileId ? ' · Attivo' : ''}</p>
              </div>
              <ChevronRight size={16} className="text-white/20" />
            </button>
          ))}
          {profiles.length < 5 && (
            <button onClick={() => addProfile({ name: `Profilo ${profiles.length + 1}`, avatar: 'default', color: '#7c3aed', isKids: false })}
              className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl border-2 border-dashed border-white/10 hover:border-white/25 transition-colors text-white/40 hover:text-white/60 text-sm">
              + {t('add_profile')}
            </button>
          )}
        </>
      ) : ep ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
            <button onClick={() => setEditId(null)} className="p-1.5 rounded-xl hover:bg-white/10 text-white/40 hover:text-white"><X size={18} /></button>
            <h3 className="text-lg font-bold text-white flex-1">{ep.name}</h3>
            <button onClick={() => setEditId(null)} className="px-5 py-2 bg-white text-black rounded-full text-sm font-semibold">{t('save')}</button>
          </div>
          <div className="flex gap-5">
            <div className="flex flex-col items-center gap-2 w-32 flex-shrink-0">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[color:var(--accent,#7c3aed)]"><AvatarImg url={ep.avatarUrl} label={ep.name} size={96} /></div>
              <input defaultValue={ep.name} onBlur={e => updateProfile(ep.id, { name: e.target.value })} className={ic + ' text-center text-xs py-2'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Avatar</p>
              <div className="bg-white/5 rounded-xl px-4 py-3 text-xs text-white/40">Modifica l'avatar dalla schermata principale Profili.</div>
            </div>
          </div>
          <Row title={t('kids_profile')} subtitle="Filtra contenuti per adulti">
            <Toggle value={ep.isKids} onChange={v => updateProfile(ep.id, { isKids: v })} />
          </Row>
          {ep.id !== 'default' && ep.id !== activeProfileId && (
            <button onClick={() => { if (confirm(`Eliminare il profilo "${ep.name}"?`)) { removeProfile(ep.id); setEditId(null); } }}
              className="w-full py-3 rounded-2xl text-red-400 bg-red-500/10 border border-red-500/20 text-sm font-medium">
              🗑️ {t('delete')}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function AspettoPage() {
  const { t } = useT();
  const { settings, updateSettings } = useStore();
  const colors = ['#7c3aed','#2563eb','#16a34a','#dc2626','#d97706','#0891b2','#be185d','#ea580c','#0d9488','#4f46e5','#db2777','#0284c7'];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-5 space-y-4">
        <p className="text-base font-semibold text-white">{t('accent_color')}</p>
        <div className="flex gap-3 flex-wrap">
          {colors.map(col => (
            <button key={col} onClick={() => updateSettings({ accentColor: col })}
              className={clsx('w-10 h-10 rounded-full transition-all hover:scale-110', settings.accentColor === col ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1e1e24] scale-110' : '')}
              style={{ backgroundColor: col }} />
          ))}
          <input type="color" value={settings.accentColor ?? '#7c3aed'} onChange={e => updateSettings({ accentColor: e.target.value })}
            className="w-10 h-10 rounded-full cursor-pointer border-0 bg-transparent p-0" />
        </div>
        <p className="text-xs text-white/30">Il colore viene applicato immediatamente.</p>
      </div>
    </div>
  );
}

function LayoutPage() {
  const { t } = useT();
  const { settings, updateSettings } = useStore();
  
  const T = ({ k, title, desc }: { k: string; title: string; desc: string }) => (
    <Row title={title} subtitle={desc}>
      <Toggle 
        value={!!(settings as any)[k]} 
        onChange={v => updateSettings({ [k]: v } as any)} 
      />
    </Row>
  );
  
  return (
    <div className="space-y-3">
      <T k="showHero" title={t('show_hero_section')} desc="Visualizza il carosello hero nella parte superiore" />
      <T k="reduceSidebar" title={t('reduce_sidebar')} desc="Comprimi la sidebar di default" />
      <T k="horizontalPosters" title={t('horizontal_posters')} desc="Passa tra schede verticali e orizzontali" />
      <T k="hideUnavailable" title={t('hide_unavailable')} desc="Nascondi film e serie non ancora pubblici" />
    </div>
  );
}

// ─── Streaming Services Page ─────────────────────────────────────────────────
function StreamingServicesPage() {
  const { t } = useT();
  const { settings, updateSettings, streamingCustomImages, setStreamingCustomImage } = useStore();
  const [editingService, setEditingService] = useState<string | null>(null);
  const [tempImageUrl, setTempImageUrl] = useState('');
  const [tempImageFile, setTempImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const streamingServices = settings.streamingServices || [];
  
  const getSetting = (serviceId: string) => {
    return streamingServices.find((s: any) => s.id === serviceId);
  };
  
  const toggleService = (serviceId: string) => {
    const current = getSetting(serviceId);
    const updated = current 
      ? { ...current, enabled: !current.enabled }
      : { id: serviceId, enabled: false };
    const newList = streamingServices.filter((s: any) => s.id !== serviceId);
    newList.push(updated);
    updateSettings({ streamingServices: newList });
  };
  
  const handleFileUpload = async (serviceId: string) => {
    if (!tempImageFile) return;
    
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setStreamingCustomImage(serviceId, base64String);
        
        const current = getSetting(serviceId);
        const updated = current 
          ? { ...current, customImage: base64String }
          : { id: serviceId, enabled: true, customImage: base64String };
        const newList = streamingServices.filter((s: any) => s.id !== serviceId);
        newList.push(updated);
        updateSettings({ streamingServices: newList });
        
        setEditingService(null);
        setTempImageFile(null);
      };
      reader.readAsDataURL(tempImageFile);
    } catch (err) {
      console.error('Errore caricamento immagine:', err);
    }
  };
  
  const handleUrlUpload = (serviceId: string) => {
    if (!tempImageUrl.trim()) return;
    setStreamingCustomImage(serviceId, tempImageUrl);
    
    const current = getSetting(serviceId);
    const updated = current 
      ? { ...current, customImage: tempImageUrl }
      : { id: serviceId, enabled: true, customImage: tempImageUrl };
    const newList = streamingServices.filter((s: any) => s.id !== serviceId);
    newList.push(updated);
    updateSettings({ streamingServices: newList });
    
    setEditingService(null);
    setTempImageUrl('');
  };
  
  const removeCustomImage = (serviceId: string) => {
    setStreamingCustomImage(serviceId, null);
    
    const current = getSetting(serviceId);
    if (current) {
      const updated = { ...current, customImage: undefined };
      const newList = streamingServices.filter((s: any) => s.id !== serviceId);
      newList.push(updated);
      updateSettings({ streamingServices: newList });
    }
    setEditingService(null);
  };
  
  const getCurrentImage = (serviceId: string) => {
    return streamingCustomImages[serviceId] || getSetting(serviceId)?.customImage;
  };
  
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-5 space-y-4">
        <p className="text-base font-semibold text-white flex items-center gap-2">
          <Tv size={18} /> {t('streaming_services')}
        </p>
        <p className="text-xs text-white/40">
          Seleziona quali servizi streaming mostrare nella Home e personalizza le loro immagini.
          Puoi caricare immagini JPG, PNG o GIF dal tuo computer o inserire un URL diretto.
        </p>
        
        <div className="space-y-3">
          {STREAMING_SERVICES.map(service => {
            const setting = getSetting(service.id);
            const enabled = setting ? setting.enabled : true;
            const customImage = getCurrentImage(service.id);
            const isEditing = editingService === service.id;
            
            return (
              <div key={service.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center">
                  {customImage ? (
                    <img src={customImage} alt={service.name} className="w-full h-full object-contain" />
                  ) : (
                    <img src={service.logo} alt={service.name} className="w-full h-full object-contain p-1" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{service.name}</p>
                  <p className="text-xs text-white/40">{service.id}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingService(service.id);
                      setTempImageUrl('');
                      setTempImageFile(null);
                    }}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                    title="Cambia immagine"
                  >
                    🖼️
                  </button>
                  <Toggle value={enabled} onChange={() => toggleService(service.id)} />
                </div>
                
                {isEditing && (
                  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-white">Modifica immagine: {service.name}</h3>
                        <button onClick={() => setEditingService(null)} className="text-white/40 hover:text-white"><X size={18} /></button>
                      </div>
                      
                      <div className="bg-white/5 rounded-xl p-4 flex justify-center">
                        <div className="w-32 h-20 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center">
                          {tempImageFile ? (
                            <img src={URL.createObjectURL(tempImageFile)} alt="Preview" className="w-full h-full object-contain" />
                          ) : tempImageUrl ? (
                            <img src={tempImageUrl} alt="Preview" className="w-full h-full object-contain" />
                          ) : customImage ? (
                            <img src={customImage} alt={service.name} className="w-full h-full object-contain" />
                          ) : (
                            <img src={service.logo} alt={service.name} className="w-full h-full object-contain p-2" />
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-xs text-white/40 mb-1.5 block">Carica dal computer</label>
                        <div className="flex gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setTempImageFile(e.target.files[0]);
                                setTempImageUrl('');
                              }
                            }}
                            className="hidden"
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm text-white transition-colors"
                          >
                            📁 Scegli file
                          </button>
                          {tempImageFile && (
                            <button
                              onClick={() => handleFileUpload(service.id)}
                              className="px-4 py-2 text-white rounded-xl text-sm"
                              style={{ backgroundColor: 'var(--accent)' }}
                            >
                              Carica
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-xs text-white/40 mb-1.5 block">URL immagine (jpg, png, gif)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={tempImageUrl}
                            onChange={e => {
                              setTempImageUrl(e.target.value);
                              setTempImageFile(null);
                            }}
                            placeholder="https://esempio.com/immagine.png"
                            className={ic}
                          />
                          {tempImageUrl && (
                            <button
                              onClick={() => handleUrlUpload(service.id)}
                              className="px-4 py-2 text-white rounded-xl text-sm"
                              style={{ backgroundColor: 'var(--accent)' }}
                            >
                              Applica
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => removeCustomImage(service.id)}
                          className="flex-1 px-4 py-2 text-red-400 bg-red-500/10 rounded-xl text-sm hover:bg-red-500/20 transition-colors"
                        >
                          Ripristina default
                        </button>
                        <button
                          onClick={() => setEditingService(null)}
                          className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm text-white transition-colors"
                        >
                          {t('cancel')}
                        </button>
                      </div>
                      
                      <p className="text-xs text-white/30 text-center">
                        Supporta JPG, PNG, GIF, WEBP. Puoi caricare file dal tuo computer o usare URL diretto.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LinguePage() {
  const { t } = useT();
  const { settings, updateSettings } = useStore();
  
  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧', tmdbCode: 'en-US' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹', tmdbCode: 'it-IT' },
    { code: 'es', name: 'Español', flag: '🇪🇸', tmdbCode: 'es-ES' },
    { code: 'fr', name: 'Français', flag: '🇫🇷', tmdbCode: 'fr-FR' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪', tmdbCode: 'de-DE' },
    { code: 'pt', name: 'Português', flag: '🇧🇷', tmdbCode: 'pt-BR' },
    { code: 'ja', name: '日本語', flag: '🇯🇵', tmdbCode: 'ja-JP' },
    { code: 'ko', name: '한국어', flag: '🇰🇷', tmdbCode: 'ko-KR' },
    { code: 'zh', name: '中文', flag: '🇨🇳', tmdbCode: 'zh-CN' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺', tmdbCode: 'ru-RU' },
  ];
  
  const handleLanguageChange = (langCode: string, tmdbCode: string) => {
    updateSettings({ appLanguage: langCode, tmdbLanguage: tmdbCode });
    // Forza il reload completo per applicare la lingua a TUTTI i componenti
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };
  
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-5 space-y-4">
        <p className="text-base font-semibold text-white flex items-center gap-2">
          <Globe size={18} /> {t('language')}
        </p>
        <p className="text-xs text-white/40">
          Modifica la lingua dell'interfaccia. I metadati TMDB verranno mostrati nella lingua selezionata.
          L'applicazione si riavvierà automaticamente per applicare le modifiche.
        </p>
        
        <div className="space-y-2">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code, lang.tmdbCode)}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors',
                settings.appLanguage === lang.code
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent-bg)]'
                  : 'border-white/10 hover:border-white/20'
              )}
            >
              <span className="text-2xl">{lang.flag}</span>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-white">{lang.name}</p>
                <p className="text-xs text-white/40">{lang.tmdbCode}</p>
              </div>
              {settings.appLanguage === lang.code && (
                <CheckCircle2 size={16} style={{ color: 'var(--accent)' }} />
              )}
            </button>
          ))}
        </div>
        
        <div className="mt-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-xs text-yellow-400/80 text-center">
            ⚠️ Dopo aver cambiato lingua, l'applicazione si riavvierà per applicare tutte le modifiche all'interfaccia.
          </p>
        </div>
      </div>
    </div>
  );
}

function IntegrazioniPage() {
  const { t } = useT();
  const { settings, updateSettings } = useStore();
  const [tmdbStatus, setTmdbStatus] = useState<'idle'|'testing'|'ok'|'err'>('idle');
  const [showKey, setShowKey] = useState(false);
  const s = settings as any;

  async function testTMDB() {
    if (!settings.tmdbApiKey?.trim()) return;
    setTmdbStatus('testing');
    const ok = await validateTMDBKey(settings.tmdbApiKey.trim());
    setTmdbStatus(ok ? 'ok' : 'err');
  }

  return (
    <div className="space-y-3">
      <Accordion title="TMDB" subtitle="Arricchimento metadati" defaultOpen>
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
            className="px-4 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-sm text-white disabled:opacity-50 border border-white/[0.08]">
            {tmdbStatus === 'testing' ? <RefreshCw size={14} className="animate-spin" /> : 'Verifica'}
          </button>
        </div>
        {tmdbStatus === 'ok' && <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 size={12} />Valida</p>}
        {tmdbStatus === 'err' && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12} />Non valida</p>}
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Lingua</label>
          <select value={settings.tmdbLanguage ?? 'en-US'} onChange={e => updateSettings({ tmdbLanguage: e.target.value })} className={ic + ' cursor-pointer'}>
            <option value="en-US">English</option>
            <option value="it-IT">Italiano</option>
            <option value="es-ES">Español</option>
            <option value="de-DE">Deutsch</option>
          </select>
        </div>
      </Accordion>
    </div>
  );
}

function RiproducibilePage() {
  const { t } = useT();
  const { settings, updateSettings } = useStore();
  const s = settings as any;
  
  const T = ({ k, title, desc }: { k: string; title: string; desc: string }) => (
    <Row title={title} subtitle={desc}>
      <Toggle 
        value={!!s[k]} 
        onChange={v => updateSettings({ [k]: v } as any)} 
      />
    </Row>
  );
  
  return (
    <div className="space-y-3">
      <T k="autoplay" title={t('autoplay_next')} desc="Avvia automaticamente il prossimo episodio" />
      <T k="skipIntro" title={t('skip_intro')} desc="Salta automaticamente intro e riassunti" />
      <Row title={t('preferred_quality')} subtitle="Qualità default degli stream">
        <select value={s.preferredQuality ?? 'auto'} onChange={e => updateSettings({ preferredQuality: e.target.value } as any)}
          className="bg-white/10 text-white text-sm px-3 py-1.5 rounded-xl border border-white/10 focus:outline-none cursor-pointer">
          <option value="auto">Auto</option><option value="4k">4K</option><option value="1080">1080p</option>
          <option value="720">720p</option><option value="480">480p</option>
        </select>
      </Row>
      <T k="subtitlesEnabled" title={t('enable_subtitles')} desc="Attiva i sottotitoli di default" />
      <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-5 space-y-3">
        <p className="text-sm font-semibold text-white">{t('external_player')}</p>
        <p className="text-xs text-white/40">Lascia vuoto per usare il player interno.</p>
        <input value={s.customPlayerPath ?? ''} onChange={e => updateSettings({ customPlayerPath: e.target.value } as any)}
          placeholder="C:\Program Files\VLC\vlc.exe" className={ic + ' font-mono'} />
      </div>
    </div>
  );
}

function TraktPage() {
  const { t } = useT();
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
      {traktAuth ? (
        <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] overflow-hidden">
          <div className="p-5 flex items-center gap-4">
            <div className="relative flex-shrink-0">
              {traktAuth.avatar
                ? <img src={traktAuth.avatar} className="w-16 h-16 rounded-full border-2 border-[#ed1c24]/50" />
                : <div className="w-16 h-16 rounded-full bg-[#ed1c24] flex items-center justify-center text-white font-bold text-xl">T</div>}
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#ed1c24] flex items-center justify-center">
                <Tv size={10} className="text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-lg">{traktAuth.name ?? traktAuth.username}</p>
              <p className="text-sm text-white/40">@{traktAuth.username}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <p className="text-xs text-green-400">{t('connected')} a Trakt.tv</p>
              </div>
            </div>
            <button onClick={() => setTraktAuth(null)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-red-400 bg-red-500/10 rounded-xl hover:bg-red-500/20 transition-colors">
              <LogOut size={14} />{t('logout')}
            </button>
          </div>
          <div className="border-t border-white/[0.06] px-5 py-3 flex items-center gap-2">
            <button onClick={() => openExternal(`https://trakt.tv/users/${traktAuth.username}`)}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors">
              <ExternalLink size={12} />Profilo Trakt
            </button>
          </div>
        </div>
      ) : code ? (
        <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-6 space-y-4 text-center">
          <p className="text-sm text-white/70">Apri <button onClick={() => openExternal(code.verification_url)} className="underline" style={{ color: 'var(--accent)' }}>{code.verification_url}</button></p>
          <div className="text-3xl font-mono font-bold tracking-widest py-4 rounded-2xl" style={{ color: 'var(--accent)', backgroundColor: 'var(--accent-bg)' }}>{code.user_code}</div>
          <div className="flex items-center justify-center gap-2 text-xs text-white/40"><RefreshCw size={12} className="animate-spin" />In attesa...</div>
        </div>
      ) : (
        <button onClick={startTrakt} disabled={loading} className="w-full flex items-center gap-2 justify-center py-3 bg-[#ed1c24] hover:bg-[#c91920] text-white rounded-2xl font-medium">
          {loading ? <RefreshCw size={15} className="animate-spin" /> : <Tv size={15} />}{t('connect_trakt')}
        </button>
      )}
    </div>
  );
}

// ─── Type e Menu ──────────────────────────────────────────────────────────────

type SubPage = null | 'account' | 'profiles' | 'aspetto' | 'layout' | 'streaming' | 'lingue' | 'integrazioni' | 'riproduzione' | 'trakt';

export default function Settings() {
  const { t } = useT();
  const { clearHistory } = useStore();
  const [sub, setSub] = useState<SubPage>(null);
  const activeProfile = (() => { const { profiles, activeProfileId } = useStore(); return profiles.find(p => p.id === activeProfileId) ?? profiles[0]; })();

  const MENU: { id: SubPage; icon: React.ReactNode; label: string }[] = [
    { id: 'account', icon: <User size={18} />, label: t('account_nuvio') },
    { id: 'profiles', icon: <Users size={18} />, label: t('profiles') },
    { id: 'aspetto', icon: <Palette size={18}/>, label: t('appearance') },
    { id: 'layout', icon: <Grid size={18} />, label: t('layout') },
    { id: 'streaming', icon: <Tv size={18} />, label: t('streaming_services') },
    { id: 'lingue', icon: <Globe size={18} />, label: t('language') },
    { id: 'integrazioni', icon: <Link2 size={18} />, label: t('integrations') },
    { id: 'riproduzione', icon: <Play size={18} />, label: t('playback') },
    { id: 'trakt', icon: <Star size={18} />, label: 'Trakt' },
    { id: null, icon: <Info size={18} />, label: t('info') },
  ];

  function handleMenu(id: SubPage, label: string) {
    if (label === t('info')) { openExternal('https://github.com/Davako94/nuvio-desktop'); return; }
    setSub(id);
  }

  const TITLES: Record<string, string> = { 
    account: t('account_nuvio'), 
    profiles: t('profiles'), 
    aspetto: t('appearance'), 
    layout: t('layout'), 
    streaming: t('streaming_services'),
    lingue: t('language'),
    integrazioni: t('integrations'), 
    riproduzione: t('playback'), 
    trakt: 'Trakt' 
  };
  const SUBTITLES: Record<string, string> = { 
    account: 'Gestisci il tuo account Nuvio e il sync dal cloud.', 
    profiles: 'Crea e modifica i profili utente.', 
    aspetto: 'Personalizza colori e tema.', 
    layout: 'Struttura della home e stili.',
    streaming: 'Seleziona i servizi streaming da mostrare in Home e personalizza le loro immagini con JPG, PNG o GIF.',
    lingue: 'Cambia la lingua dell\'applicazione e dei metadati TMDB.',
    integrazioni: 'Impostazioni TMDB e MDBList.', 
    riproduzione: 'Player, sottotitoli e riproduzione.', 
    trakt: 'Collega Trakt e Simkl.' 
  };

  return (
    <div className="flex h-full overflow-hidden bg-[#0f0f13]">
      <div className="w-64 flex-shrink-0 overflow-y-auto px-4 py-6 space-y-1.5 border-r border-white/[0.05]">
        {MENU.map(item => (
          <button key={item.label} onClick={() => handleMenu(item.id, item.label)}
            className={clsx('w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-left transition-all border',
              sub === item.id && item.id !== null ? 'bg-[#1e1e24] border-white/10 text-white' : 'bg-transparent border-transparent text-white/60 hover:text-white hover:bg-white/[0.04]')}>
            <span className={sub === item.id && item.id !== null ? 'text-white' : 'text-white/40'}>{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
            <ChevronRight size={14} className="ml-auto text-white/20" />
          </button>
        ))}
        <div className="pt-4 border-t border-white/[0.06] mt-4">
          <button onClick={() => { if (confirm('Cancellare la cronologia locale?')) clearHistory(); }}
            className="w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-left text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-all">
            <Trash2 size={18} className="text-red-400/50" /><span className="text-sm font-medium">{t('clear_history')}</span>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {sub === null ? (
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">{t('settings')}</h1>
            <p className="text-sm text-white/40 mb-6">Seleziona una voce dal menu.</p>
            {activeProfile && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#1e1e24] border border-white/[0.06] w-fit">
                <div className="w-12 h-12 rounded-full overflow-hidden"><AvatarImg url={activeProfile.avatarUrl} label={activeProfile.name} size={48} /></div>
                <div><p className="font-semibold text-white">{activeProfile.name}</p><p className="text-xs text-white/40">{t('profile')} attivo</p></div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-white">{TITLES[sub!]}</h1>
              <p className="text-sm text-white/40 mt-1">{SUBTITLES[sub!]}</p>
            </div>
            {sub === 'account' && <AccountPage />}
            {sub === 'profiles' && <ProfilesPage />}
            {sub === 'aspetto' && <AspettoPage />}
            {sub === 'layout' && <LayoutPage />}
            {sub === 'streaming' && <StreamingServicesPage />}
            {sub === 'lingue' && <LinguePage />}
            {sub === 'integrazioni' && <IntegrazioniPage />}
            {sub === 'riproduzione' && <RiproducibilePage />}
            {sub === 'trakt' && <TraktPage />}
          </>
        )}
      </div>
    </div>
  );
}