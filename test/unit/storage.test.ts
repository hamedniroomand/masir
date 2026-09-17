import type { StorageConfig } from '#server/utils/storage';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $ } from 'bun';
import { afterEach, describe, expect, it } from 'vitest';
import { assertStorageConfig, buildStorageDriver } from '#server/utils/storage';
import { createFileDriver } from '#server/utils/storage-file';
import { newId } from '#shared/id';

let root = '';

afterEach(async () => {
  if (root)
    await $`rm -rf ${root}`.quiet();
  root = '';
});

// Bun.write makes the directory, so the root only needs a fresh name.
function driver() {
  root = join(tmpdir(), `masir-storage-${newId()}`);
  return createFileDriver(root, 'http://localhost:3000/uploads');
}

function storageConfig(overrides: Partial<StorageConfig> = {}): StorageConfig {
  return {
    driver: '',
    localRoot: './data/uploads',
    publicBaseUrl: 'http://localhost:3000/uploads',
    accessKeyId: '',
    secretAccessKey: '',
    bucket: '',
    endpoint: '',
    ...overrides,
  };
}

describe('provider registry', () => {
  it('picks s3 when a bucket is set', () => {
    expect(buildStorageDriver(storageConfig({ bucket: 'masir' })).name).toBe('s3');
  });

  it('falls back to the file provider', () => {
    expect(buildStorageDriver(storageConfig()).name).toBe('file');
  });

  it('honours an explicit provider name', () => {
    expect(buildStorageDriver(storageConfig({ driver: 'file' })).name).toBe('file');
  });

  it('throws for an unknown provider name', () => {
    expect(() => buildStorageDriver(storageConfig({ driver: 'gcs' }))).toThrow(/unknown or not configured/);
  });

  it('throws when the named provider has no configuration', () => {
    expect(() => buildStorageDriver(storageConfig({ driver: 's3' }))).toThrow(/unknown or not configured/);
  });
});

describe('assertStorageConfig', () => {
  it('refuses a disk provider in CLOUD mode', () => {
    expect(() => assertStorageConfig(storageConfig(), 'CLOUD')).toThrow(/needs a disk/);
  });

  it('allows a disk provider in SELF_HOSTED mode', () => {
    expect(() => assertStorageConfig(storageConfig(), 'SELF_HOSTED')).not.toThrow();
  });

  it('allows s3 in CLOUD mode', () => {
    expect(() => assertStorageConfig(storageConfig({ bucket: 'masir' }), 'CLOUD')).not.toThrow();
  });
});

describe('file storage driver', () => {
  it('writes and reads back the bytes', async () => {
    const store = driver();
    await store.put('logos/acme.png', new Uint8Array([1, 2, 3]), 'image/png');
    const written = await Bun.file(join(root, 'logos/acme.png')).bytes();
    expect([...written]).toEqual([1, 2, 3]);
  });

  it('builds a public url', () => {
    expect(driver().publicUrl('logos/acme.png')).toBe('http://localhost:3000/uploads/logos/acme.png');
  });

  it('deletes a missing key without throwing', async () => {
    await expect(driver().delete('logos/absent.png')).resolves.toBeUndefined();
  });

  it.each([
    '../escape.png',
    '/etc/passwd',
    'logos/../../escape.png',
    'logos\\..\\..\\escape.png',
  ])('refuses the key %s', async (key) => {
    await expect(driver().put(key, new Uint8Array([1]), 'image/png'))
      .rejects
      .toThrow(/key/i);
  });
});
