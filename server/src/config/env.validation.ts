import { z } from 'zod';
import {
  DEFAULT_MAX_DURATION_SECONDS,
  DEFAULT_MIN_DURATION_SECONDS,
} from '../youtube/youtube.constants.js';

export const ENVIRONMENTS = ['local', 'production', 'test'] as const;

const booleanFlag = z.enum(['true', 'false']).default('false');

const envSchema = z.object({
  NODE_ENV: z.enum(ENVIRONMENTS).default('local'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGINS: z.string().default('*'),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().default(3306),
  DB_USERNAME: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_DATABASE: z.string().min(1),
  DB_MIGRATE_ON_START: booleanFlag,
  DB_LOGGING: booleanFlag,

  // 내부 수집 API(/api/internal/youtube/*) 인증 토큰. 없으면 서버가 뜨지 않는다.
  SEED_TOKEN: z.string().min(16),
  MIN_DURATION_SECONDS: z.coerce.number().int().positive().optional(),
  MAX_DURATION_SECONDS: z.coerce.number().int().positive().optional(),
  // 채널당 유지할 영상 수. 낮추면 다음 수집 때 초과분이 지워진다.
  TARGET_PER_CHANNEL: z.coerce.number().int().positive().optional(),
});

/**
 * 부팅 시 환경변수를 검증한다. 필수 값이 없거나 형식이 틀리면 즉시 실패시켜
 * 잘못된 설정으로 서버가 뜨는 것을 막는다.
 */
export function validateEnv(config: Record<string, unknown>) {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`환경변수 설정이 올바르지 않습니다.\n${details}`);
  }

  // 한쪽만 설정해도 기본값과 비교한다. min > max 면 모든 영상이 거부되므로 부팅을 막는다.
  // 수집기(youtube-collector/main.ts)도 같은 검증을 한다.
  const env = parsed.data;
  const minDuration = env.MIN_DURATION_SECONDS ?? DEFAULT_MIN_DURATION_SECONDS;
  const maxDuration = env.MAX_DURATION_SECONDS ?? DEFAULT_MAX_DURATION_SECONDS;
  if (minDuration > maxDuration) {
    throw new Error(
      'MIN_DURATION_SECONDS 가 MAX_DURATION_SECONDS 보다 큽니다.',
    );
  }

  return config;
}
