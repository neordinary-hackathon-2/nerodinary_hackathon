import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  connection: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    connectionLimit: 10,
    charset: 'utf8mb4',
    timezone: 'Z',
  },
  logging: process.env.DB_LOGGING === 'true',
  // true면 서버 시작 시 drizzle/ 폴더의 마이그레이션을 DB에 적용한다.
  migrateOnStart: process.env.DB_MIGRATE_ON_START === 'true',
}));
