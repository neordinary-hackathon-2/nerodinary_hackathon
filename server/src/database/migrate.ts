import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { INestApplication, Logger } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { MIGRATIONS_FOLDER } from './database.constants.js';
import type { Database } from './database.types.js';

/**
 * drizzle/ 폴더의 마이그레이션 중 아직 적용되지 않은 것을 DB에 적용한다.
 * 실패하면 예외를 던져 서버가 뜨지 않게 한다. (스키마가 어긋난 채로 요청을 받지 않도록)
 */
export async function runMigrations(app: INestApplication): Promise<void> {
  const logger = new Logger('Migration');
  const migrationsFolder = resolve(MIGRATIONS_FOLDER);

  if (!existsSync(join(migrationsFolder, 'meta', '_journal.json'))) {
    logger.warn(`마이그레이션 없음 (${migrationsFolder}). 건너뜁니다.`);
    return;
  }

  const db = app.get<Database>(getDrizzleToken());
  await migrate(db, { migrationsFolder });
  logger.log('마이그레이션 적용 완료');
}
