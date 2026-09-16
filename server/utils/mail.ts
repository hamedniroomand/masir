export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailDriver {
  send: (message: MailMessage) => Promise<void>;
}

let override: MailDriver | null = null;
let memoised: MailDriver | null = null;

export function createResendDriver(apiKey: string, from: string): MailDriver {
  return {
    async send(message) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      if (!res.ok)
        throw new Error(`Resend refused the message with status ${res.status}`);
    },
  };
}

// A deployment with no provider must still boot. The message goes to the log.
export function createLogDriver(): MailDriver {
  return {
    async send(message) {
      console.warn(`[mail] no provider configured; would send "${message.subject}" to ${message.to}`);
    },
  };
}

export function createMemoryDriver(): MailDriver & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
    },
  };
}

export function setMailDriver(driver: MailDriver | null) {
  override = driver;
  memoised = null;
}

function resolveDriver(): MailDriver {
  if (override)
    return override;
  if (memoised)
    return memoised;
  const { mailApiKey, mailFrom } = useRuntimeConfig();
  memoised = mailApiKey ? createResendDriver(mailApiKey, mailFrom) : createLogDriver();
  return memoised;
}

export function sendMail(message: MailMessage) {
  return resolveDriver().send(message);
}
