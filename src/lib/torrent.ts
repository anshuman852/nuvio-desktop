/**
 * WebTorrent bridge — streaming magnet link direttamente nel player HTML5
 * Funziona in Tauri WebView2 tramite WebRTC
 */

let _client: any = null;

async function getClient() {
  if (_client) return _client;
  // Import dinamico per bundle splitting
  const WebTorrent = (await import('webtorrent')).default;
  _client = new WebTorrent({
    // Disabilita tracker annunci per velocità
    announce: [],
  });
  _client.on('error', (e: any) => console.warn('[WebTorrent]', e.message));
  return _client;
}

export interface TorrentProgress {
  progress: number;       // 0-1
  downloadSpeed: number;  // bytes/s
  uploadSpeed: number;
  numPeers: number;
  downloaded: number;
  total: number;
}

export interface TorrentResult {
  // URL blob streamabile per <video src="">
  streamUrl: string;
  fileName: string;
  fileSize: number;
  infoHash: string;
  torrent: any;
}

/**
 * Aggiunge un magnet link a WebTorrent e restituisce lo stream URL
 * per il primo file video trovato.
 */
export async function addMagnet(
  magnetUri: string,
  onProgress?: (p: TorrentProgress) => void,
  timeoutMs = 45000
): Promise<TorrentResult> {
  const wt = await getClient();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout: nessun peer trovato in 45s. Verifica la connessione o usa un servizio Debrid.'));
    }, timeoutMs);

    // Evita torrent duplicati
    const existing = wt.get(magnetUri);
    if (existing) {
      clearTimeout(timer);
      handleTorrent(existing, resolve, reject, onProgress);
      return;
    }

    wt.add(magnetUri, { path: '/tmp/nuvio-torrent' }, (torrent: any) => {
      clearTimeout(timer);
      handleTorrent(torrent, resolve, reject, onProgress);
    });

    wt.on('error', (e: any) => {
      clearTimeout(timer);
      reject(new Error(`WebTorrent: ${e.message}`));
    });
  });
}

function handleTorrent(
  torrent: any,
  resolve: (r: TorrentResult) => void,
  reject: (e: Error) => void,
  onProgress?: (p: TorrentProgress) => void
) {
  const VIDEO_EXTS = /\.(mp4|mkv|avi|mov|webm|m4v|ts|wmv|flv|m2ts)$/i;

  // Trova il file video più grande
  const videoFiles = torrent.files.filter((f: any) => VIDEO_EXTS.test(f.name));
  if (videoFiles.length === 0) {
    reject(new Error('Nessun file video nel torrent'));
    return;
  }
  const file = videoFiles.reduce((a: any, b: any) => a.length > b.length ? a : b);

  // Prioritizza download del file selezionato
  torrent.files.forEach((f: any) => f.deselect());
  file.select();

  // Progress tracking
  if (onProgress) {
    const interval = setInterval(() => {
      if (!torrent.destroyed) {
        onProgress({
          progress: torrent.progress,
          downloadSpeed: torrent.downloadSpeed,
          uploadSpeed: torrent.uploadSpeed,
          numPeers: torrent.numPeers,
          downloaded: torrent.downloaded,
          total: torrent.length,
        });
      } else {
        clearInterval(interval);
      }
    }, 1000);
  }

  // Crea blob URL streamabile (non scarica tutto, usa MediaSource)
  file.getBlobURL((err: any, blobUrl: string) => {
    if (err) {
      // Fallback: usa renderTo su elemento video virtuale
      reject(new Error(`Stream non disponibile: ${err.message}`));
      return;
    }
    resolve({
      streamUrl: blobUrl,
      fileName: file.name,
      fileSize: file.length,
      infoHash: torrent.infoHash,
      torrent,
    });
  });
}

/** Rimuovi torrent (ferma download e libera risorse) */
export async function removeTorrent(infoHashOrMagnet: string) {
  const wt = await getClient();
  const t = wt.get(infoHashOrMagnet);
  if (t) wt.remove(t);
}

/** Distruggi il client WebTorrent */
export async function destroyClient() {
  if (_client) {
    _client.destroy();
    _client = null;
  }
}

/** Formatta velocità in bytes/s */
export function formatSpeed(bps: number): string {
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}