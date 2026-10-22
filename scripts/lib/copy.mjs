import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Recursively copy a folder. Written by hand (instead of fs.cpSync) because it
 * behaves the same on every operating system and on network or mounted drives
 * that do not allow copying file timestamps and permissions.
 * `filter(sourcePath)` may return false to skip a file or folder.
 */
export function copyDir(src, dest, filter) {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    const from = join(src, name);
    if (filter && !filter(from)) continue;
    const to = join(dest, name);
    if (statSync(from).isDirectory()) copyDir(from, to, filter);
    else copyFileSync(from, to);
  }
}
