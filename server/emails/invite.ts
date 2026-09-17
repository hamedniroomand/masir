import type { MailMessage } from '#server/utils/mail';

export function inviteMessage(to: string, workspaceName: string, link: string): MailMessage {
  return {
    to,
    subject: `Join ${workspaceName} on Linkyard`,
    text: `You were invited to join ${workspaceName}. Open this link to accept. The link stops working after 7 days.\n\n${link}`,
    html: `<p>You were invited to join ${workspaceName}. Open this link to accept. The link stops working after 7 days.</p><p><a href="${link}">${link}</a></p>`,
  };
}
