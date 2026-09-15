export type LinkStatus = 'active' | 'disabled' | 'expired';

export function deriveLinkStatus(link: {
  isEnabled: boolean;
  expiresAt: Date | null;
}, now = Date.now()): LinkStatus {
  const expired = link.expiresAt != null && link.expiresAt.getTime() <= now;
  if (expired)
    return 'expired';
  if (!link.isEnabled)
    return 'disabled';
  return 'active';
}
