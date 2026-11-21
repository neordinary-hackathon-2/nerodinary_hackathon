import {z} from 'zod';
import type {ApiEnvelope} from './envelope.js';
import {channelSchema} from '../entities/channel.js';
import {videoSchema} from '../entities/video.js';

const randomVideoDtoSchema = videoSchema.pick({
  youtubeVideoId: true,
  title: true,
  thumbnailUrl: true,
  durationSeconds: true,
});

export const randomChannelVideosDtoSchema = z
  .object({
    channelCode: channelSchema.shape.code.meta({example: 'CH05'}),
    displayOrder: channelSchema.shape.displayOrder.meta({example: 1}),
    videos: z.array(randomVideoDtoSchema).max(10).meta({
      description: '채널별 랜덤 영상. 후보가 없으면 빈 배열이며 최대 10개.',
    }),
  })
  .meta({id: 'RandomChannelVideosDto'});

export type RandomChannelVideosDto = z.infer<typeof randomChannelVideosDtoSchema>;

/** GET /api/channels/random-videos 의 result. */
export const randomVideosResultSchema = z
  .object({
    channels: z.array(randomChannelVideosDtoSchema),
  })
  .meta({id: 'RandomVideosResultDto'});

export type RandomVideosResultDto = z.infer<typeof randomVideosResultSchema>;
export type RandomVideosResponseDto = ApiEnvelope<RandomVideosResultDto>;
