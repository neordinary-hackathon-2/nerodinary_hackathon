import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { configureApp } from '../src/app.setup.js';
import { BusinessException } from '../src/common/exception/business.exception.js';
import { ErrorCodes } from '../src/common/exception/error-code.js';
import { youtubeConfig } from '../src/config/youtube.config.js';
import { SeedTokenGuard } from '../src/youtube/seed-token.guard.js';
import { YoutubeInternalController } from '../src/youtube/youtube-internal.controller.js';
import { YoutubeSyncService } from '../src/youtube/youtube-sync.service.js';
import {
  SEED_TOKEN_HEADER,
  SEED_TOKEN_SECURITY,
} from '../src/youtube/youtube.constants.js';

/**
 * 내부 수집 API 의 HTTP 계약을 검증한다: 토큰 인증, 요청 검증, 상태 코드, Swagger 문서.
 * DB 없이 돌도록 서비스는 가짜로 바꾼다. SQL 동작은 여기서 검증하지 않는다.
 */
const TOKEN = 'test-seed-token-0123456789';

const validBody = {
  channelNumber: 1,
  videos: [
    {
      youtubeVideoId: 'abc',
      title: '제목',
      thumbnailUrl: 'https://i.ytimg.com/abc.jpg',
      durationSeconds: 900,
      publishedAt: '2026-11-20T12:00:00Z',
      sourceYoutubeChannelId: 'UC1',
      sourceChannelTitle: '제작자',
      privacyStatus: 'public',
      isEmbeddable: true,
    },
  ],
  removedVideoIds: ['gone'],
};

describe('내부 YouTube 수집 API', () => {
  let app: INestApplication<App>;
  let document: OpenAPIObject;
  const service = {
    getSeedConfig: vi.fn(),
    sync: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [YoutubeInternalController],
      providers: [
        SeedTokenGuard,
        { provide: YoutubeSyncService, useValue: service },
        {
          provide: youtubeConfig.KEY,
          useValue: {
            seedToken: TOKEN,
            minDurationSeconds: 600,
            maxDurationSeconds: 7200,
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .addApiKey(
          { type: 'apiKey', in: 'header', name: SEED_TOKEN_HEADER },
          SEED_TOKEN_SECURITY,
        )
        .build(),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    service.getSeedConfig.mockReset().mockResolvedValue({
      channels: [
        { channelNumber: 1, seedKeywords: ['예능'], storedVideoIds: ['abc'] },
      ],
    });
    service.sync.mockReset().mockResolvedValue({
      acceptedCount: 1,
      rejectedCount: 0,
      rejected: [],
    });
  });

  describe('인증', () => {
    it('토큰이 없으면 401 이고 서비스를 호출하지 않는다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/internal/youtube/seed-config')
        .expect(401);

      expect(response.body).toMatchObject({
        isSuccess: false,
        code: 'COMMON401',
        result: null,
      });
      expect(service.getSeedConfig).not.toHaveBeenCalled();
    });

    it('토큰이 다르면 401 이다', async () => {
      await request(app.getHttpServer())
        .post('/api/internal/youtube/sync')
        .set(SEED_TOKEN_HEADER, `${TOKEN}x`)
        .send(validBody)
        .expect(401);

      expect(service.sync).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/internal/youtube/seed-config', () => {
    it('채널별 검색어와 저장된 영상 ID 를 봉투에 담아 돌려준다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/internal/youtube/seed-config')
        .set(SEED_TOKEN_HEADER, TOKEN)
        .expect(200);

      expect(response.body).toMatchObject({
        isSuccess: true,
        code: 'COMMON200',
        result: {
          channels: [
            {
              channelNumber: 1,
              seedKeywords: ['예능'],
              storedVideoIds: ['abc'],
            },
          ],
        },
      });
    });
  });

  describe('POST /api/internal/youtube/sync', () => {
    const post = (body: unknown) =>
      request(app.getHttpServer())
        .post('/api/internal/youtube/sync')
        .set(SEED_TOKEN_HEADER, TOKEN)
        .send(body as object);

    it('저장 결과를 201 이 아닌 200 으로 돌려준다', async () => {
      const response = await post(validBody).expect(200);

      expect(response.body).toMatchObject({
        isSuccess: true,
        code: 'COMMON200',
        result: { acceptedCount: 1, rejectedCount: 0, rejected: [] },
      });
      expect(service.sync).toHaveBeenCalledWith(validBody);
    });

    it('삭제 목록만 있는 요청(영상 0개)도 받는다', async () => {
      await post({
        channelNumber: 1,
        videos: [],
        removedVideoIds: ['gone'],
      }).expect(200);
    });

    it.each([
      ['채널 코드 누락', { videos: [] }],
      ['정의에 없는 필드', { ...validBody, extra: true }],
      [
        '영상에 정의에 없는 필드',
        { ...validBody, videos: [{ ...validBody.videos[0], extra: 1 }] },
      ],
      [
        '영상의 필수 값 누락',
        { channelNumber: 1, videos: [{ youtubeVideoId: 'abc' }] },
      ],
      [
        '잘못된 공개 상태 값',
        {
          ...validBody,
          videos: [{ ...validBody.videos[0], privacyStatus: 'x' }],
        },
      ],
    ])('%s 은 400 이고 서비스를 호출하지 않는다', async (_name, body) => {
      const response = await post(body).expect(400);

      expect(response.body).toMatchObject({
        isSuccess: false,
        code: 'COMMON400_VALIDATION',
      });
      expect(service.sync).not.toHaveBeenCalled();
    });

    it('없는 채널이면 404 CHANNEL404 다', async () => {
      service.sync.mockRejectedValue(
        new BusinessException(ErrorCodes.CHANNEL_NOT_FOUND),
      );

      const response = await post(validBody).expect(404);

      expect(response.body).toMatchObject({
        isSuccess: false,
        code: 'CHANNEL404',
      });
    });
  });

  describe('Swagger 문서', () => {
    it('두 API 가 토큰 보안 스키마와 함께 문서화된다', () => {
      const seedConfig =
        document.paths['/api/internal/youtube/seed-config'].get;
      const sync = document.paths['/api/internal/youtube/sync'].post;

      expect(seedConfig?.security).toEqual([{ [SEED_TOKEN_SECURITY]: [] }]);
      expect(sync?.security).toEqual([{ [SEED_TOKEN_SECURITY]: [] }]);
      expect(sync?.requestBody).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/YoutubeSyncRequestDto' },
          },
        },
      });
      expect(Object.keys(sync?.responses ?? {})).toEqual(
        expect.arrayContaining(['200', '400', '401', '404', '500']),
      );
      expect(Object.keys(sync?.responses ?? {})).not.toContain('201');
    });

    it('요청 예시로 바로 호출할 수 있도록 채널 코드와 영상 필드에 예시가 있다', () => {
      const schemas = document.components?.schemas ?? {};
      expect(schemas.YoutubeSyncRequestDto).toMatchObject({
        properties: { channelNumber: { example: 1 } },
      });
    });
  });
});
