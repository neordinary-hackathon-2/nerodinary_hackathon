import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { youtubeConfig } from '../config/youtube.config.js';
import { SeedTokenGuard } from './seed-token.guard.js';
import { YoutubeInternalController } from './youtube-internal.controller.js';
import { YoutubeSyncService } from './youtube-sync.service.js';

@Module({
  imports: [ConfigModule.forFeature(youtubeConfig)],
  controllers: [YoutubeInternalController],
  providers: [YoutubeSyncService, SeedTokenGuard],
})
export class YoutubeModule {}
