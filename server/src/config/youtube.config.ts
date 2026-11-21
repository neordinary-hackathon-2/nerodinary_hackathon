import { registerAs } from '@nestjs/config';
import {
  DEFAULT_MAX_DURATION_SECONDS,
  DEFAULT_MIN_DURATION_SECONDS,
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
}));
