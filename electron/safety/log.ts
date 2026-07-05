import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

let logPath = '';
const MAX_LOG_SIZE = 1024 * 1024; // 1 MB

/** In packaged apps stdout/stderr may be a closed pipe; swallow EPIPE. */
function makeConsoleSafe() {
  for (const stream of [process.stdout, process.stderr]) {
    if (stream && typeof stream.on === 'function') {
      stream.on('error', () => {});
    }
  }
  for (const method of ['log', 'error', 'warn', 'info', 'debug'] as const) {
    const original = (console as any)[method];
    if (typeof original !== 'function') continue;
    (console as any)[method] = (...args: unknown[]) => {
      try { original.apply(console, args); } catch {}
    };
  }
}

export function initLog(userDataDir: string) {
  makeConsoleSafe();
  logPath = path.join(userDataDir, 'eyeshield.log');
  // Rotate: if the log is too big, move it to .1 and start fresh.
  try {
    const stat = fs.statSync(logPath);
    if (stat.size > MAX_LOG_SIZE) {
      const old = logPath + '.1';
      try { fs.unlinkSync(old); } catch {}
      fs.renameSync(logPath, old);
    }
  } catch {
    // File doesn't exist yet — fine.
  }
  // Append a session header (don't truncate — keep crash evidence).
  try {
    fs.appendFileSync(logPath, `\n=== EyeShield started ${new Date().toISOString()} ===\n`);
  } catch {}
}

export function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    if (logPath) fs.appendFileSync(logPath, line);
  } catch {
    // logging never throws
  }
  if (!app?.isPackaged) {
    try { console.log(line.trimEnd()); } catch {}
  }
}
