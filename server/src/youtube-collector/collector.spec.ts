import { runCollector, type CollectorOptions } from './collector.js';
import type {
  CollectorChannel,
  SyncRequest,
  VideoDetail,
} from './collector.types.js';
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

function channel(overrides: Partial<CollectorChannel> = {}): CollectorChannel {
  return {
    channelId: 1,
    seedKeywords: ['예능'],
    activeVideoIds: [],
    excludedVideoIds: [],
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

function fakeServer(channels: CollectorChannel[], failSyncFor: number[] = []) {
  const synced: SyncRequest[] = [];
  const server: CollectorServer = {
    fetchChannels: () => Promise.resolve(channels),
    sync(request) {
      if (failSyncFor.includes(request.channelId)) {
        return Promise.reject(new Error('서버 오류'));
      }
      synced.push(request);
      return Promise.resolve();
    },
  };
  return { server, synced };
}

describe('runCollector', () => {
  it('활성 영상이 목표만큼 있으면 검색하지 않고 메타데이터만 갱신한다', async () => {
    const youtube = fakeYoutube({
      catalog: [video('a'), video('b'), video('c')],
    });
    const { server, synced } = fakeServer([
      channel({ activeVideoIds: ['a', 'b', 'c'] }),
    ]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      options,
    );

    expect(youtube.searches).toHaveLength(0);
    expect(report.searchCalls).toBe(0);
    expect(synced[0].upserts.map((v) => v.youtubeVideoId)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(synced[0].deactivateVideoIds).toEqual([]);
  });

  it('삭제·임베드 차단된 영상은 비활성화하고 그 자리만큼만 새로 채운다', async () => {
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
      channel({ activeVideoIds: ['a', 'b', 'c'] }),
    ]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      options,
    );

    expect(synced[0].deactivateVideoIds).toEqual(['b', 'c']);
    expect(synced[0].upserts.map((v) => v.youtubeVideoId)).toEqual([
      'a',
      'n1',
      'n2',
    ]);
    expect(report.channels[0]).toMatchObject({
      activeBefore: 3,
      deactivated: 2,
      added: 2,
      activeAfter: 3,
      eligible: 3,
    });
  });

  it('재검증 호출이 실패한 영상은 비활성화하지 않는다', async () => {
    const youtube = fakeYoutube({
      catalog: [video('a')],
      failLookupFor: ['b', 'c'],
    });
    const { server, synced } = fakeServer([
      channel({ activeVideoIds: ['a', 'b', 'c'] }),
    ]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      options,
    );

    expect(synced[0].deactivateVideoIds).toEqual([]);
    expect(report.reverifyFailed).toBe(2);
    expect(youtube.searches).toHaveLength(0);
  });

  it('길이 범위 밖, 이미 저장된 영상, 제외 목록의 영상은 추가하지 않는다', async () => {
    const youtube = fakeYoutube({
      catalog: [
        video('short', { durationSeconds: 599 }),
        video('long', { durationSeconds: 7201 }),
        video('other'),
        video('banned'),
        video('ok'),
      ],
      pages: {
        '예능|medium|': {
          videoIds: ['short', 'long', 'other', 'banned', 'ok', 'ok'],
          nextPageToken: null,
        },
      },
    });
    const { server, synced } = fakeServer([
      channel({ excludedVideoIds: ['banned'] }),
      channel({ channelId: 2, seedKeywords: [], activeVideoIds: ['other'] }),
    ]);

    await runCollector({ youtube: youtube.client, server }, options);

    const first = synced.find((s) => s.channelId === 1);
    expect(first?.upserts.map((v) => v.youtubeVideoId)).toEqual(['ok']);
  });

  it('동기화 요청에는 판정용 상태 값을 넣지 않는다', async () => {
    const youtube = fakeYoutube({ catalog: [video('a')] });
    const { server, synced } = fakeServer([channel({ activeVideoIds: ['a'] })]);

    await runCollector(
      { youtube: youtube.client, server },
      { ...options, targetPerChannel: 1 },
    );

    expect(synced[0].upserts[0]).not.toHaveProperty('embeddable');
    expect(synced[0].upserts[0]).not.toHaveProperty('privacyStatus');
  });

  it('검색어가 없는 채널은 검색하지 않는다', async () => {
    const youtube = fakeYoutube({});
    const { server } = fakeServer([
      channel({ channelId: 0, seedKeywords: [] }),
    ]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      options,
    );

    expect(youtube.searches).toHaveLength(0);
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
    expect(synced[0].upserts.map((v) => v.youtubeVideoId)).toEqual(['n1']);
  });

  it('채널당 상한에 닿은 채널은 더 검색하지 않고 다른 채널은 계속한다', async () => {
    const youtube = fakeYoutube({});
    const { server } = fakeServer([
      channel({ channelId: 1, seedKeywords: ['가', '나', '다'] }),
      channel({ channelId: 2, seedKeywords: ['라'] }),
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
      channel({ channelId: 1, seedKeywords: ['가'] }),
      channel({ channelId: 2, seedKeywords: ['나'] }),
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
      channel({ activeVideoIds: ['a', 'gone'] }),
      channel({ channelId: 2 }),
    ]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      options,
    );

    expect(report.stoppedBy).toBe('quota');
    expect(youtube.searches).toHaveLength(1);
    expect(synced[0].deactivateVideoIds).toEqual(['gone']);
  });

  it('할당량 외의 검색 오류는 해당 검색만 건너뛰고 계속한다', async () => {
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
        channel({ channelId: 1, activeVideoIds: ['a'], seedKeywords: [] }),
        channel({ channelId: 2, activeVideoIds: ['b'], seedKeywords: [] }),
      ],
      [1],
    );

    const report = await runCollector(
      { youtube: youtube.client, server },
      options,
    );

    expect(synced.map((s) => s.channelId)).toEqual([2]);
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

  it('onlyChannelId 로 한 채널만 처리하되 다른 채널의 영상과는 중복되지 않게 한다', async () => {
    const youtube = fakeYoutube({
      catalog: [video('other'), video('n1')],
      pages: {
        '예능|medium|': { videoIds: ['other', 'n1'], nextPageToken: null },
      },
    });
    const { server, synced } = fakeServer([
      channel({ channelId: 1 }),
      channel({ channelId: 2, activeVideoIds: ['other'] }),
    ]);

    const report = await runCollector(
      { youtube: youtube.client, server },
      { ...options, onlyChannelId: 1 },
    );

    expect(report.channels.map((c) => c.channelId)).toEqual([1]);
    expect(synced.map((s) => s.channelId)).toEqual([1]);
    expect(synced[0].upserts.map((v) => v.youtubeVideoId)).toEqual(['n1']);
  });
});
