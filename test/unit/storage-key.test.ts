import { describe, expect, it } from 'vitest';
import { assertSafeKey, logoStorageKey } from '#server/utils/storage-key';

const WORKSPACE = '0192a2b4-7f3e-7c1a-9b2d-3e4f5a6b7c8d';

describe('logoStorageKey', () => {
  it('puts the key under the workspace with the extension of the type', () => {
    expect(logoStorageKey(WORKSPACE, 'image/png')).toMatch(new RegExp(`^logos/${WORKSPACE}/[0-9a-f-]{36}\\.png$`));
    expect(logoStorageKey(WORKSPACE, 'image/jpeg')).toMatch(/\.jpg$/);
    expect(logoStorageKey(WORKSPACE, 'image/gif')).toMatch(/\.gif$/);
    expect(logoStorageKey(WORKSPACE, 'image/webp')).toMatch(/\.webp$/);
  });

  it('never gives the same key twice, so a replaced logo gets a new url', () => {
    expect(logoStorageKey(WORKSPACE, 'image/png')).not.toBe(logoStorageKey(WORKSPACE, 'image/png'));
  });

  it('builds a key that passes the safety check', () => {
    const key = logoStorageKey(WORKSPACE, 'image/png');
    expect(assertSafeKey(key)).toBe(key);
  });
});
