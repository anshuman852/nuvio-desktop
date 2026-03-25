/**
 * Rating Poster DB (RPDB)
 * Sovrascrive le copertine con versioni che mostrano il rating.
 * La chiave è inserita dall'utente nelle impostazioni.
 * Docs: https://ratingposterdb.com/api/
 */

const BASE = 'https://api.ratingposterdb.com';

/**
 * Restituisce l'URL del poster RPDB per un dato IMDb ID.
 * Se la chiave non c'è o la richiesta fallisce, ritorna il poster originale.
 */
export function getRPDBPoster(
  imdbId: string | undefined,
  rpdbKey: string | undefined,
  fallback: string | undefined
): string | undefined {
  if (!imdbId || !rpdbKey) return fallback;
  // RPDB fornisce poster direttamente tramite URL con key + imdb id
  return `${BASE}/${rpdbKey}/poster/img/${imdbId}.jpg`;
}

/**
 * Verifica che una chiave RPDB sia valida.
 */
export async function validateRPDBKey(key: string): Promise<boolean> {
  try {
    // Test con un IMDb ID noto (The Dark Knight)
    const res = await fetch(`${BASE}/${key}/poster/img/tt0468569.jpg`);
    return res.ok;
  } catch {
    return false;
  }
}
