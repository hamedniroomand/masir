import type { MailMessage } from '#server/utils/mail';
import { action, layout, paragraph } from '#server/emails/layout';

export function resetPasswordMessage(to: string, link: string): MailMessage {
  return {
    to,
    subject: 'Reset your password',
    text: `Open this link to set a new password. The link stops working after one hour.\n\n${link}`,
    html: layout(
      paragraph('Open this link to set a new password.')
      + action(link, 'Set a new password')
      + paragraph('<span style="font-size:13px;color:#707589;">The link stops working after one hour. If you did not ask for this, ignore this message.</span>'),
    ),
  };
}
