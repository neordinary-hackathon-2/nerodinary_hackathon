# Ne(o)rdinary Hackathon — Server

11th Ne(o)rdinary Hackathon 서버 파트. NestJS 12 · Drizzle ORM · MySQL · zod.

## 실행

```bash
pnpm install
cp .env.example .env.local   # DB 접속 정보 수정
pnpm db:push                 # 스키마를 로컬 DB에 반영
pnpm start:dev
```

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/docs`
- 헬스체크: `GET /api/health`

| 명령 | 용도 |
|---|---|
| `pnpm start:dev` | 로컬 개발 (watch) |
| `pnpm build` / `pnpm start:prod` | 빌드 / 빌드 결과 실행 |
| `pnpm lint` / `pnpm format` | 린트 / 포맷 |
| `pnpm test:e2e` | 공통 응답·예외 규약, Swagger 문서 생성 테스트 |
| `pnpm db:push` | 스키마를 로컬 DB에 바로 반영 (개발 중) |
| `pnpm db:generate` | 스키마 변경을 마이그레이션 SQL로 생성 (`drizzle/`) |
| `pnpm db:studio` | DB 조회 화면 |

## 프론트엔드 연동 (배포 서버)

FE(web·app)는 아래 배포 서버로 HTTPS 요청한다. 인증서는 Let's Encrypt(자동 갱신)이고, `sslip.io`는 고정 IP(`54.116.233.6`)를 그대로 가리키는 DNS다.

| 용도 | 주소 |
|---|---|
| API 베이스 | `https://54-116-233-6.sslip.io/api` |
| Swagger (API 문서) | `https://54-116-233-6.sslip.io/docs` |
| 헬스체크 | `https://54-116-233-6.sslip.io/api/health` |

```bash
# 연결 확인
curl https://54-116-233-6.sslip.io/api/health
# → { "isSuccess": true, "result": { "status": "UP", "database": "UP", ... } }
```

- FE 환경변수 예: `VITE_API_BASE_URL=https://54-116-233-6.sslip.io/api` (또는 `NEXT_PUBLIC_API_BASE_URL`).
- 모든 엔드포인트는 `/api` 프리픽스 아래에 있다. 응답 봉투(`isSuccess`/`code`/`message`/`result`)는 [응답 규약](#응답-규약) 참고.
- **CORS**: 허용 오리진은 서버의 `CORS_ORIGINS`로 정한다(쉼표 구분). 현재는 `*`(모든 오리진 허용)로 열려 있어 Vercel 미리보기·로컬에서 바로 호출된다. 쿠키 기반 인증은 켜져 있지 않으므로(`credentials` 미사용) 인증은 헤더 토큰 방식으로 보낸다. Vercel 운영 주소가 확정되면 그 주소로 좁힌다.
- IP가 바뀌면(해커톤 장소 이동 등) 도메인도 `<새-IP를-하이픈으로>.sslip.io`로 바뀐다. 그때 FE 베이스 URL도 함께 교체한다.

## 구조

```
src/
├── main.ts              # 부트스트랩 (CORS, Swagger, listen)
├── app.setup.ts         # 전역 파이프/필터/인터셉터 (main과 e2e 테스트가 공유)
├── app.module.ts
├── config/              # 환경변수 검증, app/database/swagger 설정
├── database/            # DB 연결(DatabaseModule), 마이그레이션 실행, schema/ (테이블 정의)
├── common/
│   ├── response/        # 공통 응답 봉투 + 인터셉터
│   ├── exception/       # 에러 코드, BusinessException, 전역 예외 필터
│   └── swagger/         # @ApiSuccess / @ApiFailure
└── health/              # 도메인 모듈 예시: controller → service
```

도메인은 `src/<도메인>/` 아래에 `controller`(HTTP) → `service`(비즈니스 로직)로 나눈다.
엔티티와 요청/응답 정의는 레포 루트의 [`shared/`](../shared/)에 모은다.
테이블 정의는 `src/database/schema/`에 모은다.
`pnpm exec nest g resource <이름>` 으로 뼈대를 만들 수 있다.

## 응답 규약

컨트롤러는 **데이터만 반환**한다. 봉투는 인터셉터가 씌운다.

```jsonc
// 200 / 201
{ "isSuccess": true, "code": "COMMON200", "message": "요청에 성공했습니다.", "result": { } }
// 400 / 404 / 500
{ "isSuccess": false, "code": "COMMON404", "message": "요청한 리소스를 찾을 수 없습니다.", "result": null }
```

| 상황 | 상태 | code |
|---|---|---|
| 조회·수정·삭제 성공 | 200 | `COMMON200` |
| 생성 성공 (`@Post`) | 201 | `COMMON201` |
| 스키마 검증 실패 (본문·쿼리·경로 파라미터) | 400 | `COMMON400_VALIDATION` (+ `result`에 필드별 사유) |
| 잘못된 JSON | 400 | `COMMON400` |
| 없는 경로·리소스 | 404 | `COMMON404` |
| 처리되지 않은 예외 | 500 | `COMMON500` (내부 메시지 비노출, 로그에만 기록) |

## API 추가 방법

엔티티와 요청/응답은 레포 루트 `shared/`에 zod 스키마로 정의한다. 검증, Swagger 문서, FE 타입이 모두 이 스키마에서 나온다.

```ts
// 1) (레포 루트) shared/entities/content.ts — 엔티티. entities/index.ts 에 export 한 줄 추가
export const contentSchema = z
  .object({
    id: z.number().int().meta({ example: 1 }),
    title: z.string().min(1).max(100).meta({ example: '권태' }),
    createdAt: z.string().meta({ example: '2026-11-21T08:00:00.000Z' }), // Date 는 응답에서 문자열
  })
  .meta({ id: 'Content' });                          // id = Swagger에 표시되는 이름
export type Content = z.infer<typeof contentSchema>;

// 2) (레포 루트) shared/api/content.ts — 요청/응답은 엔티티에서 파생. api/index.ts 에 export 한 줄 추가
export const createContentRequestSchema = contentSchema
  .pick({ title: true })
  .strict()                                          // 정의에 없는 필드가 오면 400
  .meta({ id: 'CreateContentRequestDto' });
export type CreateContentRequestDto = z.infer<typeof createContentRequestSchema>;

// 3) 에러가 필요하면 common/exception/error-code.ts 에 추가
CONTENT_NOT_FOUND: { status: HttpStatus.NOT_FOUND, code: 'CONTENT404', message: '콘텐츠가 없습니다.' },

// 4) 서비스에서는 던지기만 한다
throw new BusinessException(ErrorCodes.CONTENT_NOT_FOUND);

// 5) 컨트롤러: 파라미터 데코레이터에 schema 를 넘기면 검증과 문서화가 같이 된다
@Post()
@ApiOperation({ summary: '콘텐츠 생성' })
@ApiSuccess(contentSchema, { status: HttpStatus.CREATED })
@ApiFailure(ErrorCodes.VALIDATION_FAILED, ErrorCodes.CONTENT_NOT_FOUND)
create(@Body({ schema: createContentRequestSchema }) dto: CreateContentRequestDto) {
  return this.contentService.create(dto);
}

// 쿼리스트링·경로 파라미터는 문자열로 들어오므로 z.coerce 로 변환한다
@Get(':id')
findOne(@Param('id', { schema: z.coerce.number().int().positive().meta({ example: 1 }) }) id: number) {}
```

- Swagger에서 바로 호출되도록 **모든 요청 필드에 `.meta({ example })`** 을 넣는다.
- 목록 응답은 `@ApiSuccess(z.array(contentSchema))`.
- 서버는 `shared/`를 상대 경로로 import한다: `import { contentSchema } from '../../../shared/index.js';`
- `shared/`의 파일은 FE(web, app) 타입체크에도 걸린다. `zod`와 같은 폴더의 파일만 import한다(`pnpm lint`가 검사).
- `shared/`를 바꾸면 FE 타입이 같이 바뀐다. 필드를 지우거나 이름을 바꿀 때는 web/app 사용처를 같은 PR에서 고친다.
- 서버 빌드는 `shared/`를 함께 컴파일한다. 결과물은 `dist/server/src/`와 `dist/shared/`로 나뉘고, 실행 진입점은 `dist/main.js` 그대로다.

## DB 스키마

```ts
// 1) src/database/schema/content.schema.ts
export const contents = mysqlTable('contents', {
  id: primaryId(),
  title: varchar({ length: 100 }).notNull(), // DB 컬럼명은 snake_case로 자동 변환
  ...timestamps,                             // created_at, updated_at
});

// 2) src/database/schema/index.ts 에 추가
export * from './content.schema.js';

// 3) 서비스에서 사용
constructor(@InjectDrizzle() private readonly db: Database) {}
const rows = await this.db.select().from(contents).where(eq(contents.id, id));
```

엔티티(`shared/entities`)와 DB 테이블은 따로 정의한다. 둘이 어긋나면 컴파일 오류가 나도록 테이블 파일에서 대조한다.

```ts
// content.schema.ts 아래에 추가. 어긋난 필드 이름이 오류 메시지에 나온다
type _Check = AssertNoMismatch<EntityMismatch<typeof contents.$inferSelect, Content>>;
```

테이블에만 있는 컬럼(밖으로 내보내지 않는 값)은 허용된다. `Date` 컬럼은 엔티티에서 `string`으로 정의한다.

스키마를 바꿨을 때:

1. `pnpm db:push` — 로컬 DB에 바로 반영해서 개발
2. `pnpm db:generate` — PR 올리기 전에 실행하고 `drizzle/` 폴더를 함께 커밋

운영 DB에는 서버가 시작할 때 `drizzle/`의 마이그레이션이 자동 적용된다(`DB_MIGRATE_ON_START=true`).
2번을 빠뜨리면 CI가 실패한다.

## 환경 설정

`NODE_ENV`에 따라 `.env.local` / `.env.production` 을 읽는다. 항목은 [.env.example](.env.example) 참고.
필수 값이 없으면 서버가 부팅 단계에서 실패한다. 실제 값이 든 `.env*` 는 커밋하지 않는다.

## 배포

`main`에 `server/` 변경 푸시 → GitHub Actions: 린트·빌드·테스트 → Lightsail 인스턴스로 전송 → pm2 reload → 헬스체크(DB 연결 포함).

```
사용자 ─HTTPS(443)─▶ Lightsail 인스턴스 [Caddy → NestJS :3000] ─3306(VPC 피어링)─▶ RDS MySQL (퍼블릭 액세스 없음)
```

- 워크플로(레포 루트): [../.github/workflows/deploy.yml](../.github/workflows/deploy.yml) (필요한 Secrets/Variables는 파일 상단 주석)
- 인스턴스 최초 세팅: [deploy/lightsail-setup.sh](deploy/lightsail-setup.sh)
- HTTPS: [deploy/Caddyfile](deploy/Caddyfile)

인프라를 만들 때 확인할 것:

- Lightsail 방화벽은 80, 443만 연다. 22번은 배포 워크플로가 배포 중에만 러너 IP로 열었다 닫는다.
- Lightsail 계정 설정에서 VPC 피어링을 켜고, RDS는 같은 리전의 기본 VPC에 퍼블릭 액세스 없이 만든다.
- RDS 보안그룹은 3306을 Lightsail 쪽 사설 대역에서만 허용한다.
- 서버의 `~/app/.env.production`에 `DB_MIGRATE_ON_START=true`, `CORS_ORIGINS=<Vercel 주소>`를 넣는다.
