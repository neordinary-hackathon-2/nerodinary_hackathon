import {z} from 'zod';
import type {ApiEnvelope} from './envelope.js';
import {channelSchema} from '../entities/channel.js';
import {videoSchema} from '../entities/video.js';

/** F1 채널 목록·F9 편성표 팝업에 표시할 채널 정보. */
export const channelListItemDtoSchema = z
  .object({
    channelNumber: channelSchema.shape.channelNumber,
    name: channelSchema.shape.name,
    slogan: channelSchema.shape.slogan,
  })
  .meta({id: 'ChannelListItemDto'});

export type ChannelListItemDto = z.infer<typeof channelListItemDtoSchema>;

export const channelListResultSchema = z
  .object({
    channels: z.array(channelListItemDtoSchema).max(10).meta({
      description: '등록된 0~9번 채널을 번호순으로 반환합니다. 시딩 전에는 빈 배열입니다.',
    }),
  })
  .meta({id: 'ChannelListResultDto'});

export type ChannelListResultDto = z.infer<typeof channelListResultSchema>;
export type ChannelListResponseDto = ApiEnvelope<ChannelListResultDto>;

const randomVideoDtoSchema = videoSchema.pick({
  youtubeVideoId: true,
  title: true,
  thumbnailUrl: true,
  durationSeconds: true,
});

export const randomChannelVideosDtoSchema = z
  .object({
    channelNumber: channelSchema.shape.channelNumber,
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
