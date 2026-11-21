/**
 * 일시적인 실패(네트워크 오류, 타임아웃, 5xx)만 짧게 다시 시도한다.
 * 잘못된 키·할당량 초과·검증 오류처럼 다시 불러도 같은 실패는 재시도하지 않는다.
 * 설계: server/docs/decisions/0006-collector-retry.md
 */

/** 재시도 대기 시간을 정해 주는 오류. 서버가 Retry-After 를 준 경우에 쓴다. */
export interface RetryAfterHint {
  readonly retryAfterMs?: number;
}

export interface RetryInfo {
  /** 방금 실패한 시도 번호(1부터). */
  attempt: number;
  /** 최대 시도 횟수. */
  attempts: number;
  /** 다음 시도 전 기다릴 시간. */
  delayMs: number;
  error: unknown;
}

export interface RetryOptions {
  /** 첫 시도를 포함한 최대 시도 횟수. */
  attempts?: number;
  /** 첫 재시도 전 대기 시간. 이후 두 배씩 늘린다. */
  baseDelayMs?: number;
  /** 이 오류를 다시 시도할지. */
  isRetryable: (error: unknown) => boolean;
  /**
   * 타임아웃(isTimeoutError)은 최대 몇 번까지 다시 시도할지. 기본 1.
   * 타임아웃은 한 번에 15초를 쓰므로 횟수를 따로 줄여 실행 시간을 묶는다.
   * 0 이면 타임아웃은 재시도하지 않는다(요청이 서버에서 아직 처리 중일 수 있는 쓰기 요청).
   */
  timeoutRetries?: number;
  /**
   * 재시도 직전에 부른다. false 를 돌려주면 재시도하지 않고 마지막 오류를 던진다.
   * 호출 예산을 시도마다 차감하는 쪽(검색)이 쓴다.
   */
  beforeRetry?: (info: RetryInfo) => boolean;
  /** 테스트에서 실제로 기다리지 않도록 바꿔 끼운다. */
  sleep?: (ms: number) => Promise<void>;
  /** 0 이상 1 미만. 테스트에서 고정한다. */
  random?: () => number;
}

export const DEFAULT_ATTEMPTS = 3;
export const DEFAULT_BASE_DELAY_MS = 1_000;
export const DEFAULT_TIMEOUT_RETRIES = 1;
const MAX_JITTER_MS = 500;
/** 서버가 너무 긴 Retry-After 를 줘도 이 이상은 기다리지 않는다. */
export const MAX_RETRY_AFTER_MS = 10_000;

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const sleep = options.sleep ?? realSleep;
  const random = options.random ?? Math.random;
  const timeoutRetries = options.timeoutRetries ?? DEFAULT_TIMEOUT_RETRIES;
  let timeoutsRetried = 0;

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= attempts || !options.isRetryable(error)) {
        throw error;
      }
      if (isTimeoutError(error)) {
        if (timeoutsRetried >= timeoutRetries) {
          throw error;
        }
        timeoutsRetried += 1;
      }
      const delayMs = retryDelayMs(error, attempt, baseDelayMs, random);
      if (
        options.beforeRetry &&
        !options.beforeRetry({ attempt, attempts, delayMs, error })
      ) {
        throw error;
      }
      await sleep(delayMs);
    }
  }
}

/** Retry-After 가 있으면 그 값(상한 10초), 없으면 1초·2초…에 0~500ms 를 더한다. */
function retryDelayMs(
  error: unknown,
  attempt: number,
  baseDelayMs: number,
  random: () => number,
): number {
  const hinted = (error as RetryAfterHint | null)?.retryAfterMs;
  if (typeof hinted === 'number' && hinted >= 0) {
    return Math.min(hinted, MAX_RETRY_AFTER_MS);
  }
  return (
    baseDelayMs * 2 ** (attempt - 1) + Math.floor(random() * MAX_JITTER_MS)
  );
}

/** 로그에 남길 한 줄짜리 오류 설명. */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 15초 타임아웃(AbortSignal.timeout)으로 요청이나 본문 읽기가 끊긴 경우. */
export function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}

/**
 * Node fetch(undici)가 네트워크 실패를 알리는 TypeError 메시지.
 * 'fetch failed' 는 연결·DNS 실패, 'terminated' 는 본문을 받다가 연결이 끊긴 경우다.
 */
const NETWORK_TYPE_ERROR_MESSAGES = new Set(['fetch failed', 'terminated']);

/**
 * 네트워크 실패(연결 끊김, DNS 실패, 본문 수신 중 끊김)나 타임아웃.
 * 응답을 받은 뒤의 오류(상태 코드, 본문 형식)는 여기 해당하지 않는다.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // 코드 버그로 생긴 다른 TypeError 까지 재시도하지 않도록 메시지로 좁힌다.
    return NETWORK_TYPE_ERROR_MESSAGES.has(error.message);
  }
  return isTimeoutError(error);
}

/**
 * 응답 본문을 JSON 으로 읽는다. JSON 이 아니면 null 을 돌려준다.
 * 본문을 받다가 끊기거나 타임아웃이 난 경우는 삼키지 않고 던져서 재시도 판단에 맡긴다.
 */
export async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
}

/** Retry-After 헤더(초 단위)를 밀리초로 바꾼다. 날짜 형식이나 잘못된 값은 무시한다. */
export function parseRetryAfter(header: string | null): number | undefined {
  if (header === null || !/^\d+$/.test(header.trim())) {
    return undefined;
  }
  return Number(header.trim()) * 1_000;
}
