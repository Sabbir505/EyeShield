import { ipcMain, app } from 'electron';
import { IPC } from '../ipc-channels';
import type { Store } from '../store/store';
import type { Db } from '../db/db';
import type { Scheduler } from '../scheduler/scheduler';
import type { HelperBridge } from '../helper/bridge';
import type { CrashGuard } from '../safety/crash-guard';
import type { WindowManager } from '../windows/window-manager';
import { sanitizeSettingsPatch } from '../store/settings-validator';
import { log } from '../safety/log';

/** All the dependencies IPC handlers need. */
export interface IpcDeps {
  store: Store;
  db: Db;
  scheduler: Scheduler;
  helper: HelperBridge;
  crashGuard: CrashGuard;
  settingsWin: WindowManager;
  onboardingWin: WindowManager;
  isReady: () => boolean;
}

/** Registers all IPC handlers. Call once after modules are constructed. */
export function registerIpcHandlers(deps: IpcDeps) {
  const { store, db, scheduler, settingsWin, onboardingWin, isReady } = deps;

  ipcMain.handle(IPC.SETTINGS_GET, () => {
    if (!isReady()) throw new Error('not ready');
    return store.all();
  });

  ipcMain.handle(IPC.SETTINGS_SET, (_e, patch: unknown) => {
    if (!isReady()) throw new Error('not ready');
    const validated = sanitizeSettingsPatch(patch);
    if (!validated) throw new Error('invalid settings patch');
    store.patch(validated);
    if ('autoStart' in validated) {
      app.setLoginItemSettings({ openAtLogin: !!validated.autoStart });
    }
  });

  ipcMain.handle(IPC.SETTINGS_CLOSE, () => {
    if (!isReady()) throw new Error('not ready');
    settingsWin.hide();
  });

  ipcMain.handle(IPC.STATS_GET, async (_e, range: unknown) => {
    if (!isReady()) throw new Error('not ready');
    const r = range === 'week' ? 'week' : 'day';
    return db.getStats(r);
  });

  ipcMain.handle(IPC.STATS_EXPORT, async () => {
    if (!isReady()) throw new Error('not ready');
    return db.exportCsv();
  });

  ipcMain.handle(IPC.ONBOARDING_COMPLETE, (_e, data: unknown) => {
    if (!isReady()) throw new Error('not ready');
    const validated = sanitizeSettingsPatch(data);
    if (!validated) throw new Error('invalid onboarding data');
    log('onboarding:complete received');
    store.setOnboardingComplete(true, validated);
    onboardingWin.hide();
    scheduler.start();
    log(`scheduler started after onboarding, status: ${scheduler.getState().status}`);
  });

  ipcMain.handle(IPC.SCHEDULE_PAUSE, (_e, minutes: unknown) => {
    if (!isReady()) throw new Error('not ready');
    const m = Number(minutes);
    if (!Number.isFinite(m) || m < 1 || m > 1440) throw new Error('invalid pause duration');
    scheduler.pauseForMinutes(m);
  });

  ipcMain.handle(IPC.SCHEDULE_RESUME, () => {
    if (!isReady()) throw new Error('not ready');
    scheduler.resume();
  });

  ipcMain.handle(IPC.SCHEDULE_SNOOZE, () => {
    if (!isReady()) throw new Error('not ready');
    return scheduler.snoozeFromWarning();
  });

  ipcMain.handle(IPC.SCHEDULE_STATE, () => {
    if (!isReady()) throw new Error('not ready');
    return scheduler.getState();
  });
}
