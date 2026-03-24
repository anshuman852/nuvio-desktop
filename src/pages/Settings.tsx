import { useAppStore } from '../lib/store';
import { mpvCommand } from '../lib/addon-client';
import { Save, Play, Trash2 } from 'lucide-react';
import { useState } from 'react';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/80 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-white/30 mt-1">{hint}</p>}
    </div>
  );
}

export default function Settings() {
  const { settings, updateSettings, clearHistory, history } = useAppStore();
  const [local, setLocal] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const [mpvTest, setMpvTest] = useState<string | null>(null);

  function handleSave() {
    updateSettings(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function testMpv() {
    setMpvTest('testing');
    try {
      // Invia un comando "no-op" – se mpv non è in esecuzione restituisce errore
      await mpvCommand('get_property', ['playback-time']);
      setMpvTest('ok');
    } catch (e: any) {
      // mpv non è in esecuzione o non è nel PATH
      setMpvTest(e.message ?? 'err');
    }
  }

  const inputClass =
    'w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-violet-500 focus:outline-none text-sm text-white placeholder:text-white/30 transition-colors';

  const selectClass = inputClass + ' cursor-pointer';

  return (
    <div className="px-6 py-6 overflow-y-auto h-full space-y-8 max-w-2xl">
      <h1 className="text-lg font-bold text-white">Impostazioni</h1>

      {/* ── mpv ──────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Player (mpv)</h2>

        <Field
          label="Percorso mpv"
          hint="Lascia 'mpv' se è nel PATH, altrimenti inserisci il percorso completo (es. C:\mpv\mpv.exe)"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={local.mpvPath}
              onChange={(e) => setLocal((p) => ({ ...p, mpvPath: e.target.value }))}
              placeholder="mpv"
              className={inputClass}
            />
            <button
              onClick={testMpv}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white/70 hover:text-white rounded-lg text-sm transition-colors flex-shrink-0"
            >
              <Play size={14} /> Test
            </button>
          </div>
          {mpvTest && (
            <p
              className={`text-xs mt-1 ${
                mpvTest === 'ok'
                  ? 'text-green-400'
                  : mpvTest === 'testing'
                  ? 'text-white/40'
                  : 'text-red-400'
              }`}
            >
              {mpvTest === 'ok'
                ? '✓ mpv risponde correttamente'
                : mpvTest === 'testing'
                ? 'Test in corso...'
                : `✗ ${mpvTest}`}
            </p>
          )}
        </Field>
      </section>

      {/* ── Lingua ───────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Lingua</h2>

        <Field label="Lingua preferita">
          <select
            value={local.language}
            onChange={(e) => setLocal((p) => ({ ...p, language: e.target.value }))}
            className={selectClass}
          >
            <option value="it">Italiano</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
          </select>
        </Field>

        <Field label="Lingua sottotitoli preferita">
          <select
            value={local.subtitleLanguage}
            onChange={(e) => setLocal((p) => ({ ...p, subtitleLanguage: e.target.value }))}
            className={selectClass}
          >
            <option value="it">Italiano</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
          </select>
        </Field>
      </section>

      {/* ── Dati ─────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Dati</h2>

        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
          <div>
            <p className="text-sm text-white">Cronologia visione</p>
            <p className="text-xs text-white/40 mt-0.5">{history.length} elementi salvati</p>
          </div>
          <button
            onClick={() => {
              if (confirm('Cancellare tutta la cronologia?')) clearHistory();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-sm transition-colors"
          >
            <Trash2 size={14} /> Cancella
          </button>
        </div>
      </section>

      {/* ── Salva ────────────────────────────────────────────────────────── */}
      <button
        onClick={handleSave}
        className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium text-sm transition-colors"
      >
        <Save size={15} />
        {saved ? 'Salvato ✓' : 'Salva impostazioni'}
      </button>
    </div>
  );
}
