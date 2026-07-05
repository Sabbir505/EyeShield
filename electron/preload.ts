import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// IPC channel constants inlined — cannot use require('./ipc-channels') in
// sandboxed preload (Electron 28 restricts require to electron + built-ins).
const IPC = {
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_CLOSE: 'settings:close',
  STATS_GET: 'stats:get',
  STATS_EXPORT: 'stats:export',
  SCHEDULE_PAUSE: 'schedule:pause',
  SCHEDULE_RESUME: 'schedule:resume',
  SCHEDULE_SNOOZE: 'schedule:snooze',
  SCHEDULE_STATE: 'schedule:state',
  ONBOARDING_COMPLETE: 'onboarding:complete',
  OVERLAY_COUNTDOWN: 'overlay:countdown',
  OVERLAY_SETTINGS: 'overlay:settings',
} as const;

type CountdownCb = (remainingSec: number) => void;
type OverlaySettingsCb = (settings: { theme: string; soundOn: boolean; ambientSound: string }) => void;

try {
  contextBridge.exposeInMainWorld('eyeshield', {
    settings: {
      get: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
      set: (patch: unknown) => ipcRenderer.invoke(IPC.SETTINGS_SET, patch),
      close: () => ipcRenderer.invoke(IPC.SETTINGS_CLOSE),
    },
    stats: {
      get: (range: string) => ipcRenderer.invoke(IPC.STATS_GET, range),
      export: () => ipcRenderer.invoke(IPC.STATS_EXPORT),
    },
    schedule: {
      pause: (minutes: number) => ipcRenderer.invoke(IPC.SCHEDULE_PAUSE, minutes),
      resume: () => ipcRenderer.invoke(IPC.SCHEDULE_RESUME),
      snooze: () => ipcRenderer.invoke(IPC.SCHEDULE_SNOOZE),
      state: () => ipcRenderer.invoke(IPC.SCHEDULE_STATE),
    },
    onboarding: {
      complete: (data: unknown) => ipcRenderer.invoke(IPC.ONBOARDING_COMPLETE, data),
    },
    overlay: {
      onCountdown: (cb: CountdownCb): (() => void) => {
        const listener = (_e: IpcRendererEvent, sec: number) => cb(sec);
        ipcRenderer.on(IPC.OVERLAY_COUNTDOWN, listener);
        return () => ipcRenderer.removeListener(IPC.OVERLAY_COUNTDOWN, listener);
      },
      onSettings: (cb: OverlaySettingsCb): (() => void) => {
        const listener = (_e: IpcRendererEvent, s: { theme: string; soundOn: boolean; ambientSound: string }) => cb(s);
        ipcRenderer.on(IPC.OVERLAY_SETTINGS, listener);
        return () => ipcRenderer.removeListener(IPC.OVERLAY_SETTINGS, listener);
      },
    },
  });
} catch (e) {
  console.error('[preload] Failed to expose eyeshield API:', e);
}
