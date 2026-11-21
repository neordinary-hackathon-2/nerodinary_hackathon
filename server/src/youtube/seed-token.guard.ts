import { createHash, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request } from 'express';
import { BusinessException } from '../common/exception/business.exception.js';
import { ErrorCodes } from '../common/exception/error-code.js';
import { youtubeConfig } from '../config/youtube.config.js';
import { SEED_TOKEN_HEADER } from './youtube.constants.js';

const digest = (value: string) => createHash('sha256').update(value).digest();

/** 길이가 달라도 비교 시간이 같도록 해시끼리 비교한다. */
function matches(given: string, expected: string): boolean {
  return timingSafeEqual(digest(given), digest(expected));
}

/** 내부 수집 API 를 X-Seed-Token 헤더로 보호한다. 토큰이 없거나 다르면 401. */
@Injectable()
export class SeedTokenGuard implements CanActivate {
  constructor(
    @Inject(youtubeConfig.KEY)
    private readonly config: ConfigType<typeof youtubeConfig>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const given = request.header(SEED_TOKEN_HEADER);
    const expected = this.config.seedToken;

    // 서버에 토큰이 설정되지 않았으면 어떤 값도 통과시키지 않는다.
    if (!given || !expected || !matches(given, expected)) {
      throw new BusinessException(ErrorCodes.UNAUTHORIZED);
    }
    return true;
  }
}
