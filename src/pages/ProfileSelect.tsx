/// <reference types="vite/client" />
/**
 * ProfileSelect — stile identico a Nuvio Web
 * Avatar: personaggi reali da categorie (Anime, Animation, TV, Movie, Gaming, Linear)
 * PIN: 4 cifre con auto-submit
 * Kids: filtro contenuti
 */
import { useState } from 'react';
import { useStore } from '../lib/store';
import { Profile } from '../lib/types';
import { Plus, Lock, Pencil, Check, X, Eye, EyeOff, Shield, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

// ─── Avatar database ──────────────────────────────────────────────────────────
// Usiamo immagini da TMDB (pubbliche) e avatar stilizzati

export const AVATAR_CATEGORIES = ['All', 'Anime', 'Animation', 'TV', 'Movie', 'Gaming', 'Linear'] as const;
export type AvatarCategory = typeof AVATAR_CATEGORIES[number];

export interface AvatarDef {
  id: string;
  label: string;
  url: string;
  category: AvatarCategory;
  kids?: boolean;
}

// URL avatar da TMDB persone note + personaggi animati
export const AVATARS: AvatarDef[] = [
  // Anime
  { id: 'goku',     label: 'Goku',          url: 'https://i.imgur.com/YNqJRmT.png', category: 'Anime' },
  { id: 'naruto',   label: 'Naruto',         url: 'https://i.imgur.com/AoPFkqH.png', category: 'Anime' },
  { id: 'levi',     label: 'Levi',           url: 'https://i.imgur.com/tV8FWLQ.png', category: 'Anime' },
  { id: 'eren',     label: 'Eren',           url: 'https://i.imgur.com/REoUlMb.png', category: 'Anime' },
  { id: 'mikasa',   label: 'Mikasa',         url: 'https://i.imgur.com/7Rgg2p4.png', category: 'Anime' },
  { id: 'killua',   label: 'Killua',         url: 'https://i.imgur.com/HoRBmAS.png', category: 'Anime' },
  { id: 'hinata',   label: 'Hinata',         url: 'https://i.imgur.com/JYGKKF1.png', category: 'Anime' },
  { id: 'rem',      label: 'Rem',            url: 'https://i.imgur.com/oW1C37U.png', category: 'Anime' },
  // Animation
  { id: 'moana',    label: 'Moana',          url: 'https://i.imgur.com/DNEtcMv.png', category: 'Animation', kids: true },
  { id: 'simba',    label: 'Simba',          url: 'https://i.imgur.com/GClT5OD.png', category: 'Animation', kids: true },
  { id: 'elsa',     label: 'Elsa',           url: 'https://i.imgur.com/mfvvPCu.png', category: 'Animation', kids: true },
  { id: 'nemo',     label: 'Nemo',           url: 'https://i.imgur.com/Jt4CpL0.png', category: 'Animation', kids: true },
  // TV
  { id: 'geralt',   label: 'Geralt',         url: 'https://i.imgur.com/K5PVt8F.png', category: 'TV' },
  { id: 'jon',      label: 'Jon Snow',       url: 'https://i.imgur.com/PRTK1Vr.png', category: 'TV' },
  { id: 'walter',   label: 'Walter White',   url: 'https://i.imgur.com/lsxkHxq.png', category: 'TV' },
  { id: 'eleven',   label: 'Eleven',         url: 'https://i.imgur.com/yXlOA5c.png', category: 'TV' },
  // Movie
  { id: 'harry',    label: 'Harry Potter',   url: 'https://i.imgur.com/XlPzVKS.png', category: 'Movie' },
  { id: 'kratos',   label: 'Kratos',         url: 'https://i.imgur.com/ePVoQl1.png', category: 'Gaming' },
  { id: 'sparrow',  label: 'Jack Sparrow',   url: 'https://i.imgur.com/V5D5q7f.png', category: 'Movie' },
  { id: 'ellie',    label: 'Ellie',          url: 'https://i.imgur.com/6JzlPow.png', category: 'Gaming' },
  // Gaming
  { id: 'masterchief', label: 'Master Chief', url: 'https://i.imgur.com/ZuCJLvE.png', category: 'Gaming' },
  { id: 'link',     label: 'Link',           url: 'https://i.imgur.com/WCmQTFj.png', category: 'Gaming' },
  // Linear (gradient circles)
  { id: 'lin1',     label: 'Viola',          url: '', category: 'Linear', _color: '#7c3aed' } as any,
  { id: 'lin2',     label: 'Blu',            url: '', category: 'Linear', _color: '#2563eb' } as any,
  { id: 'lin3',     label: 'Verde',          url: '', category: 'Linear', _color: '#16a34a' } as any,
  { id: 'lin4',     label: 'Rosso',          url: '', category: 'Linear', _color: '#dc2626' } as any,
  { id: 'lin5',     label: 'Arancione',      url: '', category: 'Linear', _color: '#ea580c' } as any,
  { id: 'lin6',     label: 'Ciano',          url: '', category: 'Linear', _color: '#0891b2' } as any,
];

export function getAvatar(id: string): AvatarDef {
  return AVATARS.find(a => a.id === id) ?? AVATARS[0];
}

// Per compatibilità con vecchio codice che usava seed/style
export function getAvatarUrl(seed: string, _style?: string, _size?: number): string {
  const av = AVATARS.find(a => a.id === seed);
  if (!av) return '';
  if ((av as any)._color) return '';
  return av.url;
}

// Componente avatar
function AvatarImg({ av, size = 64, className = '' }: { av: AvatarDef; size?: number; className?: string }) {
  const [err, setErr] = useState(false);
  const color = (av as any)._color as string | undefined;

  if (color) {
    return (
      <div className={clsx('flex items-center justify-center font-bold text-white', className)}
        style={{ background: `radial-gradient(circle at 30% 30%, ${color}dd, ${color}88)`, fontSize: size * 0.4 }}>
        {av.label.charAt(0)}
      </div>
    );
  }
  if (!err && av.url) {
    return <img src={av.url} alt={av.label} className={clsx('object-cover', className)} onError={() => setErr(true)} />;
  }
  // Fallback: cerchio colorato con iniziale
  return (
    <div className={clsx('flex items-center justify-center font-bold text-white', className)}
      style={{ background: 'var(--accent, #7c3aed)', fontSize: size * 0.4 }}>
      {av.label.charAt(0)}
    </div>
  );
}

// Export per compatibilità
export const AVATAR_SEEDS = AVATARS.map(a => ({ id: a.id, seed: a.id, label: a.label, style: 'nuvio' }));

// ─── PIN Dialog ───────────────────────────────────────────────────────────────

function PinDialog({ profile, onSuccess, onCancel }: { profile: Profile; onSuccess: () => void; onCancel: () => void }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const [show, setShow] = useState(false);
  const av = getAvatar(profile.avatar ?? AVATARS[0].id);

  function handleDigit(i: number, val: string) {
    const d = val.replace(/\D/g, '').slice(-1);
    const next = [...digits]; next[i] = d; setDigits(next); setError(false);
    if (d && i < 3) (document.getElementById(`pin-${i + 1}`) as HTMLInputElement)?.focus();
    if (d && i === 3) {
      const pin = [...next.slice(0, 3), d].join('');
      setTimeout(() => {
        if (pin === profile.pin) onSuccess();
        else { setError(true); setDigits(['', '', '', '']); (document.getElementById('pin-0') as HTMLInputElement)?.focus(); }
      }, 80);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#141418] rounded-3xl p-8 w-full max-w-sm text-center space-y-6 border border-white/[0.08]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-white/5">
            <AvatarImg av={av} size={80} className="w-full h-full" />
          </div>
          <h2 className="text-xl font-bold text-white">{profile.name}</h2>
          <p className="text-sm text-white/40 flex items-center gap-1.5"><Lock size={13} />Inserisci il PIN</p>
        </div>
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3].map(i => (
            <input key={i} id={`pin-${i}`} type={show ? 'text' : 'password'} inputMode="numeric" maxLength={1}
              value={digits[i]} autoFocus={i === 0}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => { if (e.key === 'Backspace' && !digits[i] && i > 0) (document.getElementById(`pin-${i - 1}`) as HTMLInputElement)?.focus(); }}
              className={clsx('w-14 h-14 text-center text-2xl font-bold rounded-2xl border-2 bg-white/5 text-white focus:outline-none transition-all',
                error ? 'border-red-500 bg-red-500/10' : digits[i] ? 'border-[color:var(--accent,#7c3aed)]' : 'border-white/10 focus:border-white/30')} />
          ))}
        </div>
        {error && <p className="text-red-400 text-sm font-medium">PIN non corretto</p>}
        <div className="flex justify-between">
          <button onClick={() => setShow(v => !v)} className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1">
            {show ? <EyeOff size={12} /> : <Eye size={12} />}{show ? 'Nascondi' : 'Mostra'}
          </button>
          <button onClick={onCancel} className="text-xs text-white/30 hover:text-white">Annulla</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Profile (stile Nuvio Web) ──────────────────────────────────────────

function EditModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const { updateProfile, removeProfile } = useStore();
  const [name, setName] = useState(profile.name);
  const [avatarId, setAvatarId] = useState(profile.avatar ?? AVATARS[0].id);
  const [isKids, setIsKids] = useState(profile.isKids);
  const [pin, setPin] = useState(profile.pin ?? '');
  const [newPin, setNewPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [category, setCategory] = useState<AvatarCategory>('All');

  const currentAv = getAvatar(avatarId);
  const filtered = category === 'All' ? AVATARS : AVATARS.filter(a => a.category === category);
  const isDefault = profile.id === 'default';

  function save() {
    updateProfile(profile.id, { name, avatar: avatarId, isKids, pin: pin || undefined });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a1a1f] rounded-2xl w-full max-w-2xl border border-white/[0.08] my-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <p className="text-xs text-white/40 mb-0.5">Modifica profilo</p>
            <h2 className="text-2xl font-bold text-white">{profile.name}</h2>
          </div>
          <button onClick={save} className="px-6 py-2.5 bg-white text-black font-semibold rounded-full text-sm hover:bg-white/90 transition-colors">
            Salva
          </button>
        </div>

        <div className="flex gap-6 p-6">
          {/* Left: current avatar + name */}
          <div className="flex flex-col items-center gap-4 w-44 flex-shrink-0">
            <div className="w-28 h-28 rounded-full overflow-hidden bg-white/5 border-4 border-[color:var(--accent,#7c3aed)]">
              <AvatarImg av={currentAv} size={112} className="w-full h-full" />
            </div>
            <p className="text-base font-semibold text-white">{name}</p>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-sm text-white text-center" />
            <button onClick={() => onClose()} className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-sm transition-colors">
              Annulla
            </button>
            {!isDefault && (
              <button onClick={() => { if (confirm('Eliminare?')) { removeProfile(profile.id); onClose(); } }}
                className="text-xs text-red-400 hover:text-red-300">Elimina profilo</button>
            )}
          </div>

          {/* Right: avatar picker */}
          <div className="flex-1 min-w-0">
            {/* Category pills */}
            <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Scegli Avatar</p>
            <div className="flex gap-2 flex-wrap mb-4">
              {AVATAR_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setCategory(cat)}
                  className={clsx('px-4 py-1.5 rounded-full text-sm font-medium transition-colors border',
                    category === cat
                      ? 'bg-white text-black border-white'
                      : 'bg-transparent border-white/20 text-white/60 hover:text-white hover:border-white/40')}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Avatar grid */}
            <div className="grid grid-cols-6 gap-2 max-h-72 overflow-y-auto pr-1">
              {filtered.map(av => (
                <button key={av.id} onClick={() => setAvatarId(av.id)}
                  title={av.label}
                  className={clsx('relative w-14 h-14 rounded-full overflow-hidden transition-all hover:scale-105 border-2',
                    avatarId === av.id ? 'border-white scale-105' : 'border-transparent opacity-80 hover:opacity-100')}>
                  <AvatarImg av={av} size={56} className="w-full h-full" />
                </button>
              ))}
            </div>
            {/* Label del selezionato */}
            {avatarId && (
              <p className="text-xs text-white/40 mt-2 text-center">{currentAv.label}</p>
            )}

            {/* Kids + PIN */}
            <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-blue-400" />
                  <div>
                    <p className="text-sm text-white">Profilo bambini</p>
                    <p className="text-xs text-white/30">Filtra contenuti per adulti</p>
                  </div>
                </div>
                <button onClick={() => setIsKids(v => !v)}
                  className={clsx('relative w-12 h-6 rounded-full transition-colors', isKids ? 'bg-blue-500' : 'bg-white/20')}>
                  <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', isKids ? 'translate-x-6' : '')} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock size={14} className="text-white/40" />
                  <div>
                    <p className="text-sm text-white">PIN</p>
                    <p className="text-xs text-white/30">{pin ? '✓ Impostato' : 'Nessun PIN'}</p>
                  </div>
                </div>
                <button onClick={() => setShowPinInput(v => !v)}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/8 border border-white/10 text-white/60 hover:text-white transition-colors">
                  {pin ? 'Cambia' : 'Imposta'}
                </button>
              </div>

              {showPinInput && (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-2">
                    {[0, 1, 2, 3].map(i => {
                      const d = newPin.split('');
                      return (
                        <input key={i} id={`ep-${i}`} type="password" inputMode="numeric" maxLength={1} value={d[i] ?? ''}
                          onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(-1); const arr = newPin.split('').slice(0, 4); arr[i] = v; setNewPin(arr.join('').slice(0, 4)); if (v && i < 3) (document.getElementById(`ep-${i + 1}`) as HTMLInputElement)?.focus(); }}
                          className="w-11 h-11 text-center text-lg font-bold rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-white" />
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setPin(newPin); setNewPin(''); setShowPinInput(false); }} disabled={newPin.length !== 4}
                      className="px-4 py-1.5 text-xs text-white rounded-full disabled:opacity-40" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
                      Salva PIN
                    </button>
                    {pin && <button onClick={() => { setPin(''); setShowPinInput(false); }} className="px-4 py-1.5 text-xs text-red-400 bg-red-500/10 rounded-full">Rimuovi</button>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ProfileSelect principale ─────────────────────────────────────────────────

export default function ProfileSelect() {
  const { profiles, setActiveProfile, setProfileSelected, addProfile } = useStore();
  const [pinProfile, setPinProfile] = useState<Profile | null>(null);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAvatarId, setNewAvatarId] = useState(AVATARS[0].id);

  function selectProfile(p: Profile) {
    if (editMode) { setEditProfile(p); return; }
    if (p.pin) { setPinProfile(p); return; }
    setActiveProfile(p.id);
    setProfileSelected(true);
  }

  return (
    <div className="min-h-screen bg-[#0c0c10] flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
      <div className="mb-12 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
          <span className="text-white font-bold text-lg">N</span>
        </div>
        <span className="text-2xl font-bold text-white">nuvio</span>
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">
        {editMode ? 'Gestisci profili' : 'Chi guarda?'}
      </h1>
      <p className="text-white/30 text-sm mb-12">
        {editMode ? 'Tocca un profilo per modificarlo' : 'Seleziona il tuo profilo'}
      </p>

      {/* Grid */}
      <div className="flex flex-wrap justify-center gap-10 max-w-3xl mb-10">
        {profiles.map(p => {
          const av = getAvatar(p.avatar ?? AVATARS[0].id);
          return (
            <button key={p.id} onClick={() => selectProfile(p)} className="flex flex-col items-center gap-3 group">
              <div className="relative">
                <div className={clsx(
                  'w-32 h-32 rounded-full overflow-hidden transition-all duration-200 shadow-2xl',
                  'group-hover:ring-4 group-hover:ring-white group-hover:scale-105'
                )}>
                  <AvatarImg av={av} size={128} className="w-full h-full" />
                </div>
                {p.pin && !editMode && (
                  <div className="absolute bottom-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center">
                    <Lock size={11} className="text-white/70" />
                  </div>
                )}
                {p.isKids && (
                  <div className="absolute top-1 left-1 bg-blue-500 rounded-full px-1.5 py-0.5 text-xs font-bold text-white">K</div>
                )}
                {editMode && (
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil size={28} className="text-white" />
                  </div>
                )}
              </div>
              <p className="text-base font-medium text-white/70 group-hover:text-white transition-colors">{p.name}</p>
            </button>
          );
        })}

        {profiles.length < 5 && !editMode && (
          <button onClick={() => setShowAdd(true)} className="flex flex-col items-center gap-3 group">
            <div className="w-32 h-32 rounded-full border-2 border-dashed border-white/15 flex items-center justify-center transition-all group-hover:border-white/40 group-hover:scale-105">
              <Plus size={36} className="text-white/20 group-hover:text-white/50 transition-colors" />
            </div>
            <p className="text-base text-white/30 group-hover:text-white/60 font-medium">Aggiungi</p>
          </button>
        )}
      </div>

      <button onClick={() => setEditMode(v => !v)}
        className="px-6 py-2.5 rounded-full text-sm font-medium border border-white/10 text-white/40 hover:text-white/70 hover:border-white/25 transition-colors">
        {editMode ? '✓ Fine' : 'Gestisci profili'}
      </button>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#141418] rounded-3xl p-6 w-full max-w-sm border border-white/[0.08] space-y-4">
            <h2 className="text-lg font-bold text-white">Nuovo profilo</h2>
            <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus placeholder="Nome profilo"
              className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/[0.08] focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-white text-sm" />
            <div className="grid grid-cols-6 gap-2 max-h-36 overflow-y-auto">
              {AVATARS.filter(a => !a.kids).slice(0, 18).map(av => (
                <button key={av.id} onClick={() => setNewAvatarId(av.id)}
                  className={clsx('w-12 h-12 rounded-full overflow-hidden transition-all border-2',
                    newAvatarId === av.id ? 'border-white scale-110' : 'border-transparent hover:scale-105')}>
                  <AvatarImg av={av} size={48} className="w-full h-full" />
                </button>
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowAdd(false); setNewName(''); }} className="px-5 py-2.5 text-sm text-white/50 bg-white/5 rounded-2xl">Annulla</button>
              <button onClick={() => { if (!newName.trim()) return; addProfile({ name: newName.trim(), avatar: newAvatarId, color: '#7c3aed', isKids: false }); setShowAdd(false); setNewName(''); }}
                disabled={!newName.trim()} className="px-5 py-2.5 text-sm text-white rounded-2xl disabled:opacity-40" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
                Crea profilo
              </button>
            </div>
          </div>
        </div>
      )}

      {pinProfile && <PinDialog profile={pinProfile}
        onSuccess={() => { setActiveProfile(pinProfile.id); setProfileSelected(true); setPinProfile(null); }}
        onCancel={() => setPinProfile(null)} />}
      {editProfile && <EditModal profile={editProfile} onClose={() => setEditProfile(null)} />}
    </div>
  );
}
