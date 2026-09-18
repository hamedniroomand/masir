// A route sets its reason with createError. Nitro sends it in the body, but the
// HTTP status line keeps the generic text, and ofetch reads statusMessage from
// that line. Every caller must read the body instead.
export function errorReason(error: unknown, fallback: string) {
  const failure = error as { data?: { statusMessage?: string; data?: { reason?: string } } };
  return failure.data?.data?.reason || failure.data?.statusMessage || fallback;
}
