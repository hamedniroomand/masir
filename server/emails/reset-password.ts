import type { MailMessage } from '#server/utils/mail';

export function resetPasswordMessage(to: string, link: string): MailMessage {
  return {
    to,
    subject: 'Reset your password',
    text: `Open this link to set a new password. The link stops working after one hour.\n\n${link}`,
    html: `<p>Open this link to set a new password. The link stops working after one hour.</p><p><a href="${link}">${link}</a></p>`,
  };
}
