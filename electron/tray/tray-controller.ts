import { Tray, Menu, nativeImage, Notification, app } from 'electron';
import * as path from 'path';
import type { SchedulerState } from '../../shared/types';

// __dirname is dist-electron/electron/tray/ in both dev and prod.
// Icon is at project-root/build/icon.png (packed into asar).
const ICON_PATH = path.join(__dirname, '..', '..', '..', 'build', 'icon.png');

/**
 * Tray icon + context menu. Right-click exposes: pause durations, settings,
 * stats (open settings → stats tab), re-run onboarding, quit (with confirmation).
 * Hover tooltip shows "Next break in MM:SS".
 */
export class TrayController {
  private tray: Tray | null = null;
  private readonly quitWithConfirm: () => void;
  onPauseFor: (minutes: number) => void = () => {};
  onResume: () => void = () => {};

  constructor(
    private readonly getState: () => SchedulerState,
    private readonly onSettings: () => void,
    private readonly onSnooze: () => void,
    private readonly onOnboarding: () => void,
    onQuit: () => void,
  ) {
    this.quitWithConfirm = onQuit;
  }

  build() {
    if (!this.tray) {
      let icon = nativeImage.createFromPath(ICON_PATH);
      if (icon.isEmpty()) {
        // Fallback: create a simple 16x16 purple square icon from raw RGBA data
        const size = 16;
        const buf = Buffer.alloc(size * size * 4);
        for (let i = 0; i < size * size; i++) {
          buf[i * 4] = 0x7C;     // R
          buf[i * 4 + 1] = 0x6F; // G
          buf[i * 4 + 2] = 0xF7; // B
          buf[i * 4 + 3] = 0xFF; // A
        }
        icon = nativeImage.createFromBuffer(buf, { width: size, height: size });
      }
      icon = icon.resize({ width: 16, height: 16, quality: 'best' });
      this.tray = new Tray(icon);
      this.tray.setToolTip('EyeShield');
      this.tray.on('right-click', () => this.refreshMenu());
    }
    this.refreshMenu();
  }

  refreshMenu() {
    if (!this.tray) return;
    const s = this.getState();
    const menu = Menu.buildFromTemplate([
      { label: this.tooltip(s), enabled: false },
      { type: 'separator' },
      { label: 'Pause for 15 min', click: () => this.onPauseFor(15) },
      { label: 'Pause for 45 min', click: () => this.onPauseFor(45) },
      { label: 'Pause for 2 hours', click: () => this.onPauseFor(120) },
      { label: 'Resume now', enabled: s.status === 'paused', click: this.onResume },
      { type: 'separator' },
      { label: 'Snooze (warning only)', enabled: s.status === 'warning', click: this.onSnooze },
      { type: 'separator' },
      { label: 'Settings…', click: this.onSettings },
      { label: 'Re-run onboarding', click: this.onOnboarding },
      { type: 'separator' },
      { label: 'Quit EyeShield', click: this.quitWithConfirm },
    ]);
    this.tray.setContextMenu(menu);
  }

  updateTooltip(remainingSec: number) {
    if (!this.tray) return;
    this.tray.setToolTip(this.formatTimeRemaining(remainingSec));
  }

  showWarningToast(breakDurationSec: number) {
    const notification = new Notification({
      title: 'Break in 10 seconds',
      body: `Wrap up your thought — break lasts ${breakDurationSec}s.`,
      silent: false,
    });
    notification.show();
  }

  private tooltip(s: SchedulerState): string {
    if (s.status === 'in-break') return 'On break';
    if (s.status === 'paused') return 'Paused';
    if (s.status === 'idle') return 'EyeShield';
    return this.formatTimeRemaining(s.remainingSec);
  }

  private formatTimeRemaining(remainingSec: number): string {
    if (remainingSec <= 0) return 'Break starting now';
    const mm = Math.floor(remainingSec / 60);
    const ss = remainingSec % 60;
    return `Next break in ${mm}:${String(ss).padStart(2, '0')}`;
  }
}
