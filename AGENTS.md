# EyeShield — Agent Guide

## What This App Does
EyeShield is a Windows desktop app that **enforces** eye breaks — not just reminders. It locks the screen across all monitors and blocks all keyboard/mouse input via the Win32 `BlockInput` API. Emergency override: hold `Ctrl+Alt+Shift+Q` for 5 seconds, or press `Esc` 5× rapidly.

## Architecture (3-layer crash-isolated)
```
Electron Main (scheduler, tray, IPC hub)
        ↕  contextBridge (preload.ts)
Renderer (React: overlay, settings, onboarding)
        ↕  stdin/stdout JSON + heartbeat
Native Helper (C# .NET 8 self-contained: BlockInput + keyboard hook + watchdog)
```

## Project Structure
```
shared/types.ts              — Single source of truth for all shared interfaces
electron/
├── main.ts                  — Entry point: bootstrap, event wiring, lifecycle (~170 lines)
├── preload.ts               — contextBridge API surface
├── ipc-channels.ts          — IPC channel name constants
├── ipc/index.ts             — All IPC handler registrations
├── store/
│   ├── store.ts             — JSON-file settings store (atomic writes)
│   └── settings-validator.ts — Sanitizes untrusted IPC input
├── db/db.ts                 — JSON-file break history + incident log
├── scheduler/scheduler.ts   — Wall-clock-anchored countdown state machine
├── helper/bridge.ts         — Native helper process IPC + heartbeat + auto-restart
├── safety/
│   ├── log.ts               — File logger with rotation + EPIPE hardening
│   └── crash-guard.ts       — Flag-file crash detection
├── tray/tray-controller.ts  — System tray icon + context menu
└── windows/
    ├── window-manager.ts    — Reusable BrowserWindow lifecycle (settings + onboarding)
    └── overlay-manager.ts   — Per-monitor fullscreen break overlay
src/
├── settings/                — Settings shell + tabs/ (General, Schedule, Sound, Theme, Stats)
├── onboarding/              — 5-step onboarding wizard
├── overlay/                 — Break overlay UI
├── components/              — GlassPanel, Countdown, BreathingGuide, useAmbientSound, useTheme, icons, sound-sources
├── types/global.ts          — Window.eyeshield type declaration
└── styles/index.css         — Tailwind + glass/theme CSS
native-helper/EyeBreakHelper/ — C# .NET 8 self-contained helper exe
```

Note: there are **three** tsconfigs — `tsconfig.json` (renderer), `tsconfig.node.json` (vite.config.ts only), and `electron/tsconfig.json` (electron + shared, compiles to `dist-electron/`).

## Build Commands
- `npm run dev` — Vite + Electron concurrently (dev server on :5173)
- `npm run build` — Renderer + electron TS builds
- `npm run build:helper` — `dotnet publish` the C# helper (self-contained, win-x64)
- `npm run package:win` — Full build → NSIS installer in `dist/`
- `npm run typecheck` — TypeScript check for renderer + electron (run both)

## Key Design Decisions
- **JSON files over SQLite** — avoids node-gyp/VS Build Tools issues; fine at this data volume
- **Self-contained .NET helper** — bundles the .NET 8 runtime so users don't need to install it
- **Wall-clock-anchored scheduler** — computes remaining from `Date.now() - epoch`, so `setInterval` drift doesn't accumulate
- **IPC channel constants** — all channel names defined in `electron/ipc-channels.ts`, used by main, preload, and types
- **Shared types** — `shared/types.ts` is the single source of truth, imported by both electron and renderer
- **Atomic file writes** — both `Store` and `Db` use temp-file + rename pattern
- **Log rotation** — log appends (not truncates) on launch; rotates at 1MB to `.1`
- **CSP on all windows** — strict Content-Security-Policy blocks all remote loading
- **No Google Fonts** — system font fallbacks only (no network dependency)

## Coding Conventions
- TypeScript strict mode in all three tsconfigs
- No `as any` casts (use proper type guards)
- `safeAsync()` wrapper for all async event handlers (catchs + logs errors)
- `try/catch` with `log()` in `before-quit` (never swallow silently)
- **Use `log()` for all electron-side logging** — never `console.*` (exceptions: `preload.ts` last-resort, and `log.ts` itself which mirrors to console in dev)
- IPC handlers validate all arguments via `sanitizeSettingsPatch()`
- Window preload path: `path.join(__dirname, '..', 'preload.js')` (windows/ → electron/)
