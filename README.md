# EyeShield — Forced Eye-Break Enforcement

A Windows desktop app that **enforces** screen breaks instead of just suggesting them. Built for someone with a diagnosed eye condition who will actively bypass soft reminders.

## Features

- Locks the screen across **all monitors** for the configured break duration
- **Blocks all keyboard + mouse input** system-wide via the Windows `BlockInput` API
- **Cannot be dismissed** by clicking, Alt+Tab, Win+D, Esc, or any normal input
- **Emergency override**: press `Esc` 5× rapidly (limited to a few uses per day)
- **Crash-safe**: a watchdog releases the input block if Electron dies; a flag file prevents auto-blocking on the next launch if the last session crashed mid-block
- Calm "Liquid Glass" UI — animated gradient blobs, frosted glass panels, breathing guide
- Stats: compliance %, streak counter, incident log, CSV export
- Configurable work/break intervals, snooze allowance, schedule rules per time-of-day
- Ambient sound during breaks (rain, waves, white noise — all bundled CC0)
- Auto-start on login
- System tray with quick pause/resume/snooze

## Architecture (3-layer crash-isolated)

```
Electron Main (scheduler, tray, IPC hub)
        ↕  contextBridge (preload.ts)
Renderer (React: overlay, settings, onboarding)
        ↕  stdin/stdout JSON + heartbeat
Native Helper (C# .NET 8 self-contained: BlockInput + keyboard hook + watchdog)
```

The native helper is a separate process, not a Node native module — on purpose: if Electron's event loop freezes, the blocking + override still work, and if Electron crashes entirely, the helper detects the lost heartbeat and releases the block.

## Project Structure

```
shared/types.ts              — Single source of truth for all shared interfaces
electron/
├── main.ts                  — Entry point: bootstrap, CSP, event wiring, lifecycle
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
    ├── window-manager.ts    — Reusable BrowserWindow lifecycle
    └── overlay-manager.ts   — Per-monitor fullscreen break overlay
src/
├── settings/                — Settings shell + tabs (General, Schedule, Sound, Theme, Stats)
├── onboarding/              — 5-step onboarding wizard
├── overlay/                 — Break overlay UI
├── components/              — GlassPanel, Countdown, BreathingGuide, useAmbientSound, useTheme, icons, sound-sources
├── types/global.ts          — Window.eyeshield type declaration
└── styles/index.css         — Tailwind + glass/theme CSS
native-helper/EyeBreakHelper/ — C# .NET 8 self-contained helper exe
```

## Key Design Decisions

- **JSON files over SQLite** — avoids node-gyp/VS Build Tools issues; fine at this data volume
- **Self-contained .NET helper** — bundles the .NET 8 runtime so users don't need to install it
- **Wall-clock-anchored scheduler** — computes remaining from `Date.now() - epoch`, so `setInterval` drift doesn't accumulate
- **Atomic file writes** — both `Store` and `Db` use temp-file + rename pattern
- **Log rotation** — log appends (not truncates) on launch; rotates at 1MB to `.1`
- **CSP on all windows** — strict Content-Security-Policy blocks all remote loading
- **No Google Fonts** — system font fallbacks only (no network dependency)
- **Shared types** — `shared/types.ts` is the single source of truth

## Development

### Prerequisites
- Node.js 20+
- .NET 8 SDK
- Windows 10/11

### Install
```bash
npm install
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite + Electron concurrently (dev server on :5173) |
| `npm run build` | Build renderer + electron TypeScript |
| `npm run build:helper` | `dotnet publish` the C# helper (self-contained, win-x64) |
| `npm run package:win` | Full build → NSIS installer in `dist/` |
| `npm run typecheck` | TypeScript check for both renderer + electron |

### Run in dev
```bash
# Build the native helper first
npm run build:helper

# Then run the dev server + Electron
npm run dev
```

### Build the Windows installer
```bash
npm run package:win
```
Output: `dist/EyeShield Setup 1.0.0.exe`

## Safety Notes

- `BlockInput` does **not** block `Ctrl+Alt+Del` — this is by design; it's the OS-level safety valve.
- The emergency override is implemented in the native helper's keyboard hook, **not** in the Electron renderer — so it works even if the renderer is frozen.
- If your antivirus flags the keyboard hook: this is expected for any app that intercepts low-level input. The helper is open-source and does nothing beyond BlockInput + the override listener.
- On launch, EyeShield checks a `blocking.flag` file in the user-data directory. If present (indicating an unclean exit during a block), it logs an incident and never auto-blocks.

## License

MIT
