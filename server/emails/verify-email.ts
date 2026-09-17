import type { MailMessage } from '#server/utils/mail';
import { action, layout, paragraph } from '#server/emails/layout';

export function verifyEmailMessage(to: string, link: string): MailMessage {
  return {
    to,
    subject: 'Verify your email',
    text: `Open this link to verify your email. The link stops working after 24 hours.\n\n${link}`,
    html: layout(
      paragraph('Open this link to verify your email address.')
      + action(link, 'Verify my email')
      + paragraph('<span style="font-size:13px;color:#707589;">The link stops working after 24 hours.</span>'),
    ),
  };
}
