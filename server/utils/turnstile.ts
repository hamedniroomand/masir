import type { H3Event } from 'h3';
import { clientIp } from '#server/utils/client-ip';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const ROBOT_CHECK_FAILED = 'Complete the robot check.';

// An unreachable Cloudflare counts as a refusal. Failing open would turn an
// outage there into an open door here.
export async function verifyTurnstile(token: string | undefined, secretKey: string, remoteIp: string): Promise<boolean> {
  if (!secretKey)
    return true;
  if (!token)
    return false;
  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: secretKey, response: token, remoteip: remoteIp }),
    });
    const outcome = await response.json() as { success?: boolean };
    return outcome.success === true;
  }
  catch {
    return false;
  }
}

// Call it before the rate limiter and the argon2 work, so a robot reaches neither.
export async function requireHuman(event: H3Event, token: string | undefined) {
  const { turnstileSecretKey, trustedProxyDepth } = useRuntimeConfig();
  const human = await verifyTurnstile(token, turnstileSecretKey, clientIp(event, Number(trustedProxyDepth) || 0));
  if (!human)
    throw createError({ statusCode: 422, statusMessage: ROBOT_CHECK_FAILED, data: { reason: ROBOT_CHECK_FAILED } });
}
