import { describe, expect, it } from 'vitest';
import { deriveLinkStatus } from '#shared/link-status';

const base = {
  isEnabled: true,
  expiresAt: null as Date | null,
  startsAt: null as Date | null,
  maximumVisits: null as number | null,
  clickCount: 0,
};

describe('deriveLinkStatus precedence', () => {
  const now = Date.parse('2026-06-15T12:00:00.000Z');

  it('returns disabled before expired', () => {
    const status = deriveLinkStatus({
      ...base,
      isEnabled: false,
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    }, now);
    expect(status).toBe('disabled');
  });

  it('returns expired when enabled and past expiry', () => {
    expect(deriveLinkStatus({
      ...base,
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    }, now)).toBe('expired');
  });

  it('returns limit_reached before scheduled', () => {
    expect(deriveLinkStatus({
      ...base,
      maximumVisits: 10,
      clickCount: 10,
      startsAt: new Date('2026-12-01T00:00:00.000Z'),
    }, now)).toBe('limit_reached');
  });

  it('returns scheduled when start is in the future', () => {
    expect(deriveLinkStatus({
      ...base,
      startsAt: new Date('2026-12-01T00:00:00.000Z'),
    }, now)).toBe('scheduled');
  });

  it('returns active when no rule applies', () => {
    expect(deriveLinkStatus({
      ...base,
      startsAt: new Date('2026-01-01T00:00:00.000Z'),
      maximumVisits: 5,
      clickCount: 2,
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    }, now)).toBe('active');
  });
});
