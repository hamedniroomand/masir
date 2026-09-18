// Every target the application runs on. Anything else fails at build time so a
// preset with a restricted runtime, such as vercel-edge, never ships.
export const SUPPORTED_PRESETS = ['bun', 'vercel'] as const;

export type NitroPreset = (typeof SUPPORTED_PRESETS)[number];

// The provider comes from std-env, the same detector Nitro uses for an unset
// preset. Only a provider with a supported preset changes the default.
const PROVIDER_PRESETS: Record<string, NitroPreset> = { vercel: 'vercel' };

export function resolveNitroPreset(env: Record<string, string | undefined>, provider: string): NitroPreset {
  const preset = env.NITRO_PRESET ?? PROVIDER_PRESETS[provider] ?? 'bun';
  if (!SUPPORTED_PRESETS.includes(preset as NitroPreset))
    throw new Error(`NITRO_PRESET "${preset}" is not supported; use one of ${SUPPORTED_PRESETS.join(', ')}`);
  return preset as NitroPreset;
}
