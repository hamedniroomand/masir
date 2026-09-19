import * as v from 'valibot';

export const TARGET_OS = ['ios', 'android', 'desktop'] as const;

export const MAX_COUNTRY_RULES = 20;

export type TargetOs = typeof TARGET_OS[number];

export type RequestOs = TargetOs | 'other';

export type LinkTargeting = {
  os?: Partial<Record<TargetOs, string>>;
  country?: Record<string, string>;
};

// The shape only. The route runs validateDestination on every URL, because the
// private-address rule reads runtime config that shared code cannot see.
const ruleUrlSchema = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^https?:\/\/\S+$/i, 'A targeting destination must be an http or https URL.'),
  v.maxLength(2048, 'URL is too long (max 2048 characters).'),
);

export const targetingSchema = v.optional(v.nullable(v.object({
  os: v.optional(v.partial(v.object({
    ios: ruleUrlSchema,
    android: ruleUrlSchema,
    desktop: ruleUrlSchema,
  }))),
  country: v.optional(v.pipe(
    v.record(v.pipe(v.string(), v.regex(/^[A-Z]{2}$/, 'A country key must be two uppercase letters.')), ruleUrlSchema),
    v.check(map => Object.keys(map).length <= MAX_COUNTRY_RULES, `Use at most ${MAX_COUNTRY_RULES} country rules.`),
  )),
})));

// An empty map and a missing map mean the same thing, so only one of them is
// ever stored.
export function normalizeTargeting(input: LinkTargeting | null | undefined): LinkTargeting | null {
  if (!input)
    return null;
  const out: LinkTargeting = {};
  if (input.os && Object.keys(input.os).length)
    out.os = input.os;
  if (input.country && Object.keys(input.country).length)
    out.country = input.country;
  return Object.keys(out).length ? out : null;
}

// A country rule is the rarer and more deliberate one, so it wins over an os
// rule when both match.
export function resolveDestination(
  link: { destinationUrl: string; targeting: LinkTargeting | null },
  meta: { os: RequestOs; country: string | null },
): string {
  const targeting = link.targeting;
  if (!targeting)
    return link.destinationUrl;
  const byCountry = meta.country ? targeting.country?.[meta.country] : undefined;
  if (byCountry)
    return byCountry;
  const byOs = meta.os === 'other' ? undefined : targeting.os?.[meta.os];
  return byOs ?? link.destinationUrl;
}
