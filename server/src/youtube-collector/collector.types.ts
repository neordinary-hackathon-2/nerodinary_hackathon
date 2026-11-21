import type {
  YoutubeSeedConfigResultDto,
  YoutubeSyncRequestDto,
} from '../youtube/youtube-internal.schema.js';

/**
 * 서버 내부 API 계약은 src/youtube/youtube-internal.schema.ts 가 원본이다.
 * 여기에는 그 계약에서 뽑은 타입과 수집기 안에서만 쓰는 타입을 둔다.
 */

/** seed-config 응답의 채널 한 건. */
export type SeedChannel = YoutubeSeedConfigResultDto['channels'][number];

/** sync 요청의 영상 한 건. */
export type SyncVideo = YoutubeSyncRequestDto['videos'][number];

/** videos.list 응답에서 수집기가 쓰는 값만 추린 것. */
export interface VideoDetail {
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  sourceYoutubeChannelId: string;
  sourceChannelTitle: string;
  publishedAt: string;
  embeddable: boolean;
  privacyStatus: string;
}

/** search.list 의 videoDuration 값. medium = 4~20분, long = 20분 초과. */
export type SearchDuration = 'medium' | 'long';

export interface DurationLimits {
  minSeconds: number;
  maxSeconds: number;
}
