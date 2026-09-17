import { and, desc, eq, sql } from 'drizzle-orm';
import { campaigns, links } from '#server/database/schema';
import { getDb, isUniqueViolation, isUuid } from '#server/utils/db';
import { CampaignTakenError } from '#server/utils/errors';
import { invalidateAllLinks } from '#server/utils/link-cache';

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
    // A deleted link keeps its clicks in the total, so the history of the
    // campaign does not move. It is not a link any more, so it is not counted.
    linkCount: sql<number>`count(${links.id}) filter (where ${links.deletedAt} is null)`,
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
  if (!isUuid(id))
    return null;
  const db = await getDb();
  const rows = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.workspaceId, workspaceId))).limit(1);
  return rows[0] ?? null;
}

export async function createCampaign(input: {
  workspaceId: string;
  createdBy: string;
  name: string;
  utmCampaign: string;
  utmMedium: string | null;
}) {
  const db = await getDb();
  try {
    const [created] = await db.insert(campaigns).values({
      workspaceId: input.workspaceId,
      createdBy: input.createdBy,
      name: input.name,
      utmCampaign: input.utmCampaign,
      utmMedium: input.utmMedium,
    }).returning();
    return created ?? null;
  }
  catch (error) {
    if (isUniqueViolation(error))
      throw new CampaignTakenError();
    throw error;
  }
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
