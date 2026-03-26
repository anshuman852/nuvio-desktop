import { useState } from 'react';
import { useAppStore } from '../lib/store';
import { Plus, Lock, Pencil, Check, X, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';
import { Profile } from '../lib/types';

// ─── Avatar Netflix-style ─────────────────────────────────────────────────────

export const NETFLIX_AVATARS = [
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
  return NETFLIX_AVATARS.find((a) => a.id === id) ?? NETFLIX_AVATARS[0];
}

// ─── PIN Dialog ───────────────────────────────────────────────────────────────

function PinDialog({ profile, onSuccess, onCancel }: {
  profile: Profile;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const [show, setShow] = useState(false);

  function handleDigit(i: number, val: string) {
    const d = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    setError(false);

    if (d && i < 3) {
      (document.getElementById(`pin-${i + 1}`) as HTMLInputElement)?.focus();
    }

    // Auto-submit quando tutti e 4 i digit sono inseriti
    if (d && i === 3) {
      const pin = [...next.slice(0, 3), d].join('');
      setTimeout(() => checkPin(pin), 50);
    }
  }

  function handleKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      (document.getElementById(`pin-${i - 1}`) as HTMLInputElement)?.focus();
    }
  }

  function checkPin(pin: string) {
    if (pin === profile.pin) {
      onSuccess();
    } else {
      setError(true);
      setDigits(['', '', '', '']);
      setTimeout(() => (document.getElementById('pin-0') as HTMLInputElement)?.focus(), 100);
    }
  }

  const av = getAvatar(profile.avatar ?? 'red');

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#141414] rounded-2xl p-8 w-full max-w-sm text-center space-y-6 border border-white/10">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-xl flex items-center justify-center text-5xl" style={{ backgroundColor: av.bg }}>
            {av.emoji}
          </div>
          <h2 className="text-xl font-bold text-white">{profile.name}</h2>
          <p className="text-sm text-white/50 flex items-center gap-1.5">
            <Lock size={13} /> Inserisci PIN
          </p>
        </div>

        {/* Input PIN */}
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <input
              key={i}
              id={`pin-${i}`}
              type={show ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={1}
              value={digits[i]}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKey(i, e)}
              autoFocus={i === 0}
              className={clsx(
                'w-14 h-14 text-center text-2xl font-bold rounded-xl border-2 bg-white/5 text-white focus:outline-none transition-all',
                error ? 'border-red-500 shake' : digits[i] ? 'border-[color:var(--accent,#7c3aed)]' : 'border-white/10 focus:border-white/30'
              )}
            />
          ))}
        </div>

        {error && <p className="text-red-400 text-sm">PIN non corretto</p>}

        <div className="flex items-center justify-between">
          <button onClick={() => setShow(v => !v)}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors">
            {show ? <EyeOff size={12} /> : <Eye size={12} />}
            {show ? 'Nascondi' : 'Mostra'}
          </button>
          <button onClick={onCancel} className="text-xs text-white/40 hover:text-white transition-colors">
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

function EditProfileModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const { updateProfile, removeProfile } = useAppStore();
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar ?? 'red');
  const [isKids, setIsKids] = useState(profile.isKids);
  const [pin, setPin] = useState(profile.pin ?? '');
  const [newPin, setNewPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const isDefault = profile.id === 'default';

  function save() {
    updateProfile(profile.id, {
      name,
      avatar,
      avatarType: 'netflix',
      isKids,
      pin: pin || undefined,
    });
    onClose();
  }

  const av = getAvatar(avatar);

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#141414] rounded-2xl p-8 w-full max-w-lg border border-white/10 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Modifica profilo</h2>
          <button onClick={onClose}><X size={20} className="text-white/40 hover:text-white" /></button>
        </div>

        {/* Preview avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl shadow-2xl" style={{ backgroundColor: av.bg }}>
            {av.emoji}
          </div>
        </div>

        {/* Nome */}
        <div>
          <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-white text-sm" />
        </div>

        {/* Scelta avatar */}
        <div>
          <label className="block text-xs text-white/50 uppercase tracking-wider mb-3">Avatar</label>
          <div className="grid grid-cols-6 gap-2">
            {NETFLIX_AVATARS.map((a) => (
              <button key={a.id} onClick={() => setAvatar(a.id)}
                className={clsx(
                  'w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all',
                  avatar === a.id ? 'ring-2 ring-white scale-110' : 'hover:scale-105 hover:ring-1 hover:ring-white/50'
                )}
                style={{ backgroundColor: a.bg }}>
                {a.emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Kids toggle */}
        <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
          <div>
            <p className="text-sm text-white">Profilo bambini</p>
            <p className="text-xs text-white/40">Mostra solo contenuti appropriati</p>
          </div>
          <button onClick={() => setIsKids(v => !v)}
            className={clsx('relative w-11 h-6 rounded-full transition-colors', isKids ? 'bg-[color:var(--accent,#7c3aed)]' : 'bg-white/20')}>
            <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', isKids ? 'translate-x-5' : '')} />
          </button>
        </div>

        {/* PIN */}
        <div className="border-t border-white/[0.06] pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white flex items-center gap-2">
                <Lock size={14} className="text-white/50" /> PIN di accesso
              </p>
              <p className="text-xs text-white/40">{pin ? '✓ PIN impostato' : 'Nessun PIN'}</p>
            </div>
            <button onClick={() => setShowPinInput(v => !v)}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white transition-colors">
              {pin ? 'Cambia' : 'Imposta'}
            </button>
          </div>

          {showPinInput && (
            <div className="space-y-2">
              <div className="flex gap-2 justify-center">
                {[0, 1, 2, 3].map((i) => {
                  const digits = newPin.split('');
                  return (
                    <input key={i} type="password" inputMode="numeric" maxLength={1}
                      value={digits[i] ?? ''}
                      onChange={(e) => {
                        const d = e.target.value.replace(/\D/g, '').slice(-1);
                        const arr = newPin.split('').slice(0, 4);
                        arr[i] = d;
                        setNewPin(arr.join('').slice(0, 4));
                        if (d && i < 3) (document.getElementById(`edit-pin-${i + 1}`) as HTMLInputElement)?.focus();
                      }}
                      id={`edit-pin-${i}`}
                      className="w-12 h-12 text-center text-xl font-bold rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-white"
                    />
                  );
                })}
              </div>
              <div className="flex gap-2 justify-center">
                <button onClick={() => { setPin(newPin); setNewPin(''); setShowPinInput(false); }}
                  disabled={newPin.length !== 4}
                  className="px-4 py-1.5 text-xs text-white rounded-lg disabled:opacity-40 transition-colors"
                  style={{ backgroundColor: 'var(--accent, #7c3aed)' }}>
                  Imposta PIN
                </button>
                {pin && (
                  <button onClick={() => { setPin(''); setShowPinInput(false); }}
                    className="px-4 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg transition-colors">
                    Rimuovi PIN
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Azioni */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          {!isDefault ? (
            <button onClick={() => { if (confirm('Eliminare il profilo?')) { removeProfile(profile.id); onClose(); } }}
              className="text-xs text-red-400 hover:text-red-300 transition-colors">
              Elimina profilo
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-5 py-2 text-sm text-white/60 hover:text-white bg-white/5 rounded-xl transition-colors">
              Annulla
            </button>
            <button onClick={save}
              className="px-5 py-2 text-sm text-white rounded-xl flex items-center gap-2 transition-colors"
              style={{ backgroundColor: 'var(--accent, #7c3aed)' }}>
              <Check size={14} /> Salva
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ProfileSelect principale ─────────────────────────────────────────────────

export default function ProfileSelect() {
  const { profiles, setActiveProfile, setProfileSelected, addProfile } = useAppStore();
  const [pinProfile, setPinProfile] = useState<Profile | null>(null);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAvatar, setNewAvatar] = useState('red');
  const [editMode, setEditMode] = useState(false);

  function selectProfile(p: Profile) {
    if (p.pin && !editMode) {
      setPinProfile(p);
    } else if (editMode) {
      setEditProfile(p);
    } else {
      setActiveProfile(p.id);
      setProfileSelected(true);
    }
  }

  function handlePinSuccess() {
    if (pinProfile) {
      setActiveProfile(pinProfile.id);
      setProfileSelected(true);
      setPinProfile(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f13] flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
      <div className="mb-10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent, #7c3aed)' }}>
          <span className="text-white font-bold text-lg">N</span>
        </div>
        <span className="text-2xl font-bold text-white tracking-wide">Nuvio</span>
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">
        {editMode ? 'Gestisci profili' : 'Chi guarda?'}
      </h1>
      <p className="text-white/40 text-sm mb-10">
        {editMode ? 'Seleziona un profilo da modificare' : 'Scegli il tuo profilo per continuare'}
      </p>

      {/* Griglia profili */}
      <div className="flex flex-wrap justify-center gap-6 max-w-2xl mb-10">
        {profiles.map((p) => {
          const av = getAvatar(p.avatar ?? 'red');
          return (
            <button key={p.id} onClick={() => selectProfile(p)}
              className="flex flex-col items-center gap-3 group">
              <div className="relative">
                <div className={clsx(
                  'w-28 h-28 rounded-2xl flex items-center justify-center text-6xl transition-all duration-200 shadow-xl',
                  'group-hover:ring-4 group-hover:ring-white group-hover:scale-105 group-hover:rounded-xl'
                )} style={{ backgroundColor: av.bg }}>
                  {av.emoji}
                </div>
                {p.pin && !editMode && (
                  <div className="absolute bottom-2 right-2 w-6 h-6 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center">
                    <Lock size={11} className="text-white/70" />
                  </div>
                )}
                {p.isKids && (
                  <div className="absolute top-2 left-2 bg-blue-500 rounded-full px-1.5 py-0.5 text-xs font-bold text-white">K</div>
                )}
                {editMode && (
                  <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil size={24} className="text-white" />
                  </div>
                )}
              </div>
              <p className={clsx(
                'text-base font-medium transition-colors',
                editMode ? 'text-white/70 group-hover:text-white' : 'text-white/80 group-hover:text-white'
              )}>
                {p.name}
              </p>
            </button>
          );
        })}

        {/* Aggiungi profilo */}
        {profiles.length < 5 && !editMode && (
          <button onClick={() => setShowAdd(true)}
            className="flex flex-col items-center gap-3 group">
            <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center transition-all group-hover:border-white/50 group-hover:scale-105">
              <Plus size={32} className="text-white/30 group-hover:text-white/60 transition-colors" />
            </div>
            <p className="text-base text-white/40 group-hover:text-white/70 font-medium transition-colors">Aggiungi</p>
          </button>
        )}
      </div>

      {/* Bottone gestisci profili */}
      <button onClick={() => setEditMode(v => !v)}
        className={clsx(
          'px-6 py-2.5 rounded-xl text-sm font-medium border transition-colors',
          editMode
            ? 'border-white/30 text-white bg-white/10 hover:bg-white/15'
            : 'border-white/20 text-white/60 hover:text-white hover:border-white/40'
        )}>
        {editMode ? 'Fine' : 'Gestisci profili'}
      </button>

      {/* Modal aggiungi profilo */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] rounded-2xl p-8 w-full max-w-md border border-white/10 space-y-6">
            <h2 className="text-xl font-bold text-white">Nuovo profilo</h2>

            <div>
              <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Nome</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus
                placeholder="Nome profilo"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[color:var(--accent,#7c3aed)] focus:outline-none text-white text-sm" />
            </div>

            <div>
              <label className="block text-xs text-white/50 uppercase tracking-wider mb-3">Avatar</label>
              <div className="grid grid-cols-6 gap-2">
                {NETFLIX_AVATARS.map((a) => (
                  <button key={a.id} onClick={() => setNewAvatar(a.id)}
                    className={clsx('w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all',
                      newAvatar === a.id ? 'ring-2 ring-white scale-110' : 'hover:scale-105')}
                    style={{ backgroundColor: a.bg }}>
                    {a.emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowAdd(false); setNewName(''); }}
                className="px-5 py-2.5 text-sm text-white/60 hover:text-white bg-white/5 rounded-xl transition-colors">
                Annulla
              </button>
              <button onClick={() => {
                if (!newName.trim()) return;
                addProfile({ name: newName.trim(), avatar: newAvatar, avatarType: 'netflix', color: '#7c3aed', isKids: false });
                setShowAdd(false); setNewName('');
              }} disabled={!newName.trim()}
                className="px-5 py-2.5 text-sm text-white rounded-xl disabled:opacity-40 transition-colors"
                style={{ backgroundColor: 'var(--accent, #7c3aed)' }}>
                Crea profilo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Dialog */}
      {pinProfile && (
        <PinDialog profile={pinProfile} onSuccess={handlePinSuccess} onCancel={() => setPinProfile(null)} />
      )}

      {/* Edit Modal */}
      {editProfile && (
        <EditProfileModal profile={editProfile} onClose={() => setEditProfile(null)} />
      )}
    </div>
  );
}
