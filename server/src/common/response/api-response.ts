import type { ApiEnvelope } from '../../../../shared/index.js';

/**
 * 모든 API가 공유하는 응답 봉투. (타입 정의는 레포 루트 shared/api/envelope.ts)
 * 성공: { isSuccess: true,  code: 'COMMON200', message, result }
 * 실패: { isSuccess: false, code: 'COMMON400', message, result: null | 상세 }
 */
export class ApiResponse<T> implements ApiEnvelope<T> {
  private constructor(
    readonly isSuccess: boolean,
    readonly code: string,
    readonly message: string,
    readonly result: T | null,
  ) {}

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
