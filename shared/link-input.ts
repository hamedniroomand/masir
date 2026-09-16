import * as v from 'valibot';

export const MAX_TAGS_PER_LINK = 20;

export const maximumVisitsSchema = v.optional(v.nullable(v.pipe(
  v.number('Maximum visits must be a number.'),
  v.integer('Maximum visits must be a whole number.'),
  v.minValue(1, 'Maximum visits must be at least 1.'),
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
