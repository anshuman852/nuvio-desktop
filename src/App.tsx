/// <reference types="vite/client" />
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Home, Search as SearchIcon, Library, Package, Settings, X, Tv, Compass, Plug, FlaskConical, Minus, Square, Copy, Maximize } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from './lib/store';
import { setAuthToken, getProfilesFromCloud } from './api/nuvio';
import { useT } from './lib/i18n';

import HomePage from './pages/Home';
import DetailPage from './pages/Detail';
import AddonsPage from './pages/Addons';
import SettingsPage from './pages/Settings';
import SearchPage from './pages/Search';
import StreamingPage from './pages/Streaming';
import LibraryPage from './pages/Library';
import PersonDetailPage from './pages/PersonDetail';
import ProfileSelectPage from './pages/ProfileSelect';
import DiscoverPage from './pages/Discover';
import LanguageSetup from './pages/LanguageSetup';
import CatalogPage from './pages/CatalogPage';
import PluginsPage from './pages/PluginsPage';
import TestingPage from './pages/Testing';
import DiscordRPCProvider from './components/DiscordRPCProvider';

function FullscreenHandler() {
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const w = getCurrentWindow();
        if (await w.isFullscreen()) {
          await w.setFullscreen(false);
        } else {
          await w.setFullscreen(true);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return null;
}

function ResizeBorders() {
  const [maxed, setMaxed] = useState(false);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const w = getCurrentWindow();
      setMaxed(await w.isMaximized());
      unlisten = await w.onResized(() => { w.isMaximized().then(setMaxed); });
    })();
    return () => { unlisten?.(); };
  }, []);
  if (maxed) return null;
  // Invisible resize borders for frameless window — 6px edges + 14px corners
  const EDGE = 6;
  const CORNER = 14;
  const cls = (cursor: string) =>
    `fixed bg-transparent z-[9999] ${cursor}`;
  const DIR_MAP: Record<string, string> = {
    n: 'North', s: 'South', e: 'East', w: 'West',
    ne: 'NorthEast', nw: 'NorthWest', se: 'SouthEast', sw: 'SouthWest',
  };
  const startResize = async (dir: string) => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().startResizeDragging(DIR_MAP[dir] as any);
    } catch {}
  };
  return (
    <>
      {/* Top edge */}
      <div className={cls('cursor-n-resize')} style={{ top: 0, left: CORNER, right: CORNER, height: EDGE }}
        onMouseDown={() => startResize('n')} />
      {/* Bottom edge */}
      <div className={cls('cursor-s-resize')} style={{ bottom: 0, left: CORNER, right: CORNER, height: EDGE }}
        onMouseDown={() => startResize('s')} />
      {/* Left edge */}
      <div className={cls('cursor-w-resize')} style={{ top: CORNER, bottom: CORNER, left: 0, width: EDGE }}
        onMouseDown={() => startResize('w')} />
      {/* Right edge */}
      <div className={cls('cursor-e-resize')} style={{ top: CORNER, bottom: CORNER, right: 0, width: EDGE }}
        onMouseDown={() => startResize('e')} />
      {/* Corners */}
      <div className={cls('cursor-nw-resize')} style={{ top: 0, left: 0, width: CORNER, height: CORNER }}
        onMouseDown={() => startResize('nw')} />
      <div className={cls('cursor-ne-resize')} style={{ top: 0, right: 0, width: CORNER, height: CORNER }}
        onMouseDown={() => startResize('ne')} />
      <div className={cls('cursor-sw-resize')} style={{ bottom: 0, left: 0, width: CORNER, height: CORNER }}
        onMouseDown={() => startResize('sw')} />
      <div className={cls('cursor-se-resize')} style={{ bottom: 0, right: 0, width: CORNER, height: CORNER }}
        onMouseDown={() => startResize('se')} />
    </>
  );
}

function TokenRestorer() {
  const { nuvioUser, profiles, activeProfileId, updateProfile } = useStore();
  
  useEffect(() => {
    if (nuvioUser?.token) {
      setAuthToken(nuvioUser.token);
    }
  }, [nuvioUser?.token]);
  
  useEffect(() => {
    if (nuvioUser?.id && nuvioUser.token) {
      getProfilesFromCloud(nuvioUser.id, nuvioUser.token).then(cloudProfiles => {
        if (cloudProfiles && cloudProfiles.length > 0) {
          const mainProfile = cloudProfiles[0];
          const activeProfile = profiles.find(p => p.id === activeProfileId);
          if (activeProfile) {
            updateProfile(activeProfile.id, {
              name: mainProfile.name || activeProfile.name,
              avatarUrl: mainProfile.avatar_url || activeProfile.avatarUrl,
            });
          }
        }
      }).catch(() => {});
    }
  }, [nuvioUser?.id, nuvioUser?.token]);
  
  return null;
}

function WindowControls() {
  const [maxed, setMaxed] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const w = getCurrentWindow();
      setMaxed(await w.isMaximized());
      unlisten = await w.onResized(async () => { setMaxed(await w.isMaximized()); });
    })().catch(() => {});
    return () => { unlisten?.(); };
  }, []);

  const run = (fn: (w: any) => Promise<void>) => async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await fn(getCurrentWindow());
    } catch (err) {
      console.log('[window-controls] action failed:', err);
    }
  };

  // Children of a drag region need `data-tauri-drag-region="false"` to stay
  // clickable instead of starting a drag on mousedown.
  return (
    <div className="flex items-center ml-auto" data-tauri-drag-region="false">
      <button onClick={run(w => w.minimize())} title="Minimize"
        className="w-11 h-10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10">
        <Minus size={16} />
      </button>
      <button onClick={run(async w => {
          if (await w.isMaximized()) await w.unmaximize(); else await w.maximize();
          // Maximize / restore on Windows can reset WebView2 transparency.
          await invoke('force_transparent_webview').catch(() => {});
        })}
        title={maxed ? 'Restore' : 'Maximize'}
        className="w-11 h-10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10">
        {maxed ? <Copy size={13} /> : <Square size={13} />}
      </button>
      <button onClick={run(w => w.close())} title="Close"
        className="w-11 h-10 flex items-center justify-center text-white/60 hover:text-white hover:bg-red-600">
        <X size={16} />
      </button>
    </div>
  );
}

function AccentApplier() {
  const { settings } = useStore();
  useEffect(() => {
    const c = settings.accentColor ?? '#7c3aed';
    document.documentElement.style.setProperty('--accent', c);
    document.documentElement.style.setProperty('--accent-bg', c + '26');
    document.documentElement.style.setProperty('--accent-border', c + '55');
  }, [settings]);
  return null;
}

function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { t } = useT();
  const { profiles, activeProfileId, setProfileSelected, settings } = useStore();
  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? profiles[0];
  const reduceSidebar = !!(settings as any).reduceSidebar;
  const isCollapsed = collapsed || reduceSidebar;

  const NAV = [
    { to: '/', icon: Home, label: t('home'), end: true },
    { to: '/discover', icon: Compass, label: t('discover'), end: false },
    { to: '/library', icon: Library, label: t('library'), end: false },
    { to: '/addons', icon: Package, label: t('addons'), end: false },
    { to: '/plugins', icon: Plug, label: t('plugins'), end: false },
    { to: '/settings', icon: Settings, label: t('settings'), end: false },
    // { to: '/testing', icon: FlaskConical, label: 'Testing', end: false },
  ];

  return (
    <aside className={clsx(
      'flex flex-col h-full bg-[#0f0f13]/95 backdrop-blur-xl border-r border-white/[0.05] transition-all duration-200 flex-shrink-0',
      isCollapsed ? 'w-[60px]' : 'w-[200px]'
    )}>
      <div className={clsx('flex items-center h-14 border-b border-white/[0.05]', isCollapsed ? 'justify-center px-0' : 'px-5 gap-2.5')}>
        <img src="/nuvio-icon.svg" alt="Nuvio" className="w-8 h-8 flex-shrink-0 rounded-xl" />
        {!isCollapsed && <span className="font-bold text-white text-sm tracking-wide">Nuvio</span>}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              isCollapsed ? 'justify-center px-0' : 'px-3',
              isActive ? 'text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5'
            )}
            style={({ isActive }) => isActive ? { backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' } : {}}>
            <Icon size={18} className="flex-shrink-0" />
            {!isCollapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {!isCollapsed && (
        <button onClick={() => setProfileSelected(false)}
          className="flex items-center gap-2.5 px-4 py-3 border-t border-white/[0.05] hover:bg-white/5 transition-colors">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center text-base flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: '#7c3aed26' }}>
            {activeProfile?.avatarUrl ? (
              <img src={activeProfile.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-xs font-bold">{activeProfile?.name?.charAt(0) || 'U'}</span>
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-medium text-white/60 truncate">{activeProfile?.name}</p>
            <p className="text-xs text-white/25">{t('switch_profile')}</p>
          </div>
        </button>
      )}
      {isCollapsed && (
        <button onClick={() => setProfileSelected(false)} className="flex justify-center py-3 border-t border-white/[0.05] hover:bg-white/5 transition-colors">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center text-base overflow-hidden" style={{ backgroundColor: 'var(--accent-bg)' }}>
            {activeProfile?.avatarUrl ? (
              <img src={activeProfile.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-xs font-bold">{activeProfile?.name?.charAt(0) || 'U'}</span>
            )}
          </div>
        </button>
      )}
    </aside>
  );
}

function SearchBar() {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const navigate = useNavigate();
  return (
    <form onSubmit={e => { e.preventDefault(); if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`); }}
      className="flex-1 max-w-sm">
      <div className={clsx('relative transition-all duration-200', focused ? 'scale-[1.01]' : '')}>
        <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--accent)' }} />
        <input 
          type="text" 
          value={query} 
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)} 
          onBlur={() => setFocused(false)}
          placeholder={t('search_placeholder')}
          className={clsx(
            'w-full pl-9 pr-8 py-2 rounded-full text-sm text-white placeholder:text-white/40 focus:outline-none transition-all',
            focused 
              ? 'bg-[#2a2a35] border border-white/20' 
              : 'bg-[#1e1e26] border border-white/[0.08] hover:bg-[#252530]'
          )} 
          style={focused ? { borderColor: 'var(--accent)' } : {}}
        />
        {query && (
          <button 
            type="button" 
            onClick={() => setQuery('')} 
            className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--accent)' }}
          >
            <X size={13} />
          </button>
        )}
      </div>
    </form>
  );
}

function Layout() {
  const { settings } = useStore();
  const reduceSidebar = !!(settings as any).reduceSidebar;
  const [manualCollapsed, setManualCollapsed] = useState(reduceSidebar);
  
  useEffect(() => { setManualCollapsed(reduceSidebar); }, [reduceSidebar]);
  
  return (
    <div className="flex h-screen bg-[#0f0f13] overflow-hidden">
      <DiscordRPCProvider />
      <FullscreenHandler />
      <ResizeBorders />
      <Sidebar collapsed={manualCollapsed} />
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center gap-3 h-14 px-4 border-b border-white/[0.05] flex-shrink-0" data-tauri-drag-region>
          <button onClick={() => { setManualCollapsed(v => !v); }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-colors">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <SearchBar />
          <WindowControls />
        </header>
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/detail/:type/:id" element={<DetailPage />} />
            <Route path="/addons" element={<AddonsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/streaming" element={<StreamingPage />} />
            <Route path="/streaming/:serviceId" element={<StreamingPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/person/:personId" element={<PersonDetailPage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/catalog/:addonId/:catalogType/:catalogId" element={<CatalogPage />} />
            <Route path="/plugins" element={<PluginsPage />} />
            {/* <Route path="/testing" element={<TestingPage />} /> */}

          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { profileSelected } = useStore();
  const [showLanguageSetup, setShowLanguageSetup] = useState(() => {
    return !localStorage.getItem('language_selected');
  });

  // Prevent default browser context menu globally.
  const handleGlobalContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  if (showLanguageSetup) {
    return (
      <BrowserRouter>
        <AccentApplier />
        <LanguageSetup onComplete={() => setShowLanguageSetup(false)} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div onContextMenu={handleGlobalContextMenu}>
        <AccentApplier />
        <TokenRestorer />
        {profileSelected ? <Layout /> : <ProfileSelectPage />}
      </div>
    </BrowserRouter>
  );
}