/** 내부 API 인증 헤더. 수집기가 보내고 SeedTokenGuard 가 확인한다. */
export const SEED_TOKEN_HEADER = 'X-Seed-Token';

/** Swagger 의 보안 스키마 이름. */
export const SEED_TOKEN_SECURITY = 'seed-token';

/** 저장할 영상 길이(초)의 기본값. 수집기와 서버가 같은 값을 쓴다. 10분 ~ 2시간. */
export const DEFAULT_MIN_DURATION_SECONDS = 600;
export const DEFAULT_MAX_DURATION_SECONDS = 7200;
