import * as v from 'valibot';

const SIGN = 'a sign, such as ! ? # or -';

// These rules guard the account password. A link password is a different
// concept and has no rules, because the owner gives it to visitors. Do not
// import this from the link endpoints.
export const ACCOUNT_PASSWORD_RULES = [
  // The s flag lets . match a newline, so a multi-line password counts.
  { label: 'At least 8 characters', test: /.{8,}/s, error: 'Use at least 8 characters.' },
  { label: 'At least 1 number', test: /\d/, error: 'Add at least 1 number.' },
  { label: `At least 1 ${SIGN}`, test: /[^\p{L}\p{N}\s]/u, error: `Add at least 1 ${SIGN}.` },
] as const;

const MAXIMUM_LENGTH = 200;

function firstUnmetRule(value: string) {
  return ACCOUNT_PASSWORD_RULES.find(rule => !rule.test.test(value));
}

// One check for every rule, so ACCOUNT_PASSWORD_RULES stays the only source.
// The form shows the full list, so the message only names the first failure.
export const accountPasswordSchema = v.pipe(
  v.string(),
  v.maxLength(MAXIMUM_LENGTH),
  v.check(
    value => !firstUnmetRule(value),
    issue => firstUnmetRule(issue.input)?.error ?? 'This password does not meet the rules.',
  ),
);
