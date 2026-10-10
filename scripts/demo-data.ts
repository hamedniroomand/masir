import type { links } from '#server/database/schema';
import type { BotCategoryLabel, BrowserLabel, DeviceLabel, OutcomeLabel } from '#shared/codes';

export const DAY = 86_400_000;
export const NOW = Date.now();
export const daysAgo = (days: number) => new Date(NOW - days * DAY);

export type Weighted<TValue> = [TValue, number][];

export const DEVICES: Weighted<DeviceLabel> = [['desktop', 55], ['mobile', 38], ['tablet', 7]];
export const BROWSERS: Weighted<BrowserLabel> = [['chrome', 55], ['safari', 25], ['firefox', 10], ['edge', 7], ['other', 3]];
export const BOTS: Weighted<BotCategoryLabel> = [['search', 5], ['social_preview', 4], ['monitoring', 2], ['automation', 1]];
export const BOT_SHARE = 0.06;
export const COUNTRIES: Weighted<string | null> = [
  ['US', 25],
  ['DE', 12],
  ['GB', 9],
  ['IR', 8],
  ['IN', 6],
  ['FR', 6],
  ['NL', 5],
  ['CA', 5],
  ['BR', 4],
  ['JP', 3],
  ['SE', 3],
  [null, 3],
];
export const REFERRERS: Weighted<string | null> = [
  [null, 40],
  ['github.com', 20],
  ['www.google.com', 18],
  ['news.ycombinator.com', 8],
  ['www.reddit.com', 6],
  ['t.co', 5],
  ['www.linkedin.com', 3],
];
// A campaign link gets its visitors from the place that its utm_source names.
export const SOURCE_REFERRER: Record<string, string | null> = {
  x: 't.co',
  linkedin: 'www.linkedin.com',
  reddit: 'www.reddit.com',
  newsletter: null,
};

export type MemberKey = 'owner' | 'sara' | 'omar' | 'mia' | 'leo';
export type CampaignKey = 'launch' | 'newsletter';

export type DemoMember = {
  key: Exclude<MemberKey, 'owner'>;
  email: string;
  firstName: string;
  lastName: string;
  role: 'member' | 'viewer';
  joined: number;
  deactivated?: number;
};

export const MEMBERS: DemoMember[] = [
  { key: 'sara', email: 'sara.lee@example.com', firstName: 'Sara', lastName: 'Lee', role: 'member', joined: 27 },
  { key: 'omar', email: 'omar.khan@example.com', firstName: 'Omar', lastName: 'Khan', role: 'member', joined: 22 },
  { key: 'leo', email: 'leo.park@example.com', firstName: 'Leo', lastName: 'Park', role: 'member', joined: 20, deactivated: 3 },
  { key: 'mia', email: 'mia.chen@example.com', firstName: 'Mia', lastName: 'Chen', role: 'viewer', joined: 15 },
];

export const PENDING_INVITE = { email: 'nina.rossi@example.com', sent: 2 };

export const CAMPAIGNS: { key: CampaignKey; name: string; utmCampaign: string; utmMedium: string; by: MemberKey; created: number }[] = [
  { key: 'launch', name: '2.0 launch', utmCampaign: 'masir-2-launch', utmMedium: 'social', by: 'owner', created: 21 },
  { key: 'newsletter', name: 'October newsletter', utmCampaign: 'october-newsletter', utmMedium: 'email', by: 'sara', created: 9 },
];

export const TAGS = ['Docs', 'Product', 'Social', 'Newsletter', 'Events'];

export const TEAM_NOTES_PASSWORD = 'masir';

export type DemoLink = {
  slug: string;
  title: string;
  destinationUrl: string;
  created: number;
  by: MemberKey;
  tags: string[];
  // Human clicks on a normal day.
  daily: number;
  campaign?: CampaignKey;
  utmSource?: string;
  // The day that the link stopped redirecting, and what visitors got after it.
  stopped?: number;
  outcomeAfterStop?: OutcomeLabel;
  // A cap below maximumVisits, so the visit limit still has room to try.
  clickCap?: number;
  columns?: Partial<typeof links.$inferInsert>;
};

const RELEASES = 'https://github.com/hamedniroomand/masir/releases';
const DISCUSSIONS = 'https://github.com/hamedniroomand/masir/discussions';

export const LINKS: DemoLink[] = [
  {
    slug: 'docs',
    title: 'Documentation',
    destinationUrl: 'https://docs.masir.dev/',
    created: 28,
    by: 'owner',
    tags: ['Docs'],
    daily: 9,
    columns: { notes: 'Printed on the conference badges. Keep this address.', reviewAt: daysAgo(-14) },
  },
  { slug: 'github', title: 'Source code on GitHub', destinationUrl: 'https://github.com/hamedniroomand/masir', created: 28, by: 'owner', tags: ['Product'], daily: 8 },
  { slug: 'install', title: 'Installation guide', destinationUrl: 'https://docs.masir.dev/guide/installation', created: 26, by: 'sara', tags: ['Docs'], daily: 5, columns: { notes: 'Linked from the README.' } },
  { slug: 'launch-x', title: '2.0 launch post on X', destinationUrl: RELEASES, created: 21, by: 'owner', tags: ['Social'], daily: 6, campaign: 'launch', utmSource: 'x' },
  { slug: 'launch-linkedin', title: '2.0 launch post on LinkedIn', destinationUrl: RELEASES, created: 21, by: 'omar', tags: ['Social'], daily: 4, campaign: 'launch', utmSource: 'linkedin' },
  { slug: 'launch-reddit', title: '2.0 launch thread on Reddit', destinationUrl: RELEASES, created: 20, by: 'omar', tags: ['Social'], daily: 3, campaign: 'launch', utmSource: 'reddit' },
  {
    slug: 'newsletter-oct',
    title: 'October newsletter header',
    destinationUrl: 'https://docs.masir.dev/features/',
    created: 9,
    by: 'sara',
    tags: ['Newsletter'],
    daily: 6,
    campaign: 'newsletter',
    utmSource: 'newsletter',
    columns: { utmContent: 'header' },
  },
  {
    slug: 'get-started',
    title: 'Get started, by device and country',
    destinationUrl: 'https://docs.masir.dev/guide/',
    created: 16,
    by: 'omar',
    tags: ['Product'],
    daily: 4,
    columns: {
      targeting: {
        os: { ios: 'https://docs.masir.dev/guide/quickstart', android: 'https://docs.masir.dev/guide/quickstart' },
        country: { DE: 'https://docs.masir.dev/guide/self-hosting' },
      },
    },
  },
  {
    slug: 'team-notes',
    title: `Team notes (password: ${TEAM_NOTES_PASSWORD})`,
    destinationUrl: 'https://docs.masir.dev/features/access-control',
    created: 14,
    by: 'owner',
    tags: ['Docs'],
    daily: 2,
  },
  {
    slug: 'beta-invite',
    title: 'Beta invite, first 100 visits',
    destinationUrl: DISCUSSIONS,
    created: 12,
    by: 'sara',
    tags: ['Events'],
    daily: 5,
    clickCap: 64,
    // Marked as sent, so demo visits send no mail to a sample member.
    columns: { maximumVisits: 100, limitDestination: 'https://docs.masir.dev/', capAlertSentAt: daysAgo(1) },
  },
  {
    slug: 'webinar',
    title: 'Webinar room',
    destinationUrl: DISCUSSIONS,
    created: 4,
    by: 'omar',
    tags: ['Events'],
    daily: 2,
    columns: { startsAt: daysAgo(-5), scheduledDestination: 'https://docs.masir.dev/' },
  },
  {
    slug: 'early-bird',
    title: 'Early-bird offer',
    destinationUrl: 'https://docs.masir.dev/guide/quickstart',
    created: 10,
    by: 'sara',
    tags: ['Events'],
    daily: 3,
    // Marked as sent, so the alerts job sends no mail to a sample member.
    columns: { expiresAt: daysAgo(-2), expirationDestination: 'https://docs.masir.dev/', expiryAlertSentAt: daysAgo(1) },
  },
  {
    slug: 'old-promo',
    title: 'Old promotion',
    destinationUrl: 'https://docs.masir.dev/features/campaigns',
    created: 25,
    by: 'owner',
    tags: ['Social'],
    daily: 2,
    stopped: 8,
    outcomeAfterStop: 'disabled_block',
    columns: { isEnabled: false },
  },
  {
    slug: 'summer-sale',
    title: 'Summer sale',
    destinationUrl: 'https://docs.masir.dev/features/links',
    created: 29,
    by: 'leo',
    tags: ['Social'],
    daily: 2,
    stopped: 6,
    columns: { archivedAt: daysAgo(6) },
  },
  { slug: 'typo-link', title: 'Link with a typo', destinationUrl: 'https://docs.masir.dev/featurs/', created: 7, by: 'omar', tags: [], daily: 0, columns: { deletedAt: daysAgo(5) } },
];
