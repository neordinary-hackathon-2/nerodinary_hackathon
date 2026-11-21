import type { YoutubeSyncRequestDto } from '../youtube/youtube-internal.schema.js';
import { runCollector, type CollectorOptions } from './collector.js';
import type { SeedChannel, VideoDetail } from './collector.types.js';
import { withRetry } from './retry.js';
import type { CollectorServer } from './sync.client.js';
import {
  isRetryableYoutubeError,
  YoutubeApiError,
  type SearchPage,
  type SearchQuery,
  type VideoLookup,
  type YoutubeClient,
} from './youtube.client.js';

const options: CollectorOptions = {
  targetPerChannel: 3,
  // 기본은 교체하지 않는다. 교체 동작은 아래 '하루 교체' 묶음에서 켜고 확인한다.
  rotatePerChannel: 0,
  freshWindowDays: 7,
  now: new Date('2026-11-22T00:00:00Z'),
  searchCallBudget: 60,
  searchCallsPerChannel: 60,
  limits: { minSeconds: 600, maxSeconds: 7200 },
  dryRun: false,
};

function video(id: string, overrides: Partial<VideoDetail> = {}): VideoDetail {
  return {
    youtubeVideoId: id,
    title: `제목 ${id}`,
    thumbnailUrl: `https://i.ytimg.com/${id}.jpg`,
    durationSeconds: 900,
    sourceYoutubeChannelId: 'UC1',
    sourceChannelTitle: '제작자',
    publishedAt: '2026-11-20T12:00:00Z',
    embeddable: true,
    privacyStatus: 'public',
    ...overrides,
  };
}

/** 기본은 서버가 저장된 영상 목록을 내려주는(비어 있는) 채널이다. */
function channel(overrides: Partial<SeedChannel> = {}): SeedChannel {
  return {
    channelNumber: 1,
    seedKeywords: ['예능'],
    storedVideoIds: [],
    ...overrides,
  };
}

/**
 * 가짜 YouTube. catalog 에 있는 ID 만 조회되고(없으면 삭제된 영상),
 * search 는 "검색어|구간|페이지토큰" 키로 미리 정해 둔 페이지를 돌려준다.
 */
function fakeYoutube(config: {
  catalog?: VideoDetail[];
  pages?: Record<string, SearchPage>;
  failLookupFor?: string[];
  searchError?: Error;
  /** 검색마다 처음 n번은 503 으로 실패한다. 실제 클라이언트처럼 최대 3번 시도한다. */
  transientSearchFailures?: number;
}) {
  const catalog = new Map(
    (config.catalog ?? []).map((v) => [v.youtubeVideoId, v]),
  );
  const searches: SearchQuery[] = [];
  /** 재시도를 포함한 실제 검색 호출 수. */
  const attempts = { count: 0 };
  const client: YoutubeClient = {
    async searchVideoIds(query, hooks) {
      searches.push(query);
      if (config.searchError) {
        return Promise.reject(config.searchError);
      }
      let failuresLeft = config.transientSearchFailures ?? 0;
      await withRetry(
        () => {
          attempts.count += 1;
          if (failuresLeft > 0) {
            failuresLeft -= 1;
            return Promise.reject(
              new YoutubeApiError(503, 'backendError', '일시 오류'),
            );
          }
          return Promise.resolve();
        },
        {
          isRetryable: isRetryableYoutubeError,
          beforeRetry: hooks?.beforeRetry,
          sleep: () => Promise.resolve(),
        },
      );
      // 기간 조건이 붙은 검색은 키 앞에 "fresh:" 를 붙여 구분한다.
      const key = `${query.publishedAfter ? 'fresh:' : ''}${query.query}|${query.duration}|${query.pageToken ?? ''}`;
      return Promise.resolve(
        config.pages?.[key] ?? { videoIds: [], nextPageToken: null },
      );
    },
    fetchVideoDetails(ids) {
      const lookup: VideoLookup = { found: new Map(), failedIds: new Set() };
      for (const id of ids) {
        const detail = catalog.get(id);
        if (config.failLookupFor?.includes(id)) {
          lookup.failedIds.add(id);
        } else if (detail) {
          lookup.found.set(id, detail);
        }
      }
      return Promise.resolve(lookup);
    },
  };
  return { client, searches, attempts };
}

function fakeServer(
  channels: SeedChannel[],
  config: {
    failSyncFor?: number[];
    rejectIds?: string[];
    evictPerSync?: number;
  } = {},
) {
  const synced: YoutubeSyncRequestDto[] = [];
  const server: CollectorServer = {
    fetchChannels: () => Promise.resolve(channels),
    sync(request) {
      if (config.failSyncFor?.includes(request.channelNumber)) {
        return Promise.reject(new Error('서버 오류'));
      }
      synced.push(request);
      const rejected = request.videos
        .filter((v) => config.rejectIds?.includes(v.youtubeVideoId))
        .map((v) => ({ youtubeVideoId: v.youtubeVideoId, reason: '테스트' }));
      return Promise.resolve({
        acceptedCount: request.videos.length - rejected.length,
        rejectedCount: rejected.length,
        rejected,
        evictedCount: config.evictPerSync ?? 0,
      });
    },
  };
  return { server, synced };
}

const ids = (request: YoutubeSyncRequestDto | undefined) =>
  request?.videos.map((v) => v.youtubeVideoId);

describe('runCollector', () => {
  it('저장된 영상이 목표만큼 있으면 검색하지 않고 메타데이터만 갱신한다', async () => {
    const youtube = fakeYoutube({
      catalog: [video('a'), video('b'), video('c')],
    });
    const { server, synced } = fakeServer([
      channel({ storedVideoIds: ['a', 'b', 'c'] }),
    ]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      options,
    );

    expect(youtube.searches).toHaveLength(0);
    expect(report.searchCalls).toBe(0);
    expect(ids(synced[0])).toEqual(['a', 'b', 'c']);
    expect(synced[0]).not.toHaveProperty('removedVideoIds');
  });

  it('삭제·임베드 차단된 영상은 삭제 목록에 넣고 그 자리만큼만 새로 채운다', async () => {
    const youtube = fakeYoutube({
      // b 는 카탈로그에 없음(삭제), c 는 임베드 차단
      catalog: [
        video('a'),
        video('c', { embeddable: false }),
        video('n1'),
        video('n2'),
        video('n3'),
      ],
      pages: {
        '예능|medium|': { videoIds: ['n1', 'n2', 'n3'], nextPageToken: null },
      },
    });
    const { server, synced } = fakeServer([
      channel({ storedVideoIds: ['a', 'b', 'c'] }),
    ]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      options,
    );

    expect(synced[0].removedVideoIds).toEqual(['b', 'c']);
    expect(ids(synced[0])).toEqual(['a', 'n1', 'n2']);
    expect(report.channels[0]).toMatchObject({
      storedKnown: true,
      storedBefore: 3,
      removed: 2,
      added: 2,
      storedAfter: 3,
      eligible: 3,
    });
  });

  it('재검증 호출이 실패한 영상은 삭제 목록에 넣지 않는다', async () => {
    const youtube = fakeYoutube({
      catalog: [video('a')],
      failLookupFor: ['b', 'c'],
    });
    const { server, synced } = fakeServer([
      channel({ storedVideoIds: ['a', 'b', 'c'] }),
    ]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      options,
    );

    expect(synced[0]).not.toHaveProperty('removedVideoIds');
    expect(report.reverifyFailed).toBe(2);
    expect(youtube.searches).toHaveLength(0);
  });

  it('서버가 저장된 영상 목록을 주지 않으면 재검증 없이 목표 개수만큼 새로 찾는다', async () => {
    const youtube = fakeYoutube({
      catalog: [video('n1'), video('n2')],
      pages: {
        '예능|medium|': { videoIds: ['n1', 'n2'], nextPageToken: null },
      },
    });
    const { server, synced } = fakeServer([
      { channelNumber: 1, seedKeywords: ['예능'] },
    ]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      options,
    );

    expect(ids(synced[0])).toEqual(['n1', 'n2']);
    expect(synced[0]).not.toHaveProperty('removedVideoIds');
    expect(report.channels[0]).toMatchObject({
      storedKnown: false,
      removed: 0,
      added: 2,
    });
  });

  it('길이 범위 밖이거나 썸네일이 없는 영상은 추가하지 않는다', async () => {
    const youtube = fakeYoutube({
      catalog: [
        video('short', { durationSeconds: 599 }),
        video('long', { durationSeconds: 7201 }),
        video('nothumb', { thumbnailUrl: null }),
        video('ok'),
      ],
      pages: {
        '예능|medium|': {
          videoIds: ['short', 'long', 'nothumb', 'ok', 'ok'],
          nextPageToken: null,
        },
      },
    });
    const { server, synced } = fakeServer([channel()]);

    await runCollector({ youtube: youtube.client, server }, options);

    expect(ids(synced[0])).toEqual(['ok']);
  });

  it('다른 채널에 이미 있는 영상도 이 채널에 추가하고, 같은 채널에 있는 영상은 다시 추가하지 않는다', async () => {
    const youtube = fakeYoutube({
      catalog: [video('shared'), video('mine')],
      pages: {
        '예능|medium|': { videoIds: ['shared', 'mine'], nextPageToken: null },
      },
    });
    const { server, synced } = fakeServer([
      channel({ channelNumber: 1, storedVideoIds: ['mine'] }),
      channel({
        channelNumber: 2,
        seedKeywords: [],
        storedVideoIds: ['shared'],
      }),
    ]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      options,
    );

    expect(ids(synced.find((s) => s.channelNumber === 1))).toEqual([
      'mine',
      'shared',
    ]);
    expect(report.channels[0]).toMatchObject({ added: 1, candidates: 1 });
  });

  it('영상이 많으면 50개씩 나눠 보내고 삭제 목록은 첫 요청에만 싣는다', async () => {
    const stored = Array.from({ length: 120 }, (_, i) => `v${i}`);
    const youtube = fakeYoutube({ catalog: stored.map((id) => video(id)) });
    const { server, synced } = fakeServer(
      [channel({ storedVideoIds: [...stored, 'gone'], seedKeywords: [] })],
      { rejectIds: ['v0', 'v60'] },
    );

    const report = await runCollector(
      { youtube: youtube.client, server },
      { ...options, targetPerChannel: 120 },
    );

    expect(synced.map((s) => s.videos.length)).toEqual([50, 50, 20]);
    expect(synced.map((s) => s.removedVideoIds)).toEqual([
      ['gone'],
      undefined,
      undefined,
    ]);
    expect(report.channels[0].rejected).toBe(2);
  });

  it('지울 영상만 있으면 영상 없이 한 번 보낸다', async () => {
    const youtube = fakeYoutube({});
    const { server, synced } = fakeServer([
      channel({ storedVideoIds: ['gone'], seedKeywords: [] }),
    ]);

    await runCollector({ youtube: youtube.client, server }, options);

    expect(synced).toEqual([
      { channelNumber: 1, videos: [], removedVideoIds: ['gone'] },
    ]);
  });

  it('동기화 요청의 영상은 서버 계약의 필드만 담는다', async () => {
    const youtube = fakeYoutube({ catalog: [video('a')] });
    const { server, synced } = fakeServer([channel({ storedVideoIds: ['a'] })]);

    await runCollector(
      { youtube: youtube.client, server },
      { ...options, targetPerChannel: 1 },
    );

    expect(synced[0]).toEqual({
      channelNumber: 1,
      videos: [
        {
          youtubeVideoId: 'a',
          title: '제목 a',
          thumbnailUrl: 'https://i.ytimg.com/a.jpg',
          durationSeconds: 900,
          publishedAt: '2026-11-20T12:00:00Z',
          sourceYoutubeChannelId: 'UC1',
          sourceChannelTitle: '제작자',
          privacyStatus: 'public',
          isEmbeddable: true,
        },
      ],
    });
  });

  it('서버가 제외한 영상 수를 보고에 남긴다', async () => {
    const youtube = fakeYoutube({ catalog: [video('a'), video('b')] });
    const { server } = fakeServer(
      [channel({ storedVideoIds: ['a', 'b'], seedKeywords: [] })],
      { rejectIds: ['b'] },
    );

    const report = await runCollector(
      { youtube: youtube.client, server },
      options,
    );

    expect(report.channels[0].rejected).toBe(1);
    expect(report.failed).toBe(false);
  });

  it('검색어가 없는 채널은 검색하지 않는다', async () => {
    const youtube = fakeYoutube({});
    const { server, synced } = fakeServer([
      channel({ channelNumber: 1, seedKeywords: [] }),
    ]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      options,
    );

    expect(youtube.searches).toHaveLength(0);
    expect(synced).toHaveLength(0);
    expect(report.stoppedBy).toBe('done');
  });

  it('검색 상한에 닿으면 멈추고 그때까지 모은 것만 보낸다', async () => {
    const youtube = fakeYoutube({
      catalog: [video('n1')],
      pages: {
        '예능|medium|': { videoIds: ['n1'], nextPageToken: 'p2' },
      },
    });
    const { server, synced } = fakeServer([channel()]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      { ...options, searchCallBudget: 1 },
    );

    expect(report.searchCalls).toBe(1);
    expect(report.stoppedBy).toBe('budget');
    expect(report.failed).toBe(false);
    expect(ids(synced[0])).toEqual(['n1']);
  });

  it('채널당 상한에 닿은 채널은 더 검색하지 않고 다른 채널은 계속한다', async () => {
    const youtube = fakeYoutube({});
    const { server } = fakeServer([
      channel({ channelNumber: 1, seedKeywords: ['가', '나', '다'] }),
      channel({ channelNumber: 2, seedKeywords: ['라'] }),
    ]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      { ...options, searchCallsPerChannel: 3 },
    );

    expect(report.channels.map((c) => c.searchCalls)).toEqual([3, 2]);
    expect(report.stoppedBy).toBe('done');
    expect(report.failed).toBe(false);
  });

  it('채널을 돌아가며 한 페이지씩 검색한다', async () => {
    const youtube = fakeYoutube({});
    const { server } = fakeServer([
      channel({ channelNumber: 1, seedKeywords: ['가'] }),
      channel({ channelNumber: 2, seedKeywords: ['나'] }),
    ]);

    await runCollector(
      { youtube: youtube.client, server },
      { ...options, searchCallBudget: 3 },
    );

    expect(youtube.searches.map((q) => `${q.query}/${q.duration}`)).toEqual([
      '가/medium',
      '나/medium',
      '가/long',
    ]);
  });

  it('다음 페이지보다 다른 검색어의 첫 페이지를 먼저 본다', async () => {
    const youtube = fakeYoutube({
      pages: { '가|medium|': { videoIds: [], nextPageToken: 'p2' } },
    });
    const { server } = fakeServer([channel({ seedKeywords: ['가'] })]);

    await runCollector({ youtube: youtube.client, server }, options);

    expect(
      youtube.searches.map((q) => `${q.duration}/${q.pageToken ?? '-'}`),
    ).toEqual(['medium/-', 'long/-', 'medium/p2']);
  });

  it('할당량 초과 시 검색을 중단하되 재검증 결과는 보낸다', async () => {
    const youtube = fakeYoutube({
      catalog: [video('a')],
      searchError: new YoutubeApiError(403, 'quotaExceeded', '할당량 초과'),
    });
    const { server, synced } = fakeServer([
      channel({ storedVideoIds: ['a', 'gone'] }),
      channel({ channelNumber: 2 }),
    ]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      options,
    );

    expect(report.stoppedBy).toBe('quota');
    expect(youtube.searches).toHaveLength(1);
    expect(synced[0].removedVideoIds).toEqual(['gone']);
  });

  it('검색 일일 한도 초과(429)는 실패가 아니라 할당량 중단으로 보고한다', async () => {
    const youtube = fakeYoutube({
      searchError: new YoutubeApiError(
        429,
        'rateLimitExceeded',
        "Quota exceeded for quota metric 'Search Queries'",
      ),
    });
    const { server } = fakeServer([channel({ seedKeywords: ['가', '나'] })]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      options,
    );

    expect(youtube.searches).toHaveLength(1);
    expect(report.stoppedBy).toBe('quota');
    expect(report.failed).toBe(false);
  });

  it('할당량 외의 일시 오류는 해당 검색만 건너뛰고 계속한다', async () => {
    const youtube = fakeYoutube({
      searchError: new YoutubeApiError(500, 'backendError', '일시 오류'),
    });
    const { server } = fakeServer([channel({ seedKeywords: ['가', '나'] })]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      options,
    );

    expect(youtube.searches).toHaveLength(4);
    expect(report.stoppedBy).toBe('done');
  });

  it('검색 재시도도 한 번의 검색으로 세어 예산에서 차감한다', async () => {
    const youtube = fakeYoutube({ transientSearchFailures: 1 });
    const logs: string[] = [];
    const { server } = fakeServer([channel({ seedKeywords: ['가'] })]);

    const report = await runCollector(
      { youtube: youtube.client, server, log: (m) => logs.push(m) },
      options,
    );

    // 검색어 1개 × 길이 구간 2개, 각각 1번 실패 후 성공 → 4회.
    expect(report.searchCalls).toBe(4);
    expect(report.channels[0].searchCalls).toBe(4);
    expect(report.stoppedBy).toBe('done');
    expect(logs.filter((m) => m.includes('검색 재시도 2/3'))).toHaveLength(2);
  });

  it('예산이 남지 않으면 검색을 다시 시도하지 않는다', async () => {
    const youtube = fakeYoutube({ transientSearchFailures: 1 });
    const { server } = fakeServer([channel({ seedKeywords: ['가'] })]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      { ...options, searchCallBudget: 1 },
    );

    expect(youtube.attempts.count).toBe(1);
    expect(report.searchCalls).toBe(1);
    expect(report.stoppedBy).toBe('budget');
  });

  it('채널별 상한에 닿으면 검색을 다시 시도하지 않는다', async () => {
    const youtube = fakeYoutube({ transientSearchFailures: 1 });
    const { server } = fakeServer([channel({ seedKeywords: ['가'] })]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      { ...options, searchCallsPerChannel: 1 },
    );

    expect(youtube.attempts.count).toBe(1);
    expect(report.channels[0].searchCalls).toBe(1);
  });

  it('검색 시간 상한이 지나면 검색을 멈추고 실패로 보지 않는다', async () => {
    const youtube = fakeYoutube({ catalog: [video('a')] });
    const { server, synced } = fakeServer([
      channel({ storedVideoIds: ['a', 'gone'] }),
    ]);
    // 재검증까지 끝난 뒤 시간이 이미 상한을 넘었다고 본다.
    const times = [0];
    const clock = () => times.shift() ?? 10_000;

    const report = await runCollector(
      { youtube: youtube.client, server, clock },
      { ...options, searchTimeLimitMs: 5_000 },
    );

    expect(youtube.searches).toHaveLength(0);
    expect(report.stoppedBy).toBe('time');
    expect(report.failed).toBe(false);
    // 검색을 멈춰도 재검증 결과는 동기화한다.
    expect(synced[0].removedVideoIds).toEqual(['gone']);
  });

  it('검색 중 시간 상한이 지나면 재시도하지 않는다', async () => {
    const youtube = fakeYoutube({ transientSearchFailures: 1 });
    let now = 0;
    const client: YoutubeClient = {
      ...youtube.client,
      searchVideoIds(query, hooks) {
        now = 10_000; // 첫 검색이 오래 걸렸다.
        return youtube.client.searchVideoIds(query, hooks);
      },
    };
    const { server } = fakeServer([channel({ seedKeywords: ['가'] })]);

    const report = await runCollector(
      { youtube: client, server, clock: () => now },
      { ...options, searchTimeLimitMs: 5_000 },
    );

    expect(youtube.attempts.count).toBe(1);
    expect(report.stoppedBy).toBe('time');
  });

  it('YouTube 가 요청을 거부하면(잘못된 키 등) 바로 멈추고 실패로 보고한다', async () => {
    const youtube = fakeYoutube({
      searchError: new YoutubeApiError(400, 'badRequest', 'API key not valid'),
    });
    const { server } = fakeServer([channel({ seedKeywords: ['가', '나'] })]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      options,
    );

    expect(youtube.searches).toHaveLength(1);
    expect(report.stoppedBy).toBe('rejected');
    expect(report.failed).toBe(true);
  });

  it('한 채널의 동기화가 실패해도 다른 채널은 보내고 실패로 보고한다', async () => {
    const youtube = fakeYoutube({ catalog: [video('a'), video('b')] });
    const { server, synced } = fakeServer(
      [
        channel({ channelNumber: 1, storedVideoIds: ['a'], seedKeywords: [] }),
        channel({ channelNumber: 2, storedVideoIds: ['b'], seedKeywords: [] }),
      ],
      { failSyncFor: [1] },
    );

    const report = await runCollector(
      { youtube: youtube.client, server },
      options,
    );

    expect(synced.map((s) => s.channelNumber)).toEqual([2]);
    expect(report.failed).toBe(true);
    expect(report.channels[0].syncError).toBe('서버 오류');
  });

  it('dry-run 은 서버에 아무것도 보내지 않는다', async () => {
    const youtube = fakeYoutube({
      catalog: [video('n1')],
      pages: { '예능|medium|': { videoIds: ['n1'], nextPageToken: null } },
    });
    const { server, synced } = fakeServer([channel()]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      { ...options, dryRun: true },
    );

    expect(synced).toHaveLength(0);
    expect(report.channels[0].added).toBe(1);
  });

  it('onlyChannelNumber 로 한 채널만 처리한다', async () => {
    const youtube = fakeYoutube({
      catalog: [video('n1')],
      pages: { '예능|medium|': { videoIds: ['n1'], nextPageToken: null } },
    });
    const { server, synced } = fakeServer([
      channel({ channelNumber: 1 }),
      channel({ channelNumber: 2 }),
    ]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      { ...options, onlyChannelNumber: 1 },
    );

    expect(report.channels.map((c) => c.channelNumber)).toEqual([1]);
    expect(synced.map((s) => s.channelNumber)).toEqual([1]);
    expect(youtube.searches.every((q) => q.query === '예능')).toBe(true);
  });

  describe('하루 교체', () => {
    const rotating: CollectorOptions = { ...options, rotatePerChannel: 2 };
    const full = () => channel({ storedVideoIds: ['a', 'b', 'c'] });
    const stored = [video('a'), video('b'), video('c')];

    it('꽉 찬 채널도 기간 조건으로 검색해 교체 수만큼 새 영상을 보낸다', async () => {
      const youtube = fakeYoutube({
        catalog: [...stored, video('n1'), video('n2'), video('n3')],
        pages: {
          'fresh:예능|medium|': {
            videoIds: ['n1', 'n2', 'n3'],
            nextPageToken: null,
          },
        },
      });
      const { server, synced } = fakeServer([full()], { evictPerSync: 2 });

      const report = await runCollector(
        { youtube: youtube.client, server },
        rotating,
      );

      // 기준 시각(2026-11-22)에서 7일 전 이후에 공개된 영상만 찾는다.
      expect(youtube.searches[0].publishedAfter).toBe(
        '2026-11-15T00:00:00.000Z',
      );
      expect(ids(synced[0])).toEqual(['a', 'b', 'c', 'n1', 'n2']);
      // 무엇을 지울지는 서버가 정한다. 수집기는 삭제 목록을 보내지 않는다.
      expect(synced[0]).not.toHaveProperty('removedVideoIds');
      expect(report.channels[0]).toMatchObject({
        added: 2,
        evicted: 2,
        storedAfter: 3,
      });
    });

    it('이미 저장된 영상은 최근 영상이어도 다시 들이지 않는다', async () => {
      const youtube = fakeYoutube({
        catalog: [...stored, video('n1')],
        pages: {
          'fresh:예능|medium|': {
            videoIds: ['a', 'b', 'n1'],
            nextPageToken: null,
          },
        },
      });
      const { server, synced } = fakeServer([full()]);

      const report = await runCollector(
        { youtube: youtube.client, server },
        rotating,
      );

      expect(ids(synced[0])).toEqual(['a', 'b', 'c', 'n1']);
      expect(report.channels[0].added).toBe(1);
    });

    it('최근 영상을 못 찾으면 아무것도 바꾸지 않고, 기간 없는 검색으로 넘어가지도 않는다', async () => {
      const youtube = fakeYoutube({
        catalog: [...stored, video('old')],
        pages: {
          '예능|medium|': { videoIds: ['old'], nextPageToken: null },
        },
      });
      const { server, synced } = fakeServer([full()]);

      const report = await runCollector(
        { youtube: youtube.client, server },
        rotating,
      );

      // 검색어 1개 × 구간 2개(medium·long) = 2회, 모두 기간 조건이 붙는다.
      expect(youtube.searches).toHaveLength(2);
      expect(youtube.searches.every((q) => q.publishedAfter)).toBe(true);
      expect(ids(synced[0])).toEqual(['a', 'b', 'c']);
      expect(report.channels[0]).toMatchObject({
        added: 0,
        evicted: 0,
        storedAfter: 3,
      });
    });

    it('할당량 초과로 검색이 막혀도 기존 영상은 그대로 둔다', async () => {
      const youtube = fakeYoutube({
        catalog: stored,
        searchError: new YoutubeApiError(403, 'quotaExceeded', '한도 초과'),
      });
      const { server, synced } = fakeServer([full()]);

      const report = await runCollector(
        { youtube: youtube.client, server },
        rotating,
      );

      expect(report.stoppedBy).toBe('quota');
      expect(ids(synced[0])).toEqual(['a', 'b', 'c']);
      expect(synced[0]).not.toHaveProperty('removedVideoIds');
      expect(report.channels[0].evicted).toBe(0);
    });

    it('죽은 영상이 있으면 최근 영상으로 먼저 메우고, 모자란 만큼만 기간 없이 채운다', async () => {
      const youtube = fakeYoutube({
        // b, c 는 카탈로그에 없음(삭제)
        catalog: [video('a'), video('n1'), video('old1'), video('old2')],
        pages: {
          'fresh:예능|medium|': { videoIds: ['n1'], nextPageToken: null },
          '예능|medium|': { videoIds: ['old1', 'old2'], nextPageToken: null },
        },
      });
      const { server, synced } = fakeServer([full()]);

      const report = await runCollector(
        { youtube: youtube.client, server },
        rotating,
      );

      expect(synced[0].removedVideoIds).toEqual(['b', 'c']);
      // 목표 3 중 a 가 남고 n1 이 들어와 1개가 모자란다. 그 1개만 기간 없이 채운다.
      expect(ids(synced[0])).toEqual(['a', 'n1', 'old1']);
      expect(report.channels[0]).toMatchObject({
        added: 2,
        evicted: 0,
        storedAfter: 3,
      });
    });

    it('교체 수보다 많이 모자란 채널은 교체하지 않고 채우기만 한다', async () => {
      const youtube = fakeYoutube({
        catalog: [video('n1'), video('n2'), video('n3')],
        pages: {
          '예능|medium|': {
            videoIds: ['n1', 'n2', 'n3'],
            nextPageToken: null,
          },
        },
      });
      const { server, synced } = fakeServer([channel()]);

      await runCollector({ youtube: youtube.client, server }, rotating);

      expect(youtube.searches.some((q) => q.publishedAfter)).toBe(false);
      expect(ids(synced[0])).toEqual(['n1', 'n2', 'n3']);
    });

    it('서버가 저장된 영상 목록을 주지 않으면 교체하지 않는다', async () => {
      const youtube = fakeYoutube({});
      const { server } = fakeServer([channel({ storedVideoIds: undefined })]);

      await runCollector(
        { youtube: youtube.client, server },
        { ...rotating, rotatePerChannel: 5 },
      );

      expect(youtube.searches.some((q) => q.publishedAfter)).toBe(false);
    });

    it('dry-run 에서는 지워질 수를 예상값으로 보고한다', async () => {
      const youtube = fakeYoutube({
        catalog: [...stored, video('n1'), video('n2')],
        pages: {
          'fresh:예능|medium|': {
            videoIds: ['n1', 'n2'],
            nextPageToken: null,
          },
        },
      });
      const { server, synced } = fakeServer([full()]);

      const report = await runCollector(
        { youtube: youtube.client, server },
        { ...rotating, dryRun: true },
      );

      expect(synced).toHaveLength(0);
      expect(report.channels[0]).toMatchObject({ added: 2, evicted: 2 });
    });
  });
});
