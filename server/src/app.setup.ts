import { INestApplication, StandardSchemaValidationPipe } from '@nestjs/common';
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
    // @Body({ schema }), @Query({ schema }), @Param('id', { schema }) 에 붙인 zod 스키마로 검증하고,
    // 스키마가 변환한 값(z.coerce 등)을 핸들러에 넘긴다.
    new StandardSchemaValidationPipe({
      exceptionFactory: (issues) => new ValidationException(issues),
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());
}
