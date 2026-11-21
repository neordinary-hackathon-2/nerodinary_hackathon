import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'UP', description: '서버 상태' })
  status: 'UP';

  @ApiProperty({
    example: 'UP',
    enum: ['UP', 'DOWN'],
    description: 'DB 연결 상태',
  })
  database: 'UP' | 'DOWN';

  @ApiProperty({ example: '2026-11-21T08:00:00.000Z' })
  timestamp: string;
}
