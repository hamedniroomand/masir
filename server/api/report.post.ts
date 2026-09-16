import { setResponseHeader } from 'h3';
import * as v from 'valibot';
import { hashClientKey, rateLimitCheck } from '#server/utils/rate-limit';
import { writeSecurityEvent } from '#server/utils/security-log';

const bodySchema = v.object({
  slug: v.pipe(v.string(), v.minLength(1)),
  reason: v.pipe(v.string(), v.minLength(1)),
});

const ACK = { ok: true, message: 'Thank you. Your report was received.' };

export default defineEventHandler(async (event) => {
  const key = await hashClientKey(event);
  const rl = await rateLimitCheck(`report:${key}`, 5, 3_600_000);
  if (!rl.ok) {
    setResponseHeader(event, 'Retry-After', rl.retryAfterSec);
    return ACK;
  }

  const body = v.parse(bodySchema, await readBody(event));
  await writeSecurityEvent('abuse_report', { slug: body.slug.trim().toLowerCase(), reason: body.reason });
  return ACK;
});
