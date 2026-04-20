import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { pluginService, ScraperInfo, RepositoryInfo } from '../api/pluginService';
import {
  Plus, RefreshCw, Trash2, Globe, Film, Tv, Check, X,
  Power, PowerOff, TestTube, Loader2, AlertCircle, ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';

export default function PluginsPage() {
  const { nuvioUser } = useStore();
  const [repositories, setRepositories] = useState<RepositoryInfo[]>([]);
  const [scrapers, setScrapers] = useState<ScraperInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [pluginsEnabled, setPluginsEnabled] = useState(true);
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [testingScraper, setTestingScraper] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{
    scraperId: string;
    streams: any[];
    logs: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [repos, scrapersList, enabled] = await Promise.all([
        pluginService.getRepositories(),
        pluginService.getScrapers(),
        pluginService.isPluginsEnabled(),
      ]);
      setRepositories(repos);
      setScrapers(scrapersList);
      setPluginsEnabled(enabled);
    } catch (err) {
      console.error('[PluginsPage] loadData error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load plugins');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRepository = async () => {
    if (!newRepoUrl.trim()) return;
    setError(null);
    try {
      await pluginService.addRepository(newRepoUrl.trim());
      setNewRepoUrl('');
      setShowAddRepo(false);
      await loadData();
    } catch (err) {
      console.error('[PluginsPage] addRepository error:', err);
      setError(
        `Failed to add repository: ${err instanceof Error ? err.message : 'Check the URL and try again'}`
      );
    }
  };

  const handleRemoveRepository = async (repoId: string) => {
    try {
      await pluginService.removeRepository(repoId);
      await loadData();
    } catch (err) {
      console.error(err);
      setError('Failed to remove repository');
    }
  };

  const handleRefreshRepository = async (repoId: string) => {
    try {
      await pluginService.refreshRepository(repoId);
      await loadData();
    } catch (err) {
      console.error(err);
      setError('Failed to refresh repository');
    }
  };

  const handleToggleScraper = async (scraperId: string, enabled: boolean) => {
    try {
      await pluginService.setScraperEnabled(scraperId, enabled);
      await loadData();
    } catch (err) {
      console.error(err);
      setError('Failed to toggle scraper');
    }
  };

  const handleTogglePlugins = async (enabled: boolean) => {
    try {
      await pluginService.setPluginsEnabled(enabled);
      setPluginsEnabled(enabled);
    } catch (err) {
      console.error(err);
      setError('Failed to toggle plugins');
    }
  };

  const handleTestScraper = async (scraperId: string) => {
    setTestingScraper(scraperId);
    setTestResults(null);
    try {
      const result = await pluginService.testScraper(scraperId);
      setTestResults({ scraperId, streams: result.streams, logs: result.logs });
    } catch (err) {
      console.error(err);
      setError('Failed to test scraper');
    } finally {
      setTestingScraper(null);
    }
  };

  const filteredScrapers = selectedRepo
    ? scrapers.filter(s => s.repositoryId === selectedRepo)
    : scrapers;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-white/40 text-sm">Loading plugins...</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Plugins</h1>
          <p className="text-sm text-white/40 mt-1">Manage content providers and repositories</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10">
            <span className="text-sm text-white/60">Plugins</span>
            <button
              onClick={() => handleTogglePlugins(!pluginsEnabled)}
              className={clsx(
                'p-1 rounded-lg transition-colors',
                pluginsEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              )}
            >
              {pluginsEnabled ? <Power size={14} /> : <PowerOff size={14} />}
            </button>
          </div>
          <button
            onClick={loadData}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
          <span className="text-red-400 text-sm flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400">x</button>
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Repositories</h2>
          <button
            onClick={() => setShowAddRepo(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Plus size={14} /> Add Repository
          </button>
        </div>

        {repositories.length === 0 ? (
          <div className="text-center py-8 bg-white/5 rounded-xl border border-white/10">
            <Globe size={32} className="text-white/20 mx-auto mb-2" />
            <p className="text-white/40 text-sm">No repositories configured</p>
            <p className="text-white/25 text-xs mt-1">Add a repository to get plugins</p>
          </div>
        ) : (
          <div className="space-y-3">
            {repositories.map(repo => (
              <div key={repo.id} className="bg-white/5 rounded-xl border border-white/10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{repo.name}</h3>
                    <span className={clsx(
                      'text-xs px-2 py-0.5 rounded-full',
                      repo.enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    )}>
                      {repo.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRefreshRepository(repo.id)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                      title="Refresh"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      onClick={() => handleRemoveRepository(repo.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-white/40 font-mono break-all">{repo.url}</p>
                <p className="text-xs text-white/30 mt-2">
                  {repo.scraperCount} plugins &bull;{' '}
                  {repo.lastUpdated
                    ? `Updated ${new Date(repo.lastUpdated * 1000).toLocaleDateString()}`
                    : 'Never updated'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Plugins ({filteredScrapers.length})
          </h2>
          {repositories.length > 1 && (
            <select
              value={selectedRepo ?? ''}
              onChange={e => setSelectedRepo(e.target.value || null)}
              className="bg-white/10 text-white text-sm px-3 py-1.5 rounded-lg border border-white/10"
            >
              <option value="">All repositories</option>
              {repositories.map(repo => (
                <option key={repo.id} value={repo.id}>{repo.name}</option>
              ))}
            </select>
          )}
        </div>

        {filteredScrapers.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
            <Film size={32} className="text-white/20 mx-auto mb-2" />
            <p className="text-white/40 text-sm">No plugins found</p>
            <p className="text-white/25 text-xs mt-1">Add a repository and refresh to load plugins</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredScrapers.map(scraper => {
              const isActive = scraper.enabled && pluginsEnabled;
              const disabledByManifest = scraper.manifestEnabled === false;
              return (
                <div
                  key={scraper.id}
                  className={clsx(
                    'bg-white/5 rounded-xl border transition-all p-4',
                    isActive ? 'border-white/20' : 'border-white/10 opacity-70'
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="font-semibold text-white truncate">{scraper.name}</h3>
                      <p className="text-xs text-white/40 mt-0.5 line-clamp-2">
                        {scraper.description || 'No description'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleTestScraper(scraper.id)}
                        disabled={testingScraper === scraper.id}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        title="Test scraper"
                      >
                        {testingScraper === scraper.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <TestTube size={12} />}
                      </button>
                      <button
                        onClick={() => handleToggleScraper(scraper.id, !scraper.enabled)}
                        disabled={disabledByManifest || !pluginsEnabled}
                        className={clsx(
                          'p-1.5 rounded-lg transition-colors',
                          isActive ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40',
                          (disabledByManifest || !pluginsEnabled) && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {isActive ? <Check size={12} /> : <X size={12} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/30 flex-wrap">
                    <span>v{scraper.version}</span>
                    <span>&bull;</span>
                    <div className="flex items-center gap-1">
                      {scraper.supportedTypes?.includes('movie') && <Film size={10} />}
                      {scraper.supportedTypes?.includes('tv') && <Tv size={10} />}
                    </div>
                    {scraper.contentLanguage?.length > 0 && (
                      <>
                        <span>&bull;</span>
                        <span>{scraper.contentLanguage.join(', ').toUpperCase()}</span>
                      </>
                    )}
                  </div>
                  {disabledByManifest && (
                    <p className="text-xs text-yellow-500/70 mt-2">Disabled by repository manifest</p>
                  )}
                  {testResults?.scraperId === scraper.id && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <p className="text-xs text-green-400 mb-1">Found {testResults.streams.length} streams</p>
                      {testResults.streams.slice(0, 3).map((s, i) => (
                        <p key={i} className="text-[10px] text-white/40 truncate">
                          {s.name || s.title || s.url}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddRepo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1e1e24] rounded-2xl border border-white/10 w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-4">Add Repository</h3>
            <input
              type="text"
              value={newRepoUrl}
              onChange={e => setNewRepoUrl(e.target.value)}
              placeholder="https://raw.githubusercontent.com/user/repo/refs/heads/main"
              className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-[color:var(--accent)] mb-2"
              onKeyDown={e => e.key === 'Enter' && handleAddRepository()}
              autoFocus
            />
            <p className="text-xs text-white/30 mb-6">
              Inserisci l'URL della cartella contenente{' '}
              <code className="text-white/50">manifest.json</code>.{' '}
              <a
                href="https://nuvioplugin.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                Trova repository su nuvioplugin.com
                <ExternalLink size={10} className="ml-0.5" />
              </a>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowAddRepo(false); setNewRepoUrl(''); }}
                className="flex-1 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRepository}
                disabled={!newRepoUrl.trim()}
                className="flex-1 px-4 py-2 rounded-xl text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}