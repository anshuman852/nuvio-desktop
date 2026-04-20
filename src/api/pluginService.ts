// api/pluginService.ts
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../lib/store';

export interface ScraperInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  filename: string;
  supportedTypes: string[];
  enabled: boolean;
  manifestEnabled: boolean;
  logo?: string;
  contentLanguage: string[];
  repositoryId: string;
}

export interface RepositoryInfo {
  id: string;
  name: string;
  url: string;
  description?: string;
  enabled: boolean;
  lastUpdated: number;
  scraperCount: number;
}

export interface StreamResult {
  name?: string;
  title?: string;
  url: string;
  quality?: string;
  size?: string;
  infoHash?: string;
  fileIdx?: number;
  headers?: Record<string, string>;
}

class PluginService {
  private static instance: PluginService;

  static getInstance(): PluginService {
    if (!PluginService.instance) {
      PluginService.instance = new PluginService();
    }
    return PluginService.instance;
  }

  // ── Repository management ──────────────────────────────────────────────────

  async getRepositories(): Promise<RepositoryInfo[]> {
    return await invoke('plugin_get_repositories');
  }

  async addRepository(url: string): Promise<RepositoryInfo> {
    return await invoke('plugin_add_repository', { url });
  }

  async removeRepository(repoId: string): Promise<void> {
    return await invoke('plugin_remove_repository', { repoId });
  }

  async refreshRepository(repoId: string): Promise<void> {
    return await invoke('plugin_refresh_repository', { repoId });
  }

  // ── Scraper management ────────────────────────────────────────────────────

  async getScrapers(): Promise<ScraperInfo[]> {
    return await invoke('plugin_get_scrapers');
  }

  async setScraperEnabled(scraperId: string, enabled: boolean): Promise<void> {
    return await invoke('plugin_set_scraper_enabled', { scraperId, enabled });
  }

  // ── Plugin execution ──────────────────────────────────────────────────────

  // NOTA: il parametro si chiama "mediaType" (non "type") per matchare il comando Rust
  async getStreams(
    mediaType: string,
    tmdbId: string,
    season?: number,
    episode?: number
  ): Promise<StreamResult[]> {
    return await invoke('plugin_get_streams', { mediaType, tmdbId, season, episode });
  }

  // ── Global enable/disable ─────────────────────────────────────────────────

  async isPluginsEnabled(): Promise<boolean> {
    return await invoke('plugin_is_enabled');
  }

  async setPluginsEnabled(enabled: boolean): Promise<void> {
    return await invoke('plugin_set_enabled', { enabled });
  }

  // ── Test ──────────────────────────────────────────────────────────────────

  async testScraper(scraperId: string): Promise<{ streams: StreamResult[]; logs: string[] }> {
    return await invoke('plugin_test_scraper', { scraperId });
  }

  // ── Cloud sync (stub — comandi non ancora implementati nel backend) ────────

  async syncFromCloud(): Promise<void> {
    // Non ancora implementato lato Rust, no-op per ora
    console.warn('[pluginService] syncFromCloud: not yet implemented');
  }
}

export const pluginService = PluginService.getInstance();