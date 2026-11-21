import { registerAs } from '@nestjs/config';
import {
  DEFAULT_MAX_DURATION_SECONDS,
  DEFAULT_MIN_DURATION_SECONDS,
  DEFAULT_TARGET_PER_CHANNEL,
} from '../youtube/youtube.constants.js';

export const youtubeConfig = registerAs('youtube', () => ({
  /** 내부 수집 API(/api/internal/youtube/*) 인증 토큰. */
  seedToken: process.env.SEED_TOKEN ?? '',
  minDurationSeconds: Number(
    process.env.MIN_DURATION_SECONDS ?? DEFAULT_MIN_DURATION_SECONDS,
  ),
  maxDurationSeconds: Number(
    process.env.MAX_DURATION_SECONDS ?? DEFAULT_MAX_DURATION_SECONDS,
  ),
  /** 채널당 유지할 영상 수. sync 처리 뒤 이 수를 넘는 영상은 오래된 것부터 지운다. */
  targetPerChannel: Number(
    process.env.TARGET_PER_CHANNEL ?? DEFAULT_TARGET_PER_CHANNEL,
  ),
}));
