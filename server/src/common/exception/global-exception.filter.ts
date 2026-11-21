import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiResponse } from '../response/api-response.js';
import { BusinessException } from './business.exception.js';
import { ErrorCode, ErrorCodes } from './error-code.js';
import { ValidationException } from './validation.exception.js';

interface ErrorBody {
  status: number;
  code: string;
  message: string;
  detail: unknown;
}

const STATUS_TO_ERROR_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCodes.BAD_REQUEST,
  [HttpStatus.NOT_FOUND]: ErrorCodes.NOT_FOUND,
  [HttpStatus.METHOD_NOT_ALLOWED]: ErrorCodes.METHOD_NOT_ALLOWED,
  [HttpStatus.CONFLICT]: ErrorCodes.CONFLICT,
};

/**
 * 전역 예외 처리. 모든 예외를 공통 응답 봉투로 변환한다.
 * - ValidationException : 400 + 필드별 오류 목록
 * - BusinessException   : ErrorCode에 정의된 상태 코드
 * - HttpException       : Nest 기본 예외 (잘못된 JSON, 없는 경로, 파라미터 타입 오류 등)
 * - 그 외               : 500 (내부 메시지는 응답에 노출하지 않고 로그로만 남긴다)
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const body = this.toErrorBody(exception);
    this.log(exception, request, body);

    response
      .status(body.status)
      .json(ApiResponse.failure(body.code, body.message, body.detail));
  }

  private toErrorBody(exception: unknown): ErrorBody {
    if (exception instanceof ValidationException) {
      const { status, code, message } = ErrorCodes.VALIDATION_FAILED;
      return { status, code, message, detail: exception.fieldErrors };
    }

    if (exception instanceof BusinessException) {
      const { status, code } = exception.errorCode;
      return {
        status,
        code,
        message: exception.message,
        detail: exception.detail,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status < HttpStatus.INTERNAL_SERVER_ERROR) {
        const known = STATUS_TO_ERROR_CODE[status];
        return {
          status,
          code: known?.code ?? `COMMON${status}`,
          message: known?.message ?? exception.message,
          detail: null,
        };
      }
    }

    const { status, code, message } = ErrorCodes.INTERNAL_SERVER_ERROR;
    return { status, code, message, detail: null };
  }

  private log(exception: unknown, request: Request, body: ErrorBody): void {
    const summary = `${request.method} ${request.originalUrl} -> ${body.status} ${body.code}`;

    if (body.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        summary,
        exception instanceof Error ? exception.stack : String(exception),
      );
      return;
    }
    const reason = exception instanceof Error ? exception.message : '';
    this.logger.warn(`${summary} (${reason})`);
  }
}
