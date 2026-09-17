export type LinkStatus = 'active' | 'disabled' | 'expired' | 'limit_reached' | 'scheduled';

export function deriveLinkStatus(link: {
  isEnabled: boolean;
  expiresAt: Date | null;
  startsAt?: Date | null;
  maximumVisits?: number | null;
  clickCount?: number;
}, now = Date.now()): LinkStatus {
  if (!link.isEnabled)
    return 'disabled';

  const expired = link.expiresAt != null && link.expiresAt.getTime() <= now;
  if (expired)
    return 'expired';

  const maximumVisits = link.maximumVisits;
  const used = link.clickCount ?? 0;
  if (maximumVisits != null && used >= maximumVisits)
    return 'limit_reached';

  const scheduled = link.startsAt != null && link.startsAt.getTime() > now;
  if (scheduled)
    return 'scheduled';

  return 'active';
}
