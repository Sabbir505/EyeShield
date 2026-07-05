import { EventEmitter } from 'events';
import { Store } from '../store/store';
import { OverlayManager } from '../windows/overlay-manager';
import { HelperBridge } from '../helper/bridge';
import { Db } from '../db/db';
import type { SchedulerState } from '../../shared/types';

const IDLE_THRESHOLD_MS = 10 * 60 * 1000; // 10 min idle → pause countdown
const WARNING_WINDOW_SEC = 10;

/**
 * Core scheduler. Emits: 'warning' (10s before break), 'breakStart',
 * 'tick' (every second, with remaining sec), 'breakEnd'.
 *
 * Timer is wall-clock-anchored: each tick computes remaining from
 * Date.now() relative to a stored epoch, so setInterval drift does not
 * accumulate.
 */
export class Scheduler extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private remainingSec = 0;
  private status: SchedulerState['status'] = 'idle';
  private snoozesUsedToday = 0;
  private snoozeDate = new Date().toDateString();
  private pausedUntil: number | null = null;
  private warningFired = false;
  // Wall-clock anchor: the timestamp at which the current countdown started
  // (or was last recomputed). Used to correct for setInterval drift.
  private intervalEpoch: number = 0;
  // The total seconds the current countdown started with.
  private intervalTotalSec: number = 0;

  constructor(
    private store: Store,
    private overlay: OverlayManager,
    private helper: HelperBridge,
    private db: Db,
  ) {
    super();
  }

  start() {
    this.resetToNextInterval();
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  resetToNextInterval() {
    this.intervalTotalSec = this.store.getIntervalMin() * 60;
    this.remainingSec = this.intervalTotalSec;
    this.intervalEpoch = Date.now();
    this.status = 'running';
    this.warningFired = false;
    this.emit('tick', this.remainingSec);
  }

  private tick() {
    this.rollSnoozeCounterIfNewDay();

    // Auto-resume from pause if pausedUntil has elapsed.
    if (this.status === 'paused' && this.pausedUntil !== null) {
      if (Date.now() >= this.pausedUntil) {
        this.pausedUntil = null;
        this.resetToNextInterval();
        this.emit('tick', this.remainingSec);
        return;
      }
      // Still paused — don't decrement.
      return;
    }

    if (this.status === 'paused') {
      return;
    }

    // Idle detection — if no user input in the last 10 min, don't burn the
    // interval while they're already resting. We approximate "input" via the
    // helper's last-input timestamp (keyboard only on Windows, mouse not tracked).
    // 10 min is generous to avoid false positives during reading/mousing.
    if (this.status !== 'in-break') {
      const idleMs = Date.now() - this.helper.getLastInputTime();
      if (idleMs > IDLE_THRESHOLD_MS) {
        // Don't decrement — re-anchor the epoch so we don't suddenly jump
        // when the user returns.
        this.intervalEpoch = Date.now() - (this.intervalTotalSec - this.remainingSec) * 1000;
        return;
      }
    }

    // Wall-clock correction: compute remaining from elapsed real time.
    const elapsed = Math.floor((Date.now() - this.intervalEpoch) / 1000);
    const newRemaining = this.intervalTotalSec - elapsed;

    // Only emit if the value changed (avoids redundant emits within the same second).
    if (newRemaining === this.remainingSec && this.status !== 'in-break') {
      return;
    }
    this.remainingSec = newRemaining;

    if (this.status === 'running' && this.remainingSec <= WARNING_WINDOW_SEC && !this.warningFired) {
      this.status = 'warning';
      this.warningFired = true;
      this.emit('warning');
    }

    if (this.status === 'warning' && this.remainingSec <= 0) {
      this.beginBreak();
      return;
    }

    if (this.status === 'in-break' && this.remainingSec <= 0) {
      this.emit('breakEnd');
      this.resetToNextInterval();
      return;
    }

    this.emit('tick', this.remainingSec);
    // Forward countdown + settings to overlay during breaks for theme/sound.
    if (this.status === 'in-break') {
      this.overlay.updateCountdown(this.remainingSec);
    }
  }

  private beginBreak() {
    this.status = 'in-break';
    this.intervalTotalSec = this.store.getBreakDuration();
    this.remainingSec = this.intervalTotalSec;
    this.intervalEpoch = Date.now();
    this.emit('breakStart');
    this.emit('tick', this.remainingSec);
    // Pass current settings to overlay for theme + ambient sound.
    const settings = this.store.all();
    this.overlay.updateCountdown(this.remainingSec, settings);
  }

  /**
   * Snooze from the 10-second warning window only. Gives a 5-minute grace
   * period (not a full interval) so the user gets a short delay before the
   * break fires again. Limited by the daily snooze allowance.
   */
  snoozeFromWarning(): boolean {
    if (this.status !== 'warning') return false;
    if (this.snoozesUsedToday >= this.store.getSnoozeAllowance()) return false;
    this.snoozesUsedToday += 1;
    // 5-minute grace period, capped at the full interval if it's shorter.
    this.intervalTotalSec = Math.min(this.store.getIntervalMin() * 60, 300);
    this.remainingSec = this.intervalTotalSec;
    this.intervalEpoch = Date.now();
    this.status = 'running';
    this.warningFired = false;
    return true;
  }

  pauseForMinutes(minutes: number) {
    this.pausedUntil = Date.now() + minutes * 60 * 1000;
    this.status = 'paused';
  }

  resume() {
    if (this.status !== 'paused') return;
    this.pausedUntil = null;
    this.resetToNextInterval();
  }

  handleSystemSuspend() {
    // If we're in a break, end it cleanly — we can't keep the screen locked
    // through a suspend/resume cycle reliably.
    if (this.status === 'in-break') {
      this.emit('breakEnd');
    }
    // Freeze the countdown by pausing; resume will recompute.
    this.status = 'paused';
  }

  handleSystemResume() {
    if (this.pausedUntil) return; // user-initiated pause still active
    // After resume, reset to a fresh interval — we don't know how long we
    // were suspended, so the current countdown is stale.
    this.resetToNextInterval();
  }

  getState(): SchedulerState {
    return {
      status: this.status,
      remainingSec: this.remainingSec,
      nextBreakAt: this.status === 'running' || this.status === 'warning'
        ? Date.now() + this.remainingSec * 1000
        : null,
      snoozesUsedToday: this.snoozesUsedToday,
      pausedUntil: this.pausedUntil,
    };
  }

  private rollSnoozeCounterIfNewDay() {
    const today = new Date().toDateString();
    if (today !== this.snoozeDate) {
      this.snoozeDate = today;
      this.snoozesUsedToday = 0;
    }
  }

  async shutdown() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
