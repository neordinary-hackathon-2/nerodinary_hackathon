import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { z } from 'zod';
import { configureApp } from '../src/app.setup.js';
import { ApiSuccess } from '../src/common/swagger/api-envelope.decorator.js';

/**
 * zod 스키마가 Swagger 문서에 반영되는지 검증한다.
 * (심사 기준: Swagger에서 바로 호출할 수 있는 예시)
 */
const createItemSchema = z
  .strictObject({
    title: z.string().min(1).max(100).meta({ example: '권태' }),
    level: z.number().int().min(1).max(5).meta({ example: 3 }),
  })
  .meta({ id: 'CreateItemRequestDto' });

const itemSchema = z
  .object({
    id: z.number().int().meta({ example: 1 }),
    title: z.string().meta({ example: '권태' }),
  })
  .meta({ id: 'ItemResponseDto' });

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).meta({ example: 1 }),
});

const idSchema = z.coerce.number().int().positive().meta({ example: 1 });

@Controller('items')
class ItemController {
  @Get()
  @ApiSuccess(z.array(itemSchema))
  list(@Query({ schema: listQuerySchema }) _query: unknown) {
    return [];
  }

  @Post()
  @ApiSuccess(itemSchema, { status: HttpStatus.CREATED })
  create(@Body({ schema: createItemSchema }) _body: unknown) {
    return {};
  }

  @Get(':id')
  @ApiSuccess(itemSchema)
  findOne(@Param('id', { schema: idSchema }) _id: number) {
    return {};
  }
}

describe('Swagger 문서 생성 (zod → OpenAPI)', () => {
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ItemController],
    }).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    await app.close();
  });

  it('요청 본문 스키마가 이름 붙은 컴포넌트로 등록되고 예시를 가진다', () => {
    expect(document.paths['/api/items'].post?.requestBody).toMatchObject({
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CreateItemRequestDto' },
        },
      },
    });
    expect(document.components?.schemas?.CreateItemRequestDto).toMatchObject({
      required: ['title', 'level'],
      properties: {
        title: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
          example: '권태',
        },
        level: { type: 'integer', minimum: 1, maximum: 5, example: 3 },
      },
    });
  });

  it('쿼리스트링과 경로 파라미터가 문서화된다', () => {
    expect(document.paths['/api/items'].get?.parameters).toMatchObject([
      { name: 'page', in: 'query', required: false, schema: { example: 1 } },
    ]);
    expect(document.paths['/api/items/{id}'].get?.parameters).toMatchObject([
      { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
    ]);
  });

  it('성공 응답은 공통 봉투 안에 result 스키마를 담는다', () => {
    const created = document.paths['/api/items'].post?.responses['201'];
    expect(created).toMatchObject({
      content: {
        'application/json': {
          schema: {
            properties: {
              code: { example: 'COMMON201' },
              result: { $ref: '#/components/schemas/ItemResponseDto' },
            },
          },
        },
      },
    });

    const list = document.paths['/api/items'].get?.responses['200'];
    expect(list).toMatchObject({
      content: {
        'application/json': {
          schema: {
            properties: {
              result: {
                type: 'array',
                items: { $ref: '#/components/schemas/ItemResponseDto' },
              },
            },
          },
        },
      },
    });
  });
});
