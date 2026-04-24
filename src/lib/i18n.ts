import { useStore } from './store';

export type TranslationKey = 
  | 'home' | 'discover' | 'library' | 'addons' | 'settings' | 'plugins'
  | 'search' | 'film' | 'series_tv' | 'all_genres' | 'all_years'
  | 'all_platforms' | 'most_popular' | 'top_rated' | 'most_recent'
  | 'continue_watching' | 'in_progress' | 'no_addons' | 'manage_addons'
  | 'configure_tmdb_key' | 'go_to_settings' | 'load_more'
  | 'account_nuvio' | 'profiles' | 'appearance' | 'layout' | 'streaming_services'
  | 'language' | 'integrations' | 'playback' | 'info' | 'clear_history'
  | 'account' | 'sync_from_cloud' | 'logout' | 'login' | 'email' | 'password'
  | 'save' | 'cancel' | 'delete' | 'add_profile' | 'kids_profile'
  | 'accent_color' | 'show_hero_section' | 'reduce_sidebar' | 'horizontal_posters'
  | 'hide_unavailable' | 'autoplay_next' | 'skip_intro' | 'preferred_quality'
  | 'enable_subtitles' | 'external_player' | 'connect_trakt' | 'connected'
  | 'search_placeholder' | 'no_results' | 'results_for' | 'search_hint'
  | 'popular' | 'vote_average' | 'release_date' | 'revenue'
  | 'movies' | 'tv_shows' | 'profile' | 'switch_profile' | 'watch_now'
  | 'details' | 'season' | 'episode' | 'cast' | 'recommendations'
  | 'remove_from_cw' | 'mark_as_watched' | 'watched' | 'info_btn'
  | 'who_is_watching' | 'select_profile' | 'manage_profiles' | 'done' | 'add'
  | 'edit_profile' | 'choose_avatar' | 'new_profile' | 'profile_name' | 'create'
  | 'qr_login' | 'qr_scan_hint' | 'qr_enter_code' | 'qr_waiting' | 'qr_error'
  | 'retry' | 'enter_pin' | 'pin_incorrect' | 'filters_adult_content' | 'tap_to_edit'
  | 'confirm_delete' | 'qr_login_title' | 'welcome' | 'select_language' | 'continue'
  | 'you_can_change_later' | 'loading' | 'back' | 'view_all' | 'add_repository'
  | 'repository_url' | 'install' | 'configure' | 'remove' | 'refresh'
  | 'enabled' | 'disabled' | 'plugins_backend_ok' | 'repositories'
  | 'no_repositories' | 'add_repository_hint' | 'plugins_found' | 'no_plugins'
  | 'test_scraper' | 'logs' | 'found_streams' | 'disabled_by_manifest'
  | 'all_repositories' | 'search_addons' | 'catalog' | 'stremio_web'
  | 'install_via_url' | 'enter_addon_url' | 'no_addons_installed'
  | 'go_to_catalog' | 'version' | 'catalogs' | 'types' | 'configure_addon'
  | 'addon_options' | 'remove_addon' | 'up' | 'down' | 'search_addons_placeholder'
  | 'local_list' | 'no_addons_found' | 'load_more_addons' | 'close' | 'open_in_browser'
  | 'visual_name' | 'logo_url' | 'manifest_url' | 'config_page' | 'configure_in_app'
  | 'save_changes' | 'streaming' | 'tmdb_api_key' | 'skip_for_now' | 'validate'
  | 'valid' | 'invalid' | 'complete_setup' | 'select_services' | 'services_selected'
  | 'select_all' | 'deselect_all' | 'account_settings' | 'avatar' | 'choose_avatar_help'
  | 'filter_adult' | 'delete_profile' | 'edit' | 'create_profile' | 'avatar_catalog'
  | 'add_new_profile' | 'pin_protected' | 'active' | 'sync_completed' | 'sync_error'
  | 'no_internet' | 'retry_connection' | 'update_available' | 'update_now' | 'version_info'
  | 'episodes' | 'in_library' | 'add_to_library' | 'remove_from_library' | 'syncing'
  | 'error_loading' | 'try_again' | 'no_streams' | 'available_streams' | 'plugin_providers'
  | 'no_providers' | 'test_provider' | 'testing' | 'installing' | 'install_repository'
  | 'reload_streams' | 'trakt' | 'simkl' | 'mal' | 'collections' | 'browse_collections';

const translations: Record<string, Record<TranslationKey, string>> = {
  en: {
    home: 'Home', discover: 'Discover', library: 'Library', addons: 'Addons', settings: 'Settings', plugins: 'Plugins',
    search: 'Search', film: 'Movies', series_tv: 'TV Series', all_genres: 'All genres', all_years: 'All years',
    all_platforms: 'All platforms', most_popular: 'Most popular', top_rated: 'Top rated', most_recent: 'Most recent',
    continue_watching: 'Continue Watching', in_progress: 'In progress', no_addons: 'No addons installed', manage_addons: 'Manage Addons',
    configure_tmdb_key: 'Configure TMDB API key in Settings', go_to_settings: 'Settings', load_more: 'Load more',
    account_nuvio: 'Nuvio Account', profiles: 'Profiles', appearance: 'Appearance', layout: 'Layout',
    streaming_services: 'Streaming Services', language: 'Language', integrations: 'Integrations',
    playback: 'Playback', info: 'Info', clear_history: 'Clear history', account: 'Account',
    sync_from_cloud: 'Sync from cloud', logout: 'Logout', login: 'Login', email: 'Email', password: 'Password',
    save: 'Save', cancel: 'Cancel', delete: 'Delete', add_profile: 'Add profile', kids_profile: 'Kids profile',
    accent_color: 'Accent color', show_hero_section: 'Show Hero section', reduce_sidebar: 'Reduce sidebar',
    horizontal_posters: 'Horizontal Posters', hide_unavailable: 'Hide unavailable content',
    autoplay_next: 'Autoplay next episode', skip_intro: 'Skip intro', preferred_quality: 'Preferred quality',
    enable_subtitles: 'Enable subtitles', external_player: 'External player (optional)',
    connect_trakt: 'Connect Trakt.tv', connected: 'Connected',
    search_placeholder: 'Search movies, series, anime...', no_results: 'No results found',
    results_for: 'Results for', search_hint: 'Use the search bar above to find movies and TV series',
    popular: 'Popular', vote_average: 'Vote average', release_date: 'Release date', revenue: 'Revenue',
    movies: 'Movies', tv_shows: 'TV Shows', profile: 'Profile', switch_profile: 'Switch profile',
    watch_now: 'Watch now', details: 'Details', season: 'Season', episode: 'Episode',
    cast: 'Cast', recommendations: 'Recommendations',
    remove_from_cw: 'Remove from Continue Watching', mark_as_watched: 'Mark as watched',
    watched: 'WATCHED', info_btn: 'Info',
    who_is_watching: 'Who\'s watching?', select_profile: 'Select your profile',
    manage_profiles: 'Manage profiles', done: 'Done', add: 'Add',
    edit_profile: 'Edit profile', choose_avatar: 'Choose Avatar', new_profile: 'New profile',
    profile_name: 'Profile name', create: 'Create', qr_login: 'Sign in with QR',
    qr_login_title: 'Sign in with QR', qr_scan_hint: 'Scan with Nuvio mobile or go to',
    qr_enter_code: 'Or enter this code at nuvioapp.space:', qr_waiting: 'Waiting for authorisation...',
    qr_error: 'Code expired or error.', retry: 'Retry', enter_pin: 'Enter PIN',
    pin_incorrect: 'Incorrect PIN', filters_adult_content: 'Filters adult content',
    tap_to_edit: 'Tap a profile to edit it', confirm_delete: 'Delete this profile?',
    welcome: 'Welcome to Nuvio', select_language: 'Select your preferred language',
    continue: 'Continue', you_can_change_later: 'You can change the language later in Settings',
    loading: 'Loading...', back: 'Back', view_all: 'View All',
    add_repository: 'Add Repository', repository_url: 'Repository URL', install: 'Install',
    configure: 'Configure', remove: 'Remove', refresh: 'Refresh', enabled: 'Enabled',
    disabled: 'Disabled', plugins_backend_ok: 'Backend OK', repositories: 'Repositories',
    no_repositories: 'No repositories configured', add_repository_hint: 'Add a repository to get plugins',
    plugins_found: 'plugins', no_plugins: 'No plugins found', test_scraper: 'Test scraper',
    logs: 'Logs', found_streams: 'Found streams', disabled_by_manifest: 'Disabled by repository manifest',
    all_repositories: 'All repositories', search_addons: 'Search addons', catalog: 'Catalog',
    stremio_web: 'Stremio Web', install_via_url: 'Install via URL',
    enter_addon_url: 'Enter addon URL (https://... or stremio://...)',
    no_addons_installed: 'No addons installed', go_to_catalog: 'Go to Stremio Catalog tab to add addons',
    version: 'version', catalogs: 'catalogs', types: 'types', configure_addon: 'Configure addon',
    addon_options: 'Addon options', remove_addon: 'Remove addon', up: 'Up', down: 'Down',
    search_addons_placeholder: 'Search addons (Torrentio, OpenSubtitles, Jackett...)',
    local_list: 'Local list', no_addons_found: 'No addons found', load_more_addons: 'Load more',
    close: 'Close', open_in_browser: 'Open in browser', visual_name: 'Display name',
    logo_url: 'Logo URL', manifest_url: 'Manifest URL',
    config_page: 'Addon configuration page (to set tokens, filters, etc.):',
    configure_in_app: 'Configure in app', save_changes: 'Save changes',
    streaming: 'Streaming', tmdb_api_key: 'TMDB API Key', skip_for_now: 'Skip for now',
    validate: 'Validate', valid: 'Valid', invalid: 'Invalid', complete_setup: 'Complete Setup',
    select_services: 'Select which streaming services you want to see in your Home',
    services_selected: 'services selected', select_all: 'Select All', deselect_all: 'Deselect All',
    account_settings: 'Account Settings', avatar: 'Avatar',
    choose_avatar_help: 'Choose an avatar from the catalog below', filter_adult: 'Filter adult content',
    delete_profile: 'Delete profile', edit: 'Edit', create_profile: 'Create profile',
    avatar_catalog: 'Avatar Catalog', add_new_profile: 'Add new profile', pin_protected: 'PIN protected',
    active: 'Active', sync_completed: 'Sync completed successfully', sync_error: 'Sync error',
    no_internet: 'No internet connection', retry_connection: 'Retry connection',
    update_available: 'Update available', update_now: 'Update now', version_info: 'Version info',
    episodes: 'Episodes', in_library: 'In library', add_to_library: 'Add to library',
    remove_from_library: 'Remove from library', syncing: 'Syncing...', error_loading: 'Error loading',
    try_again: 'Try again', no_streams: 'No streams available', available_streams: 'Available streams',
    plugin_providers: 'Plugin providers', no_providers: 'No providers found', test_provider: 'Test provider',
    testing: 'Testing...', installing: 'Installing...', install_repository: 'Install repository',
    reload_streams: 'Reload streams', trakt: 'Trakt', simkl: 'Simkl', mal: 'MAL',
    collections: 'Collections', browse_collections: 'Browse collections',
  },
  it: {
    home: 'Home', discover: 'Scopri', library: 'Libreria', addons: 'Addon', settings: 'Impostazioni', plugins: 'Plugin',
    search: 'Cerca', film: 'Film', series_tv: 'Serie TV', all_genres: 'Tutti i generi', all_years: 'Tutti gli anni',
    all_platforms: 'Tutte le piattaforme', most_popular: 'Più popolari', top_rated: 'Più votati', most_recent: 'Più recenti',
    continue_watching: 'Continua a guardare', in_progress: 'In corso', no_addons: 'Nessun addon installato', manage_addons: 'Gestisci Addon',
    configure_tmdb_key: 'Configura la chiave API TMDB nelle Impostazioni', go_to_settings: 'Impostazioni', load_more: 'Carica altro',
    account_nuvio: 'Account Nuvio', profiles: 'Profili', appearance: 'Aspetto', layout: 'Layout',
    streaming_services: 'Servizi Streaming', language: 'Lingua', integrations: 'Integrazioni',
    playback: 'Riproduzione', info: 'Informazioni', clear_history: 'Cancella cronologia', account: 'Account',
    sync_from_cloud: 'Sincronizza da cloud', logout: 'Esci', login: 'Accedi', email: 'Email', password: 'Password',
    save: 'Salva', cancel: 'Annulla', delete: 'Elimina', add_profile: 'Aggiungi profilo', kids_profile: 'Profilo bambini',
    accent_color: 'Colore accent', show_hero_section: 'Mostra sezione Hero', reduce_sidebar: 'Riduci barra laterale',
    horizontal_posters: 'Locandine Orizzontali', hide_unavailable: 'Nascondi contenuti non disponibili',
    autoplay_next: 'Riproduci automaticamente il prossimo episodio', skip_intro: 'Salta intro',
    preferred_quality: 'Qualità preferita', enable_subtitles: 'Abilita sottotitoli',
    external_player: 'Player esterno (opzionale)', connect_trakt: 'Collega Trakt.tv', connected: 'Connesso',
    search_placeholder: 'Cerca film, serie, anime...', no_results: 'Nessun risultato trovato',
    results_for: 'Risultati per', search_hint: 'Usa la barra di ricerca in alto per trovare film e serie TV',
    popular: 'Popolari', vote_average: 'Voto medio', release_date: 'Data uscita', revenue: 'Incassi',
    movies: 'Film', tv_shows: 'Serie TV', profile: 'Profilo', switch_profile: 'Cambia profilo',
    watch_now: 'Riproduci', details: 'Dettagli', season: 'Stagione', episode: 'Episodio',
    cast: 'Cast', recommendations: 'Consigliati',
    remove_from_cw: 'Rimuovi da Continua a guardare', mark_as_watched: 'Segna come visto',
    watched: 'VISTO', info_btn: 'Info',
    who_is_watching: 'Chi guarda?', select_profile: 'Seleziona il tuo profilo',
    manage_profiles: 'Gestisci profili', done: 'Fine', add: 'Aggiungi',
    edit_profile: 'Modifica profilo', choose_avatar: 'Scegli Avatar', new_profile: 'Nuovo profilo',
    profile_name: 'Nome profilo', create: 'Crea', qr_login: 'Accedi con QR',
    qr_login_title: 'Accedi con QR', qr_scan_hint: 'Scansiona con l\'app Nuvio mobile o vai su',
    qr_enter_code: 'Oppure inserisci questo codice su nuvioapp.space:', qr_waiting: 'In attesa di autorizzazione...',
    qr_error: 'Codice scaduto o errore.', retry: 'Riprova', enter_pin: 'Inserisci PIN',
    pin_incorrect: 'PIN non corretto', filters_adult_content: 'Filtra contenuti adulti',
    tap_to_edit: 'Tocca un profilo per modificarlo', confirm_delete: 'Eliminare questo profilo?',
    welcome: 'Benvenuto su Nuvio', select_language: 'Seleziona la tua lingua preferita',
    continue: 'Continua', you_can_change_later: 'Puoi cambiare la lingua più tardi nelle Impostazioni',
    loading: 'Caricamento...', back: 'Indietro', view_all: 'Vedi tutto',
    add_repository: 'Aggiungi Repository', repository_url: 'URL Repository', install: 'Installa',
    configure: 'Configura', remove: 'Rimuovi', refresh: 'Aggiorna', enabled: 'Attivo',
    disabled: 'Disabilitato', plugins_backend_ok: 'Backend OK', repositories: 'Repository',
    no_repositories: 'Nessun repository configurato', add_repository_hint: 'Aggiungi un repository per ottenere plugin',
    plugins_found: 'plugin', no_plugins: 'Nessun plugin trovato', test_scraper: 'Test scraper',
    logs: 'Log', found_streams: 'Stream trovati', disabled_by_manifest: 'Disabilitato dal manifest del repository',
    all_repositories: 'Tutti i repository', search_addons: 'Cerca addon', catalog: 'Catalogo',
    stremio_web: 'Stremio Web', install_via_url: 'Installa tramite URL',
    enter_addon_url: 'Inserisci URL addon (https://... o stremio://...)',
    no_addons_installed: 'Nessun addon installato', go_to_catalog: 'Vai al tab Catalogo Stremio per aggiungere addon',
    version: 'versione', catalogs: 'cataloghi', types: 'tipi', configure_addon: 'Configura addon',
    addon_options: 'Opzioni addon', remove_addon: 'Rimuovi addon', up: 'Su', down: 'Giù',
    search_addons_placeholder: 'Cerca addon (Torrentio, OpenSubtitles, Jackett...)',
    local_list: 'Lista locale', no_addons_found: 'Nessun addon trovato', load_more_addons: 'Carica altri',
    close: 'Chiudi', open_in_browser: 'Apri nel browser', visual_name: 'Nome visualizzato',
    logo_url: 'URL Logo', manifest_url: 'URL Manifest',
    config_page: 'Pagina di configurazione dell\'addon (per impostare token, filtri, ecc.):',
    configure_in_app: 'Configura nell\'app', save_changes: 'Salva modifiche',
    streaming: 'Streaming', tmdb_api_key: 'Chiave API TMDB', skip_for_now: 'Salta per ora',
    validate: 'Verifica', valid: 'Valida', invalid: 'Non valida', complete_setup: 'Completa configurazione',
    select_services: 'Seleziona quali servizi streaming vuoi vedere nella Home',
    services_selected: 'servizi selezionati', select_all: 'Seleziona tutti', deselect_all: 'Deseleziona tutti',
    account_settings: 'Impostazioni account', avatar: 'Avatar',
    choose_avatar_help: 'Scegli un avatar dal catalogo qui sotto', filter_adult: 'Filtra contenuti per adulti',
    delete_profile: 'Elimina profilo', edit: 'Modifica', create_profile: 'Crea profilo',
    avatar_catalog: 'Catalogo Avatar', add_new_profile: 'Aggiungi nuovo profilo', pin_protected: 'Protetto da PIN',
    active: 'Attivo', sync_completed: 'Sincronizzazione completata', sync_error: 'Errore di sincronizzazione',
    no_internet: 'Nessuna connessione internet', retry_connection: 'Riprova connessione',
    update_available: 'Aggiornamento disponibile', update_now: 'Aggiorna ora', version_info: 'Informazioni versione',
    episodes: 'Episodi', in_library: 'In libreria', add_to_library: 'Aggiungi alla libreria',
    remove_from_library: 'Rimuovi dalla libreria', syncing: 'Sincronizzazione...', error_loading: 'Errore di caricamento',
    try_again: 'Riprova', no_streams: 'Nessuno stream disponibile', available_streams: 'Stream disponibili',
    plugin_providers: 'Provider plugin', no_providers: 'Nessun provider trovato', test_provider: 'Test provider',
    testing: 'Test in corso...', installing: 'Installazione...', install_repository: 'Installa repository',
    reload_streams: 'Ricarica stream', trakt: 'Trakt', simkl: 'Simkl', mal: 'MAL',
    collections: 'Collezioni', browse_collections: 'Sfoglia collezioni',
  },
  // ... (aggiungi qui le altre lingue: es, fr, de, pt, ja, ko, zh, ru)
  // Per brevità, mantieni le altre lingue che hai già nel tuo file
};

export function t(key: TranslationKey): string {
  const { settings } = useStore.getState();
  const lang = settings.appLanguage || 'en';
  return translations[lang]?.[key] ?? translations['en'][key] ?? key;
}

export function useT() {
  const { settings } = useStore();
  return { t, lang: settings.appLanguage || 'en' };
}