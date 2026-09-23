import type { H3Event } from 'h3';
import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import { getRequestHeader } from 'h3';

function tokenMatches(header: string, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function parseOperatorEmails(input: string): Set<string> {
  return new Set(
    input
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function requireOperator(event: H3Event): Promise<{ operatorEmail?: string; isSecret?: boolean }> {
  const config = useRuntimeConfig();
  const operatorEmails = parseOperatorEmails(config.operatorEmails || '');
  const jobsSecret = config.jobsSecret?.trim() || '';

  // An empty list and an empty secret answer 404.
  if (operatorEmails.size === 0 && !jobsSecret)
    throw createError({ statusCode: 404, statusMessage: 'Not found' });

  // 1. Check Bearer token against jobsSecret
  const authHeader = getRequestHeader(event, 'authorization') ?? '';
  if (jobsSecret && authHeader && tokenMatches(authHeader, jobsSecret))
    return { isSecret: true };

  // 2. Check signed-in user session
  const session = await getUserSession(event);
  const email = (session.user as { email?: string } | undefined)?.email?.trim().toLowerCase();
  if (email && operatorEmails.has(email))
    return { operatorEmail: email };

  // Denied callers receive 404 to avoid disclosing route existence.
  throw createError({ statusCode: 404, statusMessage: 'Not found' });
}
