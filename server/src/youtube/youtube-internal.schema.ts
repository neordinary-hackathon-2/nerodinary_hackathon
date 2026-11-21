import { z } from 'zod';
import {
  channelSchema,
  videoSchema,
  type ApiEnvelope,
} from '../../../shared/index.js';

/**
 * GitHub Actions 수집기와 서버 내부 API(/api/internal/youtube/*) 사이의 계약.
 *
 * FE가 쓰지 않는 내부용 스키마라 shared/ 가 아니라 서버 안에 둔다.
 * 수집기(src/youtube-collector/)와 내부 API 컨트롤러가 이 파일을 함께 쓴다.
 */

const youtubeSeedChannelSchema = z.object({
  channelNumber: channelSchema.shape.channelNumber,
  seedKeywords: z
    .array(z.string().min(1))
    .meta({ example: ['예능 클립', '웃긴 모음'] }),
  storedVideoIds: z
    .array(videoSchema.shape.youtubeVideoId)
    .optional()
    .meta({
      description:
        '이 채널에 저장된 영상의 YouTube ID. 수집기가 재검증하고 부족분만 채우는 데 쓴다. 없으면 수집기는 매번 목표 개수만큼 새로 찾는다.',
      example: ['YOUTUBE_VIDEO_ID'],
    }),
});

/** GET /api/internal/youtube/seed-config 의 result. 검색어를 DB에서 관리할 때 사용한다. */
export const youtubeSeedConfigResultSchema = z
  .object({ channels: z.array(youtubeSeedChannelSchema) })
  .meta({ id: 'YoutubeSeedConfigResultDto' });

export type YoutubeSeedConfigResultDto = z.infer<
  typeof youtubeSeedConfigResultSchema
>;
export type YoutubeSeedConfigResponseDto =
  ApiEnvelope<YoutubeSeedConfigResultDto>;

const youtubeSyncVideoSchema = videoSchema
  .pick({
    youtubeVideoId: true,
    title: true,
    thumbnailUrl: true,
    durationSeconds: true,
  })
  .extend({
    publishedAt: z.iso.datetime({ offset: true }).nullable().optional().meta({
      description: 'YouTube 공개 시각 (ISO 8601)',
      example: '2026-11-20T12:00:00Z',
    }),
    sourceYoutubeChannelId: z
      .string()
      .min(1)
      .max(64)
      .nullable()
      .optional()
      .meta({
        example: 'UC_CREATOR_CHANNEL_ID',
      }),
    sourceChannelTitle: z.string().max(255).nullable().optional().meta({
      example: '원본 제작자 채널명',
    }),
    privacyStatus: z.enum(['public', 'unlisted', 'private']).meta({
      description: 'public이 아니면 저장 대상에서 제외',
      example: 'public',
    }),
    isEmbeddable: z.boolean().meta({
      description: 'false이면 저장 대상에서 제외',
      example: true,
    }),
  })
  .strict();

/** POST /api/internal/youtube/sync 의 요청 본문. */
export const youtubeSyncRequestSchema = z
  .object({
    channelNumber: z.number().int().min(1).max(9).meta({ example: 1 }),
    videos: z.array(youtubeSyncVideoSchema).meta({
      description:
        '새 후보와, 메타데이터를 갱신할 기존 영상. 보낼 영상도 지울 영상도 없으면 요청 자체를 생략한다.',
    }),
    removedVideoIds: z
      .array(videoSchema.shape.youtubeVideoId)
      .optional()
      .meta({
        description:
          '재검증에서 삭제·비공개·임베드 불가가 확인돼 이 채널에서 지울 영상의 YouTube ID. 유지 개수를 넘는 영상은 여기 없어도 서버가 오래된 것부터 지운다.',
        example: ['YOUTUBE_VIDEO_ID'],
      }),
  })
  .strict()
  .meta({ id: 'YoutubeSyncRequestDto' });

export type YoutubeSyncRequestDto = z.infer<typeof youtubeSyncRequestSchema>;

const rejectedVideoSchema = z.object({
  youtubeVideoId: videoSchema.shape.youtubeVideoId.meta({
    example: 'YOUTUBE_VIDEO_ID',
  }),
  reason: z.string().min(1).meta({ example: 'Video is not embeddable' }),
});

/** POST /api/internal/youtube/sync 의 result. */
export const youtubeSyncResultSchema = z
  .object({
    acceptedCount: z.number().int().nonnegative().meta({ example: 1 }),
    rejectedCount: z.number().int().nonnegative().meta({ example: 0 }),
    rejected: z.array(rejectedVideoSchema),
    evictedCount: z.number().int().nonnegative().meta({
      description:
        '채널당 유지 개수를 넘어, 저장된 지 오래된 순서로 지운 영상 수.',
      example: 0,
    }),
  })
  .meta({ id: 'YoutubeSyncResultDto' });

export type YoutubeSyncResultDto = z.infer<typeof youtubeSyncResultSchema>;
export type YoutubeSyncResponseDto = ApiEnvelope<YoutubeSyncResultDto>;
