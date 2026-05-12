# Agents

## Communication
- Terminal logs: use `eprintln!` in Rust, NOT `console.log` in JS (not visible in Tauri terminal)
- Debug info: show status in UI overlay/badge, not console
- Version bumps: use `node scripts/bump-version.js <semver>`
- Build: `npm run tauri:build` (production), `npm run tauri dev` (dev)

## Architecture
- Tauri v2 with React frontend (TypeScript, Tailwind, Zustand state)
- libmpv via `tauri-plugin-libmpv` v0.3.2 (DLLs in `src-tauri/lib/`)
- Discord RPC via `discord-rich-presence` crate + custom Rust backend
- Window: transparent for MPV overlay (`tauri.conf.json`)

## Key files
- `src-tauri/src/lib.rs` — All Tauri commands + plugin registration
- `src-tauri/src/mpv.rs` — Legacy mpv.exe manager (IPC via named pipes)
- `src-tauri/src/discord_rpc.rs` — Discord IPC client
- `src/components/VideoPlayer.tsx` — Video player (HTML5 + MPV modes)
- `src/hooks/usePluginMpv.ts` — tauri-plugin-libmpv wrapper (singleton)
- `src/hooks/useDiscordRPC.ts` — Discord RPC media state hook
- `src/components/DiscordRPCProvider.tsx` — Persistent Discord connection
- `src/lib/types.ts` — TypeScript types + default settings
- `src/lib/i18n.ts` — Translation system
- `src/pages/Settings.tsx` — Settings UI

## Gotchas
- React strict mode in dev causes double-mounting (effects run twice, cleanup between)
- `tauri-plugin-libmpv` init must complete before `command('loadfile')` — use queue/retry pattern
- Never call `discord_disconnect` in React cleanup — `connect()` handles existing connections
- `@tauri-apps/api` version must match Rust `tauri` crate minor version
- Window transparent + shadow:false required for MPV embed
