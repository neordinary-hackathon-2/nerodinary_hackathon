import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { BusinessException } from '../common/exception/business.exception.js';
import { ErrorCodes } from '../common/exception/error-code.js';
import { youtubeConfig } from '../config/youtube.config.js';
import type { Database } from '../database/database.types.js';
import { channels, videos } from '../database/schema/index.js';
import type {
  YoutubeSeedConfigResultDto,
  YoutubeSyncRequestDto,
  YoutubeSyncResultDto,
} from './youtube-internal.schema.js';
import { partitionSyncVideos } from './youtube-sync.policy.js';

@Injectable()
export class YoutubeSyncService {
  private readonly logger = new Logger(YoutubeSyncService.name);

  constructor(
    @InjectDrizzle() private readonly db: Database,
    @Inject(youtubeConfig.KEY)
    private readonly config: ConfigType<typeof youtubeConfig>,
  ) {}

  /** 채널별 검색어와 저장된 영상 ID. 채널이 없으면 빈 배열이다. */
  async getSeedConfig(): Promise<YoutubeSeedConfigResultDto> {
    const channelRows = await this.db
      .select({
        id: channels.id,
        channelNumber: channels.channelNumber,
        seedKeywords: channels.seedKeywords,
      })
      .from(channels)
      .orderBy(asc(channels.channelNumber));

    const videoRows = await this.db
      .select({
        appChannelId: videos.appChannelId,
        youtubeVideoId: videos.youtubeVideoId,
      })
      .from(videos);

    const storedByChannel = Map.groupBy(videoRows, (row) => row.appChannelId);

    return {
      channels: channelRows.map((channel) => ({
        channelNumber: channel.channelNumber,
        seedKeywords: channel.seedKeywords,
        storedVideoIds: (storedByChannel.get(channel.id) ?? []).map(
          (row) => row.youtubeVideoId,
        ),
      })),
    };
  }

  /**
   * 한 채널의 영상을 저장·갱신하고, 재생할 수 없게 된 영상을 지운다.
   * 저장 조건(공개·임베드·길이)은 수집기가 걸렀더라도 여기서 다시 확인한다.
   */
  async sync(request: YoutubeSyncRequestDto): Promise<YoutubeSyncResultDto> {
    const [channel] = await this.db
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.channelNumber, request.channelNumber))
      .limit(1);
    if (!channel) {
      throw new BusinessException(ErrorCodes.CHANNEL_NOT_FOUND);
    }

    const { accepted, rejected } = partitionSyncVideos(request.videos, {
      minSeconds: this.config.minDurationSeconds,
      maxSeconds: this.config.maxDurationSeconds,
    });
    const removedVideoIds = request.removedVideoIds ?? [];
    const now = new Date();

    await this.db.transaction(async (tx) => {
      // videos 에는 (채널, 영상) 중복을 막는 DB 제약이 없다. 같은 영상이 여러 채널에 들어갈 수 있고,
      // 한 채널 안의 중복은 여기서 "이미 있으면 갱신, 없으면 추가"로 막는다.
      const existingIds =
        accepted.length === 0
          ? new Set<string>()
          : new Set(
              (
                await tx
                  .select({ youtubeVideoId: videos.youtubeVideoId })
                  .from(videos)
                  .where(
                    and(
                      eq(videos.appChannelId, channel.id),
                      inArray(
                        videos.youtubeVideoId,
                        accepted.map((video) => video.youtubeVideoId),
                      ),
                    ),
                  )
              ).map((row) => row.youtubeVideoId),
            );

      const toInsert: (typeof videos.$inferInsert)[] = [];
      for (const video of accepted) {
        const metadata = {
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          durationSeconds: video.durationSeconds,
          publishedAt: video.publishedAt ? new Date(video.publishedAt) : null,
          sourceYoutubeChannelId: video.sourceYoutubeChannelId ?? null,
          sourceChannelTitle: video.sourceChannelTitle ?? null,
          lastRefreshedAt: now,
        };
        if (existingIds.has(video.youtubeVideoId)) {
          await tx
            .update(videos)
            .set(metadata)
            .where(
              and(
                eq(videos.appChannelId, channel.id),
                eq(videos.youtubeVideoId, video.youtubeVideoId),
              ),
            );
        } else {
          toInsert.push({
            appChannelId: channel.id,
            youtubeVideoId: video.youtubeVideoId,
            ...metadata,
          });
        }
      }
      if (toInsert.length > 0) {
        await tx.insert(videos).values(toInsert);
      }

      if (removedVideoIds.length > 0) {
        // 요청한 채널의 행만 지운다. 같은 영상이 다른 채널에 있어도 건드리지 않는다.
        await tx
          .delete(videos)
          .where(
            and(
              eq(videos.appChannelId, channel.id),
              inArray(videos.youtubeVideoId, removedVideoIds),
            ),
          );
      }
    });

    this.logger.log(
      `sync channel=${request.channelNumber} accepted=${accepted.length} rejected=${rejected.length} removed=${removedVideoIds.length}`,
    );

    return {
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
      rejected,
    };
  }
}
