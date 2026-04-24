const fs = require('fs');
const path = require('path');

// Cartelle da escludere
const excludeDirs = ['node_modules', 'dist', '.git', 'src-tauri', 'out', 'build'];

// Regex per trovare testo nei file
const textPatterns = [
  // Testo tra tag HTML/JSX
  { regex: />\s*([A-Z][a-zA-Z0-9\s\?\!\,\.\'\`\-\:]+)\s*</g, type: 'jsx-text' },
  // placeholder, title, alt, label
  { regex: /(placeholder|title|alt|label)=["']([A-Z][a-zA-Z0-9\s\?\!\,\.\'\`\-\:]+)["']/g, type: 'attribute' },
  // Testo dopo return/ dentro ()
  { regex: /return\s*\(\s*<[^>]*>([^<]+)<\/[^>]+>/g, type: 'return-text' },
  // Testo come children
  { regex: /<[a-zA-Z]+[^>]*>([A-Z][a-zA-Z0-9\s\?\!\,\.\'\`\-\:]+)<\/[a-zA-Z]+>/g, type: 'children' },
  // Stringhe singole e doppie (solo parole significative)
  { regex: /['"]([A-Z][a-zA-Z0-9\s\?\!\,\.\'\`\-\:]{3,})['"]/g, type: 'string' },
];

// Parole da escludere (nomi variabili, funzioni, classi CSS)
const excludeWords = new Set([
  'className', 'onClick', 'onChange', 'onSubmit', 'useState', 'useEffect',
  'useRef', 'useCallback', 'useMemo', 'useStore', 'useT', 'useNavigate',
  'div', 'span', 'button', 'input', 'form', 'img', 'svg', 'path',
  'flex', 'items', 'justify', 'text', 'bg', 'border', 'rounded', 'shadow',
  'w-', 'h-', 'p-', 'm-', 'gap-', 'space-', 'from-', 'to-', 'via-',
  'true', 'false', 'null', 'undefined', 'type', 'typeof', 'instanceof',
  'return', 'import', 'export', 'default', 'const', 'let', 'var', 'function',
  'async', 'await', 'try', 'catch', 'finally', 'throw', 'new', 'this',
]);

function isExcluded(text) {
  if (!text || text.length < 2) return true;
  if (/^\d+$/.test(text)) return true;
  if (/^[a-z]+[A-Z]/.test(text)) return true; // camelCase
  if (excludeWords.has(text)) return true;
  if (excludeWords.has(text.toLowerCase())) return true;
  return false;
}

function extractTextsFromFile(filePath, textsMap) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  for (const pattern of textPatterns) {
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      let text = match[1] || match[2];
      if (text && !isExcluded(text) && !textsMap.has(text)) {
        textsMap.set(text, text);
        modified = true;
      }
    }
  }
  return modified;
}

function walkDirectory(dir, textsMap) {
  const files = fs.readdirSync(dir);
  let count = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!excludeDirs.includes(file)) {
        count += walkDirectory(filePath, textsMap);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.js')) {
      if (extractTextsFromFile(filePath, textsMap)) {
        count++;
        console.log(`  📄 ${filePath}`);
      }
    }
  }
  return count;
}

// Mappa delle traduzioni italiane (quelle che hai già nel codice)
const italianTranslations = {
  "Home": "Home",
  "Discover": "Scopri",
  "Library": "Libreria",
  "Addons": "Addon",
  "Settings": "Impostazioni",
  "Plugins": "Plugin",
  "Search": "Cerca",
  "Movies": "Film",
  "TV Series": "Serie TV",
  "Series": "Serie",
  "Anime": "Anime",
  "Season": "Stagione",
  "Episode": "Episodio",
  "Cast": "Cast",
  "Details": "Dettagli",
  "Watch now": "Riproduci",
  "WATCHED": "VISTO",
  "Mark as watched": "Segna come visto",
  "Remove from Continue Watching": "Rimuovi da Continua a guardare",
  "Continue Watching": "Continua a guardare",
  "In progress": "In corso",
  "Recommendations": "Consigliati",
  "Popular": "Popolari",
  "Top rated": "Più votati",
  "Most recent": "Più recenti",
  "Most popular": "Più popolari",
  "All genres": "Tutti i generi",
  "All years": "Tutti gli anni",
  "All platforms": "Tutte le piattaforme",
  "Revenue": "Incassi",
  "Vote average": "Voto medio",
  "Release date": "Data uscita",
  "Profile": "Profilo",
  "Switch profile": "Cambia profilo",
  "Add profile": "Aggiungi profilo",
  "Kids profile": "Profilo bambini",
  "Edit profile": "Modifica profilo",
  "Delete profile": "Elimina profilo",
  "Save": "Salva",
  "Cancel": "Annulla",
  "Delete": "Elimina",
  "Add": "Aggiungi",
  "Create": "Crea",
  "Done": "Fine",
  "Back": "Indietro",
  "Close": "Chiudi",
  "Loading": "Caricamento",
  "Retry": "Riprova",
  "Refresh": "Aggiorna",
  "Install": "Installa",
  "Configure": "Configura",
  "Remove": "Rimuovi",
  "Up": "Su",
  "Down": "Giù",
  "View All": "Vedi tutto",
  "Load more": "Carica altro",
  "No addons installed": "Nessun addon installato",
  "Manage Addons": "Gestisci Addon",
  "Install via URL": "Installa tramite URL",
  "Catalog": "Catalogo",
  "Stremio Web": "Stremio Web",
  "Search addons": "Cerca addon",
  "Configure addon": "Configura addon",
  "Addon options": "Opzioni addon",
  "Remove addon": "Rimuovi addon",
  "Display name": "Nome visualizzato",
  "Logo URL": "URL Logo",
  "Manifest URL": "URL Manifest",
  "Configure in app": "Configura nell'app",
  "Open in browser": "Apri nel browser",
  "Add Repository": "Aggiungi Repository",
  "Repository URL": "URL Repository",
  "Repositories": "Repository",
  "No repositories configured": "Nessun repository configurato",
  "Add a repository to get plugins": "Aggiungi un repository per ottenere plugin",
  "No plugins found": "Nessun plugin trovato",
  "Test scraper": "Test scraper",
  "Logs": "Log",
  "Found streams": "Stream trovati",
  "Disabled by repository manifest": "Disabilitato dal manifest del repository",
  "All repositories": "Tutti i repository",
  "Enabled": "Attivo",
  "Disabled": "Disabilitato",
  "Backend OK": "Backend OK",
  "Sync from Cloud": "Sincronizza da Cloud",
  "Welcome to Nuvio": "Benvenuto su Nuvio",
  "Select your preferred language": "Seleziona la tua lingua preferita",
  "Continue": "Continua",
  "Skip for now": "Salta per ora",
  "Validate": "Verifica",
  "Valid": "Valida",
  "Invalid": "Non valida",
  "Complete Setup": "Completa configurazione",
  "services selected": "servizi selezionati",
  "Select All": "Seleziona tutti",
  "Deselect All": "Deseleziona tutti",
  "TMDB API Key": "Chiave API TMDB",
  "Connect Trakt.tv": "Collega Trakt.tv",
  "Connected": "Connesso",
  "Accent color": "Colore accent",
  "Show Hero section": "Mostra sezione Hero",
  "Reduce sidebar": "Riduci barra laterale",
  "Horizontal Posters": "Locandine Orizzontali",
  "Hide unavailable content": "Nascondi contenuti non disponibili",
  "Autoplay next episode": "Riproduci automaticamente il prossimo episodio",
  "Skip intro": "Salta intro",
  "Preferred quality": "Qualità preferita",
  "Enable subtitles": "Abilita sottotitoli",
  "External player": "Player esterno",
  "Language": "Lingua",
  "Appearance": "Aspetto",
  "Layout": "Layout",
  "Streaming Services": "Servizi Streaming",
  "Integrations": "Integrazioni",
  "Playback": "Riproduzione",
  "Info": "Informazioni",
  "Clear history": "Cancella cronologia",
  "Account": "Account",
  "Sync from cloud": "Sincronizza da cloud",
  "Logout": "Esci",
  "Login": "Accedi",
  "Email": "Email",
  "Password": "Password",
  "Nuvio Account": "Account Nuvio",
  "Profiles": "Profili",
  "Search movies, series, anime...": "Cerca film, serie, anime...",
  "No results found": "Nessun risultato trovato",
  "Results for": "Risultati per",
  "Use the search bar above": "Usa la barra di ricerca in alto",
  "Who's watching?": "Chi guarda?",
  "Select your profile": "Seleziona il tuo profilo",
  "Manage profiles": "Gestisci profili",
  "Choose Avatar": "Scegli Avatar",
  "New profile": "Nuovo profilo",
  "Profile name": "Nome profilo",
  "Sign in with QR": "Accedi con QR",
  "Enter PIN": "Inserisci PIN",
  "Incorrect PIN": "PIN non corretto",
  "Filters adult content": "Filtra contenuti adulti",
  "Tap a profile to edit it": "Tocca un profilo per modificarlo",
  "Delete this profile?": "Eliminare questo profilo?",
  "You can change the language later": "Puoi cambiare la lingua più tardi",
  "No internet connection": "Nessuna connessione internet",
  "Retry connection": "Riprova connessione",
  "Update available": "Aggiornamento disponibile",
  "Update now": "Aggiorna ora",
  "Version info": "Informazioni versione",
  "About": "Informazioni",
  "Help": "Aiuto",
  "Support": "Supporto",
  "Privacy policy": "Informativa privacy",
  "Terms of service": "Termini di servizio",
  "Dark mode": "Modalità scura",
  "Light mode": "Modalità chiara",
  "System default": "Predefinito sistema",
  "Notifications": "Notifiche",
  "Share": "Condividi",
  "Report": "Segnala",
  "Add to library": "Aggiungi alla libreria",
  "Remove from library": "Rimuovi dalla libreria",
  "Syncing": "Sincronizzazione",
  "Sync completed": "Sincronizzazione completata",
  "Error loading": "Errore di caricamento",
  "Try again": "Riprova",
  "No streams available": "Nessuno stream disponibile",
  "Available streams": "Stream disponibili",
  "Plugin providers": "Provider plugin",
  "No providers found": "Nessun provider trovato",
  "Test provider": "Test provider",
  "Testing": "Test in corso",
  "Installing": "Installazione",
  "Install repository": "Installa repository",
  "No repositories": "Nessun repository",
  "Add repository hint": "Inserisci URL repository",
  "Reload streams": "Ricarica stream",
};

// Lingue target
const targetLangs = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh', 'ru'];

// Funzione per tradurre usando Google Translate (gratuito, senza API key)
async function translateText(text, targetLang) {
  if (targetLang === 'it') return italianTranslations[text] || text;
  if (targetLang === 'en') return text;
  
  // Se abbiamo già una traduzione italiana, usiamo quella come base
  const italianText = italianTranslations[text] || text;
  
  // Usa Google Translate gratuitamente
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=it&tl=${targetLang}&dt=t&q=${encodeURIComponent(italianText)}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data[0][0][0];
  } catch (error) {
    console.error(`Errore traduzione "${text}":`, error.message);
    return italianText;
  }
}

async function generateAllTranslations() {
  console.log('🔍 Trovare tutti i testi nel progetto...\n');
  
  const textsMap = new Map();
  const filesCount = walkDirectory('./src', textsMap);
  
  console.log(`\n📝 Trovati ${textsMap.size} testi unici in ${filesCount} file.\n`);
  
  // Aggiungi anche le chiavi italiane esistenti
  for (const [key, value] of Object.entries(italianTranslations)) {
    if (!textsMap.has(key)) {
      textsMap.set(key, key);
    }
  }
  
  const allTexts = Array.from(textsMap.keys()).sort();
  console.log(`📝 Totale testi da tradurre: ${allTexts.length}\n`);
  
  // Crea cartella locales
  const localesDir = './src/locales';
  if (!fs.existsSync(localesDir)) {
    fs.mkdirSync(localesDir, { recursive: true });
  }
  
  // Per ogni lingua, crea il file JSON
  for (const lang of targetLangs) {
    console.log(`\n🌐 Traduzione in ${lang.toUpperCase()}...`);
    const translations = {};
    
    for (let i = 0; i < allTexts.length; i++) {
      const text = allTexts[i];
      if (i % 50 === 0) {
        process.stdout.write(`\r   ${i + 1}/${allTexts.length} testi...`);
      }
      
      if (lang === 'en') {
        translations[text] = text;
      } else if (lang === 'it') {
        translations[text] = italianTranslations[text] || text;
      } else {
        // Traduci dall'italiano alla lingua target
        const translated = await translateText(text, lang);
        translations[text] = translated;
        // Piccolo delay per non overloadare Google
        await new Promise(r => setTimeout(r, 50));
      }
    }
    
    const filePath = path.join(localesDir, `${lang}.json`);
    fs.writeFileSync(filePath, JSON.stringify(translations, null, 2));
    console.log(`\n✅ Creato ${lang}.json (${Object.keys(translations).length} chiavi)`);
  }
  
  console.log('\n🎉 Traduzione completata!');
  console.log(`📁 File salvati in: ${localesDir}`);
  console.log('\n📌 Ora aggiorna il tuo i18n.ts per usare questi file JSON.');
}

// Esegui
generateAllTranslations().catch(console.error);