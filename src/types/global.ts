/** Shared window.API type for all EyeShield renderers. Imported by every
 *  renderer entry so the global declaration merges cleanly. */
import type { EyeBreakSettings, SchedulerState, StatsPayload } from '../../shared/types';

// Re-export for renderer convenience
export type { EyeBreakSettings, SchedulerState, StatsPayload } from '../../shared/types';

declare global {
  interface Window {
    eyeshield: {
      settings: {
        get: () => Promise<EyeBreakSettings>;
        set: (patch: Partial<EyeBreakSettings>) => Promise<void>;
        close: () => Promise<void>;
      };
      stats: {
        get: (range: 'day' | 'week') => Promise<StatsPayload>;
        export: () => Promise<string>;
      };
      schedule: {
        pause: (minutes: number) => Promise<void>;
        resume: () => Promise<void>;
        snooze: () => Promise<boolean>;
        state: () => Promise<SchedulerState>;
      };
      onboarding: {
        complete: (data: Partial<EyeBreakSettings>) => Promise<void>;
      };
      overlay: {
        onCountdown: (cb: (sec: number) => void) => (() => void);
        onSettings: (cb: (settings: { theme: string; soundOn: boolean; ambientSound: string }) => void) => (() => void);
      };
    };
  }
}

export {};
