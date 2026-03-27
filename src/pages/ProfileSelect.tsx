/// <reference types="vite/client" />
import { useState } from 'react';
import { useStore } from '../lib/store';
import { Profile } from '../lib/types';
import { Plus, Lock, Pencil, Check, X, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';

export const AVATARS = [
  { id: 'red',     bg: '#E50914', emoji: '😎' },
  { id: 'blue',    bg: '#0071EB', emoji: '🤖' },
  { id: 'green',   bg: '#2ECC71', emoji: '🦁' },
  { id: 'purple',  bg: '#8E44AD', emoji: '🐺' },
  { id: 'orange',  bg: '#E67E22', emoji: '🦊' },
  { id: 'pink',    bg: '#FF6B9D', emoji: '🐱' },
  { id: 'teal',    bg: '#1ABC9C', emoji: '🐸' },
  { id: 'yellow',  bg: '#F1C40F', emoji: '⚡' },
  { id: 'dark',    bg: '#2C3E50', emoji: '🌙' },
  { id: 'crimson', bg: '#C0392B', emoji: '🔥' },
  { id: 'cyan',    bg: '#0891B2', emoji: '💎' },
  { id: 'kids',    bg: '#FF9500', emoji: '🧸' },
];

export function getAvatar(id: string) {
  return AVATARS.find(a => a.id === id) ?? AVATARS[0];
}

// ─── PIN Dialog ───────────────────────────────────────────────────────────────

function PinDialog({ profile, onSuccess, onCancel }: { profile: Profile; onSuccess: () => void; onCancel: () => void }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const [show, setShow] = useState(false);
  const av = getAvatar(profile.avatar);

  function handleDigit(i: number, val: string) {
    const d = val.replace(/\D/g, '').slice(-1);
    const next = [...digits]; next[i] = d; setDigits(next); setError(false);
    if (d && i < 3) (document.getElementById(`pin-${i + 1}`) as HTMLInputElement)?.focus();
    if (d && i === 3) {
      const pin = [...next.slice(0, 3), d].join('');
      setTimeout(() => { if (pin === profile.pin) onSuccess(); else { setError(true); setDigits(['', '', '', '']); setTimeout(() => (document.getElementById('pin-0') as HTMLInputElement)?.focus(), 50); } }, 50);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#141414] rounded-2xl p-8 w-full max-w-sm text-center space-y-6 border border-white/10">
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl" style={{ backgroundColor: av.bg }}>{av.emoji}</div>
          <h2 className="text-xl font-bold text-white">{profile.name}</h2>
          <p className="text-sm text-white/50 flex items-center gap-1.5"><Lock size={13} />Inserisci il PIN</p>
        </div>
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3].map(i => (
            <input key={i} id={`pin-${i}`} type={show ? 'text' : 'password'} inputMode="numeric" maxLength={1}
              value={digits[i]} autoFocus={i === 0}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => { if (e.key === 'Backspace' && !digits[i] && i > 0) (document.getElementById(`pin-${i - 1}`) as HTMLInputElement)?.focus(); }}
              className={clsx('w-14 h-14 text-center text-2xl font-bold rounded-xl border-2 bg-white/5 text-white focus:outline-none transition-all',
                error ? 'border-red-500' : digits[i] ? 'border-[color:var(--accent,#7c3aed)]' : 'border-white/10 focus:border-white/40')} />
          ))}
        </div>
        {error && <p className="text-red-400 text-sm">PIN non corretto</p>}
        <div className="flex justify-between items-center">
          <button onClick={() => setShow(v => !v)} className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60">
            {show ? <EyeOff size={12} /> : <Eye size={12} />}{show ? 'Nascondi' : 'Mostra'}
          </button>
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
  const [avatar, setAvatar] = useState(profile.avatar);
  const [isKids, setIsKids] = useState(profile.isKids);
  const [pin, setPin] = useState(profile.pin ?? '');
  const [newPin, setNewPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const av = getAvatar(avatar);
  const isDefault = profile.id === 'default';

  function save() {
    updateProfile(profile.id, { name, avatar, isKids, pin: pin || undefined });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#141414] rounded-2xl p-8 w-full max-w-lg border border-white/10 space-y-6 my-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Modifica profilo</h2>
          <button onClick={onClose}><X size={20} className="text-white/40 hover:text-white" /></button>
        </div>
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl" style={{ backgroundColor: av.bg }}>{av.emoji}</div>
        </div>
        <div>
          <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Nome</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs text-white/40 uppercase tracking-wider mb-3">Avatar</label>
          <div className="grid grid-cols-6 gap-2">
            {AVATARS.map(a => (
              <button key={a.id} onClick={() => setAvatar(a.id)}
                className={clsx('w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all',
                  avatar === a.id ? 'ring-2 ring-white scale-110' : 'hover:scale-105')}
                style={{ backgroundColor: a.bg }}>{a.emoji}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
          <p className="text-sm text-white">Profilo bambini</p>
          <button onClick={() => setIsKids(v => !v)}
            className={clsx('relative w-11 h-6 rounded-full transition-colors', isKids ? 'bg-[color:var(--accent,#7c3aed)]' : 'bg-white/20')}>
            <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', isKids ? 'translate-x-5' : '')} />
          </button>
        </div>
        <div className="border-t border-white/[0.06] pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white flex items-center gap-2"><Lock size={13} className="text-white/40" />PIN</p>
              <p className="text-xs text-white/40">{pin ? '✓ Impostato' : 'Nessun PIN'}</p>
            </div>
            <button onClick={() => setShowPin(v => !v)} className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-lg">
              {pin ? 'Cambia' : 'Imposta'}
            </button>
          </div>
          {showPin && (
            <div className="space-y-2">
              <div className="flex gap-2 justify-center">
                {[0, 1, 2, 3].map(i => {
                  const digits = newPin.split('');
                  return (
                    <input key={i} id={`ep-${i}`} type="password" inputMode="numeric" maxLength={1}
                      value={digits[i] ?? ''}
                      onChange={e => {
                        const d = e.target.value.replace(/\D/g, '').slice(-1);
                        const arr = newPin.split('').slice(0, 4); arr[i] = d; setNewPin(arr.join('').slice(0, 4));
                        if (d && i < 3) (document.getElementById(`ep-${i + 1}`) as HTMLInputElement)?.focus();
                      }}
                      className="w-12 h-12 text-center text-xl font-bold rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-white" />
                  );
                })}
              </div>
              <div className="flex gap-2 justify-center">
                <button onClick={() => { setPin(newPin); setNewPin(''); setShowPin(false); }} disabled={newPin.length !== 4}
                  className="px-4 py-1.5 text-xs text-white rounded-lg disabled:opacity-40" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>Salva PIN</button>
                {pin && <button onClick={() => { setPin(''); setShowPin(false); }} className="px-4 py-1.5 text-xs text-red-400 bg-red-500/10 rounded-lg">Rimuovi</button>}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          {!isDefault
            ? <button onClick={() => { if (confirm('Eliminare il profilo?')) { removeProfile(profile.id); onClose(); } }} className="text-xs text-red-400 hover:text-red-300">Elimina profilo</button>
            : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-5 py-2 text-sm text-white/60 bg-white/5 rounded-xl hover:bg-white/10">Annulla</button>
            <button onClick={save} className="px-5 py-2 text-sm text-white rounded-xl" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
              <Check size={14} className="inline mr-1" />Salva
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Select ───────────────────────────────────────────────────────────

export default function ProfileSelect() {
  const { profiles, setActiveProfile, setProfileSelected, addProfile } = useStore();
  const [pinProfile, setPinProfile] = useState<Profile | null>(null);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAvatar, setNewAvatar] = useState('blue');

  function selectProfile(p: Profile) {
    if (editMode) { setEditProfile(p); return; }
    if (p.pin) { setPinProfile(p); return; }
    setActiveProfile(p.id);
    setProfileSelected(true);
  }

  return (
    <div className="min-h-screen bg-[#0f0f13] flex flex-col items-center justify-center px-6 py-12">
      <div className="mb-10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
          <span className="text-white font-bold text-lg">N</span>
        </div>
        <span className="text-2xl font-bold text-white tracking-wide">Nuvio</span>
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">{editMode ? 'Gestisci profili' : 'Chi guarda?'}</h1>
      <p className="text-white/40 text-sm mb-12">{editMode ? 'Clicca un profilo per modificarlo' : 'Scegli il tuo profilo'}</p>

      <div className="flex flex-wrap justify-center gap-8 max-w-2xl mb-10">
        {profiles.map(p => {
          const av = getAvatar(p.avatar);
          return (
            <button key={p.id} onClick={() => selectProfile(p)} className="flex flex-col items-center gap-3 group">
              <div className="relative">
                <div className={clsx('w-32 h-32 rounded-2xl flex items-center justify-center text-6xl transition-all duration-200',
                  'group-hover:ring-4 group-hover:ring-white group-hover:scale-105 group-hover:rounded-xl shadow-2xl')}
                  style={{ backgroundColor: av.bg }}>
                  {av.emoji}
                </div>
                {p.pin && !editMode && (
                  <div className="absolute bottom-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center">
                    <Lock size={11} className="text-white/70" />
                  </div>
                )}
                {p.isKids && <div className="absolute top-2 left-2 bg-blue-500 rounded-full px-1.5 py-0.5 text-xs font-bold text-white">K</div>}
                {editMode && (
                  <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil size={28} className="text-white" />
                  </div>
                )}
              </div>
              <p className="text-base font-medium text-white/80 group-hover:text-white transition-colors">{p.name}</p>
            </button>
          );
        })}

        {profiles.length < 5 && !editMode && (
          <button onClick={() => setShowAdd(true)} className="flex flex-col items-center gap-3 group">
            <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center transition-all group-hover:border-white/50 group-hover:scale-105">
              <Plus size={36} className="text-white/30 group-hover:text-white/60 transition-colors" />
            </div>
            <p className="text-base text-white/40 group-hover:text-white/70 font-medium">Aggiungi profilo</p>
          </button>
        )}
      </div>

      <button onClick={() => setEditMode(v => !v)}
        className={clsx('px-6 py-2.5 rounded-xl text-sm font-medium border transition-colors',
          editMode ? 'border-white/30 text-white bg-white/10' : 'border-white/20 text-white/50 hover:text-white hover:border-white/40')}>
        {editMode ? '✓ Fine' : 'Gestisci profili'}
      </button>

      {showAdd && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] rounded-2xl p-8 w-full max-w-md border border-white/10 space-y-6">
            <h2 className="text-xl font-bold text-white">Nuovo profilo</h2>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Nome</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus placeholder="Nome profilo"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-wider mb-3">Avatar</label>
              <div className="grid grid-cols-6 gap-2">
                {AVATARS.map(a => (
                  <button key={a.id} onClick={() => setNewAvatar(a.id)}
                    className={clsx('w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all',
                      newAvatar === a.id ? 'ring-2 ring-white scale-110' : 'hover:scale-105')}
                    style={{ backgroundColor: a.bg }}>{a.emoji}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowAdd(false); setNewName(''); }} className="px-5 py-2.5 text-sm text-white/60 bg-white/5 rounded-xl hover:bg-white/10">Annulla</button>
              <button onClick={() => { if (!newName.trim()) return; addProfile({ name: newName.trim(), avatar: newAvatar, color: '#7c3aed', isKids: false }); setShowAdd(false); setNewName(''); }}
                disabled={!newName.trim()} className="px-5 py-2.5 text-sm text-white rounded-xl disabled:opacity-40" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
                Crea profilo
              </button>
            </div>
          </div>
        </div>
      )}

      {pinProfile && (
        <PinDialog profile={pinProfile}
          onSuccess={() => { setActiveProfile(pinProfile.id); setProfileSelected(true); setPinProfile(null); }}
          onCancel={() => setPinProfile(null)} />
      )}
      {editProfile && <EditModal profile={editProfile} onClose={() => setEditProfile(null)} />}
    </div>
  );
}
