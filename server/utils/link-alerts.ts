import type { Link } from '#server/database/schema';
import { and, asc, eq, gt, isNull, lte, sql } from 'drizzle-orm';
import { links, users, workspaceMembers, workspaces } from '#server/database/schema';
import { capAlertMessage, expiryAlertMessage } from '#server/emails/link-alert';
import { writeAuditEvent } from '#server/utils/audit-log';
import { getDb } from '#server/utils/db';
import { shortUrlFor } from '#server/utils/link-repo';
import { sendMail } from '#server/utils/mail';
import { workspaceUrl } from '#shared/deployment';

export const EXPIRY_ALERT_DAYS = 3;
export const CAP_ALERT_RATIO = 0.9;
const SWEEP_LIMIT = 200;
const DAY_MS = 86_400_000;

type AlertColumn = 'capAlertSentAt' | 'expiryAlertSentAt';

// One statement claims the alert. Two instances can run this at the same time
// and only the one that gets a row back sends the mail.
async function claim(linkId: string, column: AlertColumn) {
  const db = await getDb();
  const claimed = await db.update(links)
    .set({ [column]: new Date() })
    .where(and(eq(links.id, linkId), isNull(links[column]), isNull(links.deletedAt)))
    .returning();
  return claimed[0] ?? null;
}

// A mail that failed to leave must not count as sent, or the next sweep skips
// the link for good.
async function release(linkId: string, column: AlertColumn) {
  const db = await getDb();
  await db.update(links).set({ [column]: null }).where(eq(links.id, linkId));
}

export function claimCapAlert(linkId: string) {
  return claim(linkId, 'capAlertSentAt');
}

export function claimExpiryAlert(linkId: string) {
  return claim(linkId, 'expiryAlertSentAt');
}

// The person who made the link, while they are still an active member, else
// the owner of the workspace. Somebody who was removed must not keep hearing
// about the links they left behind.
async function recipientFor(link: Link) {
  const db = await getDb();
  const activeMember = and(eq(workspaceMembers.workspaceId, link.workspaceId), isNull(workspaceMembers.deactivatedAt));
  if (link.createdBy) {
    const rows = await db.select({ email: users.email })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(and(activeMember, eq(workspaceMembers.userId, link.createdBy)))
      .limit(1);
    if (rows[0])
      return rows[0].email;
  }
  const owner = await db.select({ email: users.email })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(and(activeMember, eq(workspaceMembers.role, 'owner')))
    .limit(1);
  return owner[0]?.email ?? null;
}

async function addressesFor(link: Link) {
  const db = await getDb();
  const rows = await db.select({ slug: workspaces.slug }).from(workspaces).where(eq(workspaces.id, link.workspaceId)).limit(1);
  const workspaceSlug = rows[0]?.slug;
  if (!workspaceSlug)
    return null;
  const config = useRuntimeConfig();
  return {
    shortUrl: shortUrlFor(workspaceSlug, link.slug),
    linkUrl: `${workspaceUrl(workspaceSlug, config as never)}/links/${link.id}`,
  };
}

type MessageBase = { to: string; slug: string; title: string | null; shortUrl: string; linkUrl: string };

async function send(link: Link, kind: 'cap' | 'expiry', column: AlertColumn, build: (base: MessageBase) => Parameters<typeof sendMail>[0]) {
  const to = await recipientFor(link);
  const addresses = await addressesFor(link);
  if (!to || !addresses)
    return false;

  try {
    await sendMail(build({ to, slug: link.slug, title: link.title, ...addresses }));
  }
  catch (error) {
    await release(link.id, column);
    throw error;
  }
  await writeAuditEvent('link_alert_sent', { kind }, { workspaceId: link.workspaceId, linkId: link.id });
  return true;
}

export async function sendCapAlert(linkId: string) {
  const link = await claimCapAlert(linkId);
  if (!link || link.maximumVisits == null)
    return false;
  return send(link, 'cap', 'capAlertSentAt', base => capAlertMessage({
    ...base,
    clickCount: link.clickCount,
    maximumVisits: link.maximumVisits as number,
  }));
}

export async function sendExpiryAlert(linkId: string) {
  const link = await claimExpiryAlert(linkId);
  if (!link || !link.expiresAt)
    return false;
  const days = Math.max(0, Math.ceil((link.expiresAt.getTime() - Date.now()) / DAY_MS));
  return send(link, 'expiry', 'expiryAlertSentAt', base => expiryAlertMessage({ ...base, days }));
}

// A click that meets the threshold or the cap sends the alert. Both use the
// same claim, so a link sends one cap alert until a PATCH clears it.
export function meetsCapThreshold(clickCount: number, maximumVisits: number | null) {
  if (maximumVisits == null)
    return false;
  return clickCount >= Math.ceil(CAP_ALERT_RATIO * maximumVisits);
}

export async function runExpiryAlertSweep() {
  const db = await getDb();
  const now = new Date();
  const candidates = await db.select({ id: links.id })
    .from(links)
    .where(and(
      isNull(links.expiryAlertSentAt),
      isNull(links.deletedAt),
      eq(links.isEnabled, true),
      sql`${links.expiresAt} is not null`,
      lte(links.expiresAt, new Date(now.getTime() + EXPIRY_ALERT_DAYS * DAY_MS)),
      gt(links.expiresAt, now),
    ))
    .orderBy(asc(links.expiresAt))
    .limit(SWEEP_LIMIT);

  let sent = 0;
  for (const candidate of candidates) {
    // One failed mail must not stop the rest of the sweep.
    const ok = await sendExpiryAlert(candidate.id).catch((error) => {
      console.error(`[alerts] expiry alert failed for link ${candidate.id}`, error);
      return false;
    });
    if (ok)
      sent++;
  }
  return sent;
}
