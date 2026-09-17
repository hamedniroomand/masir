import type { StorageDriver, StorageProvider } from '#server/utils/storage';
import { assertSafeKey, resolveInRoot } from '#server/utils/storage-key';

// Writes to the local disk. Use it on a VPS, or in a container with a mounted
// volume. An edge or serverless runtime has no disk that survives a request, so
// those deployments must use the s3 provider.
export function createFileDriver(root: string, publicBaseUrl: string): StorageDriver {
  const base = publicBaseUrl.replace(/\/$/, '');
  return {
    async put(key, data) {
      // Bun.write makes the parent directories itself.
      await Bun.write(resolveInRoot(root, key), data);
    },
    async delete(key) {
      // A file that is already gone is in the wanted state.
      await Bun.file(resolveInRoot(root, key)).delete().catch(() => {});
    },
    publicUrl(key) {
      return `${base}/${assertSafeKey(key)}`;
    },
  };
}

export const fileProvider: StorageProvider = {
  name: 'file',
  needsDisk: true,
  create: config => (config.localRoot ? createFileDriver(config.localRoot, config.publicBaseUrl) : null),
};
