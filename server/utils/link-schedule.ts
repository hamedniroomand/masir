export function assertScheduleOrder(startsAt: Date | null, expiresAt: Date | null) {
  if (startsAt && expiresAt && startsAt.getTime() >= expiresAt.getTime()) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Start time must be before expiry.',
      data: { reason: 'Start time must be before expiry.' },
    });
  }
}
