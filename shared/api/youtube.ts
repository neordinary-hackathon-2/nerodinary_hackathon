import {z} from 'zod';
import type {ApiEnvelope} from './envelope.js';
import {channelSchema} from '../entities/channel.js';
import {videoSchema} from '../entities/video.js';

const youtubeSeedChannelSchema = z.object({
  channelNumber: channelSchema.shape.channelNumber,
  seedKeywords: z.array(z.string().min(1)).meta({example: ['예능 클립', '웃긴 모음']}),
});

/** GET /api/internal/youtube/seed-config 의 result. 검색어를 DB에서 관리할 때 사용한다. */
export const youtubeSeedConfigResultSchema = z
  .object({channels: z.array(youtubeSeedChannelSchema)})
  .meta({id: 'YoutubeSeedConfigResultDto'});

export type YoutubeSeedConfigResultDto = z.infer<typeof youtubeSeedConfigResultSchema>;
export type YoutubeSeedConfigResponseDto = ApiEnvelope<YoutubeSeedConfigResultDto>;

const youtubeSyncVideoSchema = videoSchema
  .pick({youtubeVideoId: true, title: true, thumbnailUrl: true, durationSeconds: true})
  .extend({
    publishedAt: z.iso.datetime({offset: true}).nullable().optional().meta({
      description: 'YouTube 공개 시각 (ISO 8601)',
      example: '2026-11-20T12:00:00Z',
    }),
    sourceYoutubeChannelId: z.string().min(1).max(64).nullable().optional().meta({
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
    channelNumber: z.number().int().min(1).max(9).meta({example: 1}),
    videos: z.array(youtubeSyncVideoSchema).min(1).meta({
      description: '조건에 맞는 후보가 없으면 요청 자체를 생략한다.',
    }),
  })
  .strict()
  .meta({id: 'YoutubeSyncRequestDto'});

export type YoutubeSyncRequestDto = z.infer<typeof youtubeSyncRequestSchema>;

const rejectedVideoSchema = z.object({
  youtubeVideoId: videoSchema.shape.youtubeVideoId.meta({example: 'YOUTUBE_VIDEO_ID'}),
  reason: z.string().min(1).meta({example: 'Video is not embeddable'}),
});

/** POST /api/internal/youtube/sync 의 result. */
export const youtubeSyncResultSchema = z
  .object({
    acceptedCount: z.number().int().nonnegative().meta({example: 1}),
    rejectedCount: z.number().int().nonnegative().meta({example: 0}),
    rejected: z.array(rejectedVideoSchema),
  })
  .meta({id: 'YoutubeSyncResultDto'});

export type YoutubeSyncResultDto = z.infer<typeof youtubeSyncResultSchema>;
export type YoutubeSyncResponseDto = ApiEnvelope<YoutubeSyncResultDto>;
