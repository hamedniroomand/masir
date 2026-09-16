import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { S3Client } from 'bun';

export interface StorageDriver {
  put: (key: string, data: Uint8Array, contentType: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
  publicUrl: (key: string) => string;
}

let override: StorageDriver | null = null;
let memoised: StorageDriver | null = null;

function assertSafeKey(key: string) {
  const clean = normalize(key);
  if (clean.startsWith('..') || clean.startsWith('/'))
    throw new Error(`Unsafe storage key "${key}"`);
  return clean;
}

export function createLocalDriver(root: string, baseUrl: string): StorageDriver {
  const base = baseUrl.replace(/\/$/, '');
  return {
    async put(key, data) {
      const path = join(root, assertSafeKey(key));
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, data);
    },
    async delete(key) {
      await rm(join(root, assertSafeKey(key)), { force: true });
    },
    publicUrl(key) {
      return `${base}/${assertSafeKey(key)}`;
    },
  };
}

export function createS3Driver(options: {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  publicBaseUrl: string;
}): StorageDriver {
  const client = new S3Client({
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    bucket: options.bucket,
    endpoint: options.endpoint,
  });
  const base = options.publicBaseUrl.replace(/\/$/, '');
  return {
    async put(key, data, contentType) {
      await client.write(assertSafeKey(key), data, { type: contentType });
    },
    async delete(key) {
      await client.delete(assertSafeKey(key));
    },
    publicUrl(key) {
      return `${base}/${assertSafeKey(key)}`;
    },
  };
}

export function setStorageDriver(driver: StorageDriver | null) {
  override = driver;
  memoised = null;
}

function resolveDriver(): StorageDriver {
  if (override)
    return override;
  if (memoised)
    return memoised;
  const config = useRuntimeConfig();
  memoised = config.storageBucket
    ? createS3Driver({
        accessKeyId: config.storageAccessKeyId,
        secretAccessKey: config.storageSecretAccessKey,
        bucket: config.storageBucket,
        endpoint: config.storageEndpoint,
        publicBaseUrl: config.storagePublicBaseUrl,
      })
    : createLocalDriver(config.storageLocalRoot, config.storagePublicBaseUrl);
  return memoised;
}

export function putObject(key: string, data: Uint8Array, contentType: string) {
  return resolveDriver().put(key, data, contentType);
}

export function deleteObject(key: string) {
  return resolveDriver().delete(key);
}

export function publicUrl(key: string) {
  return resolveDriver().publicUrl(key);
}
