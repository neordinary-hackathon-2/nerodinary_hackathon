import { ApiProperty } from '@nestjs/swagger';

/**
 * 모든 API가 공유하는 응답 봉투.
 * 성공: { isSuccess: true,  code: 'COMMON200', message, result }
 * 실패: { isSuccess: false, code: 'COMMON400', message, result: null | 상세 }
 */
export class ApiResponse<T> {
  @ApiProperty({ example: true })
  isSuccess: boolean;

  @ApiProperty({ example: 'COMMON200' })
  code: string;

  @ApiProperty({ example: '요청에 성공했습니다.' })
  message: string;

  result: T | null;

  private constructor(
    isSuccess: boolean,
    code: string,
    message: string,
    result: T | null,
  ) {
    this.isSuccess = isSuccess;
    this.code = code;
    this.message = message;
    this.result = result;
  }

  static success<T>(code: string, message: string, result: T): ApiResponse<T> {
    return new ApiResponse(true, code, message, result ?? null);
  }

  static failure<T = null>(
    code: string,
    message: string,
    result: T | null = null,
  ): ApiResponse<T> {
    return new ApiResponse(false, code, message, result);
  }
}
