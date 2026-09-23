import { describe, expect, it } from 'vitest';
import { contrastRatio, qrStyleWarning, relativeLuminance } from '#shared/qr-style';

describe('relativeLuminance', () => {
  it('calculates 0 for black and 1 for white', () => {
    expect(relativeLuminance('000000')).toBe(0);
    expect(relativeLuminance('ffffff')).toBeCloseTo(1, 4);
  });

  it('handles invalid hex gracefully', () => {
    expect(relativeLuminance('xyz')).toBe(0);
  });
});

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    expect(contrastRatio('000000', 'ffffff')).toBeCloseTo(21, 1);
  });

  it('returns 1 for identical colours', () => {
    expect(contrastRatio('ffffff', 'ffffff')).toBe(1);
  });
});

describe('qrStyleWarning', () => {
  it('returns null for good contrast with dark foreground', () => {
    expect(qrStyleWarning('000000', 'ffffff')).toBeNull();
    expect(qrStyleWarning('111111', 'eeeeee')).toBeNull();
  });

  it('warns when foreground is lighter than background', () => {
    const warning = qrStyleWarning('ffffff', '000000');
    expect(warning).toContain('foreground is lighter than the background');
  });

  it('warns when contrast ratio is below 4:1', () => {
    const warning = qrStyleWarning('888888', 'ffffff');
    expect(warning).toContain('below 4:1');
  });
});
