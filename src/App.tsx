import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Home, Package, Settings, Search as SearchIcon, X, Menu } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore, useActiveProfile } from './lib/store';

import HomePage from './pages/Home';
import DetailPage from './pages/Detail';
import AddonsPage from './pages/Addons';
import SettingsPage from './pages/Settings';
import SearchPage from './pages/Search';

const NAV = [
  { to: '/', icon: Home, label: 'Home', exact: true },
  { to: '/addons', icon: Package, label: 'Addon' },
  { to: '/settings', icon: Settings, label: 'Impostazioni' },
];

function Sidebar({ collapsed }: { collapsed: boolean }) {
  const activeProfile = useActiveProfile();

  return (
    <aside className={clsx(
      'flex flex-col h-full bg-[#111115] border-r border-white/[0.06] transition-all duration-200 flex-shrink-0',
      collapsed ? 'w-14' : 'w-52'
    )}>
      {/* Logo */}
      <div className={clsx('flex items-center h-14 px-4 border-b border-white/[0.06]', collapsed ? 'justify-center' : 'gap-2')}>
        <div className="w-6 h-6 rounded-md bg-violet-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-xs">N</span>
        </div>
        {!collapsed && <span className="font-bold text-white text-sm tracking-wide">Nuvio</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {NAV.map(({ to, icon: Icon, label, exact }) => (
          <NavLink key={to} to={to} end={exact}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive ? 'bg-violet-600/20 text-violet-400' : 'text-white/50 hover:text-white hover:bg-white/5',
              collapsed && 'justify-center'
            )}>
            <Icon size={17} className="flex-shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>

      {/* Profilo attivo */}
      {!collapsed && (
        <NavLink to="/settings"
          className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.06] hover:bg-white/5 transition-colors">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-base flex-shrink-0"
            style={{ backgroundColor: activeProfile.color + '33' }}
          >
            {activeProfile.avatar ?? '👤'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white/70 truncate">{activeProfile.name}</p>
            <p className="text-xs text-white/30">Nuvio Desktop v0.1.0</p>
          </div>
        </NavLink>
      )}
    </aside>
  );
}

function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <header className="flex items-center gap-3 h-14 px-4 border-b border-white/[0.06] bg-[#0f0f13] flex-shrink-0">
      <button onClick={onToggleSidebar}
        className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
        <Menu size={18} />
      </button>
      <form onSubmit={handleSearch} className="flex-1 max-w-sm">
        <div className="relative">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca film, serie..."
            className="w-full pl-8 pr-4 py-1.5 rounded-lg bg-white/5 border border-white/10 focus:border-violet-500 focus:outline-none text-sm text-white placeholder:text-white/30 transition-colors" />
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  return (
    <div className="flex h-screen bg-[#0f0f13] overflow-hidden">
      <Sidebar collapsed={sidebarCollapsed} />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar onToggleSidebar={() => setSidebarCollapsed((v) => !v)} />
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/detail/:type/:id" element={<DetailPage />} />
            <Route path="/addons" element={<AddonsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/search" element={<SearchPage />} />
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
