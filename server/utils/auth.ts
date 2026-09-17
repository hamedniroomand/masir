import type { H3Event } from 'h3';

// The session is sealed as JSON, so it holds a flag and not a date. A Date
// would come back as a string and every comparison on it would be wrong.
export interface SessionUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

export async function requireUser(event: H3Event): Promise<SessionUser> {
  const session = await requireUserSession(event);
  return session.user as SessionUser;
}

// Verification gates every action that creates data.
export async function requireVerifiedUser(event: H3Event): Promise<SessionUser> {
  const user = await requireUser(event);
  if (!user.emailVerified)
    throw createError({ statusCode: 403, statusMessage: 'Verify your email first.' });
  return user;
}
