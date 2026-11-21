import type { YoutubeSyncRequestDto } from './youtube-internal.schema.js';
import { partitionSyncVideos, rejectionReason } from './youtube-sync.policy.js';

type SyncVideo = YoutubeSyncRequestDto['videos'][number];

const limits = { minSeconds: 600, maxSeconds: 7200 };

function video(overrides: Partial<SyncVideo> = {}): SyncVideo {
  return {
    youtubeVideoId: 'a',
    title: '제목',
    thumbnailUrl: 'https://i.ytimg.com/a.jpg',
    durationSeconds: 900,
    privacyStatus: 'public',
    isEmbeddable: true,
    ...overrides,
  };
}

describe('rejectionReason', () => {
  it('조건을 모두 만족하면 null 이다', () => {
    expect(rejectionReason(video(), limits)).toBeNull();
  });

  it.each([
    [599, false],
    [600, true],
    [7200, true],
    [7201, false],
  ])('길이 %d초 → 저장 가능 %s (경계 포함)', (durationSeconds, storable) => {
    expect(rejectionReason(video({ durationSeconds }), limits) === null).toBe(
      storable,
    );
  });

  it('공개 상태가 아니면 사유에 상태를 담아 제외한다', () => {
    expect(
      rejectionReason(video({ privacyStatus: 'unlisted' }), limits),
    ).toContain('unlisted');
  });

  it('임베드할 수 없으면 제외한다', () => {
    expect(rejectionReason(video({ isEmbeddable: false }), limits)).toContain(
      '임베드',
    );
  });
});

describe('partitionSyncVideos', () => {
  it('저장할 영상과 제외할 영상을 나누고 제외 사유를 붙인다', () => {
    const result = partitionSyncVideos(
      [
        video({ youtubeVideoId: 'ok' }),
        video({ youtubeVideoId: 'short', durationSeconds: 10 }),
        video({ youtubeVideoId: 'private', privacyStatus: 'private' }),
      ],
      limits,
    );

    expect(result.accepted.map((v) => v.youtubeVideoId)).toEqual(['ok']);
    expect(result.rejected.map((v) => v.youtubeVideoId)).toEqual([
      'short',
      'private',
    ]);
    expect(result.rejected.every((v) => v.reason.length > 0)).toBe(true);
  });

  it('같은 영상이 두 번 오면 마지막 것만 남긴다', () => {
    const result = partitionSyncVideos(
      [video({ title: '옛 제목' }), video({ title: '새 제목' })],
      limits,
    );

    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].title).toBe('새 제목');
    expect(result.rejected).toHaveLength(0);
  });
});
