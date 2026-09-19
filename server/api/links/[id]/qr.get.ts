import type { Rgb } from '#server/utils/qr-png';
import { Buffer } from 'node:buffer';
import { encode, renderSVG } from 'uqr';
import { requireWorkspaceMember } from '#server/utils/auth';
import { findLinkById, shortUrlFor } from '#server/utils/link-repo';
import { qrResultToPng } from '#server/utils/qr-png';
import { getObject } from '#server/utils/storage';

const HEX = /^[0-9a-f]{6}$/i;

function badColour(name: string) {
  const reason = `${name} must be six hex digits.`;
  return createError({ statusCode: 422, statusMessage: reason, data: { reason } });
}

function readColour(value: unknown, name: string, fallback: string): string {
  if (value === undefined || value === '')
    return fallback;
  if (typeof value !== 'string' || !HEX.test(value))
    throw badColour(name);
  return value.toLowerCase();
}

// The code keeps working with the middle 20 percent covered, because ECC H
// recovers up to 30 percent of the modules.
const LOGO_FRACTION = 0.2;

function withLogo(svg: string, logo: { bytes: Uint8Array; contentType: string } | null, background: string) {
  if (!logo)
    return svg;
  const side = Number(svg.match(/viewBox="0 0 (\d+)/)?.[1] ?? 0);
  if (!side)
    return svg;
  const size = Math.round(side * LOGO_FRACTION);
  const offset = Math.round((side - size) / 2);
  const pad = Math.max(1, Math.round(size * 0.1));
  const dataUri = `data:${logo.contentType};base64,${Buffer.from(logo.bytes).toString('base64')}`;
  const overlay = `<rect x="${offset - pad}" y="${offset - pad}" width="${size + pad * 2}" height="${size + pad * 2}" fill="#${background}"/>`
    + `<image x="${offset}" y="${offset}" width="${size}" height="${size}" href="${dataUri}" preserveAspectRatio="xMidYMid meet"/>`;
  return svg.replace('</svg>', `${overlay}</svg>`);
}

function toRgb(hex: string): Rgb {
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.read');
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const link = await findLinkById(id, workspaceId);
  if (!link)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const query = getQuery(event);
  const format = query.format === 'png' ? 'png' : 'svg';
  const size = Math.min(512, Math.max(64, Number(query.size ?? 256) || 256));

  const foreground = readColour(query.fg, 'fg', '000000');
  // A transparent background needs an SVG. A PNG here would silently lose it.
  const transparent = query.bg === 'transparent';
  if (transparent && format === 'png')
    throw badColour('bg');
  const background = transparent ? 'transparent' : readColour(query.bg, 'bg', 'ffffff');
  const workspace = event.context.workspace as { slug: string; logoUrl: string | null };
  const payload = shortUrlFor(workspace.slug, link.slug);

  // A logo covers the middle of the code, so the highest error correction has
  // to carry it. PNG has no compositor here, so the flag applies to SVG only.
  const logo = query.logo === '1' && format === 'svg' && workspace.logoUrl
    ? await getObject(workspace.logoUrl).catch(() => null)
    : null;
  const qrOptions = { ecc: logo ? 'H' as const : 'M' as const, border: 2 };
  const qr = encode(payload, qrOptions);
  const pixelSize = Math.max(1, Math.floor(size / qr.size));

  if (format === 'png') {
    const buffer = qrResultToPng(qr, pixelSize, toRgb(foreground), toRgb(background));
    setResponseHeader(event, 'Content-Type', 'image/png');
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="masir-${link.slug}.png"`);
    return buffer;
  }

  const svg = withLogo(renderSVG(payload, {
    ...qrOptions,
    pixelSize,
    blackColor: `#${foreground}`,
    whiteColor: transparent ? 'none' : `#${background}`,
  }), logo, transparent ? 'ffffff' : background);
  setResponseHeader(event, 'Content-Type', 'image/svg+xml');
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="masir-${link.slug}.svg"`);
  return svg;
});
