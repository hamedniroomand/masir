// Every smallint column on click_events reads its codes from here. Stored rows
// keep an old code forever, so a removed label never gives its number away.

export const OUTCOME = {
  redirect_success: 1,
  bot_request: 2,
  password_failed: 3,
  scheduled_block: 4,
  disabled_block: 5,
  expired_block: 6,
  expired_redirect: 7,
  limit_reached: 8,
} as const;

export const DEVICE = {
  other: 0,
  desktop: 1,
  mobile: 2,
  tablet: 3,
} as const;

export const BROWSER = {
  other: 0,
  chrome: 1,
  firefox: 2,
  safari: 3,
  edge: 4,
} as const;

export const BOT_CATEGORY = {
  search: 1,
  social_preview: 2,
  monitoring: 3,
  automation: 4,
} as const;

export type OutcomeLabel = keyof typeof OUTCOME;
export type DeviceLabel = keyof typeof DEVICE;
export type BrowserLabel = keyof typeof BROWSER;
export type BotCategoryLabel = keyof typeof BOT_CATEGORY;

function reverse<TMap extends Record<string, number>>(map: TMap) {
  const byCode = new Map<number, keyof TMap>(
    Object.entries(map).map(([label, code]) => [code, label as keyof TMap]),
  );
  return (code: number) => byCode.get(code);
}

export const outcomeLabel = reverse(OUTCOME);
export const deviceLabel = reverse(DEVICE);
export const browserLabel = reverse(BROWSER);
export const botCategoryLabel = reverse(BOT_CATEGORY);
