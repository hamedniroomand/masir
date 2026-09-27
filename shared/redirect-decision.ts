import type { OutcomeLabel } from '#shared/codes';
import type { LinkTargeting, RequestOs } from '#shared/link-targeting';
import { deriveLinkStatus } from '#shared/link-status';
import { resolveDestinationWithRule } from '#shared/link-targeting';

export type RedirectRule
  = | 'country'
    | 'os'
    | 'default'
    | 'expired_fallback'
    | 'limit_fallback'
    | 'scheduled_fallback';

export type RedirectDecision
  = | {
    kind: 'redirect';
    destination: string;
    outcome: OutcomeLabel;
    rule: RedirectRule;
    consumesVisit: boolean;
  }
  | {
    kind: 'block';
    outcome: OutcomeLabel;
    statusCode: 404;
    linkState: string;
    startsAt?: string | null;
  }
  | {
    kind: 'password';
  };

export type DecidableLink = {
  isEnabled: boolean;
  expiresAt: Date | null;
  startsAt?: Date | null;
  maximumVisits?: number | null;
  clickCount?: number;
  passwordHash?: string | null;
  destinationUrl: string;
  targeting?: LinkTargeting | null;
  expirationDestination?: string | null;
  limitDestination?: string | null;
  scheduledDestination?: string | null;
};

export type DecisionMeta = {
  os: RequestOs;
  country: string | null;
  isBot: boolean;
};

export type FallbackDecision = Extract<RedirectDecision, { kind: 'redirect' | 'block' }>;

export function decideLimitFallback(link: { limitDestination?: string | null }): FallbackDecision {
  if (link.limitDestination) {
    return {
      kind: 'redirect',
      destination: link.limitDestination,
      outcome: 'limit_redirect',
      rule: 'limit_fallback',
      consumesVisit: false,
    };
  }
  return {
    kind: 'block',
    outcome: 'limit_reached',
    statusCode: 404,
    linkState: 'limit_reached',
  };
}

export function decideRedirect(
  link: DecidableLink,
  input: {
    meta: DecisionMeta;
    now?: number;
    hasPasswordGrant?: boolean;
  },
): RedirectDecision {
  const now = input.now ?? Date.now();
  const status = deriveLinkStatus({
    isEnabled: link.isEnabled,
    expiresAt: link.expiresAt,
    startsAt: link.startsAt,
    maximumVisits: link.maximumVisits,
    clickCount: link.clickCount,
  }, now);

  if (status === 'disabled') {
    return {
      kind: 'block',
      outcome: 'disabled_block',
      statusCode: 404,
      linkState: 'disabled',
    };
  }

  if (status === 'expired') {
    if (link.expirationDestination) {
      return {
        kind: 'redirect',
        destination: link.expirationDestination,
        outcome: 'expired_redirect',
        rule: 'expired_fallback',
        consumesVisit: false,
      };
    }
    return {
      kind: 'block',
      outcome: 'expired_block',
      statusCode: 404,
      linkState: 'expired',
    };
  }

  if (status === 'limit_reached') {
    return decideLimitFallback(link);
  }

  if (status === 'scheduled') {
    if (link.scheduledDestination) {
      return {
        kind: 'redirect',
        destination: link.scheduledDestination,
        outcome: 'scheduled_redirect',
        rule: 'scheduled_fallback',
        consumesVisit: false,
      };
    }
    const startsAtIso = link.startsAt
      ? (link.startsAt instanceof Date ? link.startsAt.toISOString() : new Date(link.startsAt).toISOString())
      : null;
    return {
      kind: 'block',
      outcome: 'scheduled_block',
      statusCode: 404,
      linkState: 'scheduled',
      startsAt: startsAtIso,
    };
  }

  // Password gate
  if (link.passwordHash && !input.hasPasswordGrant) {
    return { kind: 'password' };
  }

  // Targeting resolution
  const { destination, rule } = resolveDestinationWithRule(link, input.meta);

  if (input.meta.isBot) {
    return {
      kind: 'redirect',
      destination,
      outcome: 'bot_request',
      rule,
      consumesVisit: false,
    };
  }

  return {
    kind: 'redirect',
    destination,
    outcome: 'redirect_success',
    rule,
    consumesVisit: true,
  };
}
