/**
 * Shared types — single source of truth for the EyeShield app.
 * Imported by both the Electron main process and the React renderers.
 */

export interface EyeBreakSettings {
  intervalMin: number;
  breakDurationSec: number;
  snoozeAllowance: number;
  /** Max emergency overrides (Esc 5×) allowed per day. 0 = never, -1 = unlimited. */
  overrideAllowance: number;
  soundOn: boolean;
  ambientSound: 'none' | 'rain' | 'whitenoise' | 'waves';
  theme: 'void' | 'aurora' | 'dawn';
  autoStart: boolean;
  onboardingComplete: boolean;
  reasonForUse: string;
  /** Per-time-of-day overrides */
  scheduleRules: Array<{
    fromHour: number;
    toHour: number;
    intervalMin: number;
    breakDurationSec: number;
  }>;
}

export interface SchedulerState {
  status: 'idle' | 'running' | 'warning' | 'in-break' | 'paused';
  remainingSec: number;
  nextBreakAt: number | null;
  snoozesUsedToday: number;
  pausedUntil: number | null;
}

export interface StatsPayload {
  total: number;
  completed: number;
  skipped: number;
  overridden: number;
  compliancePct: number;
  streak: number;
  incidents: Array<{ at: string; type: string; detail: string }>;
}

export interface BreakRecord {
  id?: number;
  started_at: string;
  duration_sec: number;
  status: 'completed' | 'skipped' | 'overridden';
}

export interface IncidentRecord {
  id?: number;
  at: string;
  type: string;
  detail: string;
}

export type AmbientSound = EyeBreakSettings['ambientSound'];
export type Theme = EyeBreakSettings['theme'];
