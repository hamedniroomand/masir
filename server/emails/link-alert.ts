import type { MailMessage } from '#server/utils/mail';
import { action, layout, paragraph } from '#server/emails/layout';

export type LinkAlertKind = 'cap' | 'expiry';

export type LinkAlertInput = {
  to: string;
  slug: string;
  title: string | null;
  shortUrl: string;
  linkUrl: string;
};

export function capAlertMessage(input: LinkAlertInput & { clickCount: number; maximumVisits: number }): MailMessage {
  const left = Math.max(0, input.maximumVisits - input.clickCount);
  const name = input.title || `/${input.slug}`;
  return {
    to: input.to,
    subject: `/${input.slug} reaches its visit cap soon`,
    text: `${name} (${input.shortUrl}) has used ${input.clickCount} of ${input.maximumVisits} visits. ${left} left.\n\n${input.linkUrl}`,
    html: layout(
      paragraph(`<strong>${Bun.escapeHTML(name)}</strong> has used <strong>${input.clickCount}</strong> of its ${input.maximumVisits} visits.`)
      + paragraph(`${left} ${left === 1 ? 'visit' : 'visits'} left. The link answers 404 after that, unless you set a fallback destination.`)
      + action(input.linkUrl, 'Open the link'),
    ),
  };
}

export function expiryAlertMessage(input: LinkAlertInput & { days: number }): MailMessage {
  const name = input.title || `/${input.slug}`;
  const when = input.days <= 1 ? 'today' : `in ${input.days} days`;
  return {
    to: input.to,
    subject: `/${input.slug} expires ${when}`,
    text: `${name} (${input.shortUrl}) expires ${when}.\n\n${input.linkUrl}`,
    html: layout(
      paragraph(`<strong>${Bun.escapeHTML(name)}</strong> expires <strong>${when}</strong>.`)
      + paragraph('The link answers 404 after that, unless you set an expiration destination.')
      + action(input.linkUrl, 'Open the link'),
    ),
  };
}
