import type { ShortUrlWorkspace } from '#server/utils/link-repo';
import { setResponseHeader } from 'h3';
import * as v from 'valibot';
import { writeAuditEvent } from '#server/utils/audit-log';
import { requireUser, requireWorkspaceMember } from '#server/utils/auth';
import { readValidBody } from '#server/utils/body';
import { findCampaignForWorkspace } from '#server/utils/campaign-repo';
import { DEMO_LINK_CAP, demoRefusal } from '#server/utils/demo';
import { SlugExhaustedError, SlugTakenError } from '#server/utils/errors';
import { countLiveLinks, createLink, isSlugTaken, linkToDto } from '#server/utils/link-repo';
import { rateLimitCheck } from '#server/utils/rate-limit';
import { validateDestination } from '#server/utils/url';
import { slugSchema } from '#shared/slug';
import { emptyToNull, optionalUtmSchema } from '#shared/utm';

const MAX_ITEMS = 20;

const itemSchema = v.object({
  clientKey: v.pipe(v.string(), v.minLength(1)),
  utmSource: optionalUtmSchema,
  utmMedium: optionalUtmSchema,
  utmContent: optionalUtmSchema,
  slug: v.optional(v.nullable(v.string())),
});

const bodySchema = v.object({
  campaignId: v.optional(v.nullable(v.string())),
  destinationUrl: v.pipe(v.string(), v.minLength(1)),
  title: v.optional(v.nullable(v.string())),
  items: v.pipe(
    v.array(itemSchema),
    v.minLength(1, 'A batch needs at least one item.'),
    v.maxLength(MAX_ITEMS, `A batch holds at most ${MAX_ITEMS} items.`),
  ),
});

export default defineEventHandler(async (event) => {
  const { workspaceId } = await requireWorkspaceMember(event, 'links.manage');
  const user = await requireUser(event);
  const workspace = event.context.workspace as ShortUrlWorkspace & { expiresAt: Date | null };
  const config = useRuntimeConfig();

  const body = await readValidBody(event, bodySchema);
  const createLimit = Number(config.rateLimitCreatePerHour) || 30;
  // One create quota per item. Raising the ceiling with a single hit would let
  // a batch of N cost the same as one create.
  for (let i = 0; i < body.items.length; i++) {
    const rl = await rateLimitCheck(`create:${workspaceId}`, createLimit, 3_600_000);
    if (!rl.ok) {
      await writeAuditEvent('rate_limit_exceeded', { scope: 'create' }, { workspaceId, actor: user.id });
      setResponseHeader(event, 'Retry-After', rl.retryAfterSec);
      throw createError({ statusCode: 429, statusMessage: 'Too Many Requests', data: { retryAfterSec: rl.retryAfterSec } });
    }
  }

  const dest = validateDestination(body.destinationUrl, config.allowPrivateDestinations);
  if (!dest.ok)
    throw createError({ statusCode: 422, statusMessage: dest.reason, data: { reason: dest.reason } });

  const campaignId = emptyToNull(body.campaignId);
  if (campaignId && !await findCampaignForWorkspace(campaignId, workspaceId))
    throw createError({ statusCode: 422, statusMessage: 'Campaign not found.', data: { reason: 'Campaign not found.' } });

  if (workspace.expiresAt != null && await countLiveLinks(workspaceId) + body.items.length > DEMO_LINK_CAP)
    throw demoRefusal(`The demo allows ${DEMO_LINK_CAP} links.`);

  const rowErrors: { clientKey: string; error: string }[] = [];
  const validated: { clientKey: string; utmSource: string | null; utmMedium: string | null; utmContent: string | null; slug?: string }[] = [];
  const seenClientKeys = new Set<string>();
  const seenSlugs = new Set<string>();

  for (const item of body.items) {
    if (seenClientKeys.has(item.clientKey)) {
      rowErrors.push({ clientKey: item.clientKey, error: 'Duplicate client key in this batch.' });
      continue;
    }
    seenClientKeys.add(item.clientKey);

    let slug: string | undefined;
    if (item.slug) {
      const parsed = v.safeParse(slugSchema, item.slug);
      if (!parsed.success) {
        rowErrors.push({ clientKey: item.clientKey, error: parsed.issues[0]?.message ?? 'Invalid input.' });
        continue;
      }
      slug = parsed.output;
      if (seenSlugs.has(slug)) {
        rowErrors.push({ clientKey: item.clientKey, error: 'This short link is already taken.' });
        continue;
      }
      if (await isSlugTaken(workspaceId, slug)) {
        rowErrors.push({ clientKey: item.clientKey, error: 'This short link is already taken.' });
        continue;
      }
      seenSlugs.add(slug);
    }
    validated.push({
      clientKey: item.clientKey,
      utmSource: emptyToNull(item.utmSource),
      utmMedium: emptyToNull(item.utmMedium),
      utmContent: emptyToNull(item.utmContent),
      slug,
    });
  }

  if (rowErrors.length)
    throw createError({ statusCode: 422, statusMessage: 'Check the rows with an error.', data: { rows: rowErrors } });

  const results = [];
  for (const item of validated) {
    try {
      const link = await createLink({
        workspaceId,
        createdBy: user.id,
        destinationUrl: dest.url,
        title: body.title,
        campaignId,
        slug: item.slug ?? undefined,
        utmSource: item.utmSource,
        utmMedium: item.utmMedium,
        utmContent: item.utmContent,
      });
      await writeAuditEvent('link_created', { slug: link.slug }, { workspaceId, actor: user.id, linkId: link.id });
      results.push({ clientKey: item.clientKey, status: 'created' as const, link: linkToDto(link, workspace) });
    }
    catch (error) {
      const message = error instanceof SlugTakenError ? 'This short link is already taken.' : error instanceof SlugExhaustedError ? 'Could not generate a slug.' : 'Could not create link.';
      results.push({ clientKey: item.clientKey, status: 'error' as const, error: message });
    }
  }

  return { results };
});
