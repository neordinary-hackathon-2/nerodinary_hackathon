# Ne(o)rdinary Hackathon — Server

11th Ne(o)rdinary Hackathon 서버 파트. NestJS 12 · Drizzle ORM · MySQL.

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
| `pnpm test:e2e` | 공통 응답·예외 규약 테스트 |
| `pnpm db:push` | 스키마를 로컬 DB에 바로 반영 (개발 중) |
| `pnpm db:generate` | 스키마 변경을 마이그레이션 SQL로 생성 (`drizzle/`) |
| `pnpm db:studio` | DB 조회 화면 |

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
└── health/              # 도메인 모듈 예시: controller → service → dto
```

도메인은 `src/<도메인>/` 아래에 `controller`(HTTP) → `service`(비즈니스 로직) → `dto`로 나눈다.
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
| DTO 검증 실패 (본문·쿼리) | 400 | `COMMON400_VALIDATION` (+ `result`에 필드별 사유) |
| 잘못된 JSON, 파라미터 타입 오류 | 400 | `COMMON400` |
| 없는 경로·리소스 | 404 | `COMMON404` |
| 처리되지 않은 예외 | 500 | `COMMON500` (내부 메시지 비노출, 로그에만 기록) |

## API 추가 방법

```ts
// 1) 에러가 필요하면 common/exception/error-code.ts 에 추가
CONTENT_NOT_FOUND: { status: HttpStatus.NOT_FOUND, code: 'CONTENT404', message: '콘텐츠가 없습니다.' },

// 2) 서비스에서는 던지기만 한다
throw new BusinessException(ErrorCodes.CONTENT_NOT_FOUND);

// 3) 컨트롤러: 요청 DTO에 class-validator + @ApiProperty({ example }) 를 붙인다
@Post()
@ApiOperation({ summary: '콘텐츠 생성' })
@ApiSuccess(ContentResponseDto, { status: HttpStatus.CREATED })
@ApiFailure(ErrorCodes.VALIDATION_FAILED, ErrorCodes.CONTENT_NOT_FOUND)
create(@Body() dto: CreateContentDto) { return this.contentService.create(dto); }
```

Swagger에서 바로 호출되도록 **모든 요청 DTO 필드에 `example`** 을 넣는다.

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
