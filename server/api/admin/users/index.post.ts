import * as v from 'valibot';
import { users } from '#server/database/schema';
import { requireAdmin } from '#server/utils/auth';
import { getDb } from '#server/utils/db';
import { writeSecurityEvent } from '#server/utils/security-log';
import { generateSlug } from '#server/utils/slug';
import { newId } from '#shared/id';

const bodySchema = v.object({
  email: v.pipe(v.string(), v.email()),
  name: v.pipe(v.string(), v.minLength(1)),
  role: v.optional(v.picklist(['admin', 'member'])),
});

function initialPassword() {
  return `${generateSlug(4)}-${generateSlug(4)}-${generateSlug(4)}`;
}

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);
  const body = v.parse(bodySchema, await readBody(event));
  const db = await getDb();
  const password = initialPassword();
  const id = newId();

  try {
    await db.insert(users).values({
      id,
      email: body.email.toLowerCase(),
      passwordHash: await hashPassword(password),
      name: body.name,
      role: body.role ?? 'member',
      isActive: true,
      createdAt: new Date(),
    });
  }
  catch {
    throw createError({ statusCode: 409, statusMessage: 'Email already exists.' });
  }

  await writeSecurityEvent('user_created', { userId: id, email: body.email.toLowerCase() }, admin.id);
  setResponseStatus(event, 201);
  return { user: { id, email: body.email.toLowerCase(), name: body.name, role: body.role ?? 'member' }, initialPassword: password };
});
