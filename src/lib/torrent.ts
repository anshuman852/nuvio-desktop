/**
 * Torrent/Magnet handler
 * Per i magnet link: mpv li gestisce nativamente se c'è un client torrent nel sistema.
 * Per stream diretti (RealDebrid/AllDebrid via Torrentio): usa HTML5 player.
 */

export interface TorrentProgress {
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  numPeers: number;
  downloaded: number;
  total: number;
}

export interface TorrentResult {
  streamUrl: string;
  fileName: string;
  fileSize: number;
  infoHash: string;
  torrent: any;
}

/** Estrai infoHash da un magnet URI */
export function parseInfoHash(magnetUri: string): string | null {
  const match = magnetUri.match(/xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
  return match ? match[1].toLowerCase() : null;
}

/** Placeholder: stub per compatibilità con VideoPlayer */
export async function addMagnet(
  _magnetUri: string,
  _onProgress?: (p: TorrentProgress) => void,
  _timeoutMs?: number
): Promise<TorrentResult> {
  throw new Error('WebTorrent non disponibile. Usa Real-Debrid con Torrentio per stream diretti.');
}

export async function removeTorrent(_infoHashOrMagnet: string): Promise<void> {
  // no-op
}

export function formatSpeed(bps: number): string {
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  if (bps < 1048576) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1048576).toFixed(1)} MB/s`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}
