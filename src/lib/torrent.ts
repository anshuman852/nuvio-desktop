/**
 * WebTorrent bridge — streaming magnet link nel player HTML5
 * Usa require con ts-ignore per evitare problemi di types
 */

let _client: any = null;

async function getClient(): Promise<any> {
  if (_client) return _client;
  try {
    // @ts-ignore - webtorrent non ha @types
    const WebTorrent = (await import(/* @vite-ignore */ 'webtorrent')).default;
    _client = new WebTorrent();
    _client.on('error', (e: any) => console.warn('[WebTorrent]', e?.message ?? e));
    return _client;
  } catch (err) {
    throw new Error('WebTorrent non disponibile. Esegui: npm install webtorrent');
  }
}

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

export async function addMagnet(
  magnetUri: string,
  onProgress?: (p: TorrentProgress) => void,
  timeoutMs = 60000
): Promise<TorrentResult> {
  const wt = await getClient();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout: nessun peer trovato. Configura Real-Debrid in Torrentio per stream diretti.'));
    }, timeoutMs);

    const existing = wt.get(magnetUri);
    if (existing) { clearTimeout(timer); handleTorrent(existing, resolve, reject, onProgress); return; }

    wt.add(magnetUri, {}, (torrent: any) => { clearTimeout(timer); handleTorrent(torrent, resolve, reject, onProgress); });
    wt.on('error', (e: any) => { clearTimeout(timer); reject(new Error(`WebTorrent: ${e?.message ?? e}`)); });
  });
}

function handleTorrent(torrent: any, resolve: (r: TorrentResult) => void, reject: (e: Error) => void, onProgress?: (p: TorrentProgress) => void) {
  const VIDEO_EXTS = /\.(mp4|mkv|avi|mov|webm|m4v|ts|wmv|flv|m2ts)$/i;
  const videoFiles = torrent.files.filter((f: any) => VIDEO_EXTS.test(f.name));
  if (videoFiles.length === 0) { reject(new Error('Nessun file video nel torrent')); return; }

  const file = videoFiles.reduce((a: any, b: any) => a.length > b.length ? a : b);
  torrent.files.forEach((f: any) => { if (f !== file) f.deselect(); });
  file.select();

  let iv: ReturnType<typeof setInterval> | null = null;
  if (onProgress) {
    iv = setInterval(() => {
      if (!torrent.destroyed) onProgress({ progress: torrent.progress, downloadSpeed: torrent.downloadSpeed, uploadSpeed: torrent.uploadSpeed, numPeers: torrent.numPeers, downloaded: torrent.downloaded, total: torrent.length });
      else if (iv) clearInterval(iv);
    }, 1000);
  }

  file.getBlobURL((err: any, blobUrl: string) => {
    if (iv) clearInterval(iv);
    if (err) { reject(new Error(`Stream non disponibile: ${err.message}`)); return; }
    resolve({ streamUrl: blobUrl, fileName: file.name, fileSize: file.length, infoHash: torrent.infoHash, torrent });
  });
}

export async function removeTorrent(infoHashOrMagnet: string): Promise<void> {
  if (!_client) return;
  const t = _client.get(infoHashOrMagnet);
  if (t) _client.remove(t);
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
