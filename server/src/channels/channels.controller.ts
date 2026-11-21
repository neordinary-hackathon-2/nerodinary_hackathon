import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type ChannelListResultDto,
  type RandomVideosResultDto,
  channelListResultSchema,
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

  @Get()
  @ApiOperation({
    summary: '채널 편성표 조회',
    description:
      '요청값 없이 등록된 0~9번 채널의 번호, 카테고리명, 슬로건을 번호순으로 반환합니다.',
  })
  @ApiSuccess(channelListResultSchema, {
    description: '채널 편성표 조회 성공',
  })
  @ApiFailure(ErrorCodes.INTERNAL_SERVER_ERROR)
  getChannels(): Promise<ChannelListResultDto> {
    return this.channelsService.getChannels();
  }

  @Get('random-videos')
  @ApiOperation({
    summary: '전체 채널의 랜덤 영상 조회',
    description:
      '요청값 없이 모든 채널과 채널별 랜덤 영상 최대 10개를 반환합니다. 후보가 없으면 해당 채널의 videos는 빈 배열입니다.',
  })
  @ApiSuccess(randomVideosResultSchema, {
    description: '채널별 랜덤 영상 후보 조회 성공',
  })
  @ApiFailure(ErrorCodes.INTERNAL_SERVER_ERROR)
  getRandomVideos(): Promise<RandomVideosResultDto> {
    return this.channelsService.getRandomVideos();
  }
}
