import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Home, Package, Settings, Search as SearchIcon, X, Menu, Tv, Library } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore, useActiveProfile } from './lib/store';

import HomePage from './pages/Home';
import DetailPage from './pages/Detail';
import AddonsPage from './pages/Addons';
import SettingsPage from './pages/Settings';
import SearchPage from './pages/Search';
import StreamingPage from './pages/Streaming';
import LibraryPage from './pages/Library';
import PersonDetailPage from './pages/PersonDetail';

// Applica il colore accent come CSS variable globale
function AccentColorApplier() {
  const { settings } = useAppStore();
  useEffect(() => {
    const color = settings.accentColor ?? '#7c3aed';
    document.documentElement.style.setProperty('--accent', color);
    // Genera varianti lighter/darker
    document.documentElement.style.setProperty('--accent-bg', color + '33');
    document.documentElement.style.setProperty('--accent-border', color + '66');
  }, [settings.accentColor]);
  return null;
}

const NAV = [
  { to: '/',          icon: Home,    label: 'Home',         exact: true },
  { to: '/streaming', icon: Tv,      label: 'Streaming',    exact: false },
  { to: '/library',   icon: Library, label: 'Libreria',     exact: false },
  { to: '/addons',    icon: Package, label: 'Addon',        exact: false },
  { to: '/settings',  icon: Settings, label: 'Impostazioni', exact: false },
];

function Sidebar({ collapsed }: { collapsed: boolean }) {
  const activeProfile = useActiveProfile();

  return (
    <aside className={clsx(
      'flex flex-col h-full bg-[#111115] border-r border-white/[0.06] transition-all duration-200 flex-shrink-0',
      collapsed ? 'w-14' : 'w-52'
    )}>
      <div className={clsx('flex items-center h-14 px-4 border-b border-white/[0.06]', collapsed ? 'justify-center' : 'gap-2')}>
        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent, #7c3aed)' }}>
          <span className="text-white font-bold text-xs">N</span>
        </div>
        {!collapsed && <span className="font-bold text-white text-sm tracking-wide">Nuvio</span>}
      </div>

      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {NAV.map(({ to, icon: Icon, label, exact }) => (
          <NavLink key={to} to={to} end={exact}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive ? 'text-white' : 'text-white/50 hover:text-white hover:bg-white/5',
              collapsed && 'justify-center'
            )}
            style={({ isActive }) => isActive ? { backgroundColor: 'var(--accent-bg, rgba(124,58,237,0.2))', color: 'var(--accent, #7c3aed)' } : {}}
          >
            <Icon size={17} className="flex-shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>

      {!collapsed && (
        <NavLink to="/settings"
          className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.06] hover:bg-white/5 transition-colors">
          {activeProfile.avatar?.startsWith('http') ? (
            <img src={activeProfile.avatar} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base flex-shrink-0"
              style={{ backgroundColor: activeProfile.color + '33' }}>
              {activeProfile.avatar ?? '👤'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white/70 truncate">{activeProfile.name}</p>
            <p className="text-xs text-white/30">Nuvio Desktop</p>
          </div>
        </NavLink>
      )}
    </aside>
  );
}

function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  return (
    <header className="flex items-center gap-3 h-14 px-4 border-b border-white/[0.06] bg-[#0f0f13] flex-shrink-0">
      <button onClick={onToggleSidebar}
        className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
        <Menu size={18} />
      </button>
      <form onSubmit={(e) => { e.preventDefault(); if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`); }}
        className="flex-1 max-w-sm">
        <div className="relative">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca film, serie..."
            className="w-full pl-8 pr-4 py-1.5 rounded-lg bg-white/5 border border-white/10 focus:outline-none text-sm text-white placeholder:text-white/30 transition-colors"
            style={{ borderColor: query ? 'var(--accent, #7c3aed)' : undefined }}
          />
          {query && (
            <button type="button" onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>
      </form>
    </header>
  );
}

function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex h-screen bg-[#0f0f13] overflow-hidden">
      <AccentColorApplier />
      <Sidebar collapsed={collapsed} />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar onToggleSidebar={() => setCollapsed((v) => !v)} />
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/"                     element={<HomePage />} />
            <Route path="/detail/:type/:id"     element={<DetailPage />} />
            <Route path="/addons"               element={<AddonsPage />} />
            <Route path="/settings"             element={<SettingsPage />} />
            <Route path="/search"               element={<SearchPage />} />
            <Route path="/streaming"            element={<StreamingPage />} />
            <Route path="/streaming/:serviceId" element={<StreamingPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/person/:personId" element={<PersonDetailPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
