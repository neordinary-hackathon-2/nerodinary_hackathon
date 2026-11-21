import { INestApplication, ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/exception/global-exception.filter.js';
import { ValidationException } from './common/exception/validation.exception.js';
import { ResponseInterceptor } from './common/response/response.interceptor.js';

export const GLOBAL_PREFIX = 'api';

/**
 * 전역 파이프/필터/인터셉터 구성.
 * main.ts와 e2e 테스트가 같은 구성을 쓰도록 한 곳에 모은다.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(GLOBAL_PREFIX);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 없는 필드는 제거
      forbidNonWhitelisted: true, // DTO에 없는 필드가 오면 400
      transform: true, // 쿼리스트링/파라미터를 DTO 타입으로 변환
      exceptionFactory: (errors) => new ValidationException(errors),
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());
}
