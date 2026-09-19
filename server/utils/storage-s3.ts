import type { StorageDriver, StorageProvider } from '#server/utils/storage';
import { S3Client } from 'bun';
import { assertSafeKey } from '#server/utils/storage-key';

// One driver serves S3, R2 and any other bucket with an S3 endpoint.
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
    async get(key) {
      const file = client.file(assertSafeKey(key));
      try {
        return { bytes: new Uint8Array(await file.arrayBuffer()), contentType: file.type };
      }
      catch {
        return null;
      }
    },
    async delete(key) {
      await client.delete(assertSafeKey(key));
    },
    publicUrl(key) {
      return `${base}/${assertSafeKey(key)}`;
    },
  };
}

export const s3Provider: StorageProvider = {
  name: 's3',
  create: config => (config.bucket
    ? createS3Driver({
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        bucket: config.bucket,
        endpoint: config.endpoint,
        publicBaseUrl: config.publicBaseUrl,
      })
    : null),
};
