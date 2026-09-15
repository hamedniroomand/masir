import { describe, expect, it } from 'vitest';
import { validateDestination } from '#server/utils/url';

describe('validateDestination', () => {
  it('rejects javascript', () => {
    const r = validateDestination('javascript:alert(1)', false);
    expect(r.ok).toBe(false);
  });

  it('preserves query and fragment', () => {
    const r = validateDestination('https://example.com/a?b=1&utm_source=X#frag', false);
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.url).toBe('https://example.com/a?b=1&utm_source=X#frag');
  });

  it('normalises host and port', () => {
    const r = validateDestination('HTTPS://EXAMPLE.COM:443/Path', false);
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.url).toBe('https://example.com/Path');
  });

  it('blocks private IP by default', () => {
    expect(validateDestination('http://192.168.1.10', false).ok).toBe(false);
    expect(validateDestination('http://192.168.1.10', true).ok).toBe(true);
  });
});
