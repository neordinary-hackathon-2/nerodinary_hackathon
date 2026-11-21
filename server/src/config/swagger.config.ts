import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Ne(o)rdinary Hackathon API')
    .setDescription(
      [
        '모든 응답은 `{ isSuccess, code, message, result }` 형태입니다.',
        '- 성공: `COMMON200`(조회·수정·삭제), `COMMON201`(생성)',
        '- 실패: `COMMON400`(잘못된 요청), `COMMON404`(없는 리소스), `COMMON500`(서버 오류)',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });
}
