import QRCode from 'qrcode';
import { requireUser } from '../../../utils/auth';
import { findLinkByIdForUser, shortUrlFor } from '../../../utils/link-repo';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const link = await findLinkByIdForUser(id, user.id);
  if (!link)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  const query = getQuery(event);
  const format = query.format === 'png' ? 'png' : 'svg';
  const size = Math.min(512, Math.max(64, Number(query.size ?? 256) || 256));
  const payload = shortUrlFor(link.slug);

  if (format === 'png') {
    const buffer = await QRCode.toBuffer(payload, { type: 'png', width: size, errorCorrectionLevel: 'M', margin: 2 });
    setResponseHeader(event, 'Content-Type', 'image/png');
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="linkyard-${link.slug}.png"`);
    return buffer;
  }

  const svg = await QRCode.toString(payload, { type: 'svg', width: size, errorCorrectionLevel: 'M', margin: 2 });
  setResponseHeader(event, 'Content-Type', 'image/svg+xml');
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="linkyard-${link.slug}.svg"`);
  return svg;
});
