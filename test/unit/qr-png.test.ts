import { Buffer } from 'node:buffer';
import { inflateSync } from 'node:zlib';
import { encode } from 'uqr';
import { describe, expect, it } from 'vitest';
import { qrResultToPng } from '#server/utils/qr-png';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// The encoder writes one IHDR, one IDAT, and one IEND, so the reader only has
// to walk the chunks once.
function decode(png: Buffer) {
  expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  let offset = 8;
  let width = 0;
  const parts: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR')
      width = data.readUInt32BE(0);
    if (type === 'IDAT')
      parts.push(Buffer.from(data));
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const rowSize = 1 + width * 3;
  return {
    width,
    pixel(x: number, y: number) {
      const at = y * rowSize + 1 + x * 3;
      return [raw[at], raw[at + 1], raw[at + 2]];
    },
  };
}

describe('qrResultToPng', () => {
  const qr = encode('https://example.com/abc', { ecc: 'M', border: 2 });

  // The border is quiet space, so this module is light. The finder pattern
  // starts right after it, so this one is dark.
  const lightModule = { x: 0, y: 0 };
  const darkModule = { x: 2, y: 2 };

  it('writes black on white by default', () => {
    const png = decode(qrResultToPng(qr, 4));
    expect(png.pixel(lightModule.x * 4, lightModule.y * 4)).toEqual([255, 255, 255]);
    expect(png.pixel(darkModule.x * 4, darkModule.y * 4)).toEqual([0, 0, 0]);
  });

  it('writes the colours it is given', () => {
    const png = decode(qrResultToPng(qr, 4, [255, 0, 0], [0, 0, 255]));
    expect(png.pixel(lightModule.x * 4, lightModule.y * 4)).toEqual([0, 0, 255]);
    expect(png.pixel(darkModule.x * 4, darkModule.y * 4)).toEqual([255, 0, 0]);
  });
});
