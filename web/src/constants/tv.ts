export const TV_SCREENS = ['off', 'loading', 'noSignal', 'live'] as const;

export type TvScreen = (typeof TV_SCREENS)[number];

export const isTvScreen = (value: unknown): value is TvScreen =>
  typeof value === 'string' &&
  (TV_SCREENS as readonly string[]).includes(value);

export const SAMPLE_VIDEO_URL = 'https://www.youtube.com/watch?v=M7lc1UVf-VE';
