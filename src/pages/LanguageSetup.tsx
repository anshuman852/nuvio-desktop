import { useState } from 'react';
import { useStore } from '../lib/store';
import { Globe, Check } from 'lucide-react';
import clsx from 'clsx';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧', nativeName: 'English', tmdbCode: 'en-US' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', nativeName: 'Italiano', tmdbCode: 'it-IT' },
  { code: 'es', name: 'Español', flag: '🇪🇸', nativeName: 'Español', tmdbCode: 'es-ES' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', nativeName: 'Français', tmdbCode: 'fr-FR' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', nativeName: 'Deutsch', tmdbCode: 'de-DE' },
  { code: 'pt', name: 'Português', flag: '🇧🇷', nativeName: 'Português', tmdbCode: 'pt-BR' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', nativeName: '日本語', tmdbCode: 'ja-JP' },
  { code: 'ko', name: '한국어', flag: '🇰🇷', nativeName: '한국어', tmdbCode: 'ko-KR' },
  { code: 'zh', name: '中文', flag: '🇨🇳', nativeName: '中文', tmdbCode: 'zh-CN' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺', nativeName: 'Русский', tmdbCode: 'ru-RU' },
];

interface LanguageSetupProps {
  onComplete?: () => void;
}

export default function LanguageSetup({ onComplete }: LanguageSetupProps = {}) {
  const { settings, updateSettings } = useStore();
  const [selectedLang, setSelectedLang] = useState(settings.appLanguage || 'en');

  const handleContinue = () => {
    const lang = LANGUAGES.find(l => l.code === selectedLang);
    if (lang) {
      updateSettings({ 
        appLanguage: selectedLang, 
        tmdbLanguage: lang.tmdbCode 
      });
    }
    localStorage.setItem('language_selected', 'true');
    if (onComplete) {
      onComplete();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0f13] flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-bg)' }}>
          <Globe size={40} style={{ color: 'var(--accent)' }} />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Welcome to Nuvio</h1>
        <p className="text-white/50 mb-8">Select your preferred language</p>
        
        <div className="space-y-2 mb-8 max-h-[400px] overflow-y-auto px-2">
          {LANGUAGES.map(lang => (
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
                <p className="text-base font-semibold text-white">{lang.nativeName}</p>
                <p className="text-xs text-white/40">{lang.name}</p>
              </div>
              {selectedLang === lang.code && (
                <Check size={20} style={{ color: 'var(--accent)' }} />
              )}
            </button>
          ))}
        </div>

        <button
          onClick={handleContinue}
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