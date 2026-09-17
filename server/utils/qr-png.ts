import type { QrCodeGenerateResult } from 'uqr';
import { Buffer } from 'node:buffer';
// ponytail: node:zlib, not Bun.deflateSync — a PNG IDAT needs zlib-framed
// deflate (0x78 0x9c) and Bun emits raw deflate with no option to frame it.
import { deflateSync } from 'node:zlib';

function crc32(buffer: Buffer): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i] ?? 0;
    for (let j = 0; j < 8; j++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function qrResultToPng(qr: QrCodeGenerateResult, pixelSize: number): Buffer {
  const modules = qr.size;
  const width = modules * pixelSize;
  const height = width;
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0;
    const moduleY = Math.floor(y / pixelSize);
    for (let x = 0; x < width; x++) {
      const moduleX = Math.floor(x / pixelSize);
      const black = qr.data[moduleY]?.[moduleX] ?? false;
      const v = black ? 0 : 255;
      const i = rowStart + 1 + x * 3;
      raw[i] = v;
      raw[i + 1] = v;
      raw[i + 2] = v;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(width, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
