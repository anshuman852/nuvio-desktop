# Nuvio Desktop

[![Release](https://img.shields.io/github/v/release/TUO-USERNAME/nuvio-desktop?style=for-the-badge&color=7c3aed)](https://github.com/TUO-USERNAME/nuvio-desktop/releases/latest)
[![License](https://img.shields.io/github/license/TUO-USERNAME/nuvio-desktop?style=for-the-badge)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/TUO-USERNAME/nuvio-desktop/ci.yml?style=for-the-badge&label=build)](https://github.com/TUO-USERNAME/nuvio-desktop/actions)
[![Windows](https://img.shields.io/badge/platform-Windows-0078d7?style=for-the-badge&logo=windows)](https://github.com/TUO-USERNAME/nuvio-desktop/releases/latest)

Client Windows per l'ecosistema **Stremio addon** con player **mpv** integrato.  
Porta l'esperienza di [NuvioTV](https://github.com/NuvioMedia/NuvioTV) sul desktop Windows.

---

## Download

➡️ **[Scarica l'ultima versione (.exe)](https://github.com/TUO-USERNAME/nuvio-desktop/releases/latest)**

> Richiede **Windows 10 / 11** (64-bit) e [mpv](https://mpv.io/installation/) installato nel PATH.

---

## Funzionalità

- 🎬 **Catalogo** — sfoglia film e serie da qualsiasi addon Stremio
- 🔍 **Ricerca** — cerca tra tutti gli addon installati in simultanea
- ▶️ **Playback via mpv** — hardware decoding, tutti i formati, nessun limite
- 📺 **Episodi** — navigazione stagioni/episodi per le serie
- 🧩 **Addon manager** — installa/rimuovi/riordina addon con un click
- 📋 **Cronologia** — tieni traccia di cosa hai guardato
- ⚙️ **Impostazioni** — configura mpv, lingua, sottotitoli

---

## Installazione

### Utenti finali

1. Vai alla pagina [**Releases**](https://github.com/TUO-USERNAME/nuvio-desktop/releases/latest)
2. Scarica `NuvioDesktop_x64-setup.exe`
3. Installa mpv → [mpv.io](https://mpv.io/installation/) e aggiungilo al PATH  
   *(oppure specifica il percorso completo in Impostazioni)*

### Prerequisiti per lo sviluppo

| Tool | Versione |
|------|---------|
| [Rust](https://rustup.rs/) | stable |
| [Node.js](https://nodejs.org/) | 20+ |
| [mpv](https://mpv.io/installation/) | qualsiasi |
| Microsoft C++ Build Tools | - |

```bash
git clone https://github.com/TUO-USERNAME/nuvio-desktop.git
cd nuvio-desktop
npm install
npm run tauri dev
```

### Build .exe

```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/nsis/NuvioDesktop_x64-setup.exe
```

---

## Pubblicare una release

Il file `.exe` viene generato e pubblicato **automaticamente** da GitHub Actions  
ogni volta che crei un tag versione:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Il workflow builderà il `.exe` su Windows e creerà la Release su GitHub con il file allegato.

---

## Architettura

```
nuvio-desktop/
├── src/                    # Frontend React + TypeScript
│   ├── pages/              # Home, Detail, Addons, Search, Settings
│   ├── lib/
│   │   ├── addon-client.ts # Wrapper Tauri commands → Stremio protocol
│   │   ├── store.ts        # Zustand store (addon, history, settings)
│   │   └── types.ts        # Tipi condivisi
│   └── App.tsx             # Layout + router
└── src-tauri/              # Backend Rust
    └── src/
        ├── main.rs         # Entry point + comandi Tauri
        ├── addon.rs        # Client HTTP Stremio addon protocol
        └── mpv.rs          # Gestione processo mpv + IPC named pipe
```

---

## Correlato

- [NuvioTV](https://github.com/NuvioMedia/NuvioTV) — app Android TV originale
- [mpv](https://mpv.io/) — player video

---

## Licenza

GPL-3.0 — vedi [LICENSE](LICENSE)
