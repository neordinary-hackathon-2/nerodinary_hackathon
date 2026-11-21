import type { VideoDetail } from './collector.types.js';
import { isEligible, isPlayable, parseIsoDuration } from './video-filter.js';

const limits = { minSeconds: 600, maxSeconds: 7200 };

function video(overrides: Partial<VideoDetail> = {}): VideoDetail {
  return {
    youtubeVideoId: 'vid',
    title: '제목',
    thumbnailUrl: null,
    durationSeconds: 900,
    creatorChannelId: 'UC1',
    creatorChannelTitle: '제작자',
    publishedAt: '2026-11-20T12:00:00Z',
    embeddable: true,
    privacyStatus: 'public',
    ...overrides,
  };
}

describe('parseIsoDuration', () => {
  it.each([
    ['PT3M42S', 222],
    ['PT10M', 600],
    ['PT2H', 7200],
    ['PT1H2M3S', 3723],
    ['P1DT1S', 86_401],
    ['P0D', 0],
  ])('%s → %d초', (input, expected) => {
    expect(parseIsoDuration(input)).toBe(expected);
  });

  it.each(['', 'P', 'PT', '10:00', 'PT5X'])(
    '잘못된 형식 "%s" 은 null',
    (input) => {
      expect(parseIsoDuration(input)).toBeNull();
    },
  );
});

describe('isEligible', () => {
  it.each([
    [599, false],
    [600, true],
    [7200, true],
    [7201, false],
    [0, false],
  ])('길이 %d초 → %s (경계 포함)', (durationSeconds, expected) => {
    expect(isEligible(video({ durationSeconds }), limits)).toBe(expected);
  });

  it('임베드가 막힌 영상은 제외한다', () => {
    expect(isEligible(video({ embeddable: false }), limits)).toBe(false);
  });

  it('공개 상태가 아닌 영상은 제외한다', () => {
    expect(isEligible(video({ privacyStatus: 'unlisted' }), limits)).toBe(
      false,
    );
  });
});

describe('isPlayable', () => {
  it('길이와 무관하게 임베드·공개 여부만 본다', () => {
    expect(isPlayable(video({ durationSeconds: 30 }))).toBe(true);
    expect(isPlayable(video({ privacyStatus: 'private' }))).toBe(false);
  });
});
