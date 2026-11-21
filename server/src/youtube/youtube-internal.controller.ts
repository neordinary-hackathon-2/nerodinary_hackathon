import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ErrorCodes } from '../common/exception/error-code.js';
import {
  ApiFailure,
  ApiSuccess,
} from '../common/swagger/api-envelope.decorator.js';
import { SeedTokenGuard } from './seed-token.guard.js';
import {
  type YoutubeSeedConfigResultDto,
  type YoutubeSyncRequestDto,
  type YoutubeSyncResultDto,
  youtubeSeedConfigResultSchema,
  youtubeSyncRequestSchema,
  youtubeSyncResultSchema,
} from './youtube-internal.schema.js';
import { YoutubeSyncService } from './youtube-sync.service.js';
import { SEED_TOKEN_SECURITY } from './youtube.constants.js';

@ApiTags('[내부용] YouTube 수집 · GitHub Actions 전용')
@ApiSecurity(SEED_TOKEN_SECURITY)
@UseGuards(SeedTokenGuard)
@Controller('internal/youtube')
export class YoutubeInternalController {
  constructor(private readonly youtubeSyncService: YoutubeSyncService) {}

  @Get('seed-config')
  @ApiOperation({
    summary: '수집 설정 조회',
    description:
      '서버 내부 GitHub Actions 수집기 전용 API입니다. 프론트엔드·앱에서 호출하지 않습니다. X-Seed-Token 헤더가 필요하며, 토큰이 없거나 올바르지 않으면 401을 반환합니다. 채널별 검색어와 저장된 영상 ID를 반환합니다.',
  })
  @ApiSuccess(youtubeSeedConfigResultSchema)
  @ApiFailure(ErrorCodes.UNAUTHORIZED, ErrorCodes.INTERNAL_SERVER_ERROR)
  getSeedConfig(): Promise<YoutubeSeedConfigResultDto> {
    return this.youtubeSyncService.getSeedConfig();
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '영상 저장·갱신·삭제',
    description:
      '서버 내부 GitHub Actions 수집기 전용 API입니다. 프론트엔드·앱에서 호출하지 않습니다. X-Seed-Token 헤더가 필요하며, 토큰이 없거나 올바르지 않으면 401을 반환합니다. 한 채널의 영상을 (채널, YouTube 영상 ID) 기준으로 저장하거나 갱신하고, removedVideoIds 의 영상을 그 채널에서 지웁니다. 공개·임베드·길이(10분~2시간) 조건에 맞지 않는 영상은 저장하지 않고 rejected 로 돌려줍니다. 저장 뒤 채널당 유지 개수(기본 100개)를 넘으면 마지막으로 재확인한 지 오래된 영상부터 지우고 그 수를 evictedCount 로 돌려줍니다.',
  })
  @ApiSuccess(youtubeSyncResultSchema)
  @ApiFailure(
    ErrorCodes.BAD_REQUEST,
    ErrorCodes.VALIDATION_FAILED,
    ErrorCodes.UNAUTHORIZED,
    ErrorCodes.CHANNEL_NOT_FOUND,
    ErrorCodes.INTERNAL_SERVER_ERROR,
  )
  sync(
    @Body({ schema: youtubeSyncRequestSchema }) dto: YoutubeSyncRequestDto,
  ): Promise<YoutubeSyncResultDto> {
    return this.youtubeSyncService.sync(dto);
  }
}
