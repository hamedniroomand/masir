import type { H3Event } from 'h3';
import type { BaseIssue, BaseSchema, InferOutput } from 'valibot';
import { safeParse } from 'valibot';

// A raw valibot error leaves the client with a 500 and no reason.
export async function readValidBody<TSchema extends BaseSchema<unknown, unknown, BaseIssue<unknown>>>(
  event: H3Event,
  schema: TSchema,
): Promise<InferOutput<TSchema>> {
  const result = safeParse(schema, await readBody(event));
  if (result.success)
    return result.output;
  const reason = result.issues[0]?.message ?? 'Invalid input.';
  throw createError({ statusCode: 422, statusMessage: reason, data: { reason } });
}
