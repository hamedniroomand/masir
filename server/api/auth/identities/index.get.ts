import { requireUser } from '#server/utils/auth';
import { listIdentities } from '#server/utils/identity-repo';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const rows = await listIdentities(user.id);
  // The hash never leaves the server.
  return {
    items: rows.map(row => ({
      id: row.id,
      provider: row.provider,
      createdAt: row.createdAt,
    })),
  };
});
