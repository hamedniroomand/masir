import type { MailDriver, MailProvider } from '#server/utils/mail';

const TIMEOUT_MS = 10_000;

export function createResendDriver(apiKey: string, from: string): MailDriver {
  return {
    async send(message) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok)
        throw new Error(`Resend refused the message with status ${res.status}`);
    },
  };
}

export const resendProvider: MailProvider = {
  name: 'resend',
  create: config => (config.apiKey ? createResendDriver(config.apiKey, config.from) : null),
};
