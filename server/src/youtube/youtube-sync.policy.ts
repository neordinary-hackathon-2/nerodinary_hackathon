import type {
  YoutubeSyncRequestDto,
  YoutubeSyncResultDto,
} from './youtube-internal.schema.js';

type SyncVideo = YoutubeSyncRequestDto['videos'][number];
type Rejected = YoutubeSyncResultDto['rejected'][number];

export interface DurationLimits {
  minSeconds: number;
  maxSeconds: number;
}

/** 저장할 수 없는 이유. 저장할 수 있으면 null. */
export function rejectionReason(
  video: SyncVideo,
  limits: DurationLimits,
): string | null {
  if (video.privacyStatus !== 'public') {
    return `공개 상태가 아닙니다 (${video.privacyStatus})`;
  }
  if (!video.isEmbeddable) {
    return '임베드할 수 없는 영상입니다';
  }
  if (
    video.durationSeconds < limits.minSeconds ||
    video.durationSeconds > limits.maxSeconds
  ) {
    return `길이가 허용 범위(${limits.minSeconds}~${limits.maxSeconds}초) 밖입니다 (${video.durationSeconds}초)`;
  }
  return null;
}

/**
 * 요청의 영상을 저장할 것과 제외할 것으로 나눈다.
 * 같은 영상 ID 가 여러 번 오면 마지막 것만 남긴다.
 */
export function partitionSyncVideos(
  videos: SyncVideo[],
  limits: DurationLimits,
): { accepted: SyncVideo[]; rejected: Rejected[] } {
  const accepted = new Map<string, SyncVideo>();
  const rejected = new Map<string, Rejected>();

  for (const video of videos) {
    const reason = rejectionReason(video, limits);
    if (reason) {
      accepted.delete(video.youtubeVideoId);
      rejected.set(video.youtubeVideoId, {
        youtubeVideoId: video.youtubeVideoId,
        reason,
      });
    } else {
      rejected.delete(video.youtubeVideoId);
      accepted.set(video.youtubeVideoId, video);
    }
  }
  return { accepted: [...accepted.values()], rejected: [...rejected.values()] };
}
