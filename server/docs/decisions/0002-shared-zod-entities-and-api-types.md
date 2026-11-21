# 0002. 엔티티와 API 타입은 루트 shared/ 에 zod로 정의하고 FE와는 타입만 공유한다

- 상태: 결정됨 (2026-11-21)
- 결정자: sychoi (FE 팀과 "타입을 공통으로 쓴다"는 합의에 따름)
- 범위: `server/`, `web/`, `app/`

## 배경

FE와 서버가 엔티티와 API 타입을 공통으로 쓰기로 했다. 데코레이터가 붙은 클래스 DTO(class-validator)는 FE에서 import할 수 없어, 양쪽이 같은 정의를 쓸 수 있는 형식이 필요했다.

`server/`, `web/`, `app/`은 각자 lockfile을 가진 독립 pnpm 프로젝트이고 루트 워크스페이스가 없다. 서버 배포는 `server/`만 묶어 인스턴스에서 `pnpm install --prod`를 한다.

## 결정

- 도메인 엔티티(`shared/entities/`)와 API 요청/응답(`shared/api/`)을 레포 루트 `shared/`에 zod 스키마로 정의한다. 요청/응답은 엔티티에서 파생시키고, 타입은 `z.infer`로 뽑는다.
- DB 테이블(Drizzle)은 `server/` 안에 따로 정의한다. `shared/`가 DB 라이브러리에 의존하지 않게 하기 위해서다. 어긋남은 서버의 타입 대조(`server/src/database/entity-check.ts`)로 잡는다.
- 서버는 같은 스키마로 검증(`StandardSchemaValidationPipe`)과 Swagger 문서를 만든다. class-validator, class-transformer는 쓰지 않는다.
- FE는 tsconfig `paths`의 `@shared` 별칭으로 **`import type`만** 한다. 런타임에는 서버 코드가 번들에 들어가지 않는다.

## 폴더 위치와 구성

`server/` 안이 아니라 레포 루트 `shared/`에 둔다. 서버 소유가 아니라 세 파트 공용이고, API 요청/응답뿐 아니라 엔티티 자체를 여기서 관리하기 때문이다(결정자: sychoi).

- `shared/`는 의존성을 설치하지 않는다. `shared/package.json`은 `type: module`만 선언한다(없으면 서버 빌드가 이 폴더를 CommonJS로 내보내 런타임에 import가 깨진다). `zod`는 가져다 쓰는 쪽의 것을 쓰도록 server·web·app의 tsconfig `paths`에 `"zod": ["./node_modules/zod/index.d.ts"]`를 넣었다.
- 서버 빌드는 `rootDir`를 레포 루트로 올려 `shared/`를 함께 컴파일한다. 결과물이 `dist/server/src/`와 `dist/shared/`로 나뉘므로, 실행 경로를 바꾸지 않으려고 빌드 후 `dist/main.js`(실제 진입점을 불러오는 한 줄짜리 파일)를 만든다(`server/scripts/write-dist-entry.mjs`).
- 서버 코드는 경로 별칭이 아니라 상대 경로로 import한다. tsc가 별칭을 결과물에서 바꿔주지 않아 런타임에 깨지기 때문이다.
- `shared/**` 변경도 Server CI와 배포를 트리거한다.

## 비교

| | 타입만 공유 (선택) | 루트 pnpm 워크스페이스 + 공유 패키지 |
|---|---|---|
| FE 변경 | tsconfig `paths` 2줄, zod devDependency | lockfile 통합, 의존성 재설치 |
| 서버 빌드·배포 | 변경 없음 | `server/` 밖 패키지에 의존하게 되어 배포 묶음 방식을 바꿔야 함 |
| Vercel·Expo 설정 | 변경 없음(가정, 아래 참고) | 모노레포 설정 필요 |
| FE에서 스키마로 런타임 검증 | 불가 | 가능 |
| 영향 범위 | 설정 파일 몇 개 | 세 파트 전체 |

## 선택 기준

해커톤 도중이고 서버 배포가 이미 동작 중이라, 배포 경로와 다른 파트의 설치 구조를 건드리지 않는 쪽을 골랐다. FE에 필요한 것은 타입이었고 폼 등의 런타임 검증 요구는 없었다.

## 감수한 것

- 엔티티(zod)와 DB 테이블(Drizzle)을 두 곳에 쓴다. 필드를 추가할 때 둘 다 고쳐야 한다.

- FE는 같은 스키마로 런타임 검증을 못 한다. 필요해지면 워크스페이스 방식으로 옮겨야 한다.
- FE 타입체크가 `shared/` 파일을 직접 읽는다. 이 폴더가 Nest나 Drizzle을 import하면 FE 타입체크가 깨진다. 서버 린트(`no-restricted-imports`)로 막았다.
- `shared/` 변경이 FE 타입체크를 깨뜨릴 수 있는데, FE에는 CI가 없어 PR 단계에서 자동으로 잡히지 않는다.

## 확인한 것 / 못 한 것

- 확인: `server/node_modules`가 없는 상태에서 web·app `tsc`가 계약 타입을 해석하고, web `next build`가 통과한다. 서버 스키마에 없는 값을 넣으면 FE에서 타입 오류가 난다.
- 미확인: Vercel 빌드에서 Root Directory(`web/`) 밖의 `shared/`를 읽을 수 있는지. Vercel 프로젝트 설정의 "Include files outside the root directory"가 켜져 있어야 한다(기본값으로 알고 있으나 이 프로젝트에서 확인하지 않음). EAS 빌드도 확인하지 않았다.
