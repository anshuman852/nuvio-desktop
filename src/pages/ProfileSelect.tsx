/// <reference types="vite/client" />
import { useState } from 'react';
import { useStore } from '../lib/store';
import { Profile } from '../lib/types';
import { Plus, Lock, Pencil, Check, X, Eye, EyeOff, Shield } from 'lucide-react';
import clsx from 'clsx';

// ─── Avatar system (stile Nuvio — character avatars via DiceBear) ─────────────
// DiceBear genera avatar SVG deterministici. Ogni seed = avatar fisso.

export const AVATAR_SEEDS = [
  // Bottone/Personaggi animati
  { id: 'alex',    seed: 'alex',    label: 'Alex',     style: 'adventurer' },
  { id: 'morgan',  seed: 'morgan',  label: 'Morgan',   style: 'adventurer' },
  { id: 'riley',   seed: 'riley',   label: 'Riley',    style: 'adventurer' },
  { id: 'sam',     seed: 'sam',     label: 'Sam',      style: 'adventurer' },
  { id: 'casey',   seed: 'casey',   label: 'Casey',    style: 'adventurer' },
  { id: 'taylor',  seed: 'taylor',  label: 'Taylor',   style: 'adventurer' },
  { id: 'jordan',  seed: 'jordan',  label: 'Jordan',   style: 'adventurer' },
  { id: 'charlie', seed: 'charlie', label: 'Charlie',  style: 'adventurer' },
  { id: 'quinn',   seed: 'quinn',   label: 'Quinn',    style: 'adventurer' },
  { id: 'blake',   seed: 'blake',   label: 'Blake',    style: 'adventurer' },
  { id: 'avery',   seed: 'avery',   label: 'Avery',    style: 'adventurer' },
  { id: 'robot',   seed: 'robot1',  label: 'Robot',    style: 'bottts' },
  { id: 'pixel',   seed: 'pixel1',  label: 'Pixel',    style: 'pixel-art' },
  { id: 'mini',    seed: 'mini1',   label: 'Mini',     style: 'miniavs' },
  { id: 'fun1',    seed: 'fun1',    label: 'Fun',      style: 'fun-emoji' },
  { id: 'kids1',   seed: 'kids1',   label: 'Bimbi 🧸', style: 'adventurer', kids: true },
  { id: 'kids2',   seed: 'kids2',   label: 'Bimbi ⭐', style: 'adventurer', kids: true },
  { id: 'kids3',   seed: 'kids3',   label: 'Bimbi 🦄', style: 'pixel-art',   kids: true },
];

const AVATAR_COLORS = [
  '#7c3aed','#2563eb','#16a34a','#dc2626','#d97706',
  '#0891b2','#be185d','#ea580c','#0d9488','#4f46e5',
];

export function getAvatarUrl(seed: string, style = 'adventurer', size = 80): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=${size}&backgroundColor=${AVATAR_COLORS.map(c => c.replace('#', '')).join(',')}`;
}

export function getAvatar(avatarId: string) {
  const av = AVATAR_SEEDS.find(a => a.id === avatarId);
  if (!av) return AVATAR_SEEDS[0];
  return av;
}

// ─── Avatar Image ─────────────────────────────────────────────────────────────

function AvatarImg({ seed, style, size = 64, className = '' }: { seed: string; style: string; size?: number; className?: string }) {
  const [err, setErr] = useState(false);
  const url = getAvatarUrl(seed, style, size * 2);
  if (err) return (
    <div className={clsx('flex items-center justify-center text-2xl bg-white/10', className)}>👤</div>
  );
  return <img src={url} alt="" className={clsx('w-full h-full', className)} onError={() => setErr(true)} />;
}

// ─── PIN Dialog ───────────────────────────────────────────────────────────────

function PinDialog({ profile, onSuccess, onCancel }: { profile: Profile; onSuccess: () => void; onCancel: () => void }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const [show, setShow] = useState(false);
  const av = getAvatar(profile.avatar ?? AVATAR_SEEDS[0].id);

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
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/5">
            <AvatarImg seed={av.seed} style={av.style} size={80} />
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
                error ? 'border-red-500 bg-red-500/10' : digits[i] ? 'border-[color:var(--accent,#7c3aed)] bg-[color:var(--accent-bg)]' : 'border-white/10 focus:border-white/30')} />
          ))}
        </div>
        {error && <p className="text-red-400 text-sm font-medium">PIN non corretto</p>}
        <div className="flex justify-between items-center">
          <button onClick={() => setShow(v => !v)} className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors">
            {show ? <EyeOff size={12} /> : <Eye size={12} />}{show ? 'Nascondi' : 'Mostra'}
          </button>
          <button onClick={onCancel} className="text-xs text-white/30 hover:text-white transition-colors">Annulla</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const { updateProfile, removeProfile } = useStore();
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar ?? AVATAR_SEEDS[0].id);
  const [isKids, setIsKids] = useState(profile.isKids);
  const [pin, setPin] = useState(profile.pin ?? '');
  const [newPin, setNewPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [filterKids, setFilterKids] = useState(false);
  const isDefault = profile.id === 'default';

  const currentAv = getAvatar(avatar);
  const displaySeeds = filterKids
    ? AVATAR_SEEDS.filter(a => a.kids)
    : AVATAR_SEEDS.filter(a => !a.kids);

  function save() {
    updateProfile(profile.id, { name, avatar, isKids, pin: pin || undefined });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#141418] rounded-3xl p-6 w-full max-w-lg border border-white/[0.08] space-y-5 my-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Modifica profilo</h2>
          <button onClick={onClose}><X size={20} className="text-white/30 hover:text-white" /></button>
        </div>

        {/* Avatar preview */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white/5 border-2 border-[color:var(--accent,#7c3aed)]">
            <AvatarImg seed={currentAv.seed} style={currentAv.style} size={96} />
          </div>
        </div>

        {/* Nome */}
        <div>
          <label className="text-xs text-white/30 uppercase tracking-wider mb-1.5 block">Nome</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/[0.08] focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-white text-sm" />
        </div>

        {/* Filtro adulti/bambini */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs text-white/30 uppercase tracking-wider">Scegli avatar</label>
            <div className="flex gap-1 bg-white/5 rounded-full p-1">
              <button onClick={() => setFilterKids(false)} className={clsx('px-3 py-1 rounded-full text-xs font-medium transition-colors', !filterKids ? 'bg-white text-black' : 'text-white/50 hover:text-white')}>Tutti</button>
              <button onClick={() => setFilterKids(true)} className={clsx('px-3 py-1 rounded-full text-xs font-medium transition-colors', filterKids ? 'bg-white text-black' : 'text-white/50 hover:text-white')}>🧸 Bambini</button>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-2 max-h-52 overflow-y-auto pr-1">
            {displaySeeds.map(av => (
              <button key={av.id} onClick={() => setAvatar(av.id)}
                className={clsx('w-14 h-14 rounded-2xl overflow-hidden transition-all hover:scale-105 border-2',
                  avatar === av.id ? 'border-[color:var(--accent,#7c3aed)] scale-105' : 'border-transparent')}>
                <AvatarImg seed={av.seed} style={av.style} size={56} />
              </button>
            ))}
          </div>
        </div>

        {/* Kids toggle */}
        <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
          <div>
            <p className="text-sm text-white flex items-center gap-2"><Shield size={14} className="text-blue-400" />Profilo bambini</p>
            <p className="text-xs text-white/30">Limita contenuti per adulti</p>
          </div>
          <button onClick={() => setIsKids(v => !v)}
            className={clsx('relative w-12 h-6 rounded-full transition-colors', isKids ? 'bg-blue-500' : 'bg-white/20')}>
            <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', isKids ? 'translate-x-6' : '')} />
          </button>
        </div>

        {/* PIN */}
        <div className="border-t border-white/[0.06] pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white flex items-center gap-2"><Lock size={14} className="text-white/40" />PIN di accesso</p>
              <p className="text-xs text-white/30">{pin ? '✓ Impostato — protegge il profilo' : 'Nessun PIN'}</p>
            </div>
            <button onClick={() => setShowPinInput(v => !v)} className="text-xs px-3 py-1.5 bg-white/8 hover:bg-white/12 text-white rounded-xl transition-colors border border-white/[0.08]">
              {pin ? 'Cambia' : 'Imposta'}
            </button>
          </div>
          {showPinInput && (
            <div className="space-y-2">
              <div className="flex gap-2 justify-center">
                {[0, 1, 2, 3].map(i => {
                  const digits = newPin.split('');
                  return (
                    <input key={i} id={`ep-${i}`} type="password" inputMode="numeric" maxLength={1} value={digits[i] ?? ''}
                      onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(-1); const arr = newPin.split('').slice(0, 4); arr[i] = d; setNewPin(arr.join('').slice(0, 4)); if (d && i < 3) (document.getElementById(`ep-${i + 1}`) as HTMLInputElement)?.focus(); }}
                      className="w-12 h-12 text-center text-xl font-bold rounded-2xl bg-white/5 border border-white/10 focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-white" />
                  );
                })}
              </div>
              <div className="flex gap-2 justify-center">
                <button onClick={() => { setPin(newPin); setNewPin(''); setShowPinInput(false); }} disabled={newPin.length !== 4}
                  className="px-4 py-1.5 text-xs text-white rounded-xl disabled:opacity-40 transition-colors" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
                  Imposta PIN
                </button>
                {pin && <button onClick={() => { setPin(''); setShowPinInput(false); }} className="px-4 py-1.5 text-xs text-red-400 bg-red-500/10 rounded-xl transition-colors">Rimuovi</button>}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          {!isDefault ? (
            <button onClick={() => { if (confirm('Eliminare il profilo?')) { removeProfile(profile.id); onClose(); } }}
              className="text-xs text-red-400 hover:text-red-300 transition-colors">Elimina profilo</button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-5 py-2 text-sm text-white/50 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">Annulla</button>
            <button onClick={save} className="px-5 py-2 text-sm text-white rounded-2xl flex items-center gap-2 transition-colors" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
              <Check size={14} />Salva
            </button>
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
  const [newAvatar, setNewAvatar] = useState(AVATAR_SEEDS[0].id);

  function selectProfile(p: Profile) {
    if (editMode) { setEditProfile(p); return; }
    if (p.pin) { setPinProfile(p); return; }
    setActiveProfile(p.id);
    setProfileSelected(true);
  }

  return (
    <div className="min-h-screen bg-[#0c0c10] flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
      <div className="mb-10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-xl" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
          <span className="text-white font-bold text-lg">N</span>
        </div>
        <span className="text-2xl font-bold text-white tracking-wide">Nuvio</span>
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">
        {editMode ? 'Gestisci profili' : 'Chi guarda?'}
      </h1>
      <p className="text-white/30 text-sm mb-12">
        {editMode ? 'Tocca un profilo per modificarlo' : 'Seleziona il tuo profilo per continuare'}
      </p>

      {/* Profile grid */}
      <div className="flex flex-wrap justify-center gap-8 max-w-3xl mb-10">
        {profiles.map(p => {
          const av = getAvatar(p.avatar ?? AVATAR_SEEDS[0].id);
          return (
            <button key={p.id} onClick={() => selectProfile(p)} className="flex flex-col items-center gap-3 group">
              <div className="relative">
                <div className={clsx(
                  'w-32 h-32 rounded-3xl overflow-hidden transition-all duration-200 shadow-2xl',
                  'group-hover:ring-4 group-hover:ring-white group-hover:scale-105',
                  editMode && 'group-hover:brightness-75'
                )}>
                  <AvatarImg seed={av.seed} style={av.style} size={128} />
                </div>
                {p.pin && !editMode && (
                  <div className="absolute bottom-2 right-2 w-6 h-6 bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center">
                    <Lock size={11} className="text-white/70" />
                  </div>
                )}
                {p.isKids && (
                  <div className="absolute top-2 left-2 bg-blue-500/90 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-bold text-white">K</div>
                )}
                {editMode && (
                  <div className="absolute inset-0 rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil size={28} className="text-white drop-shadow-xl" />
                  </div>
                )}
              </div>
              <p className="text-base font-medium text-white/70 group-hover:text-white transition-colors">{p.name}</p>
            </button>
          );
        })}

        {profiles.length < 5 && !editMode && (
          <button onClick={() => setShowAdd(true)} className="flex flex-col items-center gap-3 group">
            <div className="w-32 h-32 rounded-3xl border-2 border-dashed border-white/15 flex items-center justify-center transition-all group-hover:border-white/40 group-hover:scale-105 bg-white/[0.02]">
              <Plus size={36} className="text-white/20 group-hover:text-white/50 transition-colors" />
            </div>
            <p className="text-base text-white/30 group-hover:text-white/60 font-medium transition-colors">Aggiungi</p>
          </button>
        )}
      </div>

      <button onClick={() => setEditMode(v => !v)}
        className={clsx('px-6 py-2.5 rounded-2xl text-sm font-medium border transition-colors',
          editMode ? 'border-white/20 text-white bg-white/10' : 'border-white/10 text-white/40 hover:text-white/70 hover:border-white/20')}>
        {editMode ? '✓ Fine' : 'Gestisci profili'}
      </button>

      {/* Add profile modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#141418] rounded-3xl p-6 w-full max-w-md border border-white/[0.08] space-y-5">
            <h2 className="text-lg font-bold text-white">Nuovo profilo</h2>
            <div>
              <label className="text-xs text-white/30 uppercase tracking-wider mb-1.5 block">Nome</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus placeholder="Nome profilo"
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/[0.08] focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-white/30 uppercase tracking-wider mb-3 block">Avatar</label>
              <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto">
                {AVATAR_SEEDS.filter(a => !a.kids).map(av => (
                  <button key={av.id} onClick={() => setNewAvatar(av.id)}
                    className={clsx('w-12 h-12 rounded-2xl overflow-hidden transition-all border-2 hover:scale-105',
                      newAvatar === av.id ? 'border-[color:var(--accent,#7c3aed)] scale-105' : 'border-transparent')}>
                    <AvatarImg seed={av.seed} style={av.style} size={48} />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowAdd(false); setNewName(''); }} className="px-5 py-2.5 text-sm text-white/50 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">Annulla</button>
              <button onClick={() => { if (!newName.trim()) return; addProfile({ name: newName.trim(), avatar: newAvatar, color: '#7c3aed', isKids: false }); setShowAdd(false); setNewName(''); }}
                disabled={!newName.trim()} className="px-5 py-2.5 text-sm text-white rounded-2xl disabled:opacity-40 transition-colors" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
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
