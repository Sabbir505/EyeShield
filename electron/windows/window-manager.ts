import { BrowserWindow, app } from 'electron';
import * as path from 'path';
import { log } from '../safety/log';

export interface WindowConfig {
  /** Dev server URL, e.g. http://localhost:5173/src/settings/index.html */
  devUrl: string;
  /** Production file path relative to app root, e.g. dist/src/settings/index.html */
  prodFile: string;
  width: number;
  height: number;
  /** Label used in error logging, e.g. "settings" or "onboarding" */
  label: string;
}

/**
 * Reusable BrowserWindow lifecycle manager.
 * - Creates a frameless transparent window on first show()
 * - Reuses the window on subsequent show() calls (focuses if already visible)
 * - hide() hides (not closes) the window for instant re-show
 */
export class WindowManager {
  private win: BrowserWindow | null = null;

  constructor(private config: WindowConfig, private isDev: boolean) {}

  show() {
    if (this.win && !this.win.isDestroyed()) {
      if (!this.win.isVisible()) {
        this.win.show();
      }
      this.win.focus();
      return;
    }
    const { width, height, label, devUrl, prodFile } = this.config;
    this.win = new BrowserWindow({
      width,
      height,
      frame: false,
      transparent: true,
      resizable: false,
      show: false,
      backgroundColor: '#00000000',
      thickFrame: false,
      hasShadow: false,
      roundedCorners: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });
    this.win.on('closed', () => {
      this.win = null;
    });
    this.win.webContents.on('did-fail-load', (_e, code, desc) => {
      log(`[${label}] failed to load (code ${code}): ${desc}`);
    });
    this.win.once('ready-to-show', () => this.win?.show());
    if (this.isDev) {
      this.win.loadURL(devUrl);
      this.win.webContents.openDevTools({ mode: 'detach' });
    } else {
      this.win.loadFile(path.join(app.getAppPath(), prodFile));
    }
  }

  hide() {
    if (this.win && !this.win.isDestroyed()) {
      this.win.hide();
    }
  }
}
