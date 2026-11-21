/** 내부 API 인증 헤더. 수집기가 보내고 SeedTokenGuard 가 확인한다. */
export const SEED_TOKEN_HEADER = 'X-Seed-Token';

/** Swagger 의 보안 스키마 이름. */
export const SEED_TOKEN_SECURITY = 'seed-token';

/** 저장할 영상 길이(초)의 기본값. 수집기와 서버가 같은 값을 쓴다. 10분 ~ 2시간. */
export const DEFAULT_MIN_DURATION_SECONDS = 600;
export const DEFAULT_MAX_DURATION_SECONDS = 7200;

/**
 * 채널당 유지할 영상 수의 기본값. 수집기와 서버가 같은 값을 쓴다.
 * 수집기는 이만큼 채우고, 서버는 이 수를 넘는 영상을 저장된 지 오래된 것부터 지운다.
 */
export const DEFAULT_TARGET_PER_CHANNEL = 100;
