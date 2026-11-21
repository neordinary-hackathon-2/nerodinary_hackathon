import { defineConfig } from 'drizzle-kit';

// drizzle-kit은 .env만 자동으로 읽기 때문에, 앱과 같은 규칙(.env.<NODE_ENV>)으로 직접 읽는다.
try {
  process.loadEnvFile(`.env.${process.env.NODE_ENV ?? 'local'}`);
} catch {
  // 파일이 없으면 이미 주입된 환경변수를 사용한다. (generate는 DB 접속 없이도 동작)
}

export default defineConfig({
  dialect: 'mysql',
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'hackathon',
  },
});
