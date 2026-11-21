import type { YoutubeSyncRequestDto } from '../youtube/youtube-internal.schema.js';
import { runCollector, type CollectorOptions } from './collector.js';
import type { SeedChannel, VideoDetail } from './collector.types.js';
import type { CollectorServer } from './sync.client.js';
import {
  YoutubeApiError,
  type SearchPage,
  type SearchQuery,
  type VideoLookup,
  type YoutubeClient,
} from './youtube.client.js';

const options: CollectorOptions = {
  targetPerChannel: 3,
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
}) {
  const catalog = new Map(
    (config.catalog ?? []).map((v) => [v.youtubeVideoId, v]),
  );
  const searches: SearchQuery[] = [];
  const client: YoutubeClient = {
    searchVideoIds(query) {
      searches.push(query);
      if (config.searchError) {
        return Promise.reject(config.searchError);
      }
      const key = `${query.query}|${query.duration}|${query.pageToken ?? ''}`;
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
  return { client, searches };
}

function fakeServer(
  channels: SeedChannel[],
  config: { failSyncFor?: number[]; rejectIds?: string[] } = {},
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
      channel({ channelNumber: 0, seedKeywords: [] }),
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
});
