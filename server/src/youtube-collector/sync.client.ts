import { readFile } from 'node:fs/promises';
import {
  youtubeSeedConfigResultSchema,
  youtubeSyncResultSchema,
  type YoutubeSyncRequestDto,
  type YoutubeSyncResultDto,
} from '../youtube/youtube-internal.schema.js';
import { SEED_TOKEN_HEADER } from '../youtube/youtube.constants.js';
import type { SeedChannel } from './collector.types.js';
import {
  describeError,
  isNetworkError,
  parseRetryAfter,
  readJson,
  withRetry,
} from './retry.js';
import type { FetchLike } from './youtube.client.js';

const REQUEST_TIMEOUT_MS = 15_000;

/** 서버가 성공이 아닌 상태 코드로 응답했다. */
export class ServerApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** 응답의 Retry-After. 재시도 대기 시간으로 쓴다. */
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ServerApiError';
  }
}

/**
 * 읽기 요청(seed-config)을 다시 보낼 실패인지. 네트워크 오류·타임아웃, 429, 5xx.
 * 읽기만 하므로 몇 번을 다시 보내도 서버 상태가 바뀌지 않는다.
 */
export function isRetryableServerError(error: unknown): boolean {
  if (isNetworkError(error)) {
    return true;
  }
  return (
    error instanceof ServerApiError &&
    (error.status === 429 || error.status >= 500)
  );
}

/** 앱이 직접 돌려준 실패라 sync 트랜잭션이 커밋되지 않았다고 볼 수 있는 상태 코드. */
const WRITE_RETRYABLE_STATUSES = new Set([429, 500, 503]);

/**
 * 쓰기 요청(sync)을 다시 보낼 실패인지. 서버가 요청을 처리하지 않았거나 롤백한 경우만 해당한다.
 * - 다시 보냄: 연결 실패(`fetch failed`), 앱의 500(전역 예외 필터, 트랜잭션 롤백 뒤 응답)·503·429.
 * - 다시 보내지 않음: 타임아웃, 본문 수신 중 끊김(`terminated`), 프록시의 502·504.
 *   이때는 서버 트랜잭션이 아직 돌고 있거나 이미 커밋됐을 수 있다. 다시 보내면 같은 채널의
 *   sync 가 겹쳐 유지 개수 정리(축출)가 경합하거나, 이미 축출된 영상이 새 영상으로 다시 들어가
 *   엉뚱한 영상이 축출된다(0006 참고). 그 채널은 실패로 남기고 다음 실행이 다시 처리한다.
 */
export function isRetryableWriteError(error: unknown): boolean {
  if (error instanceof ServerApiError) {
    return WRITE_RETRYABLE_STATUSES.has(error.status);
  }
  return error instanceof TypeError && error.message === 'fetch failed';
}

/** 수집기가 서버에 기대하는 두 가지 동작. */
export interface CollectorServer {
  fetchChannels(): Promise<SeedChannel[]>;
  sync(request: YoutubeSyncRequestDto): Promise<YoutubeSyncResultDto>;
}

export interface SyncClientOptions {
  /** 서버 API 주소. 예: https://example.com/api */
  baseUrl: string;
  /** 내부 API 인증 토큰. X-Seed-Token 헤더로 보낸다. */
  token: string;
  fetchFn?: FetchLike;
  /** 재시도할 때 한 줄씩 남긴다. */
  log?: (message: string) => void;
  /** 테스트에서 실제로 기다리지 않도록 바꿔 끼운다. */
  sleep?: (ms: number) => Promise<void>;
}

/** 서버 응답 봉투({ isSuccess, code, message, result })에서 result 를 꺼낸다. */
function unwrap(body: unknown): unknown {
  return typeof body === 'object' && body !== null && 'result' in body
    ? body.result
    : body;
}

/**
 * 실패 응답 봉투에서 code·message·검증 필드 오류를 뽑아 한 줄로 만든다.
 * GitHub Actions 로그만으로 원인을 알 수 있어야 한다. 본문이 JSON 이 아니면 빈 문자열.
 */
async function describeFailure(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body !== 'object' || body === null) {
    return '';
  }
  const envelope = body as {
    code?: unknown;
    message?: unknown;
    result?: unknown;
  };
  const parts: string[] = [];
  if (typeof envelope.code === 'string') {
    parts.push(envelope.code);
  }
  if (typeof envelope.message === 'string') {
    parts.push(envelope.message);
  }
  // 검증 실패(COMMON400)의 result 는 [{ field, reasons }] 다.
  if (Array.isArray(envelope.result)) {
    for (const item of envelope.result as {
      field?: unknown;
      reasons?: unknown;
    }[]) {
      if (typeof item?.field === 'string' && Array.isArray(item.reasons)) {
        parts.push(`${item.field}: ${item.reasons.join(', ')}`);
      }
    }
  }
  return parts.length > 0 ? ` — ${parts.join(' / ')}` : '';
}

export function createSyncClient(options: SyncClientOptions): CollectorServer {
  const fetchFn = options.fetchFn ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, '');

  /**
   * 일시적인 실패는 최대 3번까지 보낸다.
   * 읽기(GET)와 쓰기(POST sync)는 다시 보낼 실패의 범위가 다르다(isRetryableWriteError 참고).
   */
  function call(path: string, init: RequestInit): Promise<unknown> {
    return withRetry(() => callOnce(path, init), {
      isRetryable:
        init.method === 'GET' ? isRetryableServerError : isRetryableWriteError,
      sleep: options.sleep,
      beforeRetry: (info) => {
        options.log?.(
          `서버 ${path} 재시도 ${info.attempt + 1}/${info.attempts}: ${describeError(info.error)}`,
        );
        return true;
      },
    });
  }

  async function callOnce(path: string, init: RequestInit): Promise<unknown> {
    const response = await fetchFn(`${baseUrl}${path}`, {
      ...init,
      headers: {
        [SEED_TOKEN_HEADER]: options.token,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new ServerApiError(
        response.status,
        `서버 ${path} 호출 실패 (${response.status})${await describeFailure(response)}`,
        parseRetryAfter(response.headers.get('Retry-After')),
      );
    }
    return unwrap(await readJson(response));
  }

  return {
    async fetchChannels() {
      const result = youtubeSeedConfigResultSchema.parse(
        await call('/internal/youtube/seed-config', { method: 'GET' }),
      );
      return result.channels;
    },
    async sync(request) {
      return youtubeSyncResultSchema.parse(
        await call('/internal/youtube/sync', {
          method: 'POST',
          body: JSON.stringify(request),
        }),
      );
    },
  };
}

/**
 * 서버 API 없이 로컬 JSON 파일에서 채널 설정을 읽는다. 실측(dry-run)용이다.
 * 파일은 seed-config 의 result 와 같은 형태({ channels: [...] })다.
 * 보낼 서버가 없으므로 sync 는 항상 실패한다.
 */
export function createFileChannelSource(filePath: string): CollectorServer {
  return {
    async fetchChannels() {
      const raw: unknown = JSON.parse(await readFile(filePath, 'utf8'));
      return youtubeSeedConfigResultSchema.parse(raw).channels;
    },
    sync() {
      return Promise.reject(
        new Error(
          '채널 파일 모드에서는 동기화할 수 없습니다. --dry-run 으로 실행하세요.',
        ),
      );
    },
  };
}
