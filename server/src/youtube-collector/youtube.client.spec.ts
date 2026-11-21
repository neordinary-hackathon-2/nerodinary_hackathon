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

function client(fetchFn: FetchLike, log?: (message: string) => void) {
  return createYoutubeClient({
    apiKey: 'test-key',
    regionCode: 'KR',
    relevanceLanguage: 'ko',
    fetchFn,
    log,
    // 재시도 대기를 실제로 기다리지 않는다.
    sleep: () => Promise.resolve(),
  });
}

/** 정해진 응답을 순서대로 돌려주는 fetch. 응답 대신 Error 를 넣으면 던진다. */
function responses(...items: (Response | Error)[]) {
  return vi.fn<FetchLike>(() => {
    const next = items.shift();
    if (!next) {
      throw new Error('예상보다 많이 호출했습니다');
    }
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
}

const searchQuery = {
  query: '가',
  duration: 'medium',
  pageToken: null,
} as const;

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

  it('search.list 일일 한도 초과(429 rateLimitExceeded)를 할당량 오류로 본다', async () => {
    // 11.22 YouTube Collect #3 에서 실제로 받은 응답 형태.
    const fetchFn: FetchLike = () =>
      Promise.resolve(
        json(
          {
            error: {
              message:
                "Quota exceeded for quota metric 'Search Queries' and limit 'Search Queries per day'",
              errors: [{ reason: 'rateLimitExceeded' }],
            },
          },
          429,
        ),
      );

    const error: unknown = await client(fetchFn)
      .searchVideoIds({ query: '가', duration: 'medium', pageToken: null })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(YoutubeApiError);
    expect(isQuotaError(error)).toBe(true);
  });

  it('403 rateLimitExceeded 도 할당량 오류로 본다', () => {
    expect(
      isQuotaError(new YoutubeApiError(403, 'rateLimitExceeded', 'x')),
    ).toBe(true);
  });

  it('429 는 사유가 없어도 할당량 오류로 본다', () => {
    expect(isQuotaError(new YoutubeApiError(429, null, 'x'))).toBe(true);
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

  it('재시도까지 실패한 배치의 ID 는 failedIds 로 돌려준다', async () => {
    const fetchFn = vi.fn<FetchLike>(() => Promise.resolve(json({}, 500)));

    const lookup = await client(fetchFn).fetchVideoDetails(['a', 'b']);

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(lookup.found.size).toBe(0);
    expect([...lookup.failedIds]).toEqual(['a', 'b']);
  });

  it('일시 오류 뒤 재시도에 성공하면 정상 조회로 본다', async () => {
    const fetchFn = responses(
      new TypeError('fetch failed'),
      json({ items: [videoItem('a')] }),
    );
    const logs: string[] = [];

    const lookup = await client(fetchFn, (m) => logs.push(m)).fetchVideoDetails(
      ['a'],
    );

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect([...lookup.found.keys()]).toEqual(['a']);
    expect(lookup.failedIds.size).toBe(0);
    expect(logs).toEqual(['YouTube videos 재시도 2/3: fetch failed']);
  });

  it('ID 가 없으면 호출하지 않는다', async () => {
    const fetchFn = vi.fn<FetchLike>();

    await client(fetchFn).fetchVideoDetails([]);

    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('재시도', () => {
  it('검색이 503 뒤 성공하면 결과를 돌려준다', async () => {
    const fetchFn = responses(
      json({ error: { errors: [{ reason: 'backendError' }] } }, 503),
      json({ items: [{ id: { videoId: 'a' } }] }),
    );

    const page = await client(fetchFn).searchVideoIds(searchQuery);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(page.videoIds).toEqual(['a']);
  });

  it('잘못된 키(400)와 할당량 초과(429)는 다시 부르지 않는다', async () => {
    for (const status of [400, 403, 429]) {
      const fetchFn = vi.fn<FetchLike>(() =>
        Promise.resolve(
          json(
            { error: { errors: [{ reason: 'rateLimitExceeded' }] } },
            status,
          ),
        ),
      );

      await expect(
        client(fetchFn).searchVideoIds(searchQuery),
      ).rejects.toBeInstanceOf(YoutubeApiError);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    }
  });

  it('검색 재시도 여부는 beforeRetry 가 정한다', async () => {
    const fetchFn = vi.fn<FetchLike>(() => Promise.resolve(json({}, 500)));
    const attempts: number[] = [];

    await expect(
      client(fetchFn).searchVideoIds(searchQuery, {
        beforeRetry: (info) => {
          attempts.push(info.attempt);
          return false;
        },
      }),
    ).rejects.toBeInstanceOf(YoutubeApiError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(attempts).toEqual([1]);
  });

  it('Retry-After 를 오류에 담는다', async () => {
    const fetchFn = vi.fn<FetchLike>(() =>
      Promise.resolve(
        new Response('{}', { status: 503, headers: { 'Retry-After': '2' } }),
      ),
    );

    const error: unknown = await client(fetchFn)
      .searchVideoIds(searchQuery)
      .catch((e: unknown) => e);

    expect((error as YoutubeApiError).retryAfterMs).toBe(2_000);
  });
});

describe('재시도 시간 상한과 대기', () => {
  function recordingClient(fetchFn: FetchLike) {
    const waits: number[] = [];
    const yt = createYoutubeClient({
      apiKey: 'test-key',
      regionCode: 'KR',
      relevanceLanguage: 'ko',
      fetchFn,
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });
    return { yt, waits };
  }

  it('타임아웃은 1번만 다시 시도한다', async () => {
    const fetchFn = vi.fn<FetchLike>(() =>
      Promise.reject(new DOMException('timeout', 'TimeoutError')),
    );
    const { yt } = recordingClient(fetchFn);

    const lookup = await yt.fetchVideoDetails(['a']);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect([...lookup.failedIds]).toEqual(['a']);
  });

  it('본문을 받다가 연결이 끊기면 다시 시도한다', async () => {
    const broken = new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new TypeError('terminated'));
        },
      }),
    );
    const fetchFn = responses(broken, json({ items: [videoItem('a')] }));
    const { yt } = recordingClient(fetchFn);

    const lookup = await yt.fetchVideoDetails(['a']);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect([...lookup.found.keys()]).toEqual(['a']);
  });

  it('Retry-After 만큼 기다린 뒤 다시 시도한다', async () => {
    const fetchFn = responses(
      new Response('{}', { status: 503, headers: { 'Retry-After': '2' } }),
      json({ items: [] }),
    );
    const { yt, waits } = recordingClient(fetchFn);

    await yt.searchVideoIds(searchQuery);

    expect(waits).toEqual([2_000]);
  });
});
