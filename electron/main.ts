import { app, ipcMain, powerMonitor, session } from 'electron';
import { OverlayManager } from './windows/overlay-manager';
import { WindowManager } from './windows/window-manager';
import { Scheduler } from './scheduler/scheduler';
import { Store } from './store/store';
import { HelperBridge } from './helper/bridge';
import { CrashGuard } from './safety/crash-guard';
import { TrayController } from './tray/tray-controller';
import { Db } from './db/db';
import { initLog, log } from './safety/log';
import { registerIpcHandlers } from './ipc';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let tray: TrayController;
let overlayMgr: OverlayManager;
let settingsWin: WindowManager;
let onboardingWin: WindowManager;
let scheduler: Scheduler;
let store: Store;
let helper: HelperBridge;
let crashGuard: CrashGuard;
let db: Db;
let modulesReady = false;

// ── CSP ─────────────────────────────────────────────────────────────────────
// Production: strict — only same-origin scripts/styles/fonts.
// Development: Vite's React plugin injects an inline preamble for fast-refresh,
// so we must allow 'unsafe-inline' for scripts; HMR also needs ws connections.
const CSP_PROD = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self';";
const CSP_DEV = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws://localhost:5173 http://localhost:5173;";
const CSP = isDev ? CSP_DEV : CSP_PROD;
function applyCsp() {
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [CSP] } });
  });
}

// ── Async error wrapper ─────────────────────────────────────────────────────
/** Wraps an async handler so errors are logged, not silently dropped. */
function safeAsync<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  return (async (...args: any[]) => {
    try { return await fn(...args); }
    catch (e) { log(`Async handler error: ${e}`); }
  }) as T;
}

async function bootstrap() {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) { app.quit(); return; }
  app.whenReady().then(() => {
    applyCsp();
    return start();
  }).catch((err) => {
    log(`Bootstrap failed: ${err}`);
    app.quit();
  });
}

async function start() {
  initLog(app.getPath('userData'));
  log('start() entered');
  log(`platform: ${process.platform}, isPackaged: ${app.isPackaged}`);

  db = new Db(app.getPath('userData'));
  store = new Store(app.getPath('userData'));
  helper = new HelperBridge(app.getPath('userData'));
  log(`helper path resolved: ${helper.getHelperPath() || '(none)'}`);
  log('spawning helper...');
  await helper.start();
  log(`helper started, alive=${helper.isAlive()}`);
  crashGuard = new CrashGuard(app.getPath('userData'));

  const wasBlocking = await crashGuard.checkFlagOnLaunch();
  log(`crash flag present: ${wasBlocking}`);
  if (wasBlocking) {
    db.logIncident('crash_during_block', 'App relaunched while block flag was set');
    await crashGuard.clearFlag();
    log('cleared stale crash flag from previous session');
  }
  await helper.send({ type: 'unblock' }).catch((e) => log(`initial unblock failed: ${e}`));
  log('initial unblock sent');

  overlayMgr = new OverlayManager(isDev);
  settingsWin = new WindowManager({
    devUrl: 'http://localhost:5173/src/settings/index.html',
    prodFile: 'dist/src/settings/index.html',
    width: 560, height: 560, label: 'settings',
  }, isDev);
  onboardingWin = new WindowManager({
    devUrl: 'http://localhost:5173/src/onboarding/index.html',
    prodFile: 'dist/src/onboarding/index.html',
    width: 560, height: 560, label: 'onboarding',
  }, isDev);
  scheduler = new Scheduler(store, overlayMgr, helper, db);
  log('windows + scheduler constructed');

  tray = new TrayController(
    () => scheduler.getState(),
    () => settingsWin.show(),
    () => scheduler.snoozeFromWarning(),
    () => onboardingWin.show(),
    async () => { await scheduler.shutdown(); app.quit(); },
  );
  tray.build();
  tray.onPauseFor = (minutes) => scheduler.pauseForMinutes(minutes);
  tray.onResume = () => scheduler.resume();
  log('tray built');

  // ── Event wiring (with safeAsync wrappers) ────────────────────────────────
  scheduler.on('breakStart', safeAsync(async () => {
    const blocked = await helper.sendBlockWithRetry();
    if (!blocked) {
      log('WARNING: block command failed — overlay will show but input may not be blocked');
    } else {
      await crashGuard.setFlagBlocking();
    }
    overlayMgr.showOverlay(store.all());
  }));

  scheduler.on('tick', (remainingSec: number) => {
    overlayMgr.updateCountdown(remainingSec);
    tray.updateTooltip(remainingSec);
  });

  scheduler.on('breakEnd', safeAsync(async () => {
    overlayMgr.hideOverlay();
    await helper.send({ type: 'unblock' });
    await crashGuard.clearFlag();
    db.recordBreak({ started_at: new Date().toISOString(), status: 'completed', duration_sec: store.getBreakDuration() });
  }));

  scheduler.on('warning', () => {
    tray.showWarningToast(store.getBreakDuration());
  });

  helper.on('override', safeAsync(async () => {
    overlayMgr.hideOverlay();
    await helper.send({ type: 'unblock' });
    await crashGuard.clearFlag();
    db.recordBreak({ started_at: new Date().toISOString(), status: 'overridden', duration_sec: store.getBreakDuration() });
    db.logIncident('emergency_override', 'User triggered override (Ctrl+Alt+Shift+Q 5s or Esc 5x)');
    scheduler.resetToNextInterval();
  }));

  powerMonitor.on('suspend', () => scheduler.handleSystemSuspend());
  powerMonitor.on('resume', () => scheduler.handleSystemResume());

  // ── IPC handlers ──────────────────────────────────────────────────────────
  registerIpcHandlers({
    store, db, scheduler, helper, crashGuard, settingsWin, onboardingWin,
    isReady: () => modulesReady,
  });

  // ── Start ─────────────────────────────────────────────────────────────────
  if (!store.getOnboardingComplete()) {
    log('onboarding not complete — showing onboarding window');
    onboardingWin.show();
  } else {
    log('onboarding complete — starting scheduler');
    scheduler.start();
    tray.refreshMenu();
  }

  app.setLoginItemSettings({ openAtLogin: store.getAutoStart() });
  log('start() finished');
  modulesReady = true;
}

// ── App lifecycle ───────────────────────────────────────────────────────────
app.on('window-all-closed', (e: Electron.Event) => {
  // Prevent quitting when overlay/settings close — we live in the tray.
  e.preventDefault();
});

app.on('second-instance', () => {
  settingsWin?.show();
});

app.on('before-quit', () => {
  if (helper) helper.syncUnblockAndKill();
  if (crashGuard) {
    try { crashGuard.clearFlagSync(); } catch (e) { log(`before-quit clearFlag error: ${e}`); }
  }
  if (db) {
    try { db.close(); } catch (e) { log(`before-quit db.close error: ${e}`); }
  }
});

bootstrap();
