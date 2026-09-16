import type { H3Event } from 'h3';
import type { BaseIssue, BaseSchema, InferOutput } from 'valibot';
import { safeParse } from 'valibot';

// A raw valibot error leaves the client with a 500 and no reason.
export async function readValidBody<S extends BaseSchema<unknown, unknown, BaseIssue<unknown>>>(
  event: H3Event,
  schema: S,
): Promise<InferOutput<S>> {
  const result = safeParse(schema, await readBody(event));
  if (result.success)
    return result.output;
  const reason = result.issues[0]!.message;
  throw createError({ statusCode: 422, statusMessage: reason, data: { reason } });
}
