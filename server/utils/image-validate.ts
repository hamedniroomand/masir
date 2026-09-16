export type ImageType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

export type ImageResult
  = | { ok: true; type: ImageType }
    | { ok: false; reason: string };

const MINIMUM_BYTES = 12;

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((value, i) => bytes[offset + i] === value);
}

export function validateImage(bytes: Uint8Array, maxBytes: number): ImageResult {
  if (bytes.byteLength > maxBytes)
    return { ok: false, reason: `The file is too large. The limit is ${maxBytes} bytes.` };

  if (bytes.byteLength < MINIMUM_BYTES)
    return { ok: false, reason: 'The file is too short to identify.' };

  if (startsWith(bytes, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    return { ok: true, type: 'image/png' };

  if (startsWith(bytes, [0xFF, 0xD8, 0xFF]))
    return { ok: true, type: 'image/jpeg' };

  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]))
    return { ok: true, type: 'image/gif' };

  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return { ok: true, type: 'image/webp' };

  // An SVG can hold script, so it is refused even though it is an image.
  const head = new TextDecoder().decode(bytes.subarray(0, 256)).trimStart().toLowerCase();
  if (head.startsWith('<svg') || head.startsWith('<?xml'))
    return { ok: false, reason: 'An SVG file is not allowed.' };

  return { ok: false, reason: 'The file is not an image.' };
}
