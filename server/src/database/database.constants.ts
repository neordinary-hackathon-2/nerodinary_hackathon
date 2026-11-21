/** 컬럼 이름 규칙. TS에서는 camelCase, DB에서는 snake_case. drizzle.config.ts와 같아야 한다. */
export const DB_CASING = 'snake_case' as const;

/** drizzle-kit generate가 만든 마이그레이션 폴더 (실행 위치 기준). */
export const MIGRATIONS_FOLDER = 'drizzle';
