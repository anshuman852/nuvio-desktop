/// <reference types="vite/client" />
/**
 * Settings — identico a Nuvio Web
 * Layout: sidebar sinistra con pill-button + pannello destra con sezioni espandibili
 */
import { useState, useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import { launchPlayer, openExternal } from '../api/stremio';
import { validateTMDBKey, STREAMING_SERVICES } from '../api/tmdb';
import { nuvioLogin, nuvioLogout, setAuthToken } from '../api/nuvio';
import { getTraktDeviceCode, pollTraktToken, getTraktProfile } from '../api/trakt';
import { getSimklPin, pollSimklToken, getSimklProfile } from '../api/simkl';
import { getAvatar, getAvatarUrl, AVATARS, AVATAR_CATEGORIES, type AvatarCategory } from './ProfileSelect';
import {
  User, Users, Palette, Grid, Wrench, Link2, Play, Info,
  ChevronRight, ChevronDown, ChevronUp,
  LogIn, LogOut, RefreshCw, ExternalLink, Check,
  Save, Trash2, Key, AlertCircle, CheckCircle2, Shield,
  BookOpen, Tv, Film, Globe, Lock, Eye, EyeOff, X, Star,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Building blocks ──────────────────────────────────────────────────────────

function AvatarImg({ id, size = 40 }: { id: string; size?: number }) {
  const av = getAvatar(id);
  // Usa getAvatarUrl per generare l'URL DiceBear
  const url = getAvatarUrl(av.seed, av.style, size * 2);
  return <img src={url} alt={av.label} className="w-full h-full object-cover" loading="lazy" />;
}

const ic = 'w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/[0.08] focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-sm text-white placeholder:text-white/30 transition-colors';

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={clsx('relative w-12 h-6 rounded-full transition-colors flex-shrink-0', value ? 'bg-[color:var(--accent,#7c3aed)]' : 'bg-white/20')}>
      <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', value ? 'translate-x-6' : '')} />
    </button>
  );
}

// Accordion section stile Nuvio
function AccordionSection({ title, subtitle, defaultOpen = false, children }: {
  title: string; subtitle?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors">
        <div className="text-left">
          <p className="text-base font-semibold text-white">{title}</p>
          {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">{open ? 'Aperto' : 'Chiuso'}</span>
          {open ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
        </div>
      </button>
      {open && <div className="px-5 pb-5 space-y-3 border-t border-white/[0.04]">{children}</div>}
    </div>
  );
}

// Row stile Nuvio (clicca → sotto-pagina)
function NavRow({ icon, title, subtitle, onClick, badge }: {
  icon: React.ReactNode; title: string; subtitle?: string;
  onClick: () => void; badge?: string;
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-[#1e1e24] border border-white/[0.06] hover:bg-white/[0.04] transition-colors text-left">
      <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0 text-white/60">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white">{title}</p>
          {badge && <span className="text-xs px-2 py-0.5 rounded-full bg-[color:var(--accent-bg)] text-[color:var(--accent)] border border-[color:var(--accent-border)] font-medium">{badge}</span>}
        </div>
        {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
      </div>
      <ChevronRight size={16} className="text-white/20 flex-shrink-0" />
    </button>
  );
}

// ─── Sub-page header ──────────────────────────────────────────────────────────

function SubHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  return (
    <div className="mb-6">
      <h2 className="text-3xl font-bold text-white">{title}</h2>
      {subtitle && <p className="text-sm text-white/40 mt-1">{subtitle}</p>}
    </div>
  );
}

// ─── ACCOUNT ──────────────────────────────────────────────────────────────────

function AccountPage({ onBack }: { onBack: () => void }) {
  const { nuvioUser, setNuvioUser, profiles, activeProfileId, setActiveProfile, setProfileSelected } = useStore();
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
    <div>
      <SubHeader title="Account" onBack={onBack} />
      <div className="space-y-4">
        {/* Switch profile */}
        <AccordionSection title="Switch Profile" subtitle={profiles.find(p => p.id === activeProfileId)?.name} defaultOpen>
          <div className="grid grid-cols-3 gap-3 pt-2">
            {profiles.map(p => (
              <button key={p.id} onClick={() => { setActiveProfile(p.id); }}
                className={clsx('flex flex-col items-center gap-2 p-3 rounded-2xl transition-all border',
                  p.id === activeProfileId ? 'border-[color:var(--accent)] bg-[color:var(--accent-bg)]' : 'border-white/[0.06] bg-white/[0.03] hover:border-white/20')}>
                <div className="w-14 h-14 rounded-full overflow-hidden"><AvatarImg id={p.avatar ?? AVATARS[0].id} size={56} /></div>
                <p className="text-xs font-medium text-white">{p.name}</p>
              </button>
            ))}
          </div>
          <button onClick={() => { setProfileSelected(false); }}
            className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-sm text-white/60 hover:text-white transition-colors mt-2">
            Seleziona profilo
          </button>
        </AccordionSection>

        {/* Nuvio Sync */}
        <AccordionSection title="Nuvio Sync" subtitle="Sincronizza dati tra dispositivi">
          {nuvioUser ? (
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[color:var(--accent)] flex items-center justify-center">
                  <User size={18} className="text-white" />
                </div>
                <div><p className="text-sm font-semibold text-white">{nuvioUser.name}</p><p className="text-xs text-white/40">{nuvioUser.email}</p></div>
              </div>
              <button onClick={() => { nuvioLogout(); setAuthToken(null); setNuvioUser(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 bg-red-500/10 rounded-xl">
                <LogOut size={13} />Esci
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className={ic} />
              <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} placeholder="Password" className={ic} />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button onClick={login} disabled={loading || !email || !pw}
                className="w-full flex items-center gap-2 justify-center py-3 text-white rounded-2xl font-medium text-sm disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
                {loading ? <RefreshCw size={15} className="animate-spin" /> : <LogIn size={15} />}Accedi
              </button>
            </div>
          )}
        </AccordionSection>
      </div>
    </div>
  );
}

// ─── PROFILI ──────────────────────────────────────────────────────────────────

function ProfilesPage({ onBack }: { onBack: () => void }) {
  const { profiles, updateProfile, removeProfile, addProfile } = useStore();
  const [editId, setEditId] = useState<string | null>(null);
  const [editAvatarCategory, setEditAvatarCategory] = useState<AvatarCategory>('All');

  const editProfile = profiles.find(p => p.id === editId);

  return (
    <div>
      <SubHeader title="Profili" subtitle="Gestisci i profili utente" onBack={onBack} />
      {!editId ? (
        <div className="space-y-3">
          {profiles.map(p => (
            <button key={p.id} onClick={() => setEditId(p.id)}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-[#1e1e24] border border-white/[0.06] hover:border-white/20 transition-colors text-left">
              <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0"><AvatarImg id={p.avatar ?? AVATARS[0].id} size={48} /></div>
              <div className="flex-1"><p className="text-base font-semibold text-white">{p.name}</p><p className="text-xs text-white/40">{p.isKids ? 'Profilo bambini' : 'Profilo adulti'}{p.pin ? ' · PIN attivo' : ''}</p></div>
              <ChevronRight size={16} className="text-white/20" />
            </button>
          ))}
          {profiles.length < 5 && (
            <button onClick={() => addProfile({ name: `Profilo ${profiles.length + 1}`, avatar: AVATARS[0].id, color: '#7c3aed', isKids: false })}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-dashed border-white/10 hover:border-white/25 transition-colors text-white/40 hover:text-white/60">
              + Aggiungi profilo
            </button>
          )}
        </div>
      ) : editProfile ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-white/[0.06]">
            <p className="text-xs text-white/40">Modifica profilo</p>
            <h2 className="text-xl font-bold text-white flex-1">{editProfile.name}</h2>
            <button onClick={() => setEditId(null)} className="text-white/40 hover:text-white"><X size={18} /></button>
            <button onClick={() => setEditId(null)} className="px-5 py-2 bg-white text-black rounded-full text-sm font-semibold">Salva</button>
          </div>

          <div className="flex gap-6">
            <div className="flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[color:var(--accent,#7c3aed)]">
                <AvatarImg id={editProfile.avatar ?? AVATARS[0].id} size={96} />
              </div>
              <p className="text-sm font-semibold text-white">{editProfile.name}</p>
              <input defaultValue={editProfile.name} onBlur={e => updateProfile(editProfile.id, { name: e.target.value })}
                className={ic + ' text-center text-xs'} />
            </div>
            <div className="flex-1">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Scegli Avatar</p>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {AVATAR_CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setEditAvatarCategory(cat)}
                    className={clsx('px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                      editAvatarCategory === cat ? 'bg-white text-black border-white' : 'border-white/20 text-white/50 hover:text-white')}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5 max-h-44 overflow-y-auto">
                {(editAvatarCategory === 'All' ? AVATARS : AVATARS.filter(a => a.category === editAvatarCategory)).map(av => (
                  <button key={av.id} onClick={() => updateProfile(editProfile.id, { avatar: av.id })} title={av.label}
                    className={clsx('w-12 h-12 rounded-full overflow-hidden border-2 transition-all hover:scale-105',
                      editProfile.avatar === av.id ? 'border-white scale-105' : 'border-transparent opacity-70 hover:opacity-100')}>
                    <AvatarImg id={av.id} size={48} />
                  </button>
                ))}
              </div>
              {editProfile.avatar && <p className="text-xs text-white/30 mt-1 text-center">{getAvatar(editProfile.avatar).label}</p>}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── ASPETTO ──────────────────────────────────────────────────────────────────

function AspettoPage({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings } = useStore();
  const [local, setLocal] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  function save() { updateSettings(local as any); setSaved(true); setTimeout(() => setSaved(false), 2000); }

  return (
    <div>
      <SubHeader title="Aspetto" subtitle="Tema e personalizzazione visiva" onBack={onBack} />
      <div className="space-y-4">
        <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-5 space-y-4">
          <p className="text-base font-semibold text-white">Colore accent</p>
          <div className="flex gap-3 flex-wrap">
            {['#7c3aed','#2563eb','#16a34a','#dc2626','#d97706','#0891b2','#be185d','#ea580c','#0d9488','#4f46e5','#db2777','#0284c7'].map(c => (
              <button key={c} onClick={() => setLocal(p => ({ ...p, accentColor: c }))}
                className={clsx('w-10 h-10 rounded-full transition-all hover:scale-110', local.accentColor === c ? 'ring-3 ring-white ring-offset-2 ring-offset-[#1e1e24] scale-110' : '')}
                style={{ backgroundColor: c }} />
            ))}
            <input type="color" value={local.accentColor ?? '#7c3aed'} onChange={e => setLocal(p => ({ ...p, accentColor: e.target.value }))}
              className="w-10 h-10 rounded-full cursor-pointer border-0 bg-transparent p-0" />
          </div>
        </div>
        <button onClick={save} className="w-full py-3 rounded-2xl text-white font-medium text-sm flex items-center gap-2 justify-center"
          style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
          <Save size={15} />{saved ? '✓ Salvato' : 'Salva aspetto'}
        </button>
      </div>
    </div>
  );
}

// ─── LAYOUT ───────────────────────────────────────────────────────────────────

function LayoutPage({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings } = useStore();
  const [layout, setLayout] = useState<'modern' | 'grid' | 'classic'>((settings as any).homeLayout ?? 'classic');

  const layouts = [
    { id: 'modern' as const, label: 'Vista Moderna', desc: 'Hero fisso con una singola riga attiva per una navigazione più rapida', beta: true },
    { id: 'grid' as const, label: 'Vista Griglia', desc: 'Sfoglia tutto in una griglia verticale con una sezione hero', beta: true },
    { id: 'classic' as const, label: 'Vista Classica', desc: 'Scorri le categorie orizzontalmente', beta: true },
  ];

  return (
    <div>
      <SubHeader title="Layout" subtitle="Struttura della home e stili delle locandine." onBack={onBack} />
      <div className="space-y-4">
        <AccordionSection title="Layout Home" subtitle="Scegli la struttura e la sorgente hero." defaultOpen>
          <div className="grid grid-cols-3 gap-3 pt-2">
            {layouts.map(l => (
              <button key={l.id} onClick={() => { setLayout(l.id); updateSettings({ homeLayout: l.id } as any); }}
                className={clsx('relative p-4 rounded-2xl border-2 text-left transition-all', layout === l.id ? 'border-white bg-white/5' : 'border-white/10 bg-white/[0.02] hover:border-white/25')}>
                {l.beta && <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-md bg-white/20 text-white/60 font-medium">BETA</span>}
                {/* Layout preview mini */}
                <div className="w-full h-14 rounded-lg bg-white/10 mb-3 overflow-hidden flex flex-col gap-1 p-1.5">
                  {l.id === 'modern' ? (
                    <><div className="h-6 rounded bg-white/20 w-full" /><div className="flex gap-1">{[1,2,3].map(i => <div key={i} className="h-4 rounded bg-white/10 flex-1" />)}</div></>
                  ) : l.id === 'grid' ? (
                    <div className="grid grid-cols-4 gap-1">{Array(8).fill(0).map((_, i) => <div key={i} className="aspect-[2/3] rounded bg-white/10" />)}</div>
                  ) : (
                    <><div className="flex gap-1 mb-1">{[1,2,3,4].map(i => <div key={i} className="h-3 rounded bg-white/10 flex-1" />)}</div><div className="flex gap-1">{[1,2,3,4].map(i => <div key={i} className="h-3 rounded bg-white/10 flex-1" />)}</div></>
                  )}
                </div>
                <p className="text-xs font-semibold text-white">{l.label}</p>
                <p className="text-xs text-white/40 mt-0.5 leading-tight">{l.desc}</p>
              </button>
            ))}
          </div>
        </AccordionSection>

        <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-base font-semibold text-white">Locandine Orizzontali</p>
            <p className="text-xs text-white/40 mt-0.5">Passa tra schede verticali e orizzontali per la vista Moderna.</p>
          </div>
          <Toggle value={(settings as any).horizontalPosters ?? false} onChange={v => updateSettings({ horizontalPosters: v } as any)} />
        </div>

        <button className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-[#1e1e24] border border-white/[0.06] hover:border-white/20 transition-colors">
          <div><p className="text-base font-semibold text-white">Contenuto Home</p><p className="text-xs text-white/40 mt-0.5">Controlla cosa appare nella home e nella ricerca.</p></div>
          <div className="flex items-center gap-2 text-white/40 text-xs">Chiuso <ChevronRight size={16} /></div>
        </button>
      </div>
    </div>
  );
}

// ─── INTEGRAZIONI ─────────────────────────────────────────────────────────────

function IntegrazioniPage({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings } = useStore();
  const [local, setLocal] = useState({ ...settings });
  const [tmdbStatus, setTmdbStatus] = useState<'idle' | 'testing' | 'ok' | 'err'>('idle');
  const [showKey, setShowKey] = useState(false);

  async function testTMDB() {
    if (!local.tmdbApiKey?.trim()) return;
    setTmdbStatus('testing');
    const ok = await validateTMDBKey(local.tmdbApiKey.trim());
    setTmdbStatus(ok ? 'ok' : 'err');
    if (ok) updateSettings({ tmdbApiKey: local.tmdbApiKey.trim() });
  }

  return (
    <div>
      <SubHeader title="Integrazioni" subtitle="Scegli le impostazioni TMDB o MDBList" onBack={onBack} />
      <div className="space-y-3">
        <AccordionSection title="TMDB" subtitle="Controlli per l'arricchimento dei metadati" defaultOpen>
          <div className="space-y-3 pt-2">
            <p className="text-xs text-white/40">API Key v3 da <button onClick={() => openExternal('https://www.themoviedb.org/settings/api')} className="underline" style={{ color: 'var(--accent)' }}>themoviedb.org/settings/api</button></p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input type={showKey ? 'text' : 'password'} value={local.tmdbApiKey ?? ''} onChange={e => { setLocal(p => ({ ...p, tmdbApiKey: e.target.value })); setTmdbStatus('idle'); }}
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" className={ic + ' pr-10 font-mono'} />
                <button onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button onClick={testTMDB} disabled={!local.tmdbApiKey?.trim() || tmdbStatus === 'testing'}
                className="px-4 py-3 bg-white/8 hover:bg-white/12 text-white rounded-2xl text-sm disabled:opacity-50 flex items-center gap-1.5 border border-white/[0.08]">
                {tmdbStatus === 'testing' ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
                {tmdbStatus === 'testing' ? '...' : 'Verifica'}
              </button>
            </div>
            {tmdbStatus === 'ok' && <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 size={12} />Chiave valida e salvata</p>}
            {tmdbStatus === 'err' && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12} />Chiave non valida</p>}
            {settings.tmdbApiKey && tmdbStatus === 'idle' && <p className="text-xs text-white/30">✓ Configurata</p>}

            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Lingua contenuti</label>
              <select value={local.tmdbLanguage ?? 'it-IT'} onChange={e => { setLocal(p => ({ ...p, tmdbLanguage: e.target.value })); updateSettings({ tmdbLanguage: e.target.value }); }}
                className={ic + ' cursor-pointer'}>
                <option value="it-IT">Italiano</option>
                <option value="en-US">English</option>
                <option value="es-ES">Español</option>
                <option value="de-DE">Deutsch</option>
              </select>
            </div>
          </div>
        </AccordionSection>

        <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] flex items-center justify-between px-5 py-4 hover:border-white/20 transition-colors cursor-pointer">
          <div><p className="text-base font-semibold text-white">Valutazioni MDBList</p><p className="text-xs text-white/40 mt-0.5">Provider esterni per le valutazioni</p></div>
          <ChevronRight size={16} className="text-white/20" />
        </div>

        <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] flex items-center justify-between px-5 py-4 hover:border-white/20 transition-colors cursor-pointer">
          <div><p className="text-base font-semibold text-white">Anime Skip</p><p className="text-xs text-white/40 mt-0.5">Salta inizio/fine Anime</p></div>
          <ChevronRight size={16} className="text-white/20" />
        </div>
      </div>
    </div>
  );
}

// ─── RIPRODUZIONE ─────────────────────────────────────────────────────────────

function RiproducibilePage({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings } = useStore();
  const [local, setLocal] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  function save() { updateSettings(local as any); setSaved(true); setTimeout(() => setSaved(false), 2000); }

  const Row = ({ title, desc, value, onChange }: { title: string; desc: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] flex items-center justify-between px-5 py-4">
      <div><p className="text-base font-semibold text-white">{title}</p><p className="text-xs text-white/40 mt-0.5">{desc}</p></div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );

  const SectionBtn = ({ title, desc, value }: { title: string; desc: string; value?: string }) => (
    <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] flex items-center justify-between px-5 py-4 hover:border-white/20 transition-colors cursor-pointer">
      <div><p className="text-base font-semibold text-white">{title}</p><p className="text-xs text-white/40 mt-0.5">{desc}</p></div>
      <div className="flex items-center gap-2 text-white/40 text-sm">{value ?? 'Aperto'} <ChevronDown size={16} /></div>
    </div>
  );

  return (
    <div>
      <SubHeader title="Riproduzione" subtitle="Player, sottotitoli e riproduzione automatica." onBack={onBack} />
      <div className="space-y-3">
        <SectionBtn title="Generale" desc="Comportamento principale della riproduzione." />
        <Row title="Riproduci automaticamente il prossimo episodio"
          desc="Avvia automaticamente il prossimo episodio quando appare il prompt."
          value={local.autoplay ?? true} onChange={v => setLocal(p => ({ ...p, autoplay: v }))} />
        <Row title="Salta intro"
          desc="Usa introdb.app per rilevare intro e riassunti."
          value={(local as any).skipIntro ?? false} onChange={v => setLocal(p => ({ ...p, skipIntro: v } as any))} />
        <SectionBtn title="Streaming & Qualità" desc="Qualità, riproduzione automatica e filtraggio delle sorgenti." />

        <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] flex items-center justify-between px-5 py-4 hover:border-white/20 transition-colors cursor-pointer">
          <div><p className="text-base font-semibold text-white">Qualità preferita</p><p className="text-xs text-white/40 mt-0.5">Scegli la qualità predefinita.</p></div>
          <div className="flex items-center gap-2 text-white/40 text-sm">Auto <ChevronRight size={16} /></div>
        </div>

        <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-5 space-y-3">
          <p className="text-sm font-semibold text-white">Player esterno (opzionale)</p>
          <p className="text-xs text-white/40">Lascia vuoto per usare il player interno. Oppure specifica VLC, MPC-HC, ecc.</p>
          <input value={(local as any).customPlayerPath ?? ''} onChange={e => setLocal(p => ({ ...p, customPlayerPath: e.target.value } as any))}
            placeholder="C:\Program Files\VLC\vlc.exe" className={ic + ' font-mono'} />
        </div>

        <Row title="Decodifica hardware" desc="Usa GPU per decodificare video (consigliato)"
          value={local.hardwareDecode ?? true} onChange={v => setLocal(p => ({ ...p, hardwareDecode: v }))} />

        <button onClick={save} className="w-full py-3 rounded-2xl text-white font-medium text-sm flex items-center gap-2 justify-center"
          style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
          <Save size={15} />{saved ? '✓ Salvato' : 'Salva'}
        </button>
      </div>
    </div>
  );
}

// ─── TRAKT ────────────────────────────────────────────────────────────────────

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
    <div>
      <SubHeader title="Trakt" subtitle="Sincronizza cronologia e rating con Trakt.tv" onBack={onBack} />
      <div className="space-y-4">
        {traktAuth ? (
          <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {traktAuth.avatar ? <img src={traktAuth.avatar} className="w-12 h-12 rounded-full" /> : <div className="w-12 h-12 rounded-full bg-[#ed1c24] flex items-center justify-center text-white font-bold text-lg">T</div>}
              <div><p className="font-semibold text-white">{traktAuth.name}</p><p className="text-xs text-white/40">@{traktAuth.username} · Trakt.tv</p></div>
            </div>
            <button onClick={() => setTraktAuth(null)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-red-400 bg-red-500/10 rounded-2xl border border-red-500/20">
              <LogOut size={14} />Disconnetti
            </button>
          </div>
        ) : code ? (
          <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-6 space-y-4 text-center">
            <p className="text-sm text-white/70">Apri <button onClick={() => openExternal(code.verification_url)} className="underline" style={{ color: 'var(--accent)' }}>{code.verification_url}</button> e inserisci:</p>
            <div className="text-3xl font-mono font-bold tracking-widest py-4 rounded-2xl" style={{ color: 'var(--accent)', backgroundColor: 'var(--accent-bg)' }}>{code.user_code}</div>
            <div className="flex items-center justify-center gap-2 text-xs text-white/40"><RefreshCw size={12} className="animate-spin" />In attesa di autorizzazione...</div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-white/50">Collega Trakt per sincronizzare cronologia, watchlist e voti.</p>
            <button onClick={start} disabled={loading} className="flex items-center gap-2 px-5 py-3 bg-[#ed1c24] hover:bg-[#c91920] text-white rounded-2xl font-medium w-full justify-center disabled:opacity-50">
              {loading ? <RefreshCw size={15} className="animate-spin" /> : <Tv size={15} />}Collega Trakt.tv
            </button>
          </div>
        )}

        {/* Simkl inline */}
        <SimklInline />
        <MALInline />
      </div>
    </div>
  );
}

function SimklInline() {
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

  if (simklAuth) return (
    <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {simklAuth.avatar ? <img src={simklAuth.avatar} className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 rounded-full bg-[#0b65c2] flex items-center justify-center text-white font-bold">S</div>}
        <div><p className="text-sm font-semibold text-white">{simklAuth.name}</p><p className="text-xs text-white/40">Simkl</p></div>
      </div>
      <button onClick={() => setSimklAuth(null)} className="px-3 py-1.5 text-xs text-red-400 bg-red-500/10 rounded-xl"><LogOut size={13} /></button>
    </div>
  );
  return (
    <button onClick={start} disabled={loading} className="w-full flex items-center gap-2 justify-center py-3 bg-[#0b65c2] hover:bg-[#0952a0] text-white rounded-2xl text-sm font-medium">
      {loading ? <RefreshCw size={14} className="animate-spin" /> : <Film size={14} />}Collega Simkl
    </button>
  );
}

function MALInline() {
  const { malAuth, setMALAuth } = useStore();
  const [step, setStep] = useState<'idle'|'waiting'>('idle');
  const [code, setCode] = useState('');
  const [cv, setCv] = useState('');
  const [url, setUrl] = useState('');

  async function start() {
    const { getMALAuthUrl } = await import('../api/mal');
    const { url: u, codeVerifier } = getMALAuthUrl();
    setCv(codeVerifier); setUrl(u); setStep('waiting'); openExternal(u);
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

  if (malAuth) return (
    <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {malAuth.picture ? <img src={malAuth.picture} className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 rounded-full bg-[#2e51a2] flex items-center justify-center text-white font-bold">M</div>}
        <div><p className="text-sm font-semibold text-white">{malAuth.name}</p><p className="text-xs text-white/40">MyAnimeList</p></div>
      </div>
      <button onClick={() => setMALAuth(null)} className="px-3 py-1.5 text-xs text-red-400 bg-red-500/10 rounded-xl"><LogOut size={13} /></button>
    </div>
  );
  if (step === 'waiting') return (
    <div className="rounded-2xl bg-[#1e1e24] border border-white/[0.06] p-4 space-y-2">
      <div className="flex gap-2">
        <input value={code} onChange={e => setCode(e.target.value)} placeholder="Codice dall'URL" className={ic + ' flex-1'} />
        <button onClick={exchange} disabled={!code.trim()} className="px-4 py-3 bg-[#2e51a2] text-white rounded-2xl text-sm disabled:opacity-50">OK</button>
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

type SubPage = null | 'account' | 'profiles' | 'aspetto' | 'layout' | 'integrazioni' | 'riproduzione' | 'trakt' | 'dati';

const MENU_ITEMS = [
  { id: 'account' as SubPage,       icon: <User size={18} />,       label: 'Account' },
  { id: 'profiles' as SubPage,      icon: <Users size={18} />,      label: 'Profili' },
  { id: 'aspetto' as SubPage,       icon: <Palette size={18} />,    label: 'Aspetto' },
  { id: 'layout' as SubPage,        icon: <Grid size={18} />,       label: 'Layout' },
  { id: 'integrazioni' as SubPage,  icon: <Link2 size={18} />,      label: 'Integrazioni' },
  { id: 'riproduzione' as SubPage,  icon: <Play size={18} />,       label: 'Riproduzione' },
  { id: 'trakt' as SubPage,         icon: <Star size={18} />,       label: 'Trakt' },
  { id: 'dati' as SubPage,          icon: <Trash2 size={18} />,     label: 'Dati' },
  { id: null as SubPage,            icon: <Info size={18} />,       label: 'Informazioni', isInfo: true },
];

export default function Settings() {
  const { clearHistory } = useStore();
  const [sub, setSub] = useState<SubPage>(null);

  const activeProfile = (() => { const { profiles, activeProfileId } = useStore(); return profiles.find(p => p.id === activeProfileId) ?? profiles[0]; })();

  return (
    <div className="flex h-full overflow-hidden bg-[#0f0f13]">
      {/* LEFT sidebar */}
      <div className="w-72 flex-shrink-0 overflow-y-auto px-4 py-6 space-y-2 border-r border-white/[0.05]">
        {MENU_ITEMS.map(item => (
          <button key={item.label} onClick={() => {
            if (item.label === 'Informazioni') { openExternal('https://github.com/Davako94/nuvio-desktop'); return; }
            if (item.label === 'Dati') { if (confirm('Cancellare cronologia?')) clearHistory(); return; }
            setSub(item.id as SubPage);
          }}
            className={clsx(
              'w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all border',
              sub === item.id && item.id !== null
                ? 'bg-[#1e1e24] border-white/10 text-white'
                : 'bg-transparent border-transparent text-white/60 hover:text-white hover:bg-white/[0.04]'
            )}>
            <span className={sub === item.id && item.id !== null ? 'text-white' : 'text-white/40'}>{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
            {item.label === 'Dati' && <Trash2 size={14} className="ml-auto text-white/20" />}
            {item.id !== null && item.label !== 'Dati' && <ChevronRight size={14} className="ml-auto text-white/20" />}
          </button>
        ))}
      </div>

      {/* RIGHT content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {sub === null && (
          <div className="flex flex-col items-start gap-2">
            <h1 className="text-3xl font-bold text-white">Impostazioni</h1>
            <p className="text-sm text-white/40">Seleziona una voce dal menu per configurarla.</p>
            {activeProfile && (
              <div className="mt-4 flex items-center gap-3 p-4 rounded-2xl bg-[#1e1e24] border border-white/[0.06]">
                <div className="w-12 h-12 rounded-full overflow-hidden"><AvatarImg id={activeProfile.avatar ?? AVATARS[0].id} size={48} /></div>
                <div><p className="font-semibold text-white">{activeProfile.name}</p><p className="text-xs text-white/40">{activeProfile.isKids ? 'Profilo bambini' : 'Profilo adulti'}</p></div>
              </div>
            )}
          </div>
        )}
        {sub === 'account'      && <AccountPage onBack={() => setSub(null)} />}
        {sub === 'profiles'     && <ProfilesPage onBack={() => setSub(null)} />}
        {sub === 'aspetto'      && <AspettoPage onBack={() => setSub(null)} />}
        {sub === 'layout'       && <LayoutPage onBack={() => setSub(null)} />}
        {sub === 'integrazioni' && <IntegrazioniPage onBack={() => setSub(null)} />}
        {sub === 'riproduzione' && <RiproducibilePage onBack={() => setSub(null)} />}
        {sub === 'trakt'        && <TraktPage onBack={() => setSub(null)} />}
      </div>
    </div>
  );
}
