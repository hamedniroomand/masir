import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createLocalDriver } from '#server/utils/storage';

let root = '';

afterEach(async () => {
  if (root)
    await rm(root, { recursive: true, force: true });
  root = '';
});

async function driver() {
  root = await mkdtemp(join(tmpdir(), 'linkyard-storage-'));
  return createLocalDriver(root, 'http://localhost:3000/uploads');
}

describe('local storage driver', () => {
  it('writes and reads back the bytes', async () => {
    const store = await driver();
    await store.put('logos/acme.png', new Uint8Array([1, 2, 3]), 'image/png');
    const written = await readFile(join(root, 'logos/acme.png'));
    expect([...written]).toEqual([1, 2, 3]);
  });

  it('builds a public url', async () => {
    const store = await driver();
    expect(store.publicUrl('logos/acme.png')).toBe('http://localhost:3000/uploads/logos/acme.png');
  });

  it('deletes a missing key without throwing', async () => {
    const store = await driver();
    await expect(store.delete('logos/absent.png')).resolves.toBeUndefined();
  });

  it('refuses a key that escapes the root', async () => {
    const store = await driver();
    await expect(store.put('../escape.png', new Uint8Array([1]), 'image/png'))
      .rejects
      .toThrow(/key/i);
  });
});
