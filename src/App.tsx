/// <reference types="vite/client" />
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Home, Package, Settings, Search as SearchIcon, X, Menu, Tv, Library } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from './lib/store';
import { getAvatar } from './pages/ProfileSelect';

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
  const av = getAvatar(activeProfile?.avatar ?? 'red');
  return (
    <aside className={clsx('flex flex-col h-full bg-[#111115] border-r border-white/[0.06] transition-all duration-200 flex-shrink-0', collapsed ? 'w-14' : 'w-52')}>
      <div className={clsx('flex items-center h-14 px-4 border-b border-white/[0.06]', collapsed ? 'justify-center' : 'gap-2')}>
        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent,#7c3aed)' }}>
          <span className="text-white font-bold text-xs">N</span>
        </div>
        {!collapsed && <span className="font-bold text-white text-sm tracking-wide">Nuvio</span>}
      </div>
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => clsx('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors', isActive ? '' : 'text-white/50 hover:text-white hover:bg-white/5', collapsed && 'justify-center')}
            style={({ isActive }) => isActive ? { backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' } : {}}>
            <Icon size={17} className="flex-shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>
      {!collapsed && (
        <button onClick={() => setProfileSelected(false)} className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.06] hover:bg-white/5 transition-colors text-left">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: av.bg }}>{av.emoji}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white/70 truncate">{activeProfile?.name}</p>
            <p className="text-xs text-white/30">Cambia profilo</p>
          </div>
        </button>
      )}
    </aside>
  );
}

function Topbar({ onToggle }: { onToggle: () => void }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  return (
    <header className="flex items-center gap-3 h-14 px-4 border-b border-white/[0.06] bg-[#0f0f13] flex-shrink-0">
      <button onClick={onToggle} className="p-1.5 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors"><Menu size={18} /></button>
      <form onSubmit={e => { e.preventDefault(); if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`); }} className="flex-1 max-w-sm">
        <div className="relative">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cerca film, serie, anime..."
            className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-white/5 border border-white/10 focus:outline-none text-sm text-white placeholder:text-white/30"
            onFocus={e => e.target.style.borderColor = 'var(--accent)'} onBlur={e => e.target.style.borderColor = ''} />
          {query && <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X size={14} /></button>}
        </div>
      </form>
    </header>
  );
}

function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex h-screen bg-[#0f0f13] overflow-hidden">
      <Sidebar collapsed={collapsed} />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar onToggle={() => setCollapsed(v => !v)} />
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
