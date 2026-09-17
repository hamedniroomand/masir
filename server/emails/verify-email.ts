import type { MailMessage } from '#server/utils/mail';

export function verifyEmailMessage(to: string, link: string): MailMessage {
  return {
    to,
    subject: 'Verify your email',
    text: `Open this link to verify your email. The link stops working after 24 hours.\n\n${link}`,
    html: `<p>Open this link to verify your email. The link stops working after 24 hours.</p><p><a href="${link}">${link}</a></p>`,
  };
}
