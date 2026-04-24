// Cache delle traduzioni
const translationCache: Record<string, Record<string, string>> = {};

const langMap: Record<string, string> = {
  it: 'it', en: 'en', es: 'es', fr: 'fr', de: 'de', 
  pt: 'pt', ja: 'ja', ko: 'ko', zh: 'zh-CN', ru: 'ru'
};

// Traduce usando Google Translate (gratuito)
async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || text.trim().length < 2) return text;
  if (targetLang === 'it') return text;
  
  // Check cache
  if (translationCache[text]?.[targetLang]) {
    return translationCache[text][targetLang];
  }
  
  const googleLang = langMap[targetLang] || 'en';
  
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=it&tl=${googleLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    const data = await response.json();
    const translated = data[0][0][0];
    
    if (!translationCache[text]) translationCache[text] = {};
    translationCache[text][targetLang] = translated;
    
    return translated;
  } catch (error) {
    console.error('Translate error:', error);
    return text;
  }
}

// Traduce un nodo DOM
async function translateNode(node: Node, targetLang: string) {
  if (node.nodeType === Node.TEXT_NODE && node.textContent) {
    const original = node.textContent;
    const trimmed = original.trim();
    
    if (trimmed && trimmed.length > 1 && !/^\d+$/.test(trimmed) && !trimmed.startsWith('{')) {
      const translated = await translateText(trimmed, targetLang);
      if (translated !== trimmed) {
        node.textContent = original.replace(trimmed, translated);
      }
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    
    // Traduci attributi
    const attrs = ['placeholder', 'title', 'alt', 'aria-label'];
    for (const attr of attrs) {
      const val = el.getAttribute(attr);
      if (val && val.trim()) {
        const translated = await translateText(val, targetLang);
        if (translated !== val) el.setAttribute(attr, translated);
      }
    }
    
    // Ricorsione sui figli
    for (const child of Array.from(el.childNodes)) {
      await translateNode(child, targetLang);
    }
  }
}

// Traduce tutto il documento
let isTranslating = false;
let currentLang = 'en';

export async function translatePage(lang: string) {
  if (isTranslating || currentLang === lang || lang === 'it') return;
  currentLang = lang;
  isTranslating = true;
  
  console.log(`🌐 Traduzione in: ${lang}`);
  await translateNode(document.body, lang);
  isTranslating = false;
}

// Osserva i cambiamenti del DOM e traduce i nuovi elementi
let observer: MutationObserver | null = null;

export function startAutoTranslate(lang: string) {
  // Traduci subito
  translatePage(lang);
  
  // Osserva nuovi elementi
  if (observer) observer.disconnect();
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        translateNode(node, lang);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function stopAutoTranslate() {
  if (observer) observer.disconnect();
}