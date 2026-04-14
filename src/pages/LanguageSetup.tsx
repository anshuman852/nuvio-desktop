import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { Globe, Check, Key, Tv, Eye, EyeOff, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { STREAMING_SERVICES, validateTMDBKey } from '../api/tmdb';

export default function LanguageSetup() {
  const { settings, updateSettings } = useStore();
  const [step, setStep] = useState<'language' | 'tmdb' | 'streaming'>('language');
  const [selectedLang, setSelectedLang] = useState(settings.appLanguage || 'en');
  const [tmdbKey, setTmdbKey] = useState(settings.tmdbApiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [tmdbValidating, setTmdbValidating] = useState(false);
  const [tmdbError, setTmdbError] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>(
    (settings.streamingServices || [])
      .filter(s => s.enabled !== false)
      .map(s => s.id)
  );

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

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleLanguageContinue = () => {
    const selectedLanguage = languages.find(l => l.code === selectedLang);
    if (selectedLanguage) {
      updateSettings({ 
        appLanguage: selectedLang,
        tmdbLanguage: selectedLanguage.tmdbCode
      });
    }
    setStep('tmdb');
  };

  const handleTmdbContinue = async () => {
    if (!tmdbKey.trim()) {
      // Salta TMDB se vuoto
      setStep('streaming');
      return;
    }

    setTmdbValidating(true);
    setTmdbError(null);
    
    try {
      const isValid = await validateTMDBKey(tmdbKey.trim());
      if (isValid) {
        updateSettings({ tmdbApiKey: tmdbKey.trim() });
        setStep('streaming');
      } else {
        setTmdbError('Invalid API key. Please check and try again.');
      }
    } catch (err) {
      setTmdbError('Unable to validate API key. You can skip and add it later.');
    } finally {
      setTmdbValidating(false);
    }
  };

  const handleStreamingContinue = () => {
    // Salva i servizi streaming selezionati
    const streamingServices = STREAMING_SERVICES.map(service => ({
      id: service.id,
      enabled: selectedServices.includes(service.id)
    }));
    updateSettings({ streamingServices });
    
    localStorage.setItem('language_selected', 'true');
    window.location.reload();
  };

  const handleSkipTmdb = () => {
    setStep('streaming');
  };

  // Se la lingua è già stata selezionata, non mostrare lo schermo
  useEffect(() => {
    const hasSelected = localStorage.getItem('language_selected');
    if (hasSelected) {
      // Non fare nulla, l'app andrà direttamente al layout
    }
  }, []);

  // Step 1: Selezione Lingua
  if (step === 'language') {
    return (
      <div className="fixed inset-0 z-50 bg-[#0f0f13] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-bg)' }}>
            <Globe size={40} style={{ color: 'var(--accent)' }} />
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to Nuvio</h1>
          <p className="text-white/50 mb-8">Select your preferred language</p>
          
          <div className="space-y-2 mb-8 max-h-[400px] overflow-y-auto px-2">
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => setSelectedLang(lang.code)}
                className={clsx(
                  'w-full flex items-center gap-4 px-5 py-4 rounded-xl border transition-all text-left',
                  selectedLang === lang.code
                    ? 'border-[color:var(--accent)] bg-[color:var(--accent-bg)]'
                    : 'border-white/10 hover:border-white/20 bg-white/5'
                )}
              >
                <span className="text-2xl">{lang.flag}</span>
                <div className="flex-1">
                  <p className="text-base font-semibold text-white">{lang.name}</p>
                  <p className="text-xs text-white/40">{lang.tmdbCode}</p>
                </div>
                {selectedLang === lang.code && (
                  <Check size={20} style={{ color: 'var(--accent)' }} />
                )}
              </button>
            ))}
          </div>
          
          <button
            onClick={handleLanguageContinue}
            className="w-full py-3 rounded-xl text-white font-medium transition-colors"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Continue
          </button>
          
          <p className="text-xs text-white/30 mt-4">
            You can change the language later in Settings
          </p>
        </div>
      </div>
    );
  }

  // Step 2: TMDB API Key
  if (step === 'tmdb') {
    return (
      <div className="fixed inset-0 z-50 bg-[#0f0f13] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full">
          <button 
            onClick={() => setStep('language')}
            className="text-white/40 hover:text-white mb-4 flex items-center gap-1 text-sm"
          >
            ← Back
          </button>
          
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-bg)' }}>
              <Key size={40} style={{ color: 'var(--accent)' }} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">TMDB API Key</h2>
            <p className="text-white/50 text-sm">
              Get better metadata (posters, cast, ratings) by adding a free TMDB API key.
              You can skip this and add it later in Settings.
            </p>
          </div>

          <div className="bg-[#1e1e24] rounded-2xl border border-white/[0.06] p-5 space-y-4">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">API Key v3</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={tmdbKey}
                  onChange={e => setTmdbKey(e.target.value)}
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/[0.08] focus:border-[color:var(--accent)] focus:outline-none text-sm text-white placeholder:text-white/30 font-mono"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-white/30 mt-1.5">
                Get your key from <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="text-[color:var(--accent)] hover:underline">themoviedb.org/settings/api</a>
              </p>
            </div>

            {tmdbError && (
              <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 rounded-xl px-3 py-2">
                <AlertCircle size={13} />
                {tmdbError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleSkipTmdb}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 font-medium transition-colors"
              >
                Skip for now
              </button>
              <button
                onClick={handleTmdbContinue}
                disabled={tmdbValidating}
                className="flex-1 py-3 rounded-xl text-white font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {tmdbValidating ? 'Validating...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Selezione Servizi Streaming
  return (
    <div className="fixed inset-0 z-50 bg-[#0f0f13] flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <button 
          onClick={() => setStep('tmdb')}
          className="text-white/40 hover:text-white mb-4 flex items-center gap-1 text-sm"
        >
          ← Back
        </button>
        
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-bg)' }}>
            <Tv size={40} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Streaming Services</h2>
          <p className="text-white/50 text-sm">
            Select which streaming services you want to see in your Home.
            You can change this later in Settings.
          </p>
        </div>

        <div className="bg-[#1e1e24] rounded-2xl border border-white/[0.06] p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {STREAMING_SERVICES.map(service => (
              <button
                key={service.id}
                onClick={() => toggleService(service.id)}
                className={clsx(
                  'flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                  selectedServices.includes(service.id)
                    ? 'border-[color:var(--accent)] bg-[color:var(--accent-bg)]'
                    : 'border-white/10 hover:border-white/20 bg-white/5'
                )}
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center flex-shrink-0">
                  <img src={service.logo} alt={service.name} className="w-6 h-6 object-contain" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{service.name}</p>
                </div>
                {selectedServices.includes(service.id) && (
                  <Check size={16} style={{ color: 'var(--accent)' }} />
                )}
              </button>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.08]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-white/40">{selectedServices.length} services selected</span>
              <button
                onClick={() => setSelectedServices(selectedServices.length === STREAMING_SERVICES.length ? [] : STREAMING_SERVICES.map(s => s.id))}
                className="text-xs text-[color:var(--accent)] hover:underline"
              >
                {selectedServices.length === STREAMING_SERVICES.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <button
              onClick={handleStreamingContinue}
              className="w-full py-3 rounded-xl text-white font-medium transition-colors"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Complete Setup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}