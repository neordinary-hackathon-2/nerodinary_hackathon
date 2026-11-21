import {z} from 'zod';

/** DB와 서버에서 공유하는 YouTube 재생 후보 엔티티. */
export const videoSchema = z
  .object({
    id: z.number().int().positive().meta({example: 1}),
    appChannelId: z.number().int().positive().meta({example: 1}),
    youtubeVideoId: z.string().min(1).max(32).meta({example: 'YOUTUBE_VIDEO_ID'}),
    title: z.string().min(1).max(255).meta({example: '영상 제목'}),
    thumbnailUrl: z.string().url().max(1000).meta({
      example: 'https://i.ytimg.com/vi/YOUTUBE_VIDEO_ID/mqdefault.jpg',
    }),
    durationSeconds: z.number().int().positive().meta({example: 900}),
    publishedAt: z.string().nullable().meta({example: '2026-11-20T12:00:00.000Z'}),
    sourceYoutubeChannelId: z.string().max(64).nullable().meta({
      example: 'UC_CREATOR_CHANNEL_ID',
    }),
    sourceChannelTitle: z.string().max(255).nullable().meta({example: '원본 제작자 채널명'}),
    lastRefreshedAt: z.string().nullable().meta({example: '2026-11-21T08:00:00.000Z'}),
    createdAt: z.string().meta({example: '2026-11-21T08:00:00.000Z'}),
    updatedAt: z.string().meta({example: '2026-11-21T08:00:00.000Z'}),
  })
  .meta({id: 'Video'});

export type Video = z.infer<typeof videoSchema>;
