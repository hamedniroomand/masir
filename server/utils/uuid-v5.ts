import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replaceAll('-', '');
  if (hex.length !== 32)
    throw new Error('Invalid UUID.');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++)
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function uuidV5(namespaceUuid: string, name: Uint8Array | string): string {
  const namespace = uuidToBytes(namespaceUuid);
  const nameBytes = typeof name === 'string' ? Buffer.from(name, 'utf8') : Buffer.from(name);
  const hash = createHash('sha1').update(namespace).update(nameBytes).digest();
  const bytes = Uint8Array.from(hash.subarray(0, 16));
  const version = bytes[6] ?? 0;
  const variant = bytes[8] ?? 0;
  bytes[6] = (version & 0x0F) | 0x50;
  bytes[8] = (variant & 0x3F) | 0x80;
  return bytesToUuid(bytes);
}
