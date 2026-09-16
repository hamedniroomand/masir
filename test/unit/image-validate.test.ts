import { describe, expect, it } from 'vitest';
import { validateImage } from '#server/utils/image-validate';

function bytes(...values: number[]) {
  return new Uint8Array([...values, ...Array.from({ length: 16 }).fill(0) as number[]]);
}

const png = bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
const jpeg = bytes(0xFF, 0xD8, 0xFF, 0xE0);
const gif = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);

function webp() {
  const out = new Uint8Array(24);
  out.set([0x52, 0x49, 0x46, 0x46], 0);
  out.set([0x57, 0x45, 0x42, 0x50], 8);
  return out;
}

describe('validateImage', () => {
  it('accepts png, jpeg, gif, and webp', () => {
    expect(validateImage(png, 1024)).toEqual({ ok: true, type: 'image/png' });
    expect(validateImage(jpeg, 1024)).toEqual({ ok: true, type: 'image/jpeg' });
    expect(validateImage(gif, 1024)).toEqual({ ok: true, type: 'image/gif' });
    expect(validateImage(webp(), 1024)).toEqual({ ok: true, type: 'image/webp' });
  });

  it('refuses an executable renamed to png', () => {
    const exe = bytes(0x4D, 0x5A, 0x90, 0x00);
    const result = validateImage(exe, 1024);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.reason).toMatch(/not an image/i);
  });

  it('refuses svg', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const result = validateImage(svg, 1024);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.reason).toMatch(/svg/i);
  });

  it('refuses a file over the cap', () => {
    const result = validateImage(png, 4);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.reason).toMatch(/too large/i);
  });

  it('refuses a file too short to identify', () => {
    expect(validateImage(new Uint8Array([0x89]), 1024).ok).toBe(false);
  });
});
