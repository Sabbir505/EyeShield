import * as fs from 'fs';
import * as path from 'path';
import { log } from '../safety/log';
import type { EyeBreakSettings } from '../../shared/types';

const DEFAULTS: EyeBreakSettings = {
  intervalMin: 20,
  breakDurationSec: 20,
  snoozeAllowance: 2,
  overrideAllowance: 3,
  soundOn: false,
  ambientSound: 'none',
  theme: 'void',
  autoStart: false,
  onboardingComplete: false,
  reasonForUse: '',
  scheduleRules: [],
};

/**
 * JSON file-backed settings store. SQLite is used for break history (see Db),
 * but settings are tiny and rarely written — JSON is simpler and lets the user
 * hand-edit if needed.
 */
export class Store {
  private filePath: string;
  private data: EyeBreakSettings;

  constructor(userDataDir: string) {
    this.filePath = path.join(userDataDir, 'settings.json');
    this.data = { ...DEFAULTS };
    this.load();
  }

  private load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      this.data = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      // First run — keep defaults, will be persisted on first set().
    }
  }

  private persist() {
    try {
      const tmp = this.filePath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.filePath); // atomic on same filesystem
    } catch (e) {
      log(`Failed to persist settings: ${e}`);
    }
  }

  all(): EyeBreakSettings {
    return { ...this.data };
  }

  patch(patch: Partial<EyeBreakSettings>) {
    this.data = { ...this.data, ...patch };
    this.persist();
  }

  getIntervalMin(): number {
    const rule = this.activeRule();
    return rule?.intervalMin ?? this.data.intervalMin;
  }

  getBreakDuration(): number {
    const rule = this.activeRule();
    return rule?.breakDurationSec ?? this.data.breakDurationSec;
  }

  getSnoozeAllowance(): number {
    return this.data.snoozeAllowance;
  }

  getOverrideAllowance(): number {
    return this.data.overrideAllowance;
  }

  getOnboardingComplete(): boolean {
    return this.data.onboardingComplete;
  }

  setOnboardingComplete(v: boolean, patch: Partial<EyeBreakSettings>) {
    this.data = { ...this.data, ...patch, onboardingComplete: v };
    this.persist();
  }

  getAutoStart(): boolean {
    return this.data.autoStart;
  }

  private activeRule() {
    const hour = new Date().getHours();
    return this.data.scheduleRules.find(r => hour >= r.fromHour && hour < r.toHour);
  }
}
