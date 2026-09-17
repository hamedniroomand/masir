import type { MailDriver } from '#server/utils/mail';
import { mailOutbox } from '#server/database/schema';
import { getDb } from '#server/utils/db';
import { newId } from '#shared/id';

// A test reads what the server sent. The server runs in its own process, so a
// driver that keeps messages in memory is invisible to the test.
export function createOutboxDriver(): MailDriver {
  return {
    async send(message) {
      const db = await getDb();
      await db.insert(mailOutbox).values({
        id: newId(),
        to: message.to,
        subject: message.subject,
        text: message.text,
        createdAt: new Date(),
      });
    },
  };
}
