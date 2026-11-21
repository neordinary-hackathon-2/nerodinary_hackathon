import { youtubeSyncRequestSchema } from '../youtube/youtube-internal.schema.js';
import { createSyncClient } from './sync.client.js';
import type { FetchLike } from './youtube.client.js';

function envelope(result: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({ isSuccess: status < 400, code: 'X', message: '', result }),
    { status },
  );
}

function client(fetchFn: FetchLike) {
  return createSyncClient({
    baseUrl: 'https://example.com/api/',
    token: 'seed-token',
    fetchFn,
  });
}

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

  it('서버가 오류를 돌려주면 상태 코드를 담아 던진다', async () => {
    const fetchFn: FetchLike = () => Promise.resolve(envelope(null, 401));

    await expect(client(fetchFn).fetchChannels()).rejects.toThrow('401');
  });

  it('계약과 다른 응답은 조용히 넘기지 않는다', async () => {
    const fetchFn: FetchLike = () => Promise.resolve(envelope([{ id: 1 }]));

    await expect(client(fetchFn).fetchChannels()).rejects.toThrow();
  });
});
