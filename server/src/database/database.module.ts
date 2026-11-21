import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { DrizzleModule } from '@nestjs/drizzle';
import { drizzle } from 'drizzle-orm/mysql2';
import { databaseConfig } from '../config/database.config.js';
import { DB_CASING } from './database.constants.js';
import * as schema from './schema/index.js';

/** DB 연결. 전역 모듈이라 어느 서비스에서든 @InjectDrizzle()로 주입받을 수 있다. */
@Module({
  imports: [
    DrizzleModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (config: ConfigType<typeof databaseConfig>) => ({
        drizzle,
        connection: config.connection,
        schema,
        mode: 'default' as const,
        casing: DB_CASING,
        logger: config.logging,
      }),
    }),
  ],
})
export class DatabaseModule {}
