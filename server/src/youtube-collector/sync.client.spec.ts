import { youtubeSyncRequestSchema } from '../youtube/youtube-internal.schema.js';
import { createSyncClient } from './sync.client.js';
import type { FetchLike } from './youtube.client.js';

function envelope(result: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({ isSuccess: status < 400, code: 'X', message: '', result }),
    { status },
  );
}

function client(fetchFn: FetchLike, log?: (message: string) => void) {
  return createSyncClient({
    baseUrl: 'https://example.com/api/',
    token: 'seed-token',
    fetchFn,
    log,
    // 재시도 대기를 실제로 기다리지 않는다.
    sleep: () => Promise.resolve(),
  });
}

const syncRequest = { channelNumber: 1, videos: [] };
const syncResult = {
  acceptedCount: 0,
  rejectedCount: 0,
  rejected: [],
  evictedCount: 0,
};

describe('createSyncClient', () => {
  it('seed-config 를 X-Seed-Token 으로 호출하고 봉투에서 채널 목록을 꺼낸다', async () => {
    const fetchFn = vi.fn<FetchLike>(() =>
      Promise.resolve(
        envelope({
          channels: [
            { channelNumber: 1, seedKeywords: ['예능'] },
            { channelNumber: 2, seedKeywords: ['금융'], storedVideoIds: ['a'] },
          ],
        }),
      ),
    );

    const channels = await client(fetchFn).fetchChannels();

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://example.com/api/internal/youtube/seed-config');
    expect(init?.method).toBe('GET');
    expect(init?.headers).toMatchObject({ 'X-Seed-Token': 'seed-token' });
    expect(channels).toEqual([
      { channelNumber: 1, seedKeywords: ['예능'] },
      { channelNumber: 2, seedKeywords: ['금융'], storedVideoIds: ['a'] },
    ]);
  });

  it('sync 는 서버 계약 스키마를 통과하는 본문을 보내고 결과를 돌려준다', async () => {
    const fetchFn = vi.fn<FetchLike>(() =>
      Promise.resolve(
        envelope({
          acceptedCount: 1,
          rejectedCount: 0,
          rejected: [],
          evictedCount: 2,
        }),
      ),
    );
    const request = {
      channelNumber: 1,
      videos: [
        {
          youtubeVideoId: 'a',
          title: '제목',
          thumbnailUrl: 'https://i.ytimg.com/a.jpg',
          durationSeconds: 900,
          publishedAt: '2026-11-20T12:00:00Z',
          sourceYoutubeChannelId: 'UC1',
          sourceChannelTitle: '제작자',
          privacyStatus: 'public' as const,
          isEmbeddable: true,
        },
      ],
    };

    const result = await client(fetchFn).sync(request);

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://example.com/api/internal/youtube/sync');
    expect(init?.method).toBe('POST');
    const body: unknown = JSON.parse(init?.body as string);
    expect(youtubeSyncRequestSchema.safeParse(body).success).toBe(true);
    expect(result).toEqual({
      acceptedCount: 1,
      rejectedCount: 0,
      rejected: [],
      evictedCount: 2,
    });
  });

  it('서버가 오류를 돌려주면 상태 코드와 봉투의 code·message 를 담아 던진다', async () => {
    const fetchFn: FetchLike = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            isSuccess: false,
            code: 'CHANNEL404',
            message: '채널을 찾을 수 없습니다.',
            result: null,
          }),
          { status: 404 },
        ),
      );

    await expect(client(fetchFn).fetchChannels()).rejects.toThrow(
      '서버 /internal/youtube/seed-config 호출 실패 (404) — CHANNEL404 / 채널을 찾을 수 없습니다.',
    );
  });

  it('검증 실패(400)의 필드 오류도 메시지에 담는다', async () => {
    const fetchFn: FetchLike = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            isSuccess: false,
            code: 'COMMON400',
            message: '요청 값이 올바르지 않습니다.',
            result: [
              { field: 'channelNumber', reasons: ['1 이상이어야 합니다'] },
            ],
          }),
          { status: 400 },
        ),
      );

    await expect(client(fetchFn).fetchChannels()).rejects.toThrow(
      'channelNumber: 1 이상이어야 합니다',
    );
  });

  it('오류 본문이 JSON 이 아니어도 상태 코드는 담아 던진다', async () => {
    const fetchFn: FetchLike = () =>
      Promise.resolve(new Response('Bad Gateway', { status: 502 }));

    await expect(client(fetchFn).fetchChannels()).rejects.toThrow('(502)');
  });

  it('계약과 다른 응답은 조용히 넘기지 않는다', async () => {
    const fetchFn: FetchLike = () => Promise.resolve(envelope([{ id: 1 }]));

    await expect(client(fetchFn).fetchChannels()).rejects.toThrow();
  });
});

describe('재시도', () => {
  it('sync 가 503 뒤 성공하면 같은 본문을 다시 보내고 결과를 돌려준다', async () => {
    const replies = [new Response('', { status: 503 }), envelope(syncResult)];
    const fetchFn = vi.fn<FetchLike>(() => Promise.resolve(replies.shift()!));
    const logs: string[] = [];

    const result = await client(fetchFn, (m) => logs.push(m)).sync(syncRequest);

    expect(result).toEqual(syncResult);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[1][1]?.body).toBe(fetchFn.mock.calls[0][1]?.body);
    expect(logs).toEqual([
      '서버 /internal/youtube/sync 재시도 2/3: 서버 /internal/youtube/sync 호출 실패 (503)',
    ]);
  });

  it('네트워크 오류와 타임아웃도 다시 보낸다', async () => {
    const timeout = new Error('timed out');
    timeout.name = 'TimeoutError';
    const replies: (Response | Error)[] = [
      new TypeError('fetch failed'),
      timeout,
      envelope({ channels: [] }),
    ];
    const fetchFn = vi.fn<FetchLike>(() => {
      const next = replies.shift()!;
      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve(next);
    });

    await expect(client(fetchFn).fetchChannels()).resolves.toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('계속 5xx 면 3번 보낸 뒤 실패로 던진다', async () => {
    const fetchFn = vi.fn<FetchLike>(() =>
      Promise.resolve(new Response('', { status: 503 })),
    );

    await expect(client(fetchFn).sync(syncRequest)).rejects.toThrow('(503)');
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('인증 실패(401)와 검증 실패(400)는 다시 보내지 않는다', async () => {
    for (const status of [400, 401, 404]) {
      const fetchFn = vi.fn<FetchLike>(() =>
        Promise.resolve(envelope(null, status)),
      );

      await expect(client(fetchFn).sync(syncRequest)).rejects.toThrow(
        `(${status})`,
      );
      expect(fetchFn).toHaveBeenCalledTimes(1);
    }
  });
});

describe('쓰기 요청 타임아웃과 대기', () => {
  function recordingClient(fetchFn: FetchLike) {
    const waits: number[] = [];
    const sync = createSyncClient({
      baseUrl: 'https://example.com/api/',
      token: 'seed-token',
      fetchFn,
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });
    return { sync, waits };
  }

  it('sync 는 타임아웃이면 다시 보내지 않는다 (서버에서 아직 처리 중일 수 있음)', async () => {
    const fetchFn = vi.fn<FetchLike>(() =>
      Promise.reject(new DOMException('timeout', 'TimeoutError')),
    );
    const { sync } = recordingClient(fetchFn);

    await expect(sync.sync(syncRequest)).rejects.toMatchObject({
      name: 'TimeoutError',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('sync 도 연결 실패는 다시 보낸다', async () => {
    const replies: (Response | Error)[] = [
      new TypeError('fetch failed'),
      envelope(syncResult),
    ];
    const fetchFn = vi.fn<FetchLike>(() => {
      const next = replies.shift()!;
      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve(next);
    });
    const { sync } = recordingClient(fetchFn);

    await expect(sync.sync(syncRequest)).resolves.toEqual(syncResult);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('seed-config 는 타임아웃을 1번만 다시 보낸다', async () => {
    const fetchFn = vi.fn<FetchLike>(() =>
      Promise.reject(new DOMException('timeout', 'TimeoutError')),
    );
    const { sync } = recordingClient(fetchFn);

    await expect(sync.fetchChannels()).rejects.toMatchObject({
      name: 'TimeoutError',
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('Retry-After 만큼 기다린 뒤 다시 보낸다', async () => {
    const replies = [
      new Response('', { status: 503, headers: { 'Retry-After': '3' } }),
      envelope(syncResult),
    ];
    const fetchFn = vi.fn<FetchLike>(() => Promise.resolve(replies.shift()!));
    const { sync, waits } = recordingClient(fetchFn);

    await sync.sync(syncRequest);

    expect(waits).toEqual([3_000]);
  });
});

describe('쓰기 요청(sync)을 다시 보내는 범위', () => {
  function brokenBody(): Response {
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new TypeError('terminated'));
        },
      }),
    );
  }

  function replying(...items: (Response | Error)[]) {
    return vi.fn<FetchLike>(() => {
      const next = items.shift();
      if (!next) {
        throw new Error('예상보다 많이 호출했습니다');
      }
      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve(next);
    });
  }

  it.each([429, 500, 503])(
    '앱이 돌려준 %i 는 커밋되지 않았으므로 다시 보낸다',
    async (status) => {
      const fetchFn = replying(envelope(null, status), envelope(syncResult));

      await expect(client(fetchFn).sync(syncRequest)).resolves.toEqual(
        syncResult,
      );
      expect(fetchFn).toHaveBeenCalledTimes(2);
    },
  );

  it.each([502, 504])(
    '프록시의 %i 는 서버가 처리했을 수 있으므로 다시 보내지 않는다',
    async (status) => {
      const fetchFn = replying(new Response('', { status }));

      await expect(client(fetchFn).sync(syncRequest)).rejects.toThrow(
        `(${status})`,
      );
      expect(fetchFn).toHaveBeenCalledTimes(1);
    },
  );

  it('본문을 받다가 끊긴 sync 는 다시 보내지 않는다 (이미 커밋됐을 수 있음)', async () => {
    const fetchFn = replying(brokenBody());

    await expect(client(fetchFn).sync(syncRequest)).rejects.toThrow(
      'terminated',
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('본문을 받다가 끊긴 seed-config 는 다시 보낸다', async () => {
    const fetchFn = replying(brokenBody(), envelope({ channels: [] }));

    await expect(client(fetchFn).fetchChannels()).resolves.toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('seed-config 는 429 와 502 도 다시 보낸다', async () => {
    const fetchFn = replying(
      envelope(null, 429),
      new Response('', { status: 502 }),
      envelope({ channels: [] }),
    );

    await expect(client(fetchFn).fetchChannels()).resolves.toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});
