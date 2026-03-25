/**
 * Configurazione centralizzata — le chiavi vengono da variabili d'ambiente Vite.
 * In sviluppo: da .env.local
 * In produzione: iniettate da GitHub Actions secrets
 * NESSUNA chiave è hardcoded nel codice sorgente.
 */

// Accesso type-safe a import.meta.env senza richiedere vite/client types
const env = (typeof import.meta !== 'undefined' && (import.meta as any).env)
  ? (import.meta as any).env
  : {};

export const CONFIG = {
  trakt: {
    clientId:     (env.VITE_TRAKT_CLIENT_ID     as string) ?? '',
    clientSecret: (env.VITE_TRAKT_CLIENT_SECRET as string) ?? '',
  },
  mal: {
    clientId: (env.VITE_MAL_CLIENT_ID as string) ?? '',
  },
  simkl: {
    clientId: (env.VITE_SIMKL_CLIENT_ID as string) ?? '',
  },
  tmdb: {
    token: (env.VITE_TMDB_TOKEN as string) ?? '',
  },
} as const;

export const hasTraktKeys  = () => Boolean(CONFIG.trakt.clientId && CONFIG.trakt.clientSecret);
export const hasMALKeys    = () => Boolean(CONFIG.mal.clientId);
export const hasSimklKeys  = () => Boolean(CONFIG.simkl.clientId);
export const hasTMDBToken  = () => Boolean(CONFIG.tmdb.token);
