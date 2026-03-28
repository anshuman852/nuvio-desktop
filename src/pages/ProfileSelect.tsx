/// <reference types="vite/client" />
import { useState } from 'react';
import { useStore } from '../lib/store';
import { Profile } from '../lib/types';
import { Plus, Lock, Pencil, Check, X, Eye, EyeOff, Shield } from 'lucide-react';
import clsx from 'clsx';

// ─── Avatar system ────────────────────────────────────────────────────────────
// DiceBear v9 con stili diversi per ogni categoria — affidabile e gratuito
// Stili: adventurer (anime), lorelei (animation), personas (TV/movie), 
//        pixel-art (gaming), bottts (robot), shapes (linear)

export const AVATAR_CATEGORIES = ['All', 'Anime', 'Animation', 'TV', 'Movie', 'Gaming', 'Linear'] as const;
export type AvatarCategory = typeof AVATAR_CATEGORIES[number];

export interface AvatarDef {
  id: string;
  label: string;
  style: string;   // DiceBear style
  seed: string;    // DiceBear seed
  category: AvatarCategory;
}

export const AVATARS: AvatarDef[] = [
  // Anime
  { id: 'a1',  label: 'Goku',      style: 'adventurer', seed: 'goku-warrior',    category: 'Anime' },
  { id: 'a2',  label: 'Naruto',    style: 'adventurer', seed: 'naruto-ninja',    category: 'Anime' },
  { id: 'a3',  label: 'Levi',      style: 'adventurer', seed: 'levi-ackerman',   category: 'Anime' },
  { id: 'a4',  label: 'Eren',      style: 'adventurer', seed: 'eren-titan',      category: 'Anime' },
  { id: 'a5',  label: 'Mikasa',    style: 'adventurer', seed: 'mikasa-scout',    category: 'Anime' },
  { id: 'a6',  label: 'Killua',    style: 'adventurer', seed: 'killua-hunter',   category: 'Anime' },
  { id: 'a7',  label: 'Rem',       style: 'adventurer', seed: 'rem-maid',        category: 'Anime' },
  { id: 'a8',  label: 'Hinata',    style: 'adventurer', seed: 'hinata-byakugan', category: 'Anime' },
  { id: 'a9',  label: 'Luffy',     style: 'adventurer', seed: 'luffy-pirate',    category: 'Anime' },
  { id: 'a10', label: 'Zenitsu',   style: 'adventurer', seed: 'zenitsu-thunder', category: 'Anime' },
  // Animation
  { id: 'an1', label: 'Moana',     style: 'lorelei',    seed: 'moana-ocean',     category: 'Animation' },
  { id: 'an2', label: 'Elsa',      style: 'lorelei',    seed: 'elsa-frozen',     category: 'Animation' },
  { id: 'an3', label: 'Simba',     style: 'adventurer', seed: 'simba-king',      category: 'Animation' },
  { id: 'an4', label: 'Shrek',     style: 'adventurer', seed: 'shrek-ogre',      category: 'Animation' },
  { id: 'an5', label: 'Mirabel',   style: 'lorelei',    seed: 'mirabel-encanto', category: 'Animation' },
  { id: 'an6', label: 'Buzz',      style: 'adventurer', seed: 'buzz-lightyear',  category: 'Animation' },
  // TV
  { id: 't1',  label: 'Geralt',    style: 'personas',   seed: 'geralt-witcher',  category: 'TV' },
  { id: 't2',  label: 'Jon Snow',  style: 'personas',   seed: 'jon-got',         category: 'TV' },
  { id: 't3',  label: 'Walter',    style: 'personas',   seed: 'walter-white',    category: 'TV' },
  { id: 't4',  label: 'Eleven',    style: 'lorelei',    seed: 'eleven-strange',  category: 'TV' },
  { id: 't5',  label: 'Tommy',     style: 'personas',   seed: 'tommy-shelby',    category: 'TV' },
  { id: 't6',  label: 'Tony',      style: 'personas',   seed: 'tony-soprano',    category: 'TV' },
  // Movie
  { id: 'm1',  label: 'Harry',     style: 'personas',   seed: 'harry-potter',    category: 'Movie' },
  { id: 'm2',  label: 'Sparrow',   style: 'personas',   seed: 'jack-sparrow',    category: 'Movie' },
  { id: 'm3',  label: 'Frodo',     style: 'personas',   seed: 'frodo-baggins',   category: 'Movie' },
  { id: 'm4',  label: 'Diana',     style: 'lorelei',    seed: 'diana-wonder',    category: 'Movie' },
  { id: 'm5',  label: 'Deadpool',  style: 'adventurer', seed: 'deadpool-wade',   category: 'Movie' },
  { id: 'm6',  label: 'Thor',      style: 'personas',   seed: 'thor-asgard',     category: 'Movie' },
  // Gaming
  { id: 'g1',  label: 'Kratos',    style: 'personas',   seed: 'kratos-gow',      category: 'Gaming' },
  { id: 'g2',  label: 'Ellie',     style: 'lorelei',    seed: 'ellie-tlou',      category: 'Gaming' },
  { id: 'g3',  label: 'Link',      style: 'adventurer', seed: 'link-zelda',      category: 'Gaming' },
  { id: 'g4',  label: 'Master Ch.', style: 'bottts',    seed: 'master-chief',    category: 'Gaming' },
  { id: 'g5',  label: 'Aloy',      style: 'lorelei',    seed: 'aloy-horizon',    category: 'Gaming' },
  { id: 'g6',  label: 'Joker',     style: 'personas',   seed: 'joker-persona5',  category: 'Gaming' },
  // Linear (colori solidi)
  { id: 'l1',  label: 'Viola',     style: 'shapes',     seed: 'violet',          category: 'Linear' },
  { id: 'l2',  label: 'Blu',       style: 'shapes',     seed: 'blue',            category: 'Linear' },
  { id: 'l3',  label: 'Verde',     style: 'shapes',     seed: 'green',           category: 'Linear' },
  { id: 'l4',  label: 'Rosso',     style: 'shapes',     seed: 'red',             category: 'Linear' },
  { id: 'l5',  label: 'Arancio',   style: 'shapes',     seed: 'orange',          category: 'Linear' },
  { id: 'l6',  label: 'Ciano',     style: 'shapes',     seed: 'cyan',            category: 'Linear' },
];

const DICEBEAR = 'https://api.dicebear.com/9.x';

export function getAvatarUrl(seed: string, style: string, size = 80): string {
  return `${DICEBEAR}/${style}/svg?seed=${encodeURIComponent(seed)}&size=${size}`;
}

export function getAvatar(id: string): AvatarDef {
  return AVATARS.find(a => a.id === id) ?? AVATARS[0];
}
export const AVATAR_SEEDS = AVATARS.map(a => ({ id: a.id, seed: a.seed, label: a.label, style: a.style }));

// Componente avatar
function Av({ id, size = 64, className = '' }: { id: string; size?: number; className?: string }) {
  const av = getAvatar(id);
  const url = getAvatarUrl(av.seed, av.style, size * 2);
  return <img src={url} alt={av.label} className={clsx('object-cover', className)} loading="lazy" />;
}

// ─── PIN Dialog ───────────────────────────────────────────────────────────────

function PinDialog({ profile, onSuccess, onCancel }: { profile: Profile; onSuccess: () => void; onCancel: () => void }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const [show, setShow] = useState(false);

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
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full overflow-hidden"><Av id={profile.avatar ?? AVATARS[0].id} size={80} className="w-full h-full" /></div>
          <h2 className="text-xl font-bold text-white">{profile.name}</h2>
          <p className="text-sm text-white/40 flex items-center gap-1.5"><Lock size={13} />Inserisci il PIN</p>
        </div>
        <div className="flex justify-center gap-3">
          {[0,1,2,3].map(i => (
            <input key={i} id={`pin-${i}`} type={show ? 'text' : 'password'} inputMode="numeric" maxLength={1}
              value={digits[i]} autoFocus={i === 0}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => { if (e.key === 'Backspace' && !digits[i] && i > 0) (document.getElementById(`pin-${i-1}`) as HTMLInputElement)?.focus(); }}
              className={clsx('w-14 h-14 text-center text-2xl font-bold rounded-2xl border-2 bg-white/5 text-white focus:outline-none transition-all',
                error ? 'border-red-500' : digits[i] ? 'border-[color:var(--accent,#7c3aed)]' : 'border-white/10 focus:border-white/30')} />
          ))}
        </div>
        {error && <p className="text-red-400 text-sm">PIN non corretto</p>}
        <div className="flex justify-between">
          <button onClick={() => setShow(v => !v)} className="text-xs text-white/30 flex items-center gap-1">{show ? <EyeOff size={12} /> : <Eye size={12} />}{show ? 'Nascondi' : 'Mostra'}</button>
          <button onClick={onCancel} className="text-xs text-white/30 hover:text-white">Annulla</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const { updateProfile, removeProfile } = useStore();
  const [name, setName] = useState(profile.name);
  const [avatarId, setAvatarId] = useState(profile.avatar ?? AVATARS[0].id);
  const [isKids, setIsKids] = useState(profile.isKids);
  const [pin, setPin] = useState(profile.pin ?? '');
  const [newPin, setNewPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [category, setCategory] = useState<AvatarCategory>('All');

  const filtered = category === 'All' ? AVATARS : AVATARS.filter(a => a.category === category);

  function save() { updateProfile(profile.id, { name, avatar: avatarId, isKids, pin: pin || undefined }); onClose(); }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a1a1f] rounded-2xl w-full max-w-2xl border border-white/[0.08] my-4 overflow-hidden">
        {/* Header stile Nuvio */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <p className="text-xs text-white/40 mb-0.5">Modifica profilo</p>
            <h2 className="text-2xl font-bold text-white">{profile.name}</h2>
          </div>
          <button onClick={save} className="px-6 py-2.5 bg-white text-black font-semibold rounded-full text-sm hover:bg-white/90">Salva</button>
        </div>
        <div className="flex gap-6 p-6">
          {/* Sinistra */}
          <div className="flex flex-col items-center gap-3 w-40 flex-shrink-0">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-[color:var(--accent,#7c3aed)]">
              <Av id={avatarId} size={112} className="w-full h-full" />
            </div>
            <p className="text-sm font-semibold text-white">{name}</p>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-sm text-white text-center" />
            <button onClick={onClose} className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 text-sm">Annulla</button>
            {profile.id !== 'default' && (
              <button onClick={() => { if (confirm('Eliminare?')) { removeProfile(profile.id); onClose(); } }}
                className="text-xs text-red-400">Elimina</button>
            )}
          </div>
          {/* Destra */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Scegli Avatar</p>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {AVATAR_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setCategory(cat)}
                  className={clsx('px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    category === cat ? 'bg-white text-black border-white' : 'border-white/20 text-white/50 hover:text-white')}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-6 gap-2 max-h-56 overflow-y-auto pr-1">
              {filtered.map(av => (
                <button key={av.id} onClick={() => setAvatarId(av.id)} title={av.label}
                  className={clsx('w-14 h-14 rounded-full overflow-hidden border-2 transition-all hover:scale-105',
                    avatarId === av.id ? 'border-white scale-105' : 'border-transparent opacity-75 hover:opacity-100')}>
                  <Av id={av.id} size={56} className="w-full h-full" />
                </button>
              ))}
            </div>
            {avatarId && <p className="text-xs text-white/30 mt-1 text-center">{getAvatar(avatarId).label}</p>}
            <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock size={14} className="text-white/40" />
                  <div><p className="text-sm text-white">PIN</p><p className="text-xs text-white/30">{pin ? '✓ Impostato' : 'Nessun PIN'}</p></div>
                </div>
                <button onClick={() => setShowPinInput(v => !v)} className="text-xs px-3 py-1.5 rounded-full bg-white/8 border border-white/10 text-white/60 hover:text-white">
                  {pin ? 'Cambia' : 'Imposta'}
                </button>
              </div>
              {showPinInput && (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-2">
                    {[0,1,2,3].map(i => (
                      <input key={i} id={`ep-${i}`} type="password" inputMode="numeric" maxLength={1} value={newPin[i]??''}
                        onChange={e => { const v = e.target.value.replace(/\D/g,'').slice(-1); const a = newPin.split('').slice(0,4); a[i]=v; setNewPin(a.join('').slice(0,4)); if(v&&i<3)(document.getElementById(`ep-${i+1}`) as HTMLInputElement)?.focus(); }}
                        className="w-11 h-11 text-center text-lg font-bold rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-white" />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setPin(newPin); setNewPin(''); setShowPinInput(false); }} disabled={newPin.length !== 4}
                      className="px-4 py-1.5 text-xs text-white rounded-full disabled:opacity-40" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>Salva PIN</button>
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

// ─── ProfileSelect ────────────────────────────────────────────────────────────

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
    setActiveProfile(p.id); setProfileSelected(true);
  }

  return (
    <div className="min-h-screen bg-[#0c0c10] flex flex-col items-center justify-center px-6 py-12">
      <div className="mb-12 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
          <span className="text-white font-bold text-lg">N</span>
        </div>
        <span className="text-2xl font-bold text-white">nuvio</span>
      </div>
      <h1 className="text-3xl font-bold text-white mb-2">{editMode ? 'Gestisci profili' : 'Chi guarda?'}</h1>
      <p className="text-white/30 text-sm mb-12">{editMode ? 'Tocca un profilo per modificarlo' : 'Seleziona il tuo profilo'}</p>
      <div className="flex flex-wrap justify-center gap-10 max-w-3xl mb-10">
        {profiles.map(p => (
          <button key={p.id} onClick={() => selectProfile(p)} className="flex flex-col items-center gap-3 group">
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden transition-all group-hover:ring-4 group-hover:ring-white group-hover:scale-105 shadow-2xl">
                <Av id={p.avatar ?? AVATARS[0].id} size={128} className="w-full h-full" />
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

      {showAdd && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#141418] rounded-3xl p-6 w-full max-w-sm border border-white/[0.08] space-y-4">
            <h2 className="text-lg font-bold text-white">Nuovo profilo</h2>
            <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus placeholder="Nome profilo"
              className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/[0.08] focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-white text-sm" />
            <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto">
              {AVATARS.slice(0, 24).map(av => (
                <button key={av.id} onClick={() => setNewAvatarId(av.id)}
                  className={clsx('w-12 h-12 rounded-full overflow-hidden border-2 transition-all',
                    newAvatarId === av.id ? 'border-white scale-110' : 'border-transparent hover:scale-105')}>
                  <Av id={av.id} size={48} className="w-full h-full" />
                </button>
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowAdd(false); setNewName(''); }} className="px-5 py-2.5 text-sm text-white/50 bg-white/5 rounded-2xl">Annulla</button>
              <button onClick={() => { if (!newName.trim()) return; addProfile({ name: newName.trim(), avatar: newAvatarId, color: '#7c3aed', isKids: false }); setShowAdd(false); setNewName(''); }}
                disabled={!newName.trim()} className="px-5 py-2.5 text-sm text-white rounded-2xl disabled:opacity-40" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
                Crea
              </button>
            </div>
          </div>
        </div>
      )}
      {pinProfile && <PinDialog profile={pinProfile} onSuccess={() => { setActiveProfile(pinProfile.id); setProfileSelected(true); setPinProfile(null); }} onCancel={() => setPinProfile(null)} />}
      {editProfile && <EditModal profile={editProfile} onClose={() => setEditProfile(null)} />}
    </div>
  );
}
