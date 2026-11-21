import { readFile } from 'node:fs/promises';
import {
  youtubeSeedConfigResultSchema,
  youtubeSyncResultSchema,
  type YoutubeSyncRequestDto,
  type YoutubeSyncResultDto,
} from '../youtube/youtube-internal.schema.js';
import { SEED_TOKEN_HEADER } from '../youtube/youtube.constants.js';
import type { SeedChannel } from './collector.types.js';
import type { FetchLike } from './youtube.client.js';

const REQUEST_TIMEOUT_MS = 15_000;

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

  async function call(path: string, init: RequestInit): Promise<unknown> {
    const response = await fetchFn(`${baseUrl}${path}`, {
      ...init,
      headers: {
        [SEED_TOKEN_HEADER]: options.token,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(
        `서버 ${path} 호출 실패 (${response.status})${await describeFailure(response)}`,
      );
    }
    return unwrap(await response.json().catch(() => null));
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
