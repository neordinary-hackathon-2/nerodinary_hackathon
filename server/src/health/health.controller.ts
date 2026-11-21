import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ErrorCodes } from '../common/exception/error-code.js';
import {
  ApiFailure,
  ApiSuccess,
} from '../common/swagger/api-envelope.decorator.js';
import { HealthResponseDto } from './dto/health-response.dto.js';
import { HealthService } from './health.service.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: '서버 상태 확인',
    description:
      '서버와 DB 연결 상태를 반환합니다. 배포 후 헬스체크에 사용합니다.',
  })
  @ApiSuccess(HealthResponseDto)
  @ApiFailure(ErrorCodes.INTERNAL_SERVER_ERROR)
  check(): Promise<HealthResponseDto> {
    return this.healthService.check();
  }
}
