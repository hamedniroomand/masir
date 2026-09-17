import { and, desc, eq, sql } from 'drizzle-orm';
import { campaigns, links } from '#server/database/schema';
import { getDb, isUniqueViolation } from '#server/utils/db';
import { CampaignTakenError } from '#server/utils/errors';
import { invalidateAllLinks } from '#server/utils/link-cache';
import { newId } from '#shared/id';

export function campaignToDto(campaign: typeof campaigns.$inferSelect, stats?: { linkCount: number; clickCount: number }) {
  return {
    id: campaign.id,
    name: campaign.name,
    utmCampaign: campaign.utmCampaign,
    utmMedium: campaign.utmMedium,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    linkCount: stats?.linkCount ?? 0,
    clickCount: stats?.clickCount ?? 0,
  };
}

export async function listCampaigns(workspaceId: string) {
  const db = await getDb();
  const rows = await db.select({
    campaign: campaigns,
    linkCount: sql<number>`count(${links.id})`,
    clickCount: sql<number>`coalesce(sum(${links.clickCount}), 0)`,
  })
    .from(campaigns)
    .leftJoin(links, eq(links.campaignId, campaigns.id))
    .where(eq(campaigns.workspaceId, workspaceId))
    .groupBy(campaigns.id)
    .orderBy(desc(campaigns.createdAt));

  return rows.map(row => campaignToDto(row.campaign, {
    linkCount: Number(row.linkCount),
    clickCount: Number(row.clickCount),
  }));
}

export async function findCampaignForWorkspace(id: string, workspaceId: string) {
  const db = await getDb();
  const rows = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.workspaceId, workspaceId))).limit(1);
  return rows[0] ?? null;
}

export async function createCampaign(input: {
  workspaceId: string;
  createdByUserId: string;
  name: string;
  utmCampaign: string;
  utmMedium: string | null;
}) {
  const db = await getDb();
  const now = new Date();
  const id = newId();
  try {
    await db.insert(campaigns).values({
      id,
      workspaceId: input.workspaceId,
      createdByUserId: input.createdByUserId,
      name: input.name,
      utmCampaign: input.utmCampaign,
      utmMedium: input.utmMedium,
      createdAt: now,
      updatedAt: now,
    });
  }
  catch (error) {
    if (isUniqueViolation(error))
      throw new CampaignTakenError();
    throw error;
  }
  return findCampaignForWorkspace(id, input.workspaceId);
}

export async function updateCampaign(id: string, workspaceId: string, patch: {
  name?: string;
  utmCampaign?: string;
  utmMedium?: string | null;
}) {
  const existing = await findCampaignForWorkspace(id, workspaceId);
  if (!existing)
    return null;

  const db = await getDb();
  try {
    await db.update(campaigns).set({ ...patch, updatedAt: new Date() }).where(eq(campaigns.id, id));
  }
  catch (error) {
    if (isUniqueViolation(error))
      throw new CampaignTakenError();
    throw error;
  }
  invalidateAllLinks();
  return findCampaignForWorkspace(id, workspaceId);
}

export async function deleteCampaign(id: string, workspaceId: string) {
  const existing = await findCampaignForWorkspace(id, workspaceId);
  if (!existing)
    return false;

  const db = await getDb();
  await db.delete(campaigns).where(eq(campaigns.id, id));
  invalidateAllLinks();
  return true;
}
