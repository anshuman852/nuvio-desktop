// frontend/src/lib/tauri-plugin.ts
import { invoke } from '@tauri-apps/api/core';

export interface RepositoryInfo {
  id: string;
  name: string;
  url: string;
  description: string | null;
  enabled: boolean;
  last_updated: number;
  scraper_count: number;
}

export interface ScraperInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  filename: string;
  supported_types: string[];
  enabled: boolean;
  manifest_enabled: boolean;
  logo: string | null;
  content_language: string[];
  repository_id: string;
}

export interface StreamResult {
  name: string | null;
  title: string | null;
  url: string;
  quality: string | null;
  size: string | null;
  info_hash: string | null;
  file_idx: number | null;
  headers: Record<string, string> | null;
}

// Repository commands
export async function getRepositories(): Promise<RepositoryInfo[]> {
  return await invoke('plugin_get_repositories');
}

export async function addRepository(url: string): Promise<RepositoryInfo> {
  return await invoke('plugin_add_repository', { url });
}

export async function removeRepository(repoId: string): Promise<void> {
  return await invoke('plugin_remove_repository', { repoId });
}

export async function refreshRepository(repoId: string): Promise<void> {
  return await invoke('plugin_refresh_repository', { repoId });
}

// Scraper commands
export async function getScrapers(): Promise<ScraperInfo[]> {
  return await invoke('plugin_get_scrapers');
}

export async function setScraperEnabled(scraperId: string, enabled: boolean): Promise<void> {
  return await invoke('plugin_set_scraper_enabled', { scraperId, enabled });
}

export async function getStreams(
  mediaType: string,
  tmdbId: string,
  season?: number,
  episode?: number
): Promise<StreamResult[]> {
  return await invoke('plugin_get_streams', { mediaType, tmdbId, season, episode });
}

export async function isPluginEnabled(): Promise<boolean> {
  return await invoke('plugin_is_enabled');
}

export async function setPluginEnabled(enabled: boolean): Promise<void> {
  return await invoke('plugin_set_enabled', { enabled });
}

export async function testScraper(scraperId: string): Promise<{ streams: StreamResult[]; logs: string[] }> {
  return await invoke('plugin_test_scraper', { scraperId });
}