import {
  Body,
  Controller,
  Get,
  INestApplication,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { configureApp } from '../src/app.setup.js';
import { BusinessException } from '../src/common/exception/business.exception.js';
import { ErrorCodes } from '../src/common/exception/error-code.js';

/**
 * 공통 응답/예외 규약을 검증한다. (심사 기준: 200/201/400/404/500 구분)
 * DB 없이 돌도록 테스트 전용 컨트롤러에 실제 앱과 같은 전역 구성(configureApp)을 적용한다.
 */
class CreateItemDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsInt()
  @Min(1)
  @Max(5)
  level: number;
}

class ListQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;
}

@Controller('items')
class ItemController {
  @Get()
  list(@Query() query: ListQueryDto) {
    return { page: query.page, items: [] };
  }

  @Post()
  create(@Body() dto: CreateItemDto) {
    return { id: 1, title: dto.title, level: dto.level };
  }

  @Get('boom')
  boom() {
    throw new Error('secret internal detail');
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    if (id !== 1) {
      throw new BusinessException(ErrorCodes.NOT_FOUND, '아이템이 없습니다.');
    }
    return { id };
  }
}

describe('공통 응답 · 전역 예외처리 (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ItemController],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET 성공 → 200 + COMMON200 봉투', async () => {
    const res = await request(app.getHttpServer()).get('/api/items/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      isSuccess: true,
      code: 'COMMON200',
      message: '요청에 성공했습니다.',
      result: { id: 1 },
    });
  });

  it('POST 성공 → 201 + COMMON201 봉투', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/items')
      .send({ title: '권태', level: 3 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      isSuccess: true,
      code: 'COMMON201',
      result: { id: 1, title: '권태', level: 3 },
    });
  });

  it('쿼리스트링은 DTO 타입으로 변환된다', async () => {
    const res = await request(app.getHttpServer()).get('/api/items?page=2');
    expect(res.status).toBe(200);
    expect(res.body.result.page).toBe(2);
  });

  it('본문 값이 잘못되면 → 400 + 필드별 사유', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/items')
      .send({ title: '', level: 99 });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      isSuccess: false,
      code: 'COMMON400_VALIDATION',
    });
    expect(res.body.result.map((e: { field: string }) => e.field)).toEqual([
      'title',
      'level',
    ]);
  });

  it('DTO에 없는 필드가 오면 → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/items')
      .send({ title: 'a', level: 1, hacked: true });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('COMMON400_VALIDATION');
  });

  it('쿼리스트링 값이 잘못되면 → 400', async () => {
    const res = await request(app.getHttpServer()).get('/api/items?page=abc');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('COMMON400_VALIDATION');
  });

  it('경로 파라미터 타입이 틀리면 → 400', async () => {
    const res = await request(app.getHttpServer()).get('/api/items/abc');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ isSuccess: false, code: 'COMMON400' });
  });

  it('깨진 JSON 본문 → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/items')
      .set('Content-Type', 'application/json')
      .send('{"title": ');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ isSuccess: false, code: 'COMMON400' });
  });

  it('서비스가 던진 BusinessException → 정의된 상태 코드(404)와 메시지', async () => {
    const res = await request(app.getHttpServer()).get('/api/items/999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      isSuccess: false,
      code: 'COMMON404',
      message: '아이템이 없습니다.',
      result: null,
    });
  });

  it('없는 경로 → 404 봉투', async () => {
    const res = await request(app.getHttpServer()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ isSuccess: false, code: 'COMMON404' });
  });

  it('예상 못 한 예외 → 500, 내부 메시지는 노출하지 않는다', async () => {
    const res = await request(app.getHttpServer()).get('/api/items/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      isSuccess: false,
      code: 'COMMON500',
      message: '서버 내부 오류가 발생했습니다.',
      result: null,
    });
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });
});
