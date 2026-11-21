import { z } from 'zod';
import type { SearchDuration, VideoDetail } from './collector.types.js';
import {
  describeError,
  isNetworkError,
  parseRetryAfter,
  readJson,
  type RetryInfo,
  withRetry,
} from './retry.js';
import { parseIsoDuration } from './video-filter.js';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
/** search.list 의 maxResults, videos.list 의 id 개수 상한. */
const PAGE_SIZE = 50;
const REQUEST_TIMEOUT_MS = 15_000;
/**
 * 할당량·호출 한도 초과 사유.
 * search.list 의 일일 한도('Search Queries per day')는 429 rateLimitExceeded 로 온다(11.22 실측).
 */
const QUOTA_REASONS = new Set([
  'quotaExceeded',
  'dailyLimitExceeded',
  'rateLimitExceeded',
]);
const TOO_MANY_REQUESTS = 429;

export type FetchLike = typeof fetch;

export class YoutubeApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string | null,
    message: string,
    /** 응답의 Retry-After. 재시도 대기 시간으로 쓴다. */
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'YoutubeApiError';
  }
}

/**
 * 할당량·호출 한도를 넘어 더 호출해도 소용없는 오류인지.
 * 429 는 사유와 관계없이 한도 초과로 본다. 잘못된 키(400·403)와 달리 다음 실행에서 풀린다.
 */
export function isQuotaError(error: unknown): boolean {
  if (!(error instanceof YoutubeApiError)) {
    return false;
  }
  return (
    error.status === TOO_MANY_REQUESTS ||
    (error.reason !== null && QUOTA_REASONS.has(error.reason))
  );
}

/**
 * 다시 불러서 풀릴 수 있는 실패인지. 네트워크 오류·타임아웃과 5xx 만 해당한다.
 * 할당량 초과(429·403)와 잘못된 키(400·403)는 다시 불러도 같으므로 제외한다.
 */
export function isRetryableYoutubeError(error: unknown): boolean {
  if (isNetworkError(error)) {
    return true;
  }
  return error instanceof YoutubeApiError && error.status >= 500;
}

export interface SearchQuery {
  query: string;
  duration: SearchDuration;
  pageToken: string | null;
  /** 이 시각(ISO 8601) 이후에 공개된 영상만 찾는다. 없으면 공개 시각을 가리지 않는다. */
  publishedAfter?: string;
}

export interface SearchPage {
  videoIds: string[];
  nextPageToken: string | null;
}

export interface VideoLookup {
  /** 조회된 영상. 삭제·비공개 영상은 응답에 없으므로 여기에도 없다. */
  found: Map<string, VideoDetail>;
  /** 호출 자체가 실패해 상태를 알 수 없는 ID. "없는 영상"과 구분해야 한다. */
  failedIds: Set<string>;
}

export interface SearchHooks {
  /**
   * 검색을 다시 시도하기 직전에 부른다. false 면 재시도하지 않는다.
   * 검색은 호출마다 할당량을 크게 쓰므로, 수집기가 시도마다 예산을 차감할 때 쓴다.
   */
  beforeRetry?: (info: RetryInfo) => boolean;
}

export interface YoutubeClient {
  searchVideoIds(query: SearchQuery, hooks?: SearchHooks): Promise<SearchPage>;
  fetchVideoDetails(videoIds: string[]): Promise<VideoLookup>;
}

export interface YoutubeClientOptions {
  apiKey: string;
  regionCode: string;
  relevanceLanguage: string;
  fetchFn?: FetchLike;
  /** 재시도할 때 한 줄씩 남긴다. 검색 재시도는 수집기가 따로 남긴다. */
  log?: (message: string) => void;
  /** 테스트에서 실제로 기다리지 않도록 바꿔 끼운다. */
  sleep?: (ms: number) => Promise<void>;
}

const errorSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    errors: z.array(z.object({ reason: z.string().optional() })).optional(),
  }),
});

const searchSchema = z.object({
  items: z
    .array(z.object({ id: z.object({ videoId: z.string().optional() }) }))
    .default([]),
  nextPageToken: z.string().optional(),
});

const thumbnailSchema = z.object({ url: z.string() }).optional();
const thumbnailsSchema = z.object({
  medium: thumbnailSchema,
  high: thumbnailSchema,
  default: thumbnailSchema,
});

const videosSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: z.object({
          title: z.string(),
          publishedAt: z.string(),
          channelId: z.string(),
          channelTitle: z.string().default(''),
          thumbnails: thumbnailsSchema.optional(),
        }),
        contentDetails: z.object({ duration: z.string() }),
        status: z.object({
          embeddable: z.boolean().default(false),
          privacyStatus: z.string(),
        }),
      }),
    )
    .default([]),
});

/** medium 을 우선 쓰고, 없으면 다른 크기로 대신한다. 하나도 없으면 null. */
function pickThumbnail(
  thumbnails: z.infer<typeof thumbnailsSchema> | undefined,
): string | null {
  return (
    thumbnails?.medium?.url ??
    thumbnails?.high?.url ??
    thumbnails?.default?.url ??
    null
  );
}

export function createYoutubeClient(
  options: YoutubeClientOptions,
): YoutubeClient {
  const fetchFn = options.fetchFn ?? fetch;

  /** 일시적인 실패는 최대 3번까지 시도한다. */
  function get(
    path: string,
    params: Record<string, string>,
    beforeRetry?: (info: RetryInfo) => boolean,
  ): Promise<unknown> {
    return withRetry(() => getOnce(path, params), {
      isRetryable: isRetryableYoutubeError,
      sleep: options.sleep,
      beforeRetry:
        beforeRetry ??
        ((info) => {
          options.log?.(
            `YouTube ${path} 재시도 ${info.attempt + 1}/${info.attempts}: ${describeError(info.error)}`,
          );
          return true;
        }),
    });
  }

  async function getOnce(
    path: string,
    params: Record<string, string>,
  ): Promise<unknown> {
    const url = `${API_BASE}/${path}?${new URLSearchParams(params).toString()}`;
    // 키를 쿼리가 아닌 헤더로 보내 URL 이 로그에 남아도 노출되지 않게 한다.
    const response = await fetchFn(url, {
      headers: { 'X-Goog-Api-Key': options.apiKey },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await readJson(response);
    if (!response.ok) {
      const parsed = errorSchema.safeParse(body);
      const reason = parsed.success
        ? (parsed.data.error.errors?.[0]?.reason ?? null)
        : null;
      const detail = parsed.success ? parsed.data.error.message : undefined;
      throw new YoutubeApiError(
        response.status,
        reason,
        `YouTube ${path} 호출 실패 (${response.status}${reason ? `, ${reason}` : ''})${detail ? `: ${detail}` : ''}`,
        parseRetryAfter(response.headers.get('Retry-After')),
      );
    }
    return body;
  }

  return {
    async searchVideoIds(
      { query, duration, pageToken, publishedAfter },
      hooks,
    ) {
      const params: Record<string, string> = {
        part: 'snippet',
        type: 'video',
        q: query,
        regionCode: options.regionCode,
        relevanceLanguage: options.relevanceLanguage,
        videoEmbeddable: 'true',
        videoSyndicated: 'true',
        videoDuration: duration,
        maxResults: String(PAGE_SIZE),
        fields: 'items/id/videoId,nextPageToken',
      };
      if (pageToken) {
        params.pageToken = pageToken;
      }
      if (publishedAfter) {
        params.publishedAfter = publishedAfter;
      }
      const body = searchSchema.parse(
        await get('search', params, hooks?.beforeRetry),
      );
      return {
        videoIds: body.items.flatMap((item) =>
          item.id.videoId ? [item.id.videoId] : [],
        ),
        nextPageToken: body.nextPageToken ?? null,
      };
    },

    async fetchVideoDetails(videoIds) {
      const lookup: VideoLookup = { found: new Map(), failedIds: new Set() };
      const unique = [...new Set(videoIds)];

      for (let start = 0; start < unique.length; start += PAGE_SIZE) {
        const batch = unique.slice(start, start + PAGE_SIZE);
        try {
          const body = videosSchema.parse(
            await get('videos', {
              part: 'snippet,contentDetails,status',
              id: batch.join(','),
            }),
          );
          for (const item of body.items) {
            lookup.found.set(item.id, {
              youtubeVideoId: item.id,
              title: item.snippet.title,
              thumbnailUrl: pickThumbnail(item.snippet.thumbnails),
              durationSeconds:
                parseIsoDuration(item.contentDetails.duration) ?? 0,
              sourceYoutubeChannelId: item.snippet.channelId,
              sourceChannelTitle: item.snippet.channelTitle,
              publishedAt: item.snippet.publishedAt,
              embeddable: item.status.embeddable,
              privacyStatus: item.status.privacyStatus,
            });
          }
        } catch {
          // 실패한 배치는 "상태 모름"으로 남긴다. 호출 실패를 영상 삭제로 오인하면 안 된다.
          for (const id of batch) {
            lookup.failedIds.add(id);
          }
        }
      }
      return lookup;
    },
  };
}
