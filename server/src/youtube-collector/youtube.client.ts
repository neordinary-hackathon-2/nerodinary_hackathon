import { z } from 'zod';
import type { SearchDuration, VideoDetail } from './collector.types.js';
import { parseIsoDuration } from './video-filter.js';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
/** search.list 의 maxResults, videos.list 의 id 개수 상한. */
const PAGE_SIZE = 50;
const REQUEST_TIMEOUT_MS = 15_000;
const QUOTA_REASONS = new Set(['quotaExceeded', 'dailyLimitExceeded']);

export type FetchLike = typeof fetch;

export class YoutubeApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'YoutubeApiError';
  }
}

/** 일일 할당량을 다 써서 더 호출해도 소용없는 오류인지. */
export function isQuotaError(error: unknown): boolean {
  return (
    error instanceof YoutubeApiError &&
    error.reason !== null &&
    QUOTA_REASONS.has(error.reason)
  );
}

export interface SearchQuery {
  query: string;
  duration: SearchDuration;
  pageToken: string | null;
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

export interface YoutubeClient {
  searchVideoIds(query: SearchQuery): Promise<SearchPage>;
  fetchVideoDetails(videoIds: string[]): Promise<VideoLookup>;
}

export interface YoutubeClientOptions {
  apiKey: string;
  regionCode: string;
  relevanceLanguage: string;
  fetchFn?: FetchLike;
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

  async function get(
    path: string,
    params: Record<string, string>,
  ): Promise<unknown> {
    const url = `${API_BASE}/${path}?${new URLSearchParams(params).toString()}`;
    // 키를 쿼리가 아닌 헤더로 보내 URL 이 로그에 남아도 노출되지 않게 한다.
    const response = await fetchFn(url, {
      headers: { 'X-Goog-Api-Key': options.apiKey },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body: unknown = await response.json().catch(() => null);
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
      );
    }
    return body;
  }

  return {
    async searchVideoIds({ query, duration, pageToken }) {
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
      const body = searchSchema.parse(await get('search', params));
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
