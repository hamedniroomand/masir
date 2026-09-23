function parseChannel(hex: string, start: number): number {
  const raw = Number.parseInt(hex.slice(start, start + 2), 16);
  if (Number.isNaN(raw))
    return 0;
  const srgb = raw / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const clean = hex.replace(/^#/, '').toLowerCase();
  if (clean.length !== 6)
    return 0;
  const channelRed = parseChannel(clean, 0);
  const channelGreen = parseChannel(clean, 2);
  const channelBlue = parseChannel(clean, 4);
  return 0.2126 * channelRed + 0.7152 * channelGreen + 0.0722 * channelBlue;
}

export function contrastRatio(fgHex: string, bgHex: string): number {
  const lFg = relativeLuminance(fgHex);
  const lBg = relativeLuminance(bgHex);
  const lighter = Math.max(lFg, lBg);
  const darker = Math.min(lFg, lBg);
  return (lighter + 0.05) / (darker + 0.05);
}

export function qrStyleWarning(fgHex: string, bgHex: string): string | null {
  const lFg = relativeLuminance(fgHex);
  const lBg = relativeLuminance(bgHex);
  if (lFg > lBg) {
    return 'The foreground is lighter than the background. Many scanners require a dark code on a light background.';
  }
  const ratio = (lBg + 0.05) / (lFg + 0.05);
  if (ratio < 4) {
    return 'Contrast ratio is below 4:1. Cameras may struggle to read this code.';
  }
  return null;
}
