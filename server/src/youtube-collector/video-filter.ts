import type { DurationLimits, VideoDetail } from './collector.types.js';

const ISO_DURATION =
  /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

/**
 * YouTube 의 ISO 8601 재생시간(예: PT1H2M3S)을 초로 바꾼다.
 * 진행 중·예정된 라이브는 P0D 로 내려오며 0초가 된다. 형식이 틀리면 null.
 */
export function parseIsoDuration(value: string): number | null {
  const match = ISO_DURATION.exec(value);
  if (!match || value === 'P' || value.endsWith('T')) {
    return null;
  }
  const [weeks, days, hours, minutes, seconds] = match
    .slice(1)
    .map((part) => Number(part ?? 0));
  return (
    weeks * 604_800 + days * 86_400 + hours * 3_600 + minutes * 60 + seconds
  );
}

/** 외부 웹페이지 플레이어로 재생할 수 있는 상태인지. 기존 영상 재검증에 쓴다. */
export function isPlayable(video: VideoDetail): boolean {
  return video.embeddable && video.privacyStatus === 'public';
}

/** 새로 저장해도 되는 영상인지. 재생 가능하고 길이가 범위 안(경계 포함)이어야 한다. */
export function isEligible(
  video: VideoDetail,
  limits: DurationLimits,
): boolean {
  return (
    isPlayable(video) &&
    video.durationSeconds >= limits.minSeconds &&
    video.durationSeconds <= limits.maxSeconds
  );
}
