/**
 * Rating Poster DB (RPDB)
 * Docs: https://ratingposterdb.com/api/
 *
 * Free tier key format: "t0-XXXXX" o semplicemente la key grezza
 * URL poster: https://ratingposterdb.com/{key}/poster/img/{imdbId}.jpg
 * URL alternativo free: https://ratingposterdb.com/{key}/imdb/poster-{imdbId}.jpg
 */

const BASE = 'https://ratingposterdb.com';

export function getRPDBPoster(
  imdbId: string | undefined,
  rpdbKey: string | undefined,
  fallback: string | undefined
): string | undefined {
  if (!imdbId || !rpdbKey) return fallback;
  const cleanId = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;
  return `${BASE}/${rpdbKey}/imdb/poster-${cleanId}.jpg`;
}

export async function validateRPDBKey(key: string): Promise<boolean> {
  if (!key.trim()) return false;
  try {
    // Testa con The Dark Knight - usa il formato corretto
    const url = `${BASE}/${key.trim()}/imdb/poster-tt0468569.jpg`;
    const res = await fetch(url, { method: 'HEAD' });
    // 200 = valida, 401/403 = non valida, 404 = key format ok ma film non trovato (accettiamo)
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}
