export type ChannelPreset = {
  key: string;
  label: string;
  utmSource: string;
  utmMedium: string;
};

export const CHANNEL_PRESETS: ChannelPreset[] = [
  { key: 'newsletter', label: 'Newsletter', utmSource: 'newsletter', utmMedium: 'email' },
  { key: 'social', label: 'Social', utmSource: 'twitter', utmMedium: 'social' },
  { key: 'print', label: 'Print', utmSource: 'print', utmMedium: 'print' },
];
