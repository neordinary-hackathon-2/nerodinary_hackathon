import { ErrorCode } from './error-code.js';

/**
 * 서비스 계층에서 의도적으로 던지는 예외.
 * 사용: throw new BusinessException(ErrorCodes.NOT_FOUND);
 *       throw new BusinessException(ErrorCodes.NOT_FOUND, '해당 콘텐츠가 없습니다.');
 */
export class BusinessException extends Error {
  constructor(
    readonly errorCode: ErrorCode,
    message?: string,
    readonly detail: unknown = null,
  ) {
    super(message ?? errorCode.message);
    this.name = 'BusinessException';
  }
}
