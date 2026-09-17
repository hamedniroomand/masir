import { describe, expect, it } from 'vitest';
import {
  BOT_CATEGORY,
  botCategoryLabel,
  BROWSER,
  browserLabel,
  DEVICE,
  deviceLabel,
  OUTCOME,
  outcomeLabel,
} from '#shared/codes';

const maps = {
  OUTCOME,
  DEVICE,
  BROWSER,
  BOT_CATEGORY,
} as const;

const lookups = [
  ['OUTCOME', OUTCOME, outcomeLabel],
  ['DEVICE', DEVICE, deviceLabel],
  ['BROWSER', BROWSER, browserLabel],
  ['BOT_CATEGORY', BOT_CATEGORY, botCategoryLabel],
] as const;

describe.each(Object.entries(maps))('%s', (_name, map) => {
  it('gives one code to each label', () => {
    const codes = Object.values(map);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('holds small integer codes', () => {
    for (const code of Object.values(map)) {
      expect(Number.isInteger(code)).toBe(true);
      expect(code).toBeGreaterThanOrEqual(0);
      expect(code).toBeLessThan(32_768);
    }
  });
});

describe('zero code', () => {
  it.each([['DEVICE', DEVICE], ['BROWSER', BROWSER]] as const)('keeps 0 for other in %s', (_name, map) => {
    expect(map.other).toBe(0);
    const zeros = Object.entries(map).filter(([, code]) => code === 0);
    expect(zeros).toEqual([['other', 0]]);
  });

  it.each([['OUTCOME', OUTCOME], ['BOT_CATEGORY', BOT_CATEGORY] as const])('never uses 0 in %s', (_name, map) => {
    expect(Object.values(map)).not.toContain(0);
  });
});

describe.each(lookups)('%s reverse lookup', (_name, map, label) => {
  it('returns the label of every code', () => {
    for (const [name, code] of Object.entries(map))
      expect(label(code)).toBe(name);
  });

  it('returns undefined for an unknown code', () => {
    expect(label(9999)).toBeUndefined();
  });
});
