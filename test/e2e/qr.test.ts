import { Buffer } from 'node:buffer';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $fetch, fetch, setup } from '@nuxt/test-utils';
import { eq } from 'drizzle-orm';
import { encode } from 'uqr';
import { beforeAll, describe, expect, it } from 'vitest';
import { workspaces } from '#server/database/schema';
import {
  e2eSetupOptions,
  insertTestLink,
  resetTestDb,
  TEST_EMAIL,
  TEST_PASSWORD,
  testDatabaseUrl,
} from './helpers';
import { openTestDatabase } from './test-db';

const TEST_DB = testDatabaseUrl('qr');
const UPLOAD_ROOT = mkdtempSync(join(tmpdir(), 'masir-qr-'));
const LOGO_KEY = 'logos/test-logo.png';

// The smallest valid PNG. The route only base64s the bytes, so one pixel is
// enough to prove the overlay.
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

let linkId = '';
let workspaceId = '';
let cookie = '';

async function login() {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  return res.headers.get('set-cookie')!.split(';')[0]!;
}

function qr(query: Record<string, string>) {
  const search = new URLSearchParams(query).toString();
  return fetch(`/api/links/${linkId}/qr?${search}`, { headers: { cookie } });
}

describe('qr styling', async () => {
  await setup(await e2eSetupOptions(TEST_DB, { NUXT_STORAGE_LOCAL_ROOT: UPLOAD_ROOT }));

  beforeAll(async () => {
    const seeded = await resetTestDb(TEST_DB);
    workspaceId = seeded.workspaceId;
    linkId = await insertTestLink(TEST_DB, { workspaceId, slug: 'qr-styled' });
    cookie = await login();
    await Bun.write(join(UPLOAD_ROOT, LOGO_KEY), ONE_PIXEL_PNG);
  });

  it('paints the svg in the colours it is given', async () => {
    const svg = await (await qr({ format: 'svg', fg: 'ff0000' })).text();
    expect(svg).toContain('#ff0000');
  });

  it('leaves the background out when it is transparent', async () => {
    const svg = await (await qr({ format: 'svg', bg: 'transparent' })).text();
    expect(svg).not.toContain('#ffffff');
    expect(svg).toContain('none');
  });

  it('refuses a transparent background on a png and a colour that is not hex', async () => {
    expect((await qr({ format: 'png', bg: 'transparent' })).status).toBe(422);
    expect((await qr({ format: 'svg', fg: 'zzz' })).status).toBe(422);
    expect((await qr({ format: 'svg', bg: '12345' })).status).toBe(422);
  });

  it('writes the colours into the png bytes', async () => {
    const plain = Buffer.from(await (await qr({ format: 'png' })).arrayBuffer());
    const red = Buffer.from(await (await qr({ format: 'png', fg: 'ff0000' })).arrayBuffer());
    expect(plain.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(red.equals(plain)).toBe(false);
  });

  it('embeds the workspace logo and raises the error correction', async () => {
    const plain = await (await qr({ format: 'svg' })).text();
    expect(plain).not.toContain('<image');

    const db = openTestDatabase(TEST_DB);
    await db.update(workspaces).set({ logoUrl: LOGO_KEY }).where(eq(workspaces.id, workspaceId));

    const withLogo = await (await qr({ format: 'svg', logo: '1' })).text();
    expect(withLogo).toContain('<image');
    expect(withLogo).toContain('data:image/png;base64,');

    // The canvas is the module count times the pixel size, so encoding the same
    // payload here proves which error correction the route used.
    const { shortUrl } = await $fetch<{ shortUrl: string }>(`/api/links/${linkId}`, { headers: { cookie } });
    const sideOf = (svg: string) => Number(svg.match(/viewBox="0 0 (\d+)/)![1]);
    const expectedSide = (ecc: 'M' | 'H') => {
      const modules = encode(shortUrl, { ecc, border: 2 }).size;
      return modules * Math.max(1, Math.floor(256 / modules));
    };
    expect(sideOf(plain)).toBe(expectedSide('M'));
    expect(sideOf(withLogo)).toBe(expectedSide('H'));
    expect(expectedSide('H')).not.toBe(expectedSide('M'));
  });

  it('ignores the logo flag on a png', async () => {
    const png = Buffer.from(await (await qr({ format: 'png', logo: '1' })).arrayBuffer());
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png.toString('latin1')).not.toContain('<image');
  });

  it('produces no logo for a workspace that has none', async () => {
    const db = openTestDatabase(TEST_DB);
    await db.update(workspaces).set({ logoUrl: null }).where(eq(workspaces.id, workspaceId));
    const svg = await (await qr({ format: 'svg', logo: '1' })).text();
    expect(svg).not.toContain('<image');
  });

  it('answers 404 to a caller with no session', async () => {
    const res = await fetch(`/api/links/${linkId}/qr`);
    expect(res.status).toBe(401);
  });
});
