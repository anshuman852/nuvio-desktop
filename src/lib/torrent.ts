// @ts-ignore
declare module 'webtorrent';

/**
 * WebTorrent browser client — streaming P2P direttamente nel player HTML5
 * Usa WebRTC (non Node.js), compatibile con WebView2 di Tauri
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TorrentProgress {
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  numPeers: number;
  downloaded: number;
  total: number;
  timeRemaining?: number;
}

export interface TorrentResult {
  /** URL streamabile (blob: o http://) da passare direttamente a <video src> */
  streamUrl: string;
  fileName: string;
  fileSize: number;
  infoHash: string;
}

let _client: any = null;
let _clientReady = false;

async function getClient(): Promise<any> {
  if (_client && _clientReady) return _client;

  return new Promise(async (resolve, reject) => {
    try {
      // Import dinamico per lazy loading
      const mod = await import('webtorrent');
      const WebTorrent = mod.default ?? mod;
      
      _client = new (WebTorrent as any)({
        maxConns: 55,
        webSeeds: true,
        tracker: {
          announce: [
            'wss://tracker.openwebtorrent.com',
            'wss://tracker.btorrent.xyz',
            'wss://tracker.fastcast.nz',
            'wss://tracker.webtorrent.dev',
          ]
        }
      });

      _client.on('error', (e: any) => {
        console.error('[WebTorrent client error]', e);
      });

      _clientReady = true;
      resolve(_client);
    } catch (err: any) {
      reject(new Error(`WebTorrent non disponibile: ${err.message}`));
    }
  });
}

/**
 * Aggiunge un magnet link e restituisce un URL streamabile.
 * Il video inizia a suonare mentre il download è ancora in corso (streaming progressivo).
 */
export async function streamMagnet(
  magnetUri: string,
  onProgress?: (p: TorrentProgress) => void,
  timeoutMs = 90000
): Promise<TorrentResult> {
  const wt = await getClient();

  return new Promise((resolve, reject) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        reject(new Error('Timeout: nessun peer. Configura Real-Debrid in Torrentio per stream istantanei.'));
      }
    }, timeoutMs);

    // Riutilizza torrent se già scaricato
    const existing = wt.get(magnetUri);
    if (existing) {
      clearTimeout(timer);
      handleTorrent(existing, onProgress, (result) => { resolved = true; resolve(result); }, reject);
      return;
    }

    wt.add(magnetUri, (torrent: any) => {
      clearTimeout(timer);
      handleTorrent(torrent, onProgress, (result) => { resolved = true; resolve(result); }, reject);
    });
  });
}

function handleTorrent(
  torrent: any,
  onProgress: ((p: TorrentProgress) => void) | undefined,
  resolve: (r: TorrentResult) => void,
  reject: (e: Error) => void
) {
  const VIDEO_EXTS = /\.(mp4|mkv|avi|mov|webm|m4v|ts|wmv|flv|m2ts|mpg|mpeg)$/i;
  const files = (torrent.files as any[]);
  const videoFiles = files.filter(f => VIDEO_EXTS.test(f.name));

  if (videoFiles.length === 0) {
    reject(new Error('Nessun file video trovato nel torrent'));
    return;
  }

  // Seleziona il file video più grande
  const file = videoFiles.reduce((a, b) => a.length > b.length ? a : b);
  
  // Deseleziona gli altri file
  files.forEach(f => { if (f.path !== file.path) f.deselect(); });
  file.select();

  // Progress tracking
  let progressInterval: ReturnType<typeof setInterval> | null = null;
  if (onProgress) {
    progressInterval = setInterval(() => {
      if (torrent.destroyed) {
        if (progressInterval) clearInterval(progressInterval);
        return;
      }
      onProgress({
        progress: torrent.progress,
        downloadSpeed: torrent.downloadSpeed,
        uploadSpeed: torrent.uploadSpeed,
        numPeers: torrent.numPeers,
        downloaded: torrent.downloaded,
        total: torrent.length,
        timeRemaining: torrent.timeRemaining,
      });
    }, 500);
  }

  // Crea URL streamabile progressivo
  // streamURL funziona anche con 0% del file scaricato grazie a MediaSource API
  file.getBlobURL((err: any, url: string) => {
    if (progressInterval) clearInterval(progressInterval);
    if (err) {
      // Fallback: appendTo a video element virtuale
      reject(new Error(`Impossibile ottenere stream: ${err.message}`));
      return;
    }
    resolve({
      streamUrl: url,
      fileName: file.name,
      fileSize: file.length,
      infoHash: torrent.infoHash,
    });
  });
}

export async function stopTorrent(infoHashOrMagnet: string): Promise<void> {
  if (!_client) return;
  const t = _client.get(infoHashOrMagnet);
  if (t) {
    await new Promise<void>(res => _client.remove(t, {}, () => res()));
  }
}

export function destroyClient(): void {
  if (_client) {
    _client.destroy();
    _client = null;
    _clientReady = false;
  }
}

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
