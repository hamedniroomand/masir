import type { MailDriver, MailProvider } from '#server/utils/mail';
import { mailOutbox } from '#server/database/schema';
import { getDb } from '#server/utils/db';

// A test reads what the server sent. The server runs in its own process, so a
// driver that keeps messages in memory is invisible to the test.
export function createOutboxDriver(): MailDriver {
  return {
    async send(message) {
      const db = await getDb();
      await db.insert(mailOutbox).values({
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
    },
  };
}

export const outboxProvider: MailProvider = {
  name: 'outbox',
  create: () => createOutboxDriver(),
};
