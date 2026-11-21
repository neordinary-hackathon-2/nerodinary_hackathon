import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, Observable } from 'rxjs';
import { ApiResponse } from './api-response.js';

/**
 * 컨트롤러가 반환한 값을 공통 응답 봉투로 감싼다.
 * 컨트롤러/서비스는 순수 데이터만 반환하면 된다.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        const created = response.statusCode === HttpStatus.CREATED;
        return ApiResponse.success(
          created ? 'COMMON201' : 'COMMON200',
          created ? '생성에 성공했습니다.' : '요청에 성공했습니다.',
          data,
        );
      }),
    );
  }
}
