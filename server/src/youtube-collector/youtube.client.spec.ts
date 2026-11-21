import {
  createYoutubeClient,
  isQuotaError,
  YoutubeApiError,
  type FetchLike,
} from './youtube.client.js';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function videoItem(id: string) {
  return {
    id,
    snippet: {
      title: `제목 ${id}`,
      publishedAt: '2026-11-20T12:00:00Z',
      channelId: 'UC1',
      channelTitle: '제작자',
      thumbnails: { medium: { url: `https://i.ytimg.com/${id}.jpg` } },
    },
    contentDetails: { duration: 'PT12M' },
    status: { embeddable: true, privacyStatus: 'public' },
  };
}

function client(fetchFn: FetchLike) {
  return createYoutubeClient({
    apiKey: 'test-key',
    regionCode: 'KR',
    relevanceLanguage: 'ko',
    fetchFn,
  });
}

describe('searchVideoIds', () => {
  it('영상·임베드·길이 필터를 붙이고 키는 URL 이 아닌 헤더로 보낸다', async () => {
    const fetchFn = vi.fn<FetchLike>(() =>
      Promise.resolve(
        json({
          items: [{ id: { videoId: 'a' } }, { id: {} }],
          nextPageToken: 'p2',
        }),
      ),
    );

    const page = await client(fetchFn).searchVideoIds({
      query: '예능 클립',
      duration: 'long',
      pageToken: 'p1',
    });

    const [url, init] = fetchFn.mock.calls[0];
    const params = new URL(url as string).searchParams;
    expect(Object.fromEntries(params)).toMatchObject({
      type: 'video',
      q: '예능 클립',
      videoDuration: 'long',
      videoEmbeddable: 'true',
      maxResults: '50',
      pageToken: 'p1',
      regionCode: 'KR',
    });
    expect(url as string).not.toContain('test-key');
    expect(init?.headers).toMatchObject({ 'X-Goog-Api-Key': 'test-key' });
    expect(page).toEqual({ videoIds: ['a'], nextPageToken: 'p2' });
  });

  it('publishedAfter 를 주면 검색에 붙이고, 없으면 붙이지 않는다', async () => {
    const fetchFn = vi.fn<FetchLike>(() =>
      Promise.resolve(json({ items: [] })),
    );
    const youtube = client(fetchFn);

    await youtube.searchVideoIds({
      query: '가',
      duration: 'medium',
      pageToken: null,
      publishedAfter: '2026-11-19T00:00:00.000Z',
    });
    await youtube.searchVideoIds({
      query: '가',
      duration: 'medium',
      pageToken: null,
    });

    const [withWindow, withoutWindow] = fetchFn.mock.calls.map(
      ([url]) => new URL(url as string).searchParams,
    );
    expect(withWindow.get('publishedAfter')).toBe('2026-11-19T00:00:00.000Z');
    expect(withoutWindow.has('publishedAfter')).toBe(false);
  });

  it('할당량 초과 응답을 구분할 수 있는 오류로 던진다', async () => {
    const fetchFn: FetchLike = () =>
      Promise.resolve(
        json(
          {
            error: { message: 'quota', errors: [{ reason: 'quotaExceeded' }] },
          },
          403,
        ),
      );

    const error: unknown = await client(fetchFn)
      .searchVideoIds({ query: '가', duration: 'medium', pageToken: null })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(YoutubeApiError);
    expect(isQuotaError(error)).toBe(true);
  });

  it('다른 403 은 할당량 오류로 보지 않는다', () => {
    expect(isQuotaError(new YoutubeApiError(403, 'forbidden', 'x'))).toBe(
      false,
    );
    expect(isQuotaError(new Error('x'))).toBe(false);
  });
});

describe('fetchVideoDetails', () => {
  it('50개씩 나눠 조회하고 응답을 수집기 형태로 바꾼다', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `v${i}`);
    const fetchFn = vi.fn<FetchLike>((url) => {
      const requested = new URL(url as string).searchParams.get('id') ?? '';
      return Promise.resolve(
        json({ items: requested.split(',').map(videoItem) }),
      );
    });

    const lookup = await client(fetchFn).fetchVideoDetails(ids);

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(lookup.found.size).toBe(120);
    expect(lookup.found.get('v0')).toEqual({
      youtubeVideoId: 'v0',
      title: '제목 v0',
      thumbnailUrl: 'https://i.ytimg.com/v0.jpg',
      durationSeconds: 720,
      sourceYoutubeChannelId: 'UC1',
      sourceChannelTitle: '제작자',
      publishedAt: '2026-11-20T12:00:00Z',
      embeddable: true,
      privacyStatus: 'public',
    });
  });

  it('medium 썸네일이 없으면 다른 크기를 쓰고, 하나도 없으면 null 이다', async () => {
    const withHigh = videoItem('a');
    withHigh.snippet.thumbnails = {
      high: { url: 'https://i.ytimg.com/a-high.jpg' },
    } as never;
    const withNone = videoItem('b');
    withNone.snippet.thumbnails = {} as never;
    const fetchFn: FetchLike = () =>
      Promise.resolve(json({ items: [withHigh, withNone] }));

    const lookup = await client(fetchFn).fetchVideoDetails(['a', 'b']);

    expect(lookup.found.get('a')?.thumbnailUrl).toBe(
      'https://i.ytimg.com/a-high.jpg',
    );
    expect(lookup.found.get('b')?.thumbnailUrl).toBeNull();
  });

  it('응답에 없는 ID 는 found 에도 failedIds 에도 넣지 않는다 (삭제된 영상)', async () => {
    const fetchFn: FetchLike = () =>
      Promise.resolve(json({ items: [videoItem('a')] }));

    const lookup = await client(fetchFn).fetchVideoDetails(['a', 'gone']);

    expect([...lookup.found.keys()]).toEqual(['a']);
    expect(lookup.failedIds.size).toBe(0);
  });

  it('호출이 실패한 배치의 ID 는 failedIds 로 돌려준다', async () => {
    const fetchFn: FetchLike = () => Promise.resolve(json({}, 500));

    const lookup = await client(fetchFn).fetchVideoDetails(['a', 'b']);

    expect(lookup.found.size).toBe(0);
    expect([...lookup.failedIds]).toEqual(['a', 'b']);
  });

  it('ID 가 없으면 호출하지 않는다', async () => {
    const fetchFn = vi.fn<FetchLike>();

    await client(fetchFn).fetchVideoDetails([]);

    expect(fetchFn).not.toHaveBeenCalled();
  });
});
