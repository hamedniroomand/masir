import type { H3Event } from 'h3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientIp } from '#server/utils/client-ip';

const SOCKET = '203.0.113.9';

function event(headers: Record<string, string> = {}): H3Event {
  return {
    node: {
      req: {
        headers,
        socket: { remoteAddress: SOCKET },
      },
    },
  } as unknown as H3Event;
}

describe('clientIp', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ignores the header when no proxy is trusted', () => {
    expect(clientIp(event({ 'x-forwarded-for': '1.2.3.4' }), 0)).toBe(SOCKET);
  });

  // A proxy appends, so the caller's own value ends up on the left. Reading the
  // leftmost entry is what let a caller choose their own rate-limit bucket.
  it('reads from the right, not the left', () => {
    const headers = { 'x-forwarded-for': '9.9.9.9, 198.51.100.7' };
    expect(clientIp(event(headers), 1)).toBe('198.51.100.7');
  });

  it('counts back by the trusted depth', () => {
    const headers = { 'x-forwarded-for': '9.9.9.9, 198.51.100.7, 10.0.0.1' };
    expect(clientIp(event(headers), 2)).toBe('198.51.100.7');
  });

  it('falls back to the socket when the chain is shorter than the trusted depth', () => {
    expect(clientIp(event({ 'x-forwarded-for': '1.2.3.4' }), 3)).toBe(SOCKET);
  });

  it('falls back to the socket when the header is absent', () => {
    expect(clientIp(event(), 2)).toBe(SOCKET);
  });

  // Off Vercel this header is one a caller can write like any other. Trusting
  // it would reopen the hole the rest of this function closes.
  it('ignores the vercel header when not running on vercel', () => {
    const headers = { 'x-vercel-forwarded-for': '198.51.100.7', 'x-forwarded-for': '9.9.9.9' };
    expect(clientIp(event(headers), 0)).toBe(SOCKET);
  });

  it('reads the vercel header on vercel', () => {
    vi.stubEnv('VERCEL', '1');
    const headers = { 'x-vercel-forwarded-for': '198.51.100.7', 'x-forwarded-for': '9.9.9.9' };
    expect(clientIp(event(headers), 0)).toBe('198.51.100.7');
  });

  // The forged value must not change the bucket, or every IP-keyed limit is one
  // header away from a reset.
  it('gives one caller one key however they forge the header', () => {
    const forged = ['1.1.1.1', '2.2.2.2', '3.3.3.3'].map(
      value => clientIp(event({ 'x-forwarded-for': value }), 0),
    );
    expect(new Set(forged).size).toBe(1);
  });
});
