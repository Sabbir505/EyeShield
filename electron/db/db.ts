import * as fs from 'fs';
import * as path from 'path';
import { log } from '../safety/log';
import type { BreakRecord, IncidentRecord } from '../../shared/types';

interface DbShape {
  breaks: BreakRecord[];
  incidents: IncidentRecord[];
  nextId: number;
  /** Daily emergency-override counter state. Persisted so the cap survives
   *  app restarts within the same day. Rolled over at local midnight. */
  overrideCounter?: {
    date: string;   // yyyy-MM-dd (local)
    used: number;   // overrides used so far today
  };
}

/**
 * JSON-file-backed store for break history + incident log. Pure JS, no native
 * deps — sidesteps the node-gyp / VS Build Tools / space-in-path issues that
 * better-sqlite3 was hitting.
 *
 * At this app's data volume (a few hundred break records per year), querying
 * in-memory is instant; the only real cost is rewriting the whole file on
 * each write, which happens a few times per hour at most.
 */
export class Db {
  private filePath: string;
  private data: DbShape;

  constructor(userDataDir: string) {
    this.filePath = path.join(userDataDir, 'eyeshield-history.json');
    this.data = { breaks: [], incidents: [], nextId: 1 };
    this.load();
  }

  private load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as DbShape;
      this.data = {
        breaks: Array.isArray(parsed.breaks) ? parsed.breaks : [],
        incidents: Array.isArray(parsed.incidents) ? parsed.incidents : [],
        nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 1,
        overrideCounter: (parsed.overrideCounter && typeof parsed.overrideCounter === 'object')
          ? {
              date: typeof parsed.overrideCounter.date === 'string' ? parsed.overrideCounter.date : '',
              used: typeof parsed.overrideCounter.used === 'number' ? parsed.overrideCounter.used : 0,
            }
          : undefined,
      };
    } catch {
      // First run or corrupt file — start empty.
    }
  }

  private persist() {
    try {
      const tmp = this.filePath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data));
      fs.renameSync(tmp, this.filePath); // atomic on same filesystem
    } catch (e) {
      log(`Failed to persist history: ${e}`);
    }
  }

  recordBreak(r: Omit<BreakRecord, 'id'>) {
    const record: BreakRecord = { ...r, id: this.data.nextId++ };
    this.data.breaks.push(record);
    // Cap history at 5000 records to keep the file from growing unbounded.
    if (this.data.breaks.length > 5000) {
      this.data.breaks = this.data.breaks.slice(-5000);
    }
    this.persist();
  }

  logIncident(type: string, detail: string) {
    this.data.incidents.push({ id: this.data.nextId++, at: new Date().toISOString(), type, detail });
    if (this.data.incidents.length > 5000) {
      this.data.incidents = this.data.incidents.slice(-5000);
    }
    this.persist();
  }

  // ── Daily emergency-override counter ───────────────────────────────────────
  // The cap is enforced in the native helper, but the helper is restarted on
  // every app launch, so it can't track the daily count itself. Electron is the
  // source of truth: it persists the count, rolls over at local midnight, and
  // sends the remaining allowance to the helper with each block command.

  private localDayStr(): string {
    // Use the local date so "today" matches the user's day, not UTC.
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Returns how many emergency overrides remain today, given the configured cap.
   *  -1 means "unlimited" (cap is -1). 0 means the cap is exhausted. */
  overridesLeftToday(cap: number): number {
    if (cap < 0) return -1;
    const counter = this.data.overrideCounter;
    const today = this.localDayStr();
    if (!counter || counter.date !== today) return cap;
    return Math.max(0, cap - counter.used);
  }

  /** Called when the helper honored an override (Esc 5×). Increments the daily
   *  counter. The helper has already released the block; this just records it. */
  recordOverrideUsed() {
    const today = this.localDayStr();
    if (!this.data.overrideCounter || this.data.overrideCounter.date !== today) {
      this.data.overrideCounter = { date: today, used: 1 };
    } else {
      this.data.overrideCounter.used += 1;
    }
    this.persist();
  }

  getStats(range: 'day' | 'week'): {
    total: number;
    completed: number;
    skipped: number;
    overridden: number;
    compliancePct: number;
    streak: number;
    incidents: IncidentRecord[];
  } {
    const sinceMs = range === 'day' ? 86400000 : 7 * 86400000;
    const sinceIso = new Date(Date.now() - sinceMs).toISOString();

    const recent = this.data.breaks.filter(b => b.started_at >= sinceIso);
    const total = recent.length;
    const completed = recent.filter(r => r.status === 'completed').length;
    const skipped = recent.filter(r => r.status === 'skipped').length;
    const overridden = recent.filter(r => r.status === 'overridden').length;
    const compliancePct = total === 0 ? 0 : Math.round((completed / total) * 100);
    const streak = this.computeStreak();

    const recentIncidents = this.data.incidents
      .filter(i => i.at >= sinceIso)
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 50);

    return { total, completed, skipped, overridden, compliancePct, streak, incidents: recentIncidents };
  }

  private computeStreak(): number {
    const byDay = new Map<string, { completed: number; noncompleted: number }>();
    for (const r of this.data.breaks) {
      const day = r.started_at.slice(0, 10);
      const entry = byDay.get(day) ?? { completed: 0, noncompleted: 0 };
      if (r.status === 'completed') entry.completed += 1;
      else entry.noncompleted += 1;
      byDay.set(day, entry);
    }

    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().slice(0, 10);
      const row = byDay.get(dayStr);
      if (!row) {
        if (i === 0) continue; // today not yet broken → don't break streak
        break;
      }
      if (row.noncompleted > 0) break;
      streak += 1;
    }
    return streak;
  }

  exportCsv(): string {
    const header = 'started_at,duration_sec,status\n';
    const body = [...this.data.breaks]
      .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
      .map(r => `${r.started_at},${r.duration_sec},${r.status}`)
      .join('\n');
    return header + body;
  }

  close() {
    // no-op — file is written on every mutation; nothing to flush.
  }
}
