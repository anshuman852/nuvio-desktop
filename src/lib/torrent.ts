/**
 * Torrent stub — i magnet vengono gestiti da mpv direttamente.
 * Per stream istantanei usa Real-Debrid + Torrentio (converte magnet in URL HTTP).
 */

export interface TorrentProgress {
  progress: number; downloadSpeed: number; uploadSpeed: number;
  numPeers: number; downloaded: number; total: number;
}

export interface TorrentResult {
  streamUrl: string; fileName: string; fileSize: number; infoHash: string;
}

// Non usata — mpv gestisce i magnet
export async function streamMagnet(_m: string, _cb?: (p: TorrentProgress) => void): Promise<TorrentResult> {
  throw new Error('Usa Real-Debrid + Torrentio per stream diretti.');
}

export async function stopTorrent(_h: string): Promise<void> {}

export function formatSpeed(bps: number): string {
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  if (bps < 1048576) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1048576).toFixed(1)} MB/s`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}
