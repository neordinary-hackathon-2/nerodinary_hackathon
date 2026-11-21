import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './config/app.config.js';
import { databaseConfig } from './config/database.config.js';
import { validateEnv } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { ChannelsModule } from './channels/channels.module.js';
import { YoutubeModule } from './youtube/youtube.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // NODE_ENV에 맞는 파일을 먼저 읽는다. (.env.local / .env.production)
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'local'}`, '.env'],
      load: [appConfig, databaseConfig],
      validate: validateEnv,
    }),
    DatabaseModule,
    HealthModule,
    ChannelsModule,
    YoutubeModule,
  ],
})
export class AppModule {}
