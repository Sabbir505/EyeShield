import type { EyeBreakSettings, AmbientSound, Theme } from '../../shared/types';

const VALID_AMBIENT: readonly AmbientSound[] = ['none', 'rain', 'whitenoise', 'waves'];
const VALID_THEME: readonly Theme[] = ['void', 'aurora', 'dawn'];

/**
 * Validates and sanitizes a settings patch from an untrusted source (IPC).
 * Only whitelisted keys are extracted; values are range-checked.
 * Returns null if the patch contains no valid keys.
 */
export function sanitizeSettingsPatch(raw: unknown): Partial<EyeBreakSettings> | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const out: Partial<EyeBreakSettings> = {};

  if (typeof obj.intervalMin === 'number' && obj.intervalMin >= 1 && obj.intervalMin <= 180) {
    out.intervalMin = obj.intervalMin;
  }
  if (typeof obj.breakDurationSec === 'number' && obj.breakDurationSec >= 5 && obj.breakDurationSec <= 600) {
    out.breakDurationSec = obj.breakDurationSec;
  }
  if (typeof obj.snoozeAllowance === 'number' && obj.snoozeAllowance >= 0 && obj.snoozeAllowance <= 20) {
    out.snoozeAllowance = obj.snoozeAllowance;
  }
  if (typeof obj.soundOn === 'boolean') out.soundOn = obj.soundOn;
  if (typeof obj.ambientSound === 'string' && VALID_AMBIENT.includes(obj.ambientSound as AmbientSound)) {
    out.ambientSound = obj.ambientSound as AmbientSound;
  }
  if (typeof obj.theme === 'string' && VALID_THEME.includes(obj.theme as Theme)) {
    out.theme = obj.theme as Theme;
  }
  if (typeof obj.autoStart === 'boolean') out.autoStart = obj.autoStart;
  if (typeof obj.onboardingComplete === 'boolean') out.onboardingComplete = obj.onboardingComplete;
  if (typeof obj.reasonForUse === 'string' && obj.reasonForUse.length <= 1000) {
    out.reasonForUse = obj.reasonForUse;
  }
  if (Array.isArray(obj.scheduleRules)) {
    out.scheduleRules = obj.scheduleRules
      .filter((r: unknown): r is Record<string, unknown> => !!r && typeof r === 'object')
      .map((r) => ({
        fromHour: Math.max(0, Math.min(23, Number(r.fromHour) || 0)),
        toHour: Math.max(0, Math.min(24, Number(r.toHour) || 24)),
        intervalMin: Math.max(1, Math.min(180, Number(r.intervalMin) || 20)),
        breakDurationSec: Math.max(5, Math.min(600, Number(r.breakDurationSec) || 20)),
      }))
      .slice(0, 20);
  }

  return Object.keys(out).length > 0 ? out : null;
}
