import { nanoid } from 'nanoid';
import { securityEvents } from '../database/schema';
import { getDb } from './db';

export async function writeSecurityEvent(
  type: string,
  detail?: Record<string, unknown>,
  actorUserId?: string | null,
) {
  const db = await getDb();
  await db.insert(securityEvents).values({
    id: nanoid(),
    createdAt: new Date(),
    type,
    actorUserId: actorUserId ?? null,
    detail: detail ? JSON.stringify(detail) : null,
  });
}
