import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { asc, eq, sql } from 'drizzle-orm';
import type { RandomVideosResultDto } from '../../../shared/index.js';
import type { Database } from '../database/database.types.js';
import { channels } from '../database/schema/channel.schema.js';
import { videos } from '../database/schema/video.schema.js';

@Injectable()
export class ChannelsService {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  async getRandomVideos(): Promise<RandomVideosResultDto> {
    const channelRows = await this.db
      .select({
        id: channels.id,
        channelNumber: channels.channelNumber,
      })
      .from(channels)
      .orderBy(asc(channels.channelNumber));

    const channelResults = await Promise.all(
      channelRows.map(async (channel) => {
        const channelVideos = await this.db
          .select({
            youtubeVideoId: videos.youtubeVideoId,
            title: videos.title,
            thumbnailUrl: videos.thumbnailUrl,
            durationSeconds: videos.durationSeconds,
          })
          .from(videos)
          .where(eq(videos.appChannelId, channel.id))
          .orderBy(sql`RAND()`)
          .limit(10);

        return {
          channelNumber: channel.channelNumber,
          videos: channelVideos,
        };
      }),
    );

    return {channels: channelResults};
  }
}
