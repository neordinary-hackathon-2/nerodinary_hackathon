import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { createConnection, createPool, type Pool } from 'mysql2/promise';
import { ChannelsService } from '../src/channels/channels.service.js';
import { BusinessException } from '../src/common/exception/business.exception.js';
import { ErrorCodes } from '../src/common/exception/error-code.js';
import {
  DB_CASING,
  MIGRATIONS_FOLDER,
} from '../src/database/database.constants.js';
import type { Database } from '../src/database/database.types.js';
import * as schema from '../src/database/schema/index.js';
import { channels, videos } from '../src/database/schema/index.js';
import type { YoutubeSyncRequestDto } from '../src/youtube/youtube-internal.schema.js';
import { YoutubeSyncService } from '../src/youtube/youtube-sync.service.js';

/**
 * YoutubeSyncService·ChannelsService 의 SQL 동작을 실제 MySQL 로 검증한다.
 * (HTTP 계약은 youtube-internal.e2e-spec.ts 가 서비스를 가짜로 바꿔 검증한다.)
 *
 * 전용 테스트 DB(`<DB_DATABASE>_test`)를 만들어 쓰므로 개발 DB 는 건드리지 않는다.
 * MySQL 에 연결할 수 없으면(예: CI) 전체를 건너뛰고 경고만 남긴다.
 */
const connection = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
};
const testDatabase = `${process.env.DB_DATABASE ?? 'hackathon'}_test`;

async function prepareTestDatabase(): Promise<boolean> {
  try {
    const probe = await createConnection({
      ...connection,
      connectTimeout: 2000,
    });
    try {
      await probe.query(
        `CREATE DATABASE IF NOT EXISTS \`${testDatabase}\` CHARACTER SET utf8mb4`,
      );
    } finally {
      await probe.end();
    }
    return true;
  } catch {
    return false;
  }
}

const dbAvailable = await prepareTestDatabase();
if (!dbAvailable) {
  console.warn(
    `[db-services.e2e] MySQL(${connection.host}:${connection.port})에 연결할 수 없어 DB 통합 테스트를 건너뜁니다. ` +
      'DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD 로 접속 정보를 지정할 수 있습니다.',
  );
}

/** 저장 가능한(공개·임베드 가능·길이 통과) sync 요청 영상을 만든다. */
function syncVideo(
  youtubeVideoId: string,
  overrides: Partial<YoutubeSyncRequestDto['videos'][number]> = {},
): YoutubeSyncRequestDto['videos'][number] {
  return {
    youtubeVideoId,
    title: `제목 ${youtubeVideoId}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${youtubeVideoId}/hq.jpg`,
    durationSeconds: 900,
    publishedAt: '2026-11-20T12:00:00.000Z',
    sourceYoutubeChannelId: 'UC_SOURCE',
    sourceChannelTitle: '제작자',
    privacyStatus: 'public',
    isEmbeddable: true,
    ...overrides,
  };
}

describe.skipIf(!dbAvailable)(
  'DB 통합 (YoutubeSyncService·ChannelsService)',
  () => {
    const TARGET_PER_CHANNEL = 5;
    let pool: Pool;
    let db: Database;
    let syncService: YoutubeSyncService;
    let channelsService: ChannelsService;

    beforeAll(async () => {
      pool = createPool({
        ...connection,
        database: testDatabase,
        connectionLimit: 10,
        charset: 'utf8mb4',
        timezone: 'Z',
      });
      db = drizzle(pool, { schema, mode: 'default', casing: DB_CASING });
      // 운영과 같은 마이그레이션으로 스키마·시드 채널(1~9)을 만든다.
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

      syncService = new YoutubeSyncService(db, {
        seedToken: 'test-seed-token-0123456789',
        minDurationSeconds: 600,
        maxDurationSeconds: 7200,
        targetPerChannel: TARGET_PER_CHANNEL,
      });
      channelsService = new ChannelsService(db);
    });

    beforeEach(async () => {
      await db.delete(videos);
    });

    afterAll(async () => {
      await pool?.end();
    });

    async function channelId(channelNumber: number): Promise<number> {
      const [row] = await db
        .select({ id: channels.id })
        .from(channels)
        .where(eq(channels.channelNumber, channelNumber))
        .limit(1);
      return row.id;
    }

    async function videosOf(channelNumber: number) {
      return db
        .select()
        .from(videos)
        .where(eq(videos.appChannelId, await channelId(channelNumber)))
        .orderBy(asc(videos.id));
    }

    describe('sync', () => {
      it('새 영상을 저장하고 acceptedCount 를 반환한다', async () => {
        const result = await syncService.sync({
          channelNumber: 1,
          videos: [syncVideo('vid-a'), syncVideo('vid-b')],
        });

        expect(result.acceptedCount).toBe(2);
        expect(result.rejectedCount).toBe(0);
        const stored = await videosOf(1);
        expect(stored.map((row) => row.youtubeVideoId).sort()).toEqual([
          'vid-a',
          'vid-b',
        ]);
        expect(stored[0].title).toBe('제목 vid-a');
        expect(stored[0].lastRefreshedAt).not.toBeNull();
      });

      it('같은 영상을 다시 보내면 행을 새로 만들지 않고 메타데이터만 갱신한다', async () => {
        await syncService.sync({
          channelNumber: 1,
          videos: [syncVideo('vid-a', { title: '처음 제목' })],
        });
        const [before] = await videosOf(1);

        await syncService.sync({
          channelNumber: 1,
          videos: [syncVideo('vid-a', { title: '갱신된 제목' })],
        });

        const stored = await videosOf(1);
        expect(stored).toHaveLength(1);
        // id 가 같으면 삭제 후 재삽입이 아니라 갱신이다.
        expect(stored[0].id).toBe(before.id);
        expect(stored[0].createdAt).toEqual(before.createdAt);
        expect(stored[0].title).toBe('갱신된 제목');
      });

      it('같은 새 영상의 sync 가 동시에 와도 유니크 위반 없이 한 행만 남는다', async () => {
        // 수정 전(select-then-insert)에는 둘 다 "없음"으로 판단해 중복 insert → 500 이 났다.
        // 한 번으로는 타이밍이 겹치지 않을 수 있어 반복해 겹칠 확률을 높인다.
        const ROUNDS = 5;
        for (let round = 0; round < ROUNDS; round++) {
          const videoId = `vid-race-${round}`;
          await Promise.all([
            syncService.sync({
              channelNumber: 1,
              videos: [syncVideo(videoId)],
            }),
            syncService.sync({
              channelNumber: 1,
              videos: [syncVideo(videoId)],
            }),
          ]);
        }

        const stored = await videosOf(1);
        expect(stored.map((row) => row.youtubeVideoId)).toEqual(
          Array.from({ length: ROUNDS }, (_, i) => `vid-race-${i}`),
        );
      });

      it('같은 영상이라도 다른 채널에는 독립으로 저장된다', async () => {
        await syncService.sync({
          channelNumber: 1,
          videos: [syncVideo('vid-a')],
        });
        await syncService.sync({
          channelNumber: 2,
          videos: [syncVideo('vid-a')],
        });

        expect(await videosOf(1)).toHaveLength(1);
        expect(await videosOf(2)).toHaveLength(1);
      });

      it('removedVideoIds 는 요청한 채널의 행만 지운다', async () => {
        await syncService.sync({
          channelNumber: 1,
          videos: [syncVideo('vid-a')],
        });
        await syncService.sync({
          channelNumber: 2,
          videos: [syncVideo('vid-a')],
        });

        await syncService.sync({
          channelNumber: 1,
          videos: [],
          removedVideoIds: ['vid-a'],
        });

        expect(await videosOf(1)).toHaveLength(0);
        expect(await videosOf(2)).toHaveLength(1);
      });

      it('유지 개수를 넘으면 저장된 지 오래된 영상부터 넘는 만큼만 지운다', async () => {
        // target(5)만큼 채운다. createdAt 이 같은 초라면 id 로 순서를 가른다.
        await syncService.sync({
          channelNumber: 1,
          videos: [1, 2, 3, 4, 5].map((n) => syncVideo(`vid-${n}`)),
        });

        const result = await syncService.sync({
          channelNumber: 1,
          videos: [syncVideo('vid-6'), syncVideo('vid-7')],
        });

        expect(result.evictedCount).toBe(2);
        const stored = await videosOf(1);
        expect(stored.map((row) => row.youtubeVideoId)).toEqual([
          'vid-3',
          'vid-4',
          'vid-5',
          'vid-6',
          'vid-7',
        ]);
      });

      it('길이 범위 밖 영상은 rejected 로 반환하고 저장하지 않는다', async () => {
        const result = await syncService.sync({
          channelNumber: 1,
          videos: [syncVideo('vid-short', { durationSeconds: 300 })],
        });

        expect(result.acceptedCount).toBe(0);
        expect(result.rejected).toEqual([
          {
            youtubeVideoId: 'vid-short',
            reason: expect.stringContaining('길이'),
          },
        ]);
        expect(await videosOf(1)).toHaveLength(0);
      });

      it('없는 채널이면 CHANNEL_NOT_FOUND 를 던진다', async () => {
        await expect(
          syncService.sync({ channelNumber: 99, videos: [] }),
        ).rejects.toMatchObject({
          name: 'BusinessException',
          errorCode: ErrorCodes.CHANNEL_NOT_FOUND,
        });
        await expect(
          syncService.sync({ channelNumber: 99, videos: [] }),
        ).rejects.toBeInstanceOf(BusinessException);
      });
    });

    describe('getSeedConfig', () => {
      it('채널을 번호 순으로, 채널별 저장 영상 ID 와 함께 반환한다', async () => {
        await syncService.sync({
          channelNumber: 2,
          videos: [syncVideo('vid-a'), syncVideo('vid-b')],
        });

        const config = await syncService.getSeedConfig();

        const numbers = config.channels.map((channel) => channel.channelNumber);
        expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
        const channel2 = config.channels.find((c) => c.channelNumber === 2);
        expect(channel2?.storedVideoIds.sort()).toEqual(['vid-a', 'vid-b']);
        const channel1 = config.channels.find((c) => c.channelNumber === 1);
        expect(channel1?.storedVideoIds).toEqual([]);
      });
    });

    describe('ChannelsService', () => {
      it('채널 목록을 번호 오름차순으로 반환한다', async () => {
        const result = await channelsService.getChannels();

        expect(result.channels.length).toBeGreaterThan(0);
        const numbers = result.channels.map((channel) => channel.channelNumber);
        expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
        expect(result.channels[0]).toMatchObject({
          name: expect.any(String),
          slogan: expect.any(String),
        });
      });

      it('랜덤 영상은 채널당 최대 10개만 반환한다', async () => {
        const appChannelId = await channelId(1);
        await db.insert(videos).values(
          Array.from({ length: 12 }, (_, i) => ({
            appChannelId,
            youtubeVideoId: `vid-${i}`,
            title: `제목 ${i}`,
            thumbnailUrl: `https://i.ytimg.com/vi/vid-${i}/hq.jpg`,
            durationSeconds: 900,
          })),
        );

        const result = await channelsService.getRandomVideos();

        const channel1 = result.channels.find((c) => c.channelNumber === 1);
        expect(channel1?.videos).toHaveLength(10);
        for (const video of channel1?.videos ?? []) {
          expect(video.youtubeVideoId).toMatch(/^vid-\d+$/);
        }
        const channel2 = result.channels.find((c) => c.channelNumber === 2);
        expect(channel2?.videos).toEqual([]);
      });
    });
  },
);
