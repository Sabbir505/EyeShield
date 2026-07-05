import * as fs from 'fs';
import * as path from 'path';
import { log } from './log';

const FLAG_FILE = 'blocking.flag';

/**
 * Writes a flag file to disk when input is blocked, and clears it when
 * unblocked. On launch, if the flag file exists, the app knows the previous
 * session died mid-block and refuses to auto-block until the user clears it.
 *
 * This is the single most important safety mechanism in the entire app. If
 * everything else fails — Electron crashes, the helper crashes, the OS kills
 * the process — this file tells the next launch "something went wrong, do not
 * trust the block state."
 */
export class CrashGuard {
  private flagPath: string;

  constructor(userDataDir: string) {
    this.flagPath = path.join(userDataDir, FLAG_FILE);
  }

  async checkFlagOnLaunch(): Promise<boolean> {
    try {
      await fs.promises.access(this.flagPath);
      return true;
    } catch {
      return false;
    }
  }

  /** Returns true if the flag was successfully set. */
  async setFlagBlocking(): Promise<boolean> {
    try {
      await fs.promises.writeFile(this.flagPath, String(Date.now()));
      return true;
    } catch (e) {
      log(`Failed to set blocking flag: ${e}`);
      return false;
    }
  }

  async clearFlag() {
    try {
      await fs.promises.unlink(this.flagPath);
    } catch {
      // already gone — fine
    }
  }

  /** Synchronous flag removal — used in before-quit where async may not complete. */
  clearFlagSync() {
    try {
      fs.unlinkSync(this.flagPath);
    } catch {
      // already gone — fine
    }
  }
}
