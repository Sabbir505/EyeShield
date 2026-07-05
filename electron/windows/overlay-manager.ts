import { BrowserWindow, screen, app } from 'electron';
import * as path from 'path';
import { IPC } from '../ipc-channels';
import type { EyeBreakSettings } from '../../shared/types';

const OVERLAY_URL = 'http://localhost:5173/src/overlay/index.html';
const OVERLAY_PROD = 'dist/src/overlay/index.html';

/**
 * Manages one full-screen always-on-top BrowserWindow PER monitor, so the
 * break overlay cannot be escaped by dragging the cursor to a second display.
 */
export class OverlayManager {
  private windows: BrowserWindow[] = [];
  private isDev: boolean;

  constructor(isDev: boolean) {
    this.isDev = isDev;
  }

  showOverlay(settings?: EyeBreakSettings) {
    this.destroyAll(); // never stack
    const displays = screen.getAllDisplays();
    for (const display of displays) {
      const win = new BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
        fullscreen: true,
        frame: false,
        movable: false,
        resizable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        // 'screen-saver' level is set via setAlwaysOnTop after ready-to-show;
        // it's above normal always-on-top windows, helps against Alt+Tab and
        // Win+D escape attempts at the window-manager level.
        show: false,
        transparent: false,
        backgroundColor: '#08080C',
        webPreferences: {
          preload: path.join(__dirname, '..', 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
      });

      // Kiosk-like behavior: prevent close via OS shortcuts where possible.
      win.setKiosk?.(true);

      win.once('ready-to-show', () => {
        win.show();
        win.setAlwaysOnTop(true, 'screen-saver');
        win.focus();
        // Send settings once the overlay content has loaded.
        if (settings) {
          win.webContents.send(IPC.OVERLAY_SETTINGS, {
            theme: settings.theme,
            soundOn: settings.soundOn,
            ambientSound: settings.ambientSound,
          });
        }
      });

      // Prevent the renderer from being killed by close attempts.
      win.on('close', (e) => e.preventDefault());

      if (this.isDev) {
        win.loadURL(OVERLAY_URL);
        win.webContents.openDevTools({ mode: 'detach' });
      } else {
        win.loadFile(path.join(app.getAppPath(), OVERLAY_PROD));
      }

      this.windows.push(win);
    }
  }

  updateCountdown(remainingSec: number, settings?: EyeBreakSettings) {
    for (const w of this.windows) {
      w.webContents.send(IPC.OVERLAY_COUNTDOWN, remainingSec);
      if (settings) {
        w.webContents.send(IPC.OVERLAY_SETTINGS, {
          theme: settings.theme,
          soundOn: settings.soundOn,
          ambientSound: settings.ambientSound,
        });
      }
    }
  }

  hideOverlay() {
    for (const w of this.windows) {
      w.setKiosk?.(false);
      w.removeAllListeners('close');
      w.close();
    }
    this.windows = [];
  }

  private destroyAll() {
    for (const w of this.windows) {
      try {
        w.setKiosk?.(false);
        w.destroy();
      } catch {
        // ignore
      }
    }
    this.windows = [];
  }
}
