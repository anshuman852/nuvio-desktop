/// <reference types="vite/client" />

export const CONFIG = {
  trakt: {
    clientId:     import.meta.env.VITE_TRAKT_CLIENT_ID     ?? '',
    clientSecret: import.meta.env.VITE_TRAKT_CLIENT_SECRET ?? '',
  },
  mal: {
    clientId: import.meta.env.VITE_MAL_CLIENT_ID ?? '',
  },
  simkl: {
    clientId: import.meta.env.VITE_SIMKL_CLIENT_ID ?? '',
  },
  tmdb: {
    token: import.meta.env.VITE_TMDB_TOKEN ?? '',
  },
} as const;

export const hasTraktKeys  = () => Boolean(CONFIG.trakt.clientId && CONFIG.trakt.clientSecret);
export const hasMALKeys    = () => Boolean(CONFIG.mal.clientId);
export const hasSimklKeys  = () => Boolean(CONFIG.simkl.clientId);
export const hasTMDBToken  = () => Boolean(CONFIG.tmdb.token);
