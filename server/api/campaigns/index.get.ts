import { requireUser } from '#server/utils/auth';
import { listCampaigns } from '#server/utils/campaign-repo';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const items = await listCampaigns(user.id);
  return { items, total: items.length };
});
