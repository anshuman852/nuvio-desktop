# Guida creazione API keys

## 1. Trakt.tv

1. Vai su https://trakt.tv/oauth/applications/new
2. Compila:
   - **Name**: Nuvio Desktop
   - **Description**: Desktop client for Nuvio
   - **Redirect URI**: `urn:ietf:wg:oauth:2.0:oob` (per device flow)
   - **Javascript (CORS) Origins**: lascia vuoto
3. Clicca **Save App**
4. Copia **Client ID** e **Client Secret**

## 2. MyAnimeList

1. Vai su https://myanimelist.net/apiconfig/create
2. Compila:
   - **App Name**: Nuvio Desktop
   - **App Type**: other
   - **App Description**: Desktop media client
   - **App Redirect URL**: `https://nuvio.local/callback` (qualsiasi URL, non usato)
   - **Homepage URL**: `https://github.com/TUO_USERNAME/nuvio-desktop`
3. Clicca **Submit**
4. Copia **Client ID**

## 3. TMDB

1. Vai su https://www.themoviedb.org/settings/api
2. Clicca **Create** → **Developer**
3. Compila il form (uso personale/non commerciale)
4. Copia **API Read Access Token (v4 auth)**

## 4. RPDB

1. Vai su https://ratingposterdb.com
2. Registrati e vai su Dashboard → API Key
3. Copia la tua API key

## 5. Simkl

1. Vai su https://simkl.com/settings/developer/
2. Clicca **Create new app**
3. Compila:
   - **App name**: Nuvio Desktop
   - **Redirect URI**: `urn:ietf:wg:oauth:2.0:oob`
4. Copia **Client ID**

---

## Come aggiungere le chiavi su GitHub (sicuro, non nel codice)

1. Vai su **GitHub → tuo repo → Settings → Secrets and variables → Actions**
2. Clicca **New repository secret** per ognuna:

| Nome Secret | Valore |
|-------------|--------|
| `VITE_TRAKT_CLIENT_ID` | Il tuo Trakt Client ID |
| `VITE_TRAKT_CLIENT_SECRET` | Il tuo Trakt Client Secret |
| `VITE_MAL_CLIENT_ID` | Il tuo MAL Client ID |
| `VITE_SIMKL_CLIENT_ID` | Il tuo Simkl Client ID |
| `VITE_TMDB_TOKEN` | Il tuo TMDB API Read Token |

> **Nota RPDB**: la chiave RPDB la inserisce l'utente direttamente nelle impostazioni dell'app, non è una chiave di sviluppo. Non serve come secret GitHub.

## File .env.local (per sviluppo locale)

Crea un file `.env.local` nella root del progetto (già in .gitignore):

```
VITE_TRAKT_CLIENT_ID=la_tua_chiave_qui
VITE_TRAKT_CLIENT_SECRET=il_tuo_secret_qui
VITE_MAL_CLIENT_ID=la_tua_chiave_qui
VITE_SIMKL_CLIENT_ID=la_tua_chiave_qui
VITE_TMDB_TOKEN=il_tuo_token_qui
```
