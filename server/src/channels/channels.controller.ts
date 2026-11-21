import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type RandomVideosResultDto,
  randomVideosResultSchema,
} from '../../../shared/index.js';
import { ErrorCodes } from '../common/exception/error-code.js';
import {
  ApiFailure,
  ApiSuccess,
} from '../common/swagger/api-envelope.decorator.js';
import { ChannelsService } from './channels.service.js';

@ApiTags('Channels')
@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get('random-videos')
  @ApiOperation({
    summary: '전체 채널의 랜덤 영상 조회',
    description: '모든 채널과 채널별 랜덤 영상 최대 10개를 반환합니다.',
  })
  @ApiSuccess(randomVideosResultSchema)
  @ApiFailure(ErrorCodes.INTERNAL_SERVER_ERROR)
  getRandomVideos(): Promise<RandomVideosResultDto> {
    return this.channelsService.getRandomVideos();
  }
}
