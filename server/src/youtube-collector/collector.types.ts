import { z } from 'zod';

/**
 * 수집기와 서버 내부 API 사이의 계약.
 *
 * 서버의 channel/video 테이블과 내부 API가 아직 없어 수집기 쪽에서 가정한 형태다.
 * 서버 API가 만들어지면 이 파일을 실제 응답에 맞춘다.
 */
export const collectorChannelSchema = z.object({
  channelId: z.number().int(),
  /** 채널별 검색어. 비어 있으면(예: 0번 컬러바 채널) 검색하지 않는다. */
  seedKeywords: z.array(z.string().min(1)).default([]),
  /** 현재 활성 상태인 영상의 YouTube ID. 재검증 대상이다. */
  activeVideoIds: z.array(z.string().min(1)).default([]),
  /** 다시 등록하면 안 되는 영상(사람이 내린 영상 등)의 YouTube ID. */
  excludedVideoIds: z.array(z.string().min(1)).default([]),
});
export const collectorChannelsSchema = z.array(collectorChannelSchema);
export type CollectorChannel = z.infer<typeof collectorChannelSchema>;

/** videos.list 응답에서 수집기가 쓰는 값만 추린 것. */
export interface VideoDetail {
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  creatorChannelId: string;
  creatorChannelTitle: string;
  publishedAt: string;
  embeddable: boolean;
  privacyStatus: string;
}

/** 동기화 API로 보내는 영상 한 건. 판정에만 쓰는 상태 값은 보내지 않는다. */
export type SyncVideo = Omit<VideoDetail, 'embeddable' | 'privacyStatus'>;

export interface SyncRequest {
  channelId: number;
  /** 새로 추가할 영상과, 메타데이터를 갱신할 기존 활성 영상. */
  upserts: SyncVideo[];
  /** 더 이상 재생할 수 없어 비활성화할 영상의 YouTube ID. */
  deactivateVideoIds: string[];
}

/** search.list 의 videoDuration 값. medium = 4~20분, long = 20분 초과. */
export type SearchDuration = 'medium' | 'long';

export interface DurationLimits {
  minSeconds: number;
  maxSeconds: number;
}
