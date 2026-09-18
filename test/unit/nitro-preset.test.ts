import { describe, expect, it } from 'vitest';
import { resolveNitroPreset } from '#shared/nitro-preset';

describe('resolveNitroPreset', () => {
  it('defaults to bun when nothing names a target', () => {
    expect(resolveNitroPreset({}, '')).toBe('bun');
  });

  it('picks vercel when the build runs on Vercel', () => {
    expect(resolveNitroPreset({}, 'vercel')).toBe('vercel');
  });

  it('ignores a build provider without a preset', () => {
    expect(resolveNitroPreset({}, 'github_actions')).toBe('bun');
  });

  it('lets NITRO_PRESET win over the detected provider', () => {
    expect(resolveNitroPreset({ NITRO_PRESET: 'bun' }, 'vercel')).toBe('bun');
  });

  it('refuses a preset outside the supported list', () => {
    expect(() => resolveNitroPreset({ NITRO_PRESET: 'vercel-edge' }, '')).toThrow(/vercel-edge/);
    expect(() => resolveNitroPreset({ NITRO_PRESET: 'node-server' }, '')).toThrow(/bun, vercel/);
  });
});
