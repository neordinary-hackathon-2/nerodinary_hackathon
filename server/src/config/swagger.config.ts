import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  SEED_TOKEN_HEADER,
  SEED_TOKEN_SECURITY,
} from '../youtube/youtube.constants.js';

export const SWAGGER_PATH = 'docs';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Ne(o)rdinary Hackathon API')
    .setDescription(
      [
        '모든 응답은 `{ isSuccess, code, message, result }` 형태입니다.',
        '- 성공: `COMMON200`(조회·수정·삭제), `COMMON201`(생성)',
        '- 실패: `COMMON400`(잘못된 요청), `COMMON401`(인증 실패), `COMMON404`(없는 리소스), `COMMON500`(서버 오류)',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    // 내부 수집 API 용. Swagger 우측 상단 Authorize 에 토큰을 넣으면 헤더로 전송된다.
    .addApiKey(
      { type: 'apiKey', in: 'header', name: SEED_TOKEN_HEADER },
      SEED_TOKEN_SECURITY,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });
}
