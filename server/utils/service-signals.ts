import type { ServiceSignal } from '#server/database/schema';
import { serviceSignals } from '#server/database/schema';
import { getDb } from '#server/utils/db';

export async function setSignal(key: string, state: string, detail?: unknown): Promise<void> {
  try {
    const db = await getDb();
    const now = new Date();
    await db.insert(serviceSignals)
      .values({ key, state, detail, updatedAt: now })
      .onConflictDoUpdate({
        target: serviceSignals.key,
        set: { state, detail, updatedAt: now },
      });
  }
  catch (error) {
    console.error(`[service-signals] failed to set signal "${key}":`, error);
  }
}

export async function getSignals(): Promise<ServiceSignal[]> {
  const db = await getDb();
  return db.select().from(serviceSignals);
}
