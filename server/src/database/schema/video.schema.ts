import {
  datetime,
  index,
  int,
  mysqlTable,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
import type { Video } from '../../../../shared/entities/video.js';
import { AssertNoMismatch, EntityMismatch } from '../entity-check.js';
import { channels } from './channel.schema.js';
import { foreignId, primaryId, timestamps } from './columns.js';

export const videos = mysqlTable(
  'videos',
  {
    id: primaryId(),
    appChannelId: foreignId()
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    youtubeVideoId: varchar({ length: 32 }).notNull(),
    title: varchar({ length: 255 }).notNull(),
    thumbnailUrl: varchar({ length: 1000 }).notNull(),
    durationSeconds: int({ unsigned: true }).notNull(),
    publishedAt: datetime(),
    sourceYoutubeChannelId: varchar({ length: 64 }),
    sourceChannelTitle: varchar({ length: 255 }),
    lastRefreshedAt: datetime(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('videos_app_channel_youtube_video_uq').on(
      table.appChannelId,
      table.youtubeVideoId,
    ),
    index('videos_app_channel_id_idx').on(table.appChannelId),
  ],
);

type _VideoEntityCheck = AssertNoMismatch<
  EntityMismatch<typeof videos.$inferSelect, Video>
>;
