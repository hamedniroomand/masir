import type { H3Event } from 'h3';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
}

export async function requireUser(event: H3Event): Promise<SessionUser> {
  const session = await requireUserSession(event);
  return session.user as SessionUser;
}

export async function requireAdmin(event: H3Event): Promise<SessionUser> {
  const user = await requireUser(event);
  if (user.role !== 'admin')
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  return user;
}
