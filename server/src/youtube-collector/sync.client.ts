import { readFile } from 'node:fs/promises';
import {
  collectorChannelsSchema,
  type CollectorChannel,
  type SyncRequest,
} from './collector.types.js';
import type { FetchLike } from './youtube.client.js';

const REQUEST_TIMEOUT_MS = 15_000;

/** 수집기가 서버에 기대하는 두 가지 동작. */
export interface CollectorServer {
  fetchChannels(): Promise<CollectorChannel[]>;
  sync(request: SyncRequest): Promise<void>;
}

export interface SyncClientOptions {
  /** 서버 API 주소. 예: https://example.com/api */
  baseUrl: string;
  token: string;
  fetchFn?: FetchLike;
}

/** 서버 응답 봉투({ isSuccess, code, message, result })에서 result 를 꺼낸다. */
function unwrap(body: unknown): unknown {
  return typeof body === 'object' && body !== null && 'result' in body
    ? body.result
    : body;
}

export function createSyncClient(options: SyncClientOptions): CollectorServer {
  const fetchFn = options.fetchFn ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, '');

  async function call(path: string, init: RequestInit): Promise<unknown> {
    const response = await fetchFn(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`서버 ${path} 호출 실패 (${response.status})`);
    }
    return unwrap(await response.json().catch(() => null));
  }

  return {
    async fetchChannels() {
      return collectorChannelsSchema.parse(
        await call('/internal/youtube/channels', { method: 'GET' }),
      );
    },
    async sync(request) {
      await call('/internal/youtube/sync', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },
  };
}

/**
 * 서버 API 없이 로컬 JSON 파일에서 채널 설정을 읽는다. 실측(dry-run)용이다.
 * 보낼 서버가 없으므로 sync 는 항상 실패한다.
 */
export function createFileChannelSource(filePath: string): CollectorServer {
  return {
    async fetchChannels() {
      const raw: unknown = JSON.parse(await readFile(filePath, 'utf8'));
      return collectorChannelsSchema.parse(raw);
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
