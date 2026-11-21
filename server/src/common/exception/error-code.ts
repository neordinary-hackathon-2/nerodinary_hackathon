import { HttpStatus } from '@nestjs/common';

export interface ErrorCode {
  readonly status: HttpStatus;
  readonly code: string;
  readonly message: string;
}

/**
 * 에러 코드 카탈로그.
 * 도메인 에러는 여기에 추가한다. 예) MEMBER_NOT_FOUND: { status: 404, code: 'MEMBER404', ... }
 */
export const ErrorCodes = {
  BAD_REQUEST: {
    status: HttpStatus.BAD_REQUEST,
    code: 'COMMON400',
    message: '잘못된 요청입니다.',
  },
  VALIDATION_FAILED: {
    status: HttpStatus.BAD_REQUEST,
    code: 'COMMON400_VALIDATION',
    message: '요청 값이 올바르지 않습니다.',
  },
  NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'COMMON404',
    message: '요청한 리소스를 찾을 수 없습니다.',
  },
  METHOD_NOT_ALLOWED: {
    status: HttpStatus.METHOD_NOT_ALLOWED,
    code: 'COMMON405',
    message: '허용되지 않은 메서드입니다.',
  },
  CONFLICT: {
    status: HttpStatus.CONFLICT,
    code: 'COMMON409',
    message: '이미 존재하는 리소스입니다.',
  },
  INTERNAL_SERVER_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'COMMON500',
    message: '서버 내부 오류가 발생했습니다.',
  },
} as const satisfies Record<string, ErrorCode>;
