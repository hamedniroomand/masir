import type { H3Event } from 'h3';
import { sessionVersionOf } from '#server/utils/identity-repo';

// The session is sealed as JSON, so it holds a flag and not a date. A Date
// would come back as a string and every comparison on it would be wrong.
export interface SessionUser {
  id: string;
  email: string;
  emailVerified: boolean;
  sessionVersion: number;
}

export async function requireUser(event: H3Event): Promise<SessionUser> {
  const session = await requireUserSession(event);
  const user = session.user as SessionUser;

  // A sealed cookie cannot be withdrawn, so the server compares its version
  // against the user record. A password change raises the number and every
  // older cookie stops working.
  const current = await sessionVersionOf(user.id);
  if (current == null || current !== user.sessionVersion) {
    await clearUserSession(event);
    throw createError({ statusCode: 401, statusMessage: 'Sign in again.' });
  }

  return user;
}

// Verification gates every action that creates data.
export async function requireVerifiedUser(event: H3Event): Promise<SessionUser> {
  const user = await requireUser(event);
  if (!user.emailVerified)
    throw createError({ statusCode: 403, statusMessage: 'Verify your email first.' });
  return user;
}
