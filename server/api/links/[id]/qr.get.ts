import { encode, renderSVG } from 'uqr';
import { requireWorkspaceMember } from '#server/utils/auth';
import { findLinkById, shortUrlFor } from '#server/utils/link-repo';
import { qrResultToPng } from '#server/utils/qr-png';

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
  const workspace = event.context.workspace as { slug: string };
  const payload = shortUrlFor(workspace.slug, link.slug);
  const qrOptions = { ecc: 'M' as const, border: 2 };
  const qr = encode(payload, qrOptions);
  const pixelSize = Math.max(1, Math.floor(size / qr.size));

  if (format === 'png') {
    const buffer = qrResultToPng(qr, pixelSize);
    setResponseHeader(event, 'Content-Type', 'image/png');
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="masir-${link.slug}.png"`);
    return buffer;
  }

  const svg = renderSVG(payload, { ...qrOptions, pixelSize });
  setResponseHeader(event, 'Content-Type', 'image/svg+xml');
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="masir-${link.slug}.svg"`);
  return svg;
});
