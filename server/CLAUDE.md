# server/CLAUDE.md

@AGENTS.md

NestJS 12 · Drizzle ORM · MySQL · zod. 실행법·응답 규약·예시 코드는 [README.md](README.md)가 원본이다. 여기에는 작업 전에 반드시 알아야 할 것만 둔다.

## 무엇을 만드는가

밥 먹는 20분 동안 뭘 볼지 고르지 않게, **채널을 넘기기만 하는 레트로 TV** (웹 + 웹뷰 앱).
기획 원본은 레포 루트 [`docs/planning/`](../docs/planning/) (PM 관리, **읽기 전용**). 기능은 `02-features.md`, 화면 흐름은 `03-flow.md`.

- 채널 1개 = 카테고리 1개. 영상 채널은 1~9번 9개(예능·금융·뉴스·먹방·요리·동물·음악·스포츠·홈쇼핑). DB에는 0번 컬러바 채널도 들어 있으나 검색어가 없어 영상을 수집하지 않는다.
- 채널 번호는 한 자리이고 리모컨 숫자 키(1~9)와 1:1로 대응한다. 사용자는 채널 ▲(다음 채널) 또는 숫자 키로 이동한다. 이전 채널(▼)은 없다.
- 사용자는 영상을 고르지 않는다. 채널을 켜면 그 채널의 영상 중 하나가 랜덤으로 재생된다(유튜브 임베드).
- 마지막 채널(9번) 다음은 1번으로 순환한다. 순서 계산과 전환 연출은 Web 담당.

## 서버가 맡는 범위

| 기능 | 서버가 줄 것 |
|---|---|
| F1 채널 목록 | 채널: id, 이름, `order`(1~9), 슬로건, 대표 색상, 아이콘 |
| F2 채널 영상 재생 | 영상: id, 채널 id, 유튜브 링크/ID, 제목 |
| F4 랜덤 | 채널별 영상 풀 (채널당 100개 유지, 하루 10개씩 최근 영상으로 교체, 길이 10분~2시간, 퍼가기 가능한 영상만) |

- 화면의 채널 번호(`CH 1`~`CH 9`)는 서버의 `order`(1~9)와 같은 값이다. 연출용 별도 번호(`CH 05` 등)는 쓰지 않는다.
- 채널 편성표 팝업(헤더 ? 아이콘)은 채널 번호·이름·슬로건을 F1 채널 데이터로 표시한다.
- **채널 0개, 영상 없는 채널은 오류가 아니다.** FE가 "방송 준비 중"·"방송 없음" 화면으로 처리하므로 500을 내지 않는다.
- 만들지 않는 것: 로그인·회원, 실시간 통신(Socket/SSE), 검색, 추천 알고리즘, 이전 채널(▼)·영상 직접 선택. 요청이 없으면 추가하지 않는다.
- 부가 기능(시청 기록 X1 등)은 MVP가 끝난 뒤에만 다룬다.

- 영상 수집·저장·랜덤 조회 스펙은 [`docs/youtube-data-api.md`](../docs/youtube-data-api.md)를 따른다. 스크래핑하지 않고 YouTube Data API로 수집하며, 랜덤 영상은 서버 API가 내려준다.
- 내부 수집 API(`/api/internal/youtube/seed-config`, `sync`)는 `src/youtube/`에 있고 `X-Seed-Token`으로 보호한다. `SEED_TOKEN`이 없으면 서버가 뜨지 않는다.
- 같은 YouTube 영상을 여러 채널에 편성할 수 있다(11.22 결정). 고유 제약은 `(app_channel_id, youtube_video_id)` 복합이고, `sync` 서비스는 "있으면 갱신, 없으면 추가"로 처리한다.
- 채널 0~9번은 초기 마이그레이션(`0000`)이 넣는다. **이미 적용된 마이그레이션 파일은 고치지 않는다.** 내용을 바꿔도 적용된 DB에는 반영되지 않아 운영에서 500이 난다(11.22 장애). 스키마를 바꾸면 `pnpm db:generate`로 새 파일을 추가한다.
- 수집기는 `src/youtube-collector/`(Nest와 별개, Actions에서 실행)다. 서버 내부 API 계약과 할당량은 [`docs/decisions/0003-youtube-collector.md`](docs/decisions/0003-youtube-collector.md), 하루 교체 정책은 [`docs/decisions/0005-youtube-daily-rotation.md`](docs/decisions/0005-youtube-daily-rotation.md).

미확정(임의로 정하지 말고 사용자에게 확인): 최종 채널 목록, 검색어를 DB와 저장소 JSON 중 어디서 관리할지.

## 심사 기준에서 오는 제약

Swagger로 심사한다. 기준 원문은 [`docs/guides/Server.md`](../docs/guides/Server.md).

- 명세된 API가 전부 정상 동작해야 한다. **500이 나면 감점**이다.
- 모든 요청 필드에 `.meta({ example })`을 넣어 Swagger에서 바로 호출되게 한다.
- 잘못된 쿼리·본문·경로 값은 400으로 떨어져야 한다. 요청 스키마는 `.strict()`, 쿼리·경로 파라미터는 `z.coerce`.
- 상태 코드 200 / 201 / 400 / 404 / 500을 구분한다. 전역 예외 필터를 우회하지 않는다.
- 관심사 분리(controller → service), 중복 제거, 설정값 외부화가 채점 항목이다.
- 하드코딩 응답은 0점이다. 채널·영상은 DB에서 읽는다.
- 인프라 구성도·ERD는 11.22 04:00까지 제출. 테이블을 바꾸면 ERD도 맞춘다.

## 구조와 규칙

```
src/
├── app.setup.ts     # 전역 파이프·필터·인터셉터 (main과 e2e가 공유)
├── config/          # 환경변수 검증, 설정
├── database/        # 연결, 마이그레이션, schema/ (테이블 정의)
├── common/          # 응답 봉투, 예외, Swagger 데코레이터
└── <도메인>/         # controller(HTTP) → service(로직). health/ 가 예시
../shared/           # 엔티티·요청/응답 zod 스키마 (FE와 공유)
```

- 컨트롤러는 **데이터만 반환**한다. 봉투(`isSuccess`/`code`/`message`/`result`)는 인터셉터가 씌운다.
- 오류는 서비스에서 `throw new BusinessException(ErrorCodes.X)`. 새 코드는 `common/exception/error-code.ts`에 추가한다.
- 응답은 `@ApiSuccess(schema)`, 실패는 `@ApiFailure(...ErrorCodes)`로 문서화한다.
- 검증은 `@Body({ schema })`, `@Param('id', { schema })`. class-validator는 쓰지 않는다.
- ESM이다. 상대 import는 `.js`로 끝난다. 테스트는 Vitest(`vi.fn()`).
- `any`는 린트가 막지 않지만 쓰지 않는다. Promise는 `await`하거나 `void`로 명시한다(린트 오류).

### shared/ (레포 루트)

- 엔티티는 `shared/entities/`, 요청/응답은 `shared/api/`에 두고 엔티티에서 파생시킨다(`.pick()` 등). 각 `index.ts`에 export를 추가한다.
- `shared/`에는 **FE가 쓰는 것만** 둔다. FE가 호출하지 않는 내부 API(예: 수집기용 `/api/internal/youtube/*`)의 스키마는 서버 안에 둔다(`src/youtube/youtube-internal.schema.ts`). 엔티티에서 파생시키는 방식은 같다.
- `shared/`의 파일은 `zod`와 그 폴더 안의 파일만 import한다. Nest·Drizzle을 import하면 FE 타입체크가 깨진다.
- 서버에서는 **상대 경로**로 가져온다: `'../../../shared/index.js'`. 경로 별칭은 런타임에 깨진다.
- 필드를 지우거나 이름을 바꾸면 `web/`·`app/` 사용처를 같은 PR에서 고친다. FE에는 CI가 없어 자동으로 잡히지 않는다.

### DB

- 테이블은 `src/database/schema/<이름>.schema.ts`에 정의하고 `schema/index.ts`에 export한다.
- `primaryId()`, `foreignId()`, `...timestamps`(`schema/columns.ts`)를 쓴다. 컬럼명은 snake_case로 자동 변환된다.
- 테이블 파일마다 엔티티와 대조한다: `type _Check = AssertNoMismatch<EntityMismatch<typeof t.$inferSelect, Entity>>;`
- `Date` 컬럼은 엔티티에서 `string`이다. 테이블에만 있는 컬럼은 허용된다.
- 스키마를 바꾸면 `pnpm db:push`(로컬 반영) 후 **`pnpm db:generate`를 실행하고 `drizzle/`를 함께 커밋**한다. 빠뜨리면 CI가 실패한다.
- 운영 DB에는 서버 시작 시 `drizzle/` 마이그레이션이 자동 적용된다. 생성된 SQL에 컬럼 삭제·이름 변경이 있으면 커밋 전에 사용자에게 알린다.

## 명령 (server/ 안에서 실행)

```bash
pnpm start:dev     # 로컬 실행. API :3000/api, Swagger :3000/docs
pnpm lint          # oxlint (server + shared)
pnpm build         # shared/ 를 함께 컴파일
pnpm test:e2e      # 응답·예외 규약, Swagger 문서 생성
pnpm db:generate   # 마이그레이션 SQL 생성
```

PR 전에는 CI와 같은 순서로 확인한다: `lint` → `db:generate`(변경 없음 확인) → `build` → `test` → `test:e2e`.

## 작업 규칙

- 브랜치: `main`이 아니라 **에픽에서 딴다.** `epic/server/<작업>` ← `feat|fix|chore|refact/server/<작업>`. PR 대상도 그 에픽이다.
- **`main`에 `server/` 또는 `shared/` 변경이 합쳐지면 바로 운영에 배포된다.** 에픽은 배포해도 되는 상태일 때만 합친다.
- 커밋: `<type>: <한국어 설명>` (Conventional Commits, 헤더 100자 이내).
- 실제 값이 든 `.env*`는 커밋하지 않는다. 환경변수를 추가하면 `config/env.validation.ts`와 `.env.example`도 같이 고친다. 운영에 필요한 값이면 `deploy/render-env.sh`와 `deploy.yml`의 env 블록에도 넣고, 머지 전에 GitHub Secrets/Variables 등록을 사용자에게 요청한다(운영 `.env.production`은 배포가 만든다).
- 작업 중 만드는 문서는 `server/docs/`에 둔다. 설계 결정은 `server/docs/decisions/NNNN-<제목>.md`.
- 인프라(Lightsail, RDS, Caddy, `deploy/`, `.github/workflows/`)는 요청이 있을 때만 건드린다.
