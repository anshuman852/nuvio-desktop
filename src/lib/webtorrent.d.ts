declare module 'webtorrent' {
  export default class WebTorrent {
    constructor(opts?: Record<string, unknown>);
    add(uri: string, opts: Record<string, unknown>, cb: (torrent: any) => void): void;
    get(uri: string): any;
    remove(torrent: any): void;
    destroy(cb?: () => void): void;
    on(event: string, cb: (...args: any[]) => void): void;
  }
}
