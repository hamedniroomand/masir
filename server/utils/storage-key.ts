import { normalize, resolve, sep } from 'node:path';

// A key can come from user input. Refuse an absolute path, a climb out of the
// root, and a null byte.
export function assertSafeKey(key: string): string {
  const clean = normalize(key.replaceAll('\\', '/'));
  if (clean.startsWith('..') || clean.startsWith('/') || clean.includes('\0'))
    throw new Error(`Unsafe storage key "${key}"`);
  return clean;
}

// normalize() alone does not hold. Resolve both sides and prove the file stays
// under the root before any read or write touches the disk.
export function resolveInRoot(root: string, key: string): string {
  const base = resolve(root);
  const path = resolve(base, assertSafeKey(key));
  if (path !== base && !path.startsWith(base + sep))
    throw new Error(`Unsafe storage key "${key}"`);
  return path;
}
