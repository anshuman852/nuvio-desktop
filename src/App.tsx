/// <reference types="vite/client" />
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Home, Search as SearchIcon, Library, Package, Settings, X, Tv } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from './lib/store';
import { getAvatar, getAvatarUrl, AVATAR_SEEDS } from './pages/ProfileSelect';

import HomePage from './pages/Home';
import DetailPage from './pages/Detail';
import AddonsPage from './pages/Addons';
import SettingsPage from './pages/Settings';
import SearchPage from './pages/Search';
import StreamingPage from './pages/Streaming';
import LibraryPage from './pages/Library';
import PersonDetailPage from './pages/PersonDetail';
import ProfileSelectPage from './pages/ProfileSelect';

function AccentApplier() {
  const { settings } = useStore();
  useEffect(() => {
    const c = settings.accentColor ?? '#7c3aed';
    document.documentElement.style.setProperty('--accent', c);
    document.documentElement.style.setProperty('--accent-bg', c + '26');
    document.documentElement.style.setProperty('--accent-border', c + '55');
  }, [settings.accentColor]);
  return null;
}

const NAV = [
  { to: '/',          icon: Home,    label: 'Home',         end: true },
  { to: '/streaming', icon: Tv,      label: 'Streaming',    end: false },
  { to: '/library',   icon: Library, label: 'Libreria',     end: false },
  { to: '/addons',    icon: Package, label: 'Addon',        end: false },
  { to: '/settings',  icon: Settings, label: 'Impostazioni', end: false },
];

function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { profiles, activeProfileId, setProfileSelected } = useStore();
  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? profiles[0];
  const av = getAvatar(activeProfile?.avatar ?? AVATAR_SEEDS[0].id);

  return (
    <aside className={clsx(
      'flex flex-col h-full bg-[#0f0f13]/95 backdrop-blur-xl border-r border-white/[0.05] transition-all duration-200 flex-shrink-0',
      collapsed ? 'w-[60px]' : 'w-[200px]'
    )}>
      {/* Logo */}
      <div className={clsx('flex items-center h-14 border-b border-white/[0.05]', collapsed ? 'justify-center px-0' : 'px-5 gap-2.5')}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
          <span className="text-white font-bold text-sm">N</span>
        </div>
        {!collapsed && <span className="font-bold text-white text-sm tracking-wide">Nuvio</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              collapsed ? 'justify-center px-0' : 'px-3',
              isActive ? 'text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5'
            )}
            style={({ isActive }) => isActive ? { backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' } : {}}>
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Profile */}
      {!collapsed && (
        <button onClick={() => setProfileSelected(false)}
          className="flex items-center gap-2.5 px-4 py-3 border-t border-white/[0.05] hover:bg-white/5 transition-colors">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center text-base flex-shrink-0"
            style={{ backgroundColor: av.bg }}>
            {av.emoji}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-medium text-white/60 truncate">{activeProfile?.name}</p>
            <p className="text-xs text-white/25">Cambia profilo</p>
          </div>
        </button>
      )}
      {collapsed && (
        <button onClick={() => setProfileSelected(false)} className="flex justify-center py-3 border-t border-white/[0.05] hover:bg-white/5 transition-colors">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center text-base" style={{ backgroundColor: av.bg }}>{av.emoji}</div>
        </button>
      )}
    </aside>
  );
}

function SearchBar() {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const navigate = useNavigate();
  return (
    <form onSubmit={e => { e.preventDefault(); if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`); }}
      className="flex-1 max-w-sm">
      <div className={clsx('relative transition-all duration-200', focused ? 'scale-[1.01]' : '')}>
        <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input type="search" value={query} onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder="Cerca film, serie, anime..."
          className={clsx(
            'w-full pl-9 pr-8 py-2 rounded-full text-sm text-white placeholder:text-white/30 focus:outline-none transition-all',
            focused ? 'bg-white/15 border border-white/20' : 'bg-white/8 border border-white/8 hover:bg-white/10'
          )} />
        {query && <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X size={13} /></button>}
      </div>
    </form>
  );
}

function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex h-screen bg-[#0f0f13] overflow-hidden">
      <Sidebar collapsed={collapsed} />
      <div className="flex flex-col flex-1 min-w-0">
        {/* Topbar */}
        <header className="flex items-center gap-3 h-14 px-4 border-b border-white/[0.05] flex-shrink-0">
          <button onClick={() => setCollapsed(v => !v)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-colors">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <SearchBar />
        </header>
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/"                     element={<HomePage />} />
            <Route path="/detail/:type/:id"     element={<DetailPage />} />
            <Route path="/addons"               element={<AddonsPage />} />
            <Route path="/settings"             element={<SettingsPage />} />
            <Route path="/search"               element={<SearchPage />} />
            <Route path="/streaming"            element={<StreamingPage />} />
            <Route path="/streaming/:serviceId" element={<StreamingPage />} />
            <Route path="/library"              element={<LibraryPage />} />
            <Route path="/person/:personId"     element={<PersonDetailPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { profileSelected } = useStore();
  return (
    <BrowserRouter>
      <AccentApplier />
      {profileSelected ? <Layout /> : <ProfileSelectPage />}
    </BrowserRouter>
  );
}
