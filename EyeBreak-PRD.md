# Product Requirements Document: EyeShield
### Forced Eye-Break Enforcement Desktop App

**Version:** 1.0
**Owner:** Sabbir
**Status:** Draft — ready for implementation loop in Claude Code
**Target Platform:** Windows (primary), macOS (secondary/native vibrancy support)

---

## 1. Problem Statement

The user has a serious eye condition that requires regular breaks from screen exposure, but their work makes it easy to ignore soft reminders (notifications, tray popups) and keep working through pain/strain. Existing "20-20-20" reminder apps are dismissible with a single click, which defeats their purpose for someone who needs enforced compliance, not a suggestion.

**Core insight:** The app must remove the *choice* to skip a break during work hours, while still being safe (no permanent lockout risk) and pleasant enough to not feel punitive.

---

## 2. Goals

### 2.1 Primary Goals
- Enforce screen breaks at user-defined intervals with **no way to dismiss, click through, or Alt+Tab out** of the break screen until the timer expires.
- Block all mouse and keyboard input system-wide during the break (except a deliberate safety override).
- Feel calm, premium, and non-punitive — this is a care tool, not a punishment tool. UI should reduce stress, not add to it.

### 2.2 Secondary Goals
- Build habit/compliance tracking (streaks, stats) to reinforce positive behavior.
- Allow contextual flexibility (pause during meetings/presentations) without undermining the core enforcement.
- Reusable, polished "Liquid Glass" design system that could extend to future health-tool builds.

### 2.3 Non-Goals (v1)
- Not a general productivity/focus app (no website blocking, no Pomodoro task tracking).
- Not multi-user / team analytics.
- Not a mobile app (desktop only for v1).
- Not a medical device — no diagnostic claims, no health data storage beyond local break/streak history.

---

## 3. User Persona

**Primary user:** The developer himself — a technical, deadline-driven person who works long unbroken desk sessions, has a diagnosed eye condition, and will actively try to bypass "soft" versions of this tool out of habit. Design must assume the user *will* try to defeat weak enforcement, so the blocking mechanism must be technically real, not just UI-level.

---

## 4. Core User Flows

### 4.1 First-Run Onboarding
1. Welcome screen (glass aesthetic intro)
2. Brief context capture: reason for use (optional, stored locally only), preferred break interval, preferred break duration
3. Permission requests explained plainly (why the app needs elevated/accessibility permissions to block input)
4. Auto-start on login toggle
5. Done → app minimizes to system tray

### 4.2 Normal Operation Loop
1. App runs in tray, countdown to next break tracked silently
2. **T-minus 10 seconds:** gentle warning toast (non-blocking) — "Break in 10s, wrap up your thought"
3. **T-0:** full-screen glass overlay fades in across all monitors
4. Input blocking engages (mouse + keyboard captured)
5. Countdown displayed prominently; optional breathing-guide animation; optional ambient sound
6. Timer reaches zero → overlay fades out, input unblocked, next interval begins
7. Tray icon updates streak/compliance stats

### 4.3 Snooze / Flexibility Flow (bounded, not unlimited)
- User gets a limited number of snoozes per day (configurable, default 2), usable only during the 10-second warning window (not during an active lock)
- "Meeting mode" — user can proactively pause the whole schedule for a set window (e.g. "pause for 45 min"), requiring explicit re-enable — this prevents "I'll just pause forever" by requiring a duration selection, not an indefinite toggle
- No snooze/pause option is available **once the lock screen has started** — this is the core enforcement guarantee

### 4.4 Emergency Override (Safety Requirement)
- A genuine emergency escape must exist so the user is never truly trapped (e.g., needs to answer urgent call, handle a fire alarm)
- Mechanism: hold a specific key combo (e.g. `Ctrl+Alt+Shift+Q`) for a continuous 5 seconds
- Triggering it unlocks immediately but logs the override (visible in stats as "Break skipped — emergency override") — friction + accountability, not literal impossibility
- This override must work even if the rest of the app UI is unresponsive (implemented at the native hook level, not the Electron renderer)

---

## 5. Functional Requirements

### 5.1 Timer & Scheduling
- Configurable work interval (default 20 min)
- Configurable break duration (default 20 sec, but should support longer, e.g. 5 min, since this is medical-need driven, not just the standard rule)
- Support for different schedules by time of day (e.g. shorter breaks in morning, longer in afternoon)
- Idle detection: if the user is away from the desk (no input for N minutes), pause the countdown rather than waste a break while they're already resting
- Schedule persists across app restarts and system sleep/wake

### 5.2 Break Overlay (Lock Screen)
- Full-screen, frameless, borderless, always-on-top, covering **every connected monitor** simultaneously
- No close/minimize/system tray interaction possible while active
- Large, legible countdown (MM:SS)
- Liquid Glass panel design (see Section 7) floating over an animated gradient background
- Optional: breathing exercise guide synced to countdown
- Optional: soft ambient audio toggle (rain, white noise, etc.) — off by default
- Emergency override hint shown subtly (small text, not intrusive) so the user always knows it exists

### 5.3 Input Blocking (Critical Technical Requirement)
- Must block **all** mouse clicks/movement-based interaction with anything except the app's own overlay
- Must block **all** keyboard input except the emergency override combo
- Must survive attempts to: Alt+Tab, Ctrl+Alt+Del (cannot truly block this on Windows — see Section 8 risk notes), Win key, multi-monitor cursor drag
- Must NOT survive a hard system crash/force-quit in a way that leaves input permanently blocked (auto-recovery on relaunch/crash detection)

### 5.4 Tray / Background App
- System tray icon shows time until next break (hover tooltip or icon state)
- Right-click menu: Pause schedule (with duration picker), Open settings, View stats, Quit (requires confirmation + reason, logged)
- Runs on startup (OS-level auto-launch registration)

### 5.5 Settings Panel
- Interval & duration configuration
- Per-time-of-day schedule rules
- Snooze allowance per day
- Sound on/off, ambient sound selection
- Theme (glass tint color, background gradient palette)
- Data export (CSV of break history) / reset stats

### 5.6 Stats & History
- Daily/weekly compliance percentage
- Streak counter (consecutive days with 100% compliance)
- Log of skipped/overridden breaks with timestamps
- All stored locally only (no cloud sync in v1 — privacy-first for health-adjacent data)

---

## 6. Technical Architecture

### 6.1 High-Level Stack
- **Shell/UI:** Electron (Chromium + Node.js) — chosen for full CSS/animation control needed for the Liquid Glass aesthetic
- **Frontend framework:** React + TypeScript
- **Styling:** Tailwind CSS (utility-first, fast iteration) + custom CSS for `backdrop-filter` glass effects and animated gradient backgrounds
- **State/animation:** Framer Motion for spring-based, elastic transitions (core to selling the "liquid" feel)
- **Native input blocking helper:** Separate small native module/process — see 6.3
- **Local storage:** SQLite (via `better-sqlite3`) or simple JSON file store for settings/history — SQLite preferred for stats querying
- **Packaging:** `electron-builder` → Windows installer (.exe/.msi) and macOS (.dmg)

### 6.2 Process Architecture
```
┌─────────────────────────────┐
│   Electron Main Process      │  ← scheduling logic, tray, IPC hub, autolaunch
└───────────┬──────────────────┘
            │ IPC
┌───────────▼──────────────────┐
│  Renderer: Overlay Window     │  ← full-screen glass UI, countdown, animations
│  Renderer: Settings Window    │  ← settings panel
│  Renderer: Tray popover (opt) │
└───────────┬──────────────────┘
            │ spawns/controls
┌───────────▼──────────────────┐
│  Native Input-Block Helper    │  ← calls BlockInput() (Win32) or CGEventTap (macOS)
│  (C# .exe on Windows /        │     listens for emergency override combo
│   Swift/ObjC binary on macOS) │     independent of Electron's responsiveness
└────────────────────────────────┘
```

### 6.3 Input Blocking Implementation Detail

**Windows:**
- Primary: `user32.dll` → `BlockInput(TRUE)` — blocks all keyboard/mouse input system-wide except for input sent programmatically by the calling thread
- The emergency override must be captured via a **low-level keyboard hook** (`SetWindowsHookEx` with `WH_KEYBOARD_LL`) running in the native helper, which listens for the override combo *even while BlockInput is active*, since low-level hooks fire before BlockInput's filtering in practice — this must be tested carefully, as `BlockInput` behavior with global hooks needs verification during implementation
- Note: `BlockInput` does **not** block Ctrl+Alt+Del (Windows reserves this at the OS level for security — this is expected and fine, it's the user's actual safety valve at the OS level, separate from your app's own override)
- The Electron overlay window should be set: `alwaysOnTop: true` with the `'screen-saver'` level, `fullscreenable: true`, `skipTaskbar: true`, `focusable: true`, and kiosk mode enabled to prevent window-manager-level escape (Win+D, Win+Tab)

**macOS:**
- `CGEventTapCreate` to intercept and swallow input events system-wide (requires Accessibility permission grant from the user — must be requested clearly during onboarding)
- Native `vibrancy` in `BrowserWindow` for real frosted glass instead of CSS-faked blur
- Similar low-level tap for the emergency override combo

**Why a separate native helper process instead of doing this in Electron directly:**
- Electron's renderer can freeze/be slow to respond under load; the blocking + override-listening logic needs to run in a lightweight, always-responsive process independent of Electron's event loop
- Cleaner crash isolation — if Electron crashes, the helper can detect this and release the input block automatically (critical safety requirement, see Section 8)

### 6.4 Crash-Safety / Failsafe Design (Must-Have)
- Native helper runs a **watchdog**: if it loses heartbeat contact with the Electron main process for more than N seconds while a block is active, it automatically calls `BlockInput(FALSE)` and exits the lock state
- On every app launch, check for a "was blocking input during last shutdown" flag written to disk — if found, this indicates an unclean exit; log it and never boot back into a blocked state automatically
- This prevents the worst-case failure mode: user's computer permanently unusable after a crash

---

## 7. Design System — "Liquid Glass"

### 7.1 Visual Language
- Frosted, translucent glass panels floating over a slowly animated gradient/blob background
- Multiple depth layers: background gradient blobs (slow drift animation, ~20-30s loop) → mid-layer blur → foreground glass panel with content
- Specular highlight: soft diagonal light streak across panel edges, subtly animated or reactive to (simulated) light angle
- Rounded corners: 20–28px radius on major panels
- Motion: spring/elastic easing (Framer Motion `type: "spring", stiffness: 300, damping: 30` as a starting point) — nothing should move linearly

### 7.2 Color Palette (extending your existing Neural OS system where it fits)
- Background gradient: deep void base (`#08080C`) blending into slow-moving soft blobs of ion purple (`#7C6FF7`) and plasma cyan-green (`#00D4AA`) at low opacity
- Glass panel: `rgba(255,255,255,0.08)` fill, `rgba(255,255,255,0.18)` 1px border, `backdrop-filter: blur(24px) saturate(160%)`
- Text: near-white (`#F5F5F7`) primary, muted gray-purple for secondary text
- Typography: Space Grotesk for headings/countdown, Space Mono for stats/timestamps (consistent with NoboGyan's system)

### 7.3 Key Screens to Design
1. Onboarding (3–4 steps)
2. Break/lock overlay (the emotional core — get this right first)
3. Tray popover / mini dashboard
4. Settings panel
5. Stats/history view

---

## 8. Risks & Open Questions

| Risk | Notes |
|---|---|
| Windows security software may flag low-level keyboard hooks / BlockInput usage as suspicious | May need code-signing and clear app description; test with common AV software |
| BlockInput + global override hook interaction is not 100% guaranteed by Microsoft docs | Must be empirically tested before relying on it as the sole safety valve |
| Admin/elevated privileges may be required for some of these APIs | Confirm during prototyping; affects installer design (may need UAC prompt) |
| Multi-monitor edge cases (monitors added/removed while locked, different DPI scaling) | Needs explicit handling in overlay window enumeration logic |
| macOS Accessibility permission UX | Users often don't grant this correctly first try — needs a clear guided screen with a "test it" step |
| Legal/liability | Since this is health-adjacent (eye condition), avoid any language implying medical treatment/guarantee — frame as a personal productivity/wellness tool only |

---

## 9. Milestones (Suggested Build Order for Claude Code Loop)

1. **M1 — Overlay UI prototype:** Static HTML/CSS/React glass break-screen, no real blocking yet, just visuals + countdown animation
2. **M2 — Electron shell + scheduling:** Tray icon, main-process timer logic, triggers overlay window on schedule (still no input blocking)
3. **M3 — Native input-block helper (Windows first):** Standalone C# helper exe, tested independently via CLI before wiring into Electron
4. **M4 — IPC integration:** Electron ↔ native helper communication, heartbeat/watchdog failsafe
5. **M5 — Emergency override + crash safety:** Implement and stress-test the override combo and crash recovery flag
6. **M6 — Settings, stats, SQLite storage**
7. **M7 — Onboarding flow + polish pass on Liquid Glass system**
8. **M8 — Packaging & installer (electron-builder), auto-start registration**
9. **M9 (stretch) — macOS support (vibrancy + CGEventTap)**

---

## 10. Success Criteria

- Break screen cannot be dismissed by any normal input (click, Alt+Tab, Win key, Esc) — only by timer completion or the deliberate emergency override
- Zero incidents of permanent lockout during testing (crash-safety watchdog verified)
- App feels calm and premium, not punitive, in informal user testing (i.e., you actually want to keep it running)
- Successfully reduces actual screen time per interval as measured by compliance stats over a 2-week trial
