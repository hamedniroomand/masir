import type { DeploymentMode } from '#shared/deployment';
import { fileProvider } from '#server/utils/storage-file';
import { s3Provider } from '#server/utils/storage-s3';

export type StorageDriver = {
  put: (key: string, data: Uint8Array, contentType: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
  publicUrl: (key: string) => string;
};

export type StorageConfig = {
  driver: string;
  // The key stays localRoot so NUXT_STORAGE_LOCAL_ROOT keeps its meaning.
  localRoot: string;
  publicBaseUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
};

// One strategy for each backend. create() gives back null when the config holds
// no credentials for that backend, so the resolver can try the next one.
export type StorageProvider = {
  name: string;
  // true when the provider needs a disk that lives longer than one request. An
  // edge or serverless runtime has none.
  needsDisk?: boolean;
  create: (config: StorageConfig) => StorageDriver | null;
};

const providers = new Map<string, StorageProvider>();

let override: StorageDriver | null = null;
let memoised: StorageDriver | null = null;

export function registerStorageProvider(provider: StorageProvider) {
  providers.set(provider.name, provider);
  memoised = null;
}

export function storageProviderNames() {
  return [...providers.keys()];
}

registerStorageProvider(s3Provider);
registerStorageProvider(fileProvider);

// With no NUXT_STORAGE_DRIVER, a bucket wins. The file provider takes the rest,
// because it always holds a root.
const DEFAULT_ORDER = ['s3', 'file'];

// The chosen name comes back with the driver, so a caller can report the choice
// without building the driver a second time.
export function buildStorageDriver(config: StorageConfig): { name: string; driver: StorageDriver } {
  if (config.driver) {
    const driver = providers.get(config.driver)?.create(config);
    if (driver)
      return { name: config.driver, driver };
    throw new Error(`Storage provider "${config.driver}" is unknown or not configured; known providers are ${storageProviderNames().join(', ')}`);
  }

  for (const name of DEFAULT_ORDER) {
    const driver = providers.get(name)?.create(config);
    if (driver)
      return { name, driver };
  }
  throw new Error('No storage provider is configured; set NUXT_STORAGE_LOCAL_ROOT or NUXT_STORAGE_BUCKET');
}

// A CLOUD deployment runs on an edge or serverless runtime, which keeps no disk
// between requests. Refuse at boot rather than lose every upload at the first
// cold start.
export function assertStorageConfig(config: StorageConfig, deploymentMode: DeploymentMode) {
  const { name } = buildStorageDriver(config);
  if (deploymentMode === 'CLOUD' && providers.get(name)?.needsDisk)
    throw new Error(`Storage provider "${name}" needs a disk, which a CLOUD deployment does not keep. Set NUXT_STORAGE_BUCKET to store uploads in a bucket.`);
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
  memoised = buildStorageDriver(useRuntimeConfig().storage).driver;
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
