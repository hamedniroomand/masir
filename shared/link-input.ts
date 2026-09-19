import * as v from 'valibot';

export const MAX_TAGS_PER_LINK = 20;

export const MAX_ALIASES_PER_LINK = 10;

export const CAMPAIGN_UTM_CONFLICT = 'A campaign sets utm_campaign. Clear one of the two.';

// A campaign owns utm_campaign. A database check refuses the pair, so the form
// and the route both ask this before the write.
export function hasCampaignUtmConflict(input: {
  campaignId?: string | null;
  utmCampaign?: string | null;
}) {
  return Boolean(input.campaignId) && Boolean(input.utmCampaign);
}

export const maximumVisitsSchema = v.optional(v.nullable(v.pipe(
  v.number('Maximum visits must be a number.'),
  v.integer('Maximum visits must be a whole number.'),
  v.minValue(1, 'Maximum visits must be at least 1.'),
)));

export const MAX_NOTES_LENGTH = 2000;

export const notesSchema = v.optional(v.nullable(v.pipe(
  v.string(),
  v.maxLength(MAX_NOTES_LENGTH, `Use at most ${MAX_NOTES_LENGTH} characters for notes.`),
)));

export const tagNameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, 'Enter a tag name.'),
  v.maxLength(40, 'Use at most 40 characters for a tag.'),
);

export const tagsSchema = v.optional(v.pipe(
  v.array(tagNameSchema),
  v.maxLength(MAX_TAGS_PER_LINK, `Use at most ${MAX_TAGS_PER_LINK} tags for a link.`),
));

// A cleared number input gives back an empty string, not null.
export function toVisitLimit(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : null;
}
