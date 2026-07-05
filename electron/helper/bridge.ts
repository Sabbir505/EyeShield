import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { log } from '../safety/log';

type HelperMsg =
  | { type: 'block' }
  | { type: 'unblock' }
  | { type: 'status' }
  | { type: 'heartbeat' };

interface HelperResponse {
  ok: boolean;
  status?: string;
  lastInputMs?: number;
  overrideTriggered?: boolean;
  error?: string;
}

/**
 * Spawns the native EyeBreakHelper.exe and talks to it over stdin/stdout JSON
 * lines. The helper does the actual BlockInput + low-level keyboard hook work;
 * this class just wraps the protocol and:
 *   - sends a heartbeat every 1s so the helper can release the block if we die
 *   - tracks the helper's reported last-input timestamp for idle detection
 *   - emits 'override' when the helper says the user held the escape combo
 */
export class HelperBridge extends EventEmitter {
  private proc: ChildProcess | null = null;
  private helperPath: string;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastInputMs = Date.now();
  private pending = new Map<string, (res: HelperResponse) => void>();
  private seq = 0;
  private buffer = '';
  private isDisposing = false;

  /** Returns the resolved helper exe path (for logging). */
  getHelperPath(): string { return this.helperPath; }

  /** Returns true if the helper process is currently alive. */
  isAlive(): boolean { return this.proc !== null && !this.proc.killed; }

  constructor(userDataDir: string) {
    super();
    if (process.platform === 'win32') {
      const candidates: string[] = [];
      // Packaged: electron-builder puts extraResources under process.resourcesPath.
      // This is the only path used in production — no env var override for security.
      if (process.resourcesPath) {
        candidates.push(path.join(process.resourcesPath, 'EyeBreakHelper', 'EyeBreakHelper.exe'));
      }
      // Dev fallbacks — dotnet publish with -r win-x64 lands here
      candidates.push(path.join(process.cwd(), 'native-helper', 'EyeBreakHelper', 'bin', 'Release', 'net8.0', 'win-x64', 'publish', 'EyeBreakHelper.exe'));
      candidates.push(path.join(process.cwd(), 'native-helper', 'EyeBreakHelper', 'bin', 'Release', 'net8.0', 'win-x64', 'EyeBreakHelper.exe'));
      // First existing candidate wins
      this.helperPath = candidates.find(p => {
        try { return fs.existsSync(p); } catch { return false; }
      }) ?? ''; // no path if nothing found — start() will no-op safely
    } else {
      this.helperPath = ''; // macOS not yet supported
    }
  }

  async start() {
    if (!this.helperPath) return;
    // Clear any existing heartbeat timer to prevent leak on restart.
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    // Verify the exe exists before spawning — avoids EPIPE confusion later.
    try {
      fs.accessSync(this.helperPath, fs.constants.X_OK);
    } catch {
      log(`[helper] exe not found or not executable: ${this.helperPath}`);
      return;
    }
    let proc: ChildProcess;
    try {
      proc = spawn(this.helperPath, ['--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      log(`[helper] failed to spawn at ${this.helperPath}: ${e}`);
      return;
    }
    // Wire up stdout/stderr immediately so we don't lose the first chunk.
    proc.stdout?.setEncoding('utf8');
    proc.stderr?.on('data', (d: Buffer) => log(`[helper stderr] ${d.toString()}`));

    // Wait briefly for an async 'error' event (e.g. spawn ENOENT). If it
    // fires, we abandon the proc and don't start the heartbeat loop.
    const spawnOk = await new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      proc.once('error', (err: NodeJS.ErrnoException) => {
        log(`[helper] spawn error (code=${err.code}) for path: ${this.helperPath}`);
        done(false);
      });
      proc.stdout?.once('data', () => done(true));
      setTimeout(() => done(true), 2000);
    });
    if (!spawnOk) {
      try { proc.kill(); } catch {}
      return;
    }
    this.proc = proc;
    this.proc.stdout?.on('data', (chunk: string) => this.onStdout(chunk));
    this.proc.on('exit', (code) => {
      log(`[helper] exited with ${code}`);
      this.proc = null;
      // Clear heartbeat on exit — it will be re-created on restart.
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
      // Reject all pending callbacks immediately so callers don't wait for timeout.
      for (const [seq, cb] of this.pending) {
        cb({ ok: false, error: `helper exited (code ${code})` });
        this.pending.delete(seq);
      }
      // Auto-restart if this was an unexpected exit (not during dispose).
      if (!this.isDisposing && this.helperPath) {
        log('[helper] unexpected exit — attempting restart in 1s');
        setTimeout(() => {
          if (!this.isDisposing) this.start().catch(() => {});
        }, 1000);
      }
    });

    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'heartbeat' }).catch(() => {});
    }, 1000);
  }

  private onStdout(chunk: string) {
    this.buffer += chunk;
    let nl: number;
    while ((nl = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const res = JSON.parse(line) as HelperResponse & { seq?: string; event?: string };
        if (res.event === 'override') {
          this.emit('override');
          continue;
        }
        // lastInputMs from helper is the idle DURATION (ms since last input).
        // We store it as a timestamp: Date.now() - duration = timestamp of last input.
        if (typeof res.lastInputMs === 'number') {
          this.lastInputMs = Date.now() - res.lastInputMs;
        }
        const seq = res.seq;
        if (seq && this.pending.has(seq)) {
          this.pending.get(seq)!(res);
          this.pending.delete(seq);
        }
      } catch {
        // ignore non-JSON lines
      }
    }
  }

  async send(msg: HelperMsg): Promise<HelperResponse> {
    if (!this.proc || this.proc.killed) {
      if (!this.helperPath) return { ok: false, error: 'no helper path' };
      try {
        await this.start();
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    }
    if (!this.proc) return { ok: false, error: 'helper not available' };
    const seq = String(++this.seq);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(seq);
        reject(new Error('helper timeout'));
      }, 3000);
      this.pending.set(seq, (res) => {
        clearTimeout(timeout);
        resolve(res);
      });
      const payload = JSON.stringify({ ...msg, seq }) + '\n';
      this.proc?.stdin?.write(payload, (err) => {
        if (err) {
          this.pending.delete(seq);
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  }

  getLastInputTime(): number {
    return this.lastInputMs;
  }

  /**
   * Sends a block command with retry. The block is critical — if the first
   * attempt times out, we retry once before giving up. Returns true if the
   * block was confirmed by the helper.
   */
  async sendBlockWithRetry(): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await this.send({ type: 'block' });
        if (res.ok) return true;
      } catch {
        // timeout or error — retry once
      }
    }
    return false;
  }

  /**
   * Synchronously sends an unblock command and kills the helper.
   * Used in before-quit where async IPC may not complete before exit.
   */
  syncUnblockAndKill() {
    this.isDisposing = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    if (this.proc && !this.proc.killed) {
      try {
        this.proc.stdin?.write(JSON.stringify({ type: 'unblock', seq: 'quit' }) + '\n');
      } catch {}
      try { this.proc.kill(); } catch {}
      this.proc = null;
    }
  }
}
