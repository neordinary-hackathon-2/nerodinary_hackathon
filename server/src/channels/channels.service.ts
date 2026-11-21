import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { ResilienceService, type ResiliencePolicy } from '@nestjs/resilience';
import { asc, eq, sql } from 'drizzle-orm';
import type {
  ChannelListResultDto,
  RandomVideosResultDto,
} from '../../../shared/index.js';
import type { Database } from '../database/database.types.js';
import { isTransientDatabaseError } from '../database/database-retry.js';
import { channels } from '../database/schema/channel.schema.js';
import { videos } from '../database/schema/video.schema.js';

@Injectable()
export class ChannelsService {
  private readonly databaseReadPolicy: ResiliencePolicy;

  constructor(
    @InjectDrizzle() private readonly db: Database,
    resilience: ResilienceService,
  ) {
    this.databaseReadPolicy = resilience.create(
      {
        retry: {
          attempts: 2,
          backoff: { delay: '100ms', factor: 1, maxDelay: '100ms', jitter: 'none' },
          retryIf: isTransientDatabaseError,
        },
      },
      'channels-database-read',
    );
  }

  async getChannels(): Promise<ChannelListResultDto> {
    return this.databaseReadPolicy.execute(async () => {
      const channelRows = await this.db
        .select({
          channelNumber: channels.channelNumber,
          name: channels.name,
          slogan: channels.slogan,
        })
        .from(channels)
        .orderBy(asc(channels.channelNumber));

      return {channels: channelRows};
    });
  }

  async getRandomVideos(): Promise<RandomVideosResultDto> {
    return this.databaseReadPolicy.execute(async () => {
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
    });
  }
}
