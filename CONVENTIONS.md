# 코드 컨벤션 (app, web)

`app/`(Expo / React Native)과 `web/`(Next.js)에 적용하는 규칙이다.

- **(자동)** 표시가 있는 규칙은 `pnpm lint`가 검사한다. 나머지는 리뷰에서 본다.

## 목차

1. [포맷](#1-포맷)
2. [린트](#2-린트)
3. [커밋 메시지](#3-커밋-메시지)
4. [네이밍](#4-네이밍)
5. [TypeScript](#5-typescript)
6. [폴더 구조](#6-폴더-구조)
7. [API 레이어](#7-api-레이어)
8. [상태 관리](#8-상태-관리)
9. [커스텀 훅](#9-커스텀-훅)
10. [컴포넌트](#10-컴포넌트)
11. [스타일](#11-스타일)
12. [라우팅](#12-라우팅)
13. [에러 처리](#13-에러-처리)
14. [날짜](#14-날짜)
15. [import 순서](#15-import-순서)
16. [주석](#16-주석)
17. [체크리스트](#17-체크리스트)

---

## 1. 포맷

**(자동)** 루트 [`.prettierrc`](.prettierrc)를 app/web이 같이 쓴다. `pnpm format`으로 고친다.

| 항목 | 값 | 예시 |
|---|---|---|
| 들여쓰기 | 2칸 | |
| 세미콜론 | 항상 | `const x = 1;` |
| 따옴표 | 작은따옴표, JSX 속성은 큰따옴표 | `'text'`, `className="flex"` |
| 후행 쉼표 | 항상 | `{a, b,}` |
| 괄호 안 공백 | 없음 | `{foo: bar}`, `import {useState} from 'react';` |
| 화살표 함수 괄호 | 항상 | `(value) => value` |
| 최대 줄 길이 | 80자 | |

## 2. 린트

**(자동)** oxlint. 공통 규칙은 루트 [`.oxlintrc.json`](.oxlintrc.json), 플랫폼 규칙은 `app/.oxlintrc.json`, `web/.oxlintrc.json`.

| 규칙 | 수준 | 내용 |
|---|---|---|
| `typescript/no-explicit-any` | error | `any` 금지 → [5.2](#52-타입-정의-원칙) |
| `no-unused-vars` | error | 미사용 import·변수·인자 금지. 일부러 안 쓰는 값은 `_`로 시작 (`_event`) |
| `typescript/no-floating-promises` | error | Promise는 `await`, `.catch`, 또는 `void`로 명시 |
| `react/rules-of-hooks` | error | 훅 호출 규칙 |
| `react/exhaustive-deps` | warn | 의존성 배열 누락 |
| `unicorn/filename-case` | error | 파일명 규칙 → [4.1](#41-파일) |
| `no-restricted-imports` | error | `@shared`는 `import type`으로만 → [5.3](#53-서버와-타입-공유-zod) |
| `react/forbid-dom-props` (web) | error | `style` 속성 금지 → [11.1](#111-web-tailwind-css) |
| `react-perf/jsx-no-new-object-as-prop` (app) | warn | `style={{...}}` 같은 인라인 객체 금지 → [11.2](#112-app-stylesheet) |

## 3. 커밋 메시지

[Conventional Commits](https://www.conventionalcommits.org/) 형식. 헤더는 100자 이내, 설명은 한국어.

```
<type>: <설명>

feat: 플레이어 연결 화면 추가
fix: 재연결 시 세션이 초기화되는 문제 수정
```

| type | 용도 |
|---|---|
| `feat` | 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 동작 변경 없는 구조 개선 (브랜치 접두사는 `refact/`) |
| `imp` | 기존 기능 개선 |
| `style` | 포맷 등 코드 스타일만 변경 |
| `docs` | 문서 |
| `test` | 테스트 |
| `chore` | 설정, 의존성, 빌드 |
| `build`, `ci`, `perf`, `revert` | 표준 타입 |

브랜치 이름은 [README 브랜치 전략](README.md#브랜치-전략)을 따른다.

## 4. 네이밍

### 4.1 파일

| 종류 | 규칙 | 예시 |
|---|---|---|
| 컴포넌트 (`components/`) | PascalCase.tsx **(자동)** | `PlayerCard.tsx`, `ui/Collapsible.tsx` |
| 화면 (`screens/`) | PascalCase + `Screen` 접미사 **(자동)** | `HomeScreen.tsx`, `PlayerDetailScreen.tsx` |
| 훅 (`hooks/`) | camelCase, `use` 접두사 **(자동)** | `useTheme.ts`, `usePlayerList.ts` |
| API 모듈 (`api/`) | camelCase, 도메인 이름 **(자동)** | `players.ts`, `client.ts` |
| 유틸 (`utils/`) | camelCase **(자동)** | `date.ts`, `storage.ts` |
| 상수 (`constants/`) | camelCase **(자동)** | `theme.ts`, `queryKeys.ts` |
| 라우트 (`app/`) | 프레임워크 규칙. 소문자 / kebab-case | web: `page.tsx`, `layout.tsx`, `not-found.tsx` · app: `_layout.tsx`, `index.tsx`, `player-detail.tsx`, `[id].tsx` |
| 플랫폼별 파일 (app) | 접미사 유지 | `AppTabs.web.tsx`, `useColorScheme.web.ts` |

### 4.2 변수 / 함수 / 타입

| 종류 | 규칙 | 예시 |
|---|---|---|
| 변수 | camelCase | `playerName`, `isLoading` |
| boolean | `is` / `has` / `can` / `should` 접두사 | `isConnected`, `hasError` |
| 함수 | 동사 + 명사 camelCase | `formatScore`, `handlePressButton` |
| 컴포넌트 | PascalCase | `PlayerCard` |
| 타입 / interface / enum | PascalCase | `Player`, `PlayerCardProps`, `GameStatus` |
| 원시값 상수 | UPPER_SNAKE_CASE | `MAX_PLAYERS`, `DEFAULT_TIMEOUT_MS` |
| zod 스키마 | camelCase + `Schema` | `contentSchema`, `healthResponseSchema` |
| 요청/응답 타입 | PascalCase + `RequestDto` / `ResponseDto` | `CreateContentRequestDto`, `HealthResponseDto` |

### 4.3 API 함수 접두사

| 접두사 | HTTP | 의미 | 예시 |
|---|---|---|---|
| `get*` | GET | 조회 | `getPlayer()`, `getPlayerList()` |
| `request*` | POST | 특정 작업 요청 | `requestMatch()` |
| `send*` | POST | 전송 (알림, 메시지 등) | `sendInvite()` |
| `check*` | GET/POST | 유효성·중복 검사 | `checkNickname()` |
| `create*` | POST | 생성 | `createRoom()` |
| `edit*` | PUT/PATCH | 수정 | `editProfile()` |
| `delete*` | DELETE | 삭제 | `deleteRoom()` |
| `upsert*` | PUT | 없으면 생성, 있으면 수정 | `upsertSetting()` |

### 4.4 이벤트 핸들러

| 접두사 | 용도 | 예시 |
|---|---|---|
| `on*` | props로 받는 콜백 | `onPress`, `onSubmit`, `onChangeText` |
| `handle*` | 컴포넌트 안에서 구현하는 핸들러 | web `handleClickJoin`, app `handlePressJoin` |

web은 `Click`, app은 `Press`를 쓴다 (`onClick` / `onPress`에 맞춘다).

### 4.5 고차 함수

| 형태 | 용도 | 예시 |
|---|---|---|
| `handle<Action>` | 인자를 캡처해 핸들러를 돌려주는 단순 클로저 | `handlePressItem(item)` |
| `create<Action>Handler` | 조건·비동기·여러 상태를 조합하는 핸들러 팩토리 | `createToggleFilterHandler(type)` |
| `render<Thing>` | JSX를 돌려주는 함수 | `renderItem`, `renderHeader` |

```tsx
const handlePressItem = (item: Player) => () => {
  router.push(`/players/${item.id}`);
};

<PlayerRow onPress={handlePressItem(player)} />;
```

## 5. TypeScript

### 5.1 경로 별칭

`@/*` → `src/*`. 다른 폴더의 파일은 항상 별칭으로 import한다. 같은 폴더 안의 파일만 `./` 상대 경로를 쓴다.

```ts
import PlayerCard from '@/components/PlayerCard'; // ✅
import PlayerCard from '../../components/PlayerCard'; // ❌
```

app은 `@/assets/*` → `assets/*`도 있다.

### 5.2 타입 정의 원칙

- `any` 금지 **(자동)**. 모르는 값은 `unknown`으로 받고 타입 가드로 좁힌다.
- 함수 인자·반환값·props는 타입을 명시한다. 지역 변수는 추론에 맡긴다.

```ts
const isPlayer = (value: unknown): value is Player =>
  typeof value === 'object' && value !== null && 'id' in value;
```

**타입을 정의하는 방법**

| 구분 | 방법 | 위치 | 예시 |
|---|---|---|---|
| 엔티티, API 요청/응답 | zod 스키마 + `z.infer` | `shared/` | `healthResponseSchema` → `HealthResponseDto` |
| 클라이언트 전용 (props, 훅 반환값, 컴포넌트 내부 구조) | `interface` | 쓰는 파일 | `PlayerCardProps`, `UsePlayerListReturn` |

서버와 주고받는 데이터의 타입은 `type`/`interface`로 손으로 쓰지 않는다. `shared/`의 zod 스키마가 유일한 원본이다 → [5.3](#53-서버와-타입-공유-zod).

props가 RN/DOM 기본 props를 확장하면 `extends`를 쓴다.

```ts
interface ThemedTextProps extends TextProps {
  type?: 'default' | 'title' | 'small';
}
```

### 5.3 서버와 타입 공유 (zod)

엔티티와 API 요청/응답 타입은 **레포 루트 [`shared/`](shared/)에 zod 스키마로 정의하고, app/web은 거기서 타입만 가져온다.** 서버는 같은 스키마로 요청을 검증하고 Swagger 문서를 만든다.

```ts
import type {Content, CreateContentRequestDto} from '@shared';
```

| 폴더 | 내용 | 예시 |
|---|---|---|
| `shared/entities/` | 도메인 엔티티 (zod 스키마 + 타입) | `contentSchema`, `Content` |
| `shared/api/` | API 요청/응답. 엔티티에서 파생 | `createContentRequestSchema`, `CreateContentRequestDto` |

`shared/`에 정의하는 형태:

```ts
// shared/api/health.ts
import {z} from 'zod';

export const healthResponseSchema = z
  .object({
    status: z.literal('UP'),
    database: z.enum(['UP', 'DOWN']),
    timestamp: z.string(),
  })
  .meta({id: 'HealthResponseDto'}); // Swagger 문서의 이름

export type HealthResponseDto = z.infer<typeof healthResponseSchema>;
```

- 스키마와 `z.infer` 타입을 같은 파일에서 함께 export한다.
- API 요청/응답 스키마는 가능하면 `shared/entities/`의 엔티티에서 `pick` / `omit` / `extend`로 만든다.
- 새 파일을 만들면 폴더의 `index.ts`에 `export * from './파일.js';`를 추가한다.

app/web에서 쓸 때:

- **(자동)** 반드시 `import type`으로 가져온다. 값으로 import하면 린트 오류가 난다. 스키마 자체(런타임 검증)는 FE에서 쓰지 않는다.
- `@shared` 별칭은 `tsconfig.json`의 `paths`에 있다(`../shared/index.ts`). 서버 코드를 설치하거나 빌드할 필요는 없다.
- 타입을 그대로 쓴다. 화면에 맞게 필드 이름을 바꾸거나 합치지 않는다. 변환이 필요하면 훅의 `select`에서 한다 → [9.1](#91-api-훅-tanstack-query).
- `shared/`가 바뀌면 app/web 타입체크가 바로 깨진다. 바꾸는 PR에서 app/web 사용처도 같이 고친다.
- 필요한 타입이 아직 없으면 서버 담당자에게 요청하거나 `shared/`에 직접 추가한다. 이 폴더의 파일은 `zod`와 같은 폴더 안의 파일만 import할 수 있다.
- 서버 응답 봉투 `{isSuccess, code, message, result}`는 `src/api/client.ts`에서 벗기고, 도메인 타입은 `result` 안쪽만 쓴다. 봉투 타입도 `ApiEnvelope`로 가져온다 → [7.1](#71-클라이언트).

### 5.4 enum

클라이언트 전용 상수 묶음은 `enum`으로 관리한다. 서버와 주고받는 값은 `shared/` 스키마의 `z.enum`에서 나온 유니온 타입을 그대로 쓴다 (`HealthResponseDto['database']` → `'UP' | 'DOWN'`).

```ts
export enum TabKey {
  Home = 'home',
  Explore = 'explore',
}
```

### 5.5 export

| 대상 | 방식 |
|---|---|
| 컴포넌트, 화면 | `export default` (파일당 컴포넌트 하나) |
| 커스텀 훅 | `export default` |
| API 도메인 모듈 | `export default` 객체 |
| 유틸, 상수, 타입 | named export |

```tsx
// ✅ 컴포넌트: 화살표 함수 + 파일 맨 아래 default export
const PlayerCard = ({player}: PlayerCardProps) => {
  ...
};

export default PlayerCard;

// ✅ 유틸: named export
export const formatScore = (score: number) => ...;
```

한 파일에서만 쓰는 보조 컴포넌트는 export하지 않고 같은 파일에 둔다.

## 6. 폴더 구조

```
src/
├── app/         # 라우트. 화면을 연결만 한다
├── screens/     # 화면 컴포넌트
├── components/  # 재사용 컴포넌트
├── hooks/       # 커스텀 훅 (API 훅 포함)
├── constants/   # 상수, 디자인 토큰, query key
├── utils/       # 순수 함수
└── api/         # 서버 API 호출 (타입은 @shared)
```

| 폴더 | 책임 | 하지 않는 것 |
|---|---|---|
| `app/` | URL과 화면 연결 | UI·로직 작성 |
| `screens/` | 화면 조립, 훅에서 받은 데이터 렌더링 | `fetch` 직접 호출 |
| `components/` | UI 렌더링, 이벤트를 props로 전달 | API 호출, 전역 상태 변경 |
| `hooks/` | 상태·데이터 로직 캡슐화, 화면에 데이터 제공 | JSX 반환 |
| `api/` | HTTP 요청/응답 | 상태 변경, 라우팅, UI, 요청/응답 타입 직접 정의 |
| `utils/` | 입력 → 출력 순수 함수 | 사이드 이펙트, 외부 의존 |
| `constants/` | 변하지 않는 값 | 계산 로직 |

라우트 파일 예:

```ts
// src/app/players/[id].tsx (app) 또는 src/app/players/[id]/page.tsx (web)
export {default} from '@/screens/PlayerDetailScreen';
```

## 7. API 레이어

### 7.1 클라이언트

모든 요청은 `src/api/client.ts` 하나를 거친다. 서버 주소, 공통 헤더, 응답 봉투 해제, 에러 변환을 여기서만 한다.

| | 환경 변수 |
|---|---|
| web | `NEXT_PUBLIC_API_URL` (예: `http://localhost:3000/api`) |
| app | `EXPO_PUBLIC_API_URL` |

```ts
// src/api/client.ts
import type {ApiEnvelope} from '@shared';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const BASE_URL = process.env.EXPO_PUBLIC_API_URL; // web: NEXT_PUBLIC_API_URL

export const request = async <T>(path: string, init?: RequestInit) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {'Content-Type': 'application/json', ...init?.headers},
  });
  const body = (await response.json()) as ApiEnvelope<T>;

  if (!body.isSuccess) {
    throw new ApiError(body.code, body.message);
  }
  return body.result as T;
};
```

### 7.2 도메인 모듈

도메인마다 파일 하나. 요청/응답 타입은 `shared/`에서 가져오고([5.3](#53-서버와-타입-공유-zod)), 함수는 default export 객체로 묶는다.

```ts
// src/api/players.ts
import type {EditPlayerRequestDto, PlayerResponseDto} from '@shared';

import {request} from './client';

export default {
  getPlayer(id: number) {
    return request<PlayerResponseDto>(`/players/${id}`);
  },
  editPlayer(id: number, body: EditPlayerRequestDto) {
    return request<PlayerResponseDto>(`/players/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
};
```

### 7.3 통합 export

```ts
// src/api/index.ts
import players from './players';

const API = {players};

export default API;
```

```ts
import API from '@/api';

API.players.getPlayer(1);
```

화면·컴포넌트는 `API`를 직접 부르지 않고 훅을 통해 쓴다 → [9.1](#91-api-훅-tanstack-query).

## 8. 상태 관리

| 상태 | 도구 | 용도 |
|---|---|---|
| 로컬 | `useState` | 한 컴포넌트 안의 UI 상태 |
| 서버 | TanStack Query (`@tanstack/react-query`) | 서버 데이터 조회, 캐싱, 갱신 |
| 전역 | React Context | 여러 화면이 같이 쓰는 클라이언트 상태 |

- 서버에서 온 데이터를 `useState`나 Context에 복사하지 않는다. Query 캐시가 원본이다.
- `useState`를 Context로 올리는 기준: 두 개 이상의 화면이 같은 값을 쓰거나, 화면 이동 후에도 값이 유지돼야 할 때.
- `QueryClientProvider`는 루트 레이아웃에 한 번만 둔다 (web은 `'use client'` Providers 컴포넌트로 감싼다).

## 9. 커스텀 훅

### 9.1 API 훅 (TanStack Query)

API 하나에 훅 하나. query key는 `src/constants/queryKeys.ts`에 모은다.

```ts
// src/constants/queryKeys.ts
export const queryKeys = {
  player: (id: number) => ['player', id] as const,
};
```

```ts
// src/hooks/usePlayer.ts
import {useQuery} from '@tanstack/react-query';

import API from '@/api';
import {queryKeys} from '@/constants/queryKeys';

const usePlayer = (id: number) => {
  const {data, isPending, error} = useQuery({
    queryKey: queryKeys.player(id),
    queryFn: () => API.players.getPlayer(id),
    staleTime: 60 * 1_000,
  });

  return {player: data, isPending, error};
};

export default usePlayer;
```

변경은 `useMutation`으로 하고, 성공하면 관련 query를 `invalidateQueries`로 갱신한다. 목록을 바로 바꿔 보여줘야 할 때만 `onMutate`로 낙관적 업데이트를 하고, `onError`에서 되돌린다.

### 9.2 반환 구조

- 이름은 `use*` **(자동: hooks/ 파일명)**.
- 반환값은 객체로, 데이터 · 로딩 · 에러 · 액션 함수 순서로 이름을 붙여 돌려준다 (`{player, isPending, error, refresh}`).
- 반환 타입을 밖에서 쓰면 `interface UsePlayerReturn`으로 정의한다.

## 10. 컴포넌트

### 10.1 작성 순서

```tsx
'use client'; // web Client Component일 때만

// 1. import
// 2. Props interface
interface JoinButtonProps {
  roomId: number;
  onJoin: () => void;
}

// 3. 컴포넌트 (props는 구조 분해)
const JoinButton = ({roomId, onJoin}: JoinButtonProps) => {
  // 4. 외부 훅 (router, query 등)
  // 5. 로컬 상태
  // 6. 파생 값
  // 7. 핸들러
  // 8. effect
  // 9. JSX
};

// 10. (app) StyleSheet
const styles = StyleSheet.create({...});

// 11. default export
export default JoinButton;
```

예시의 번호 주석은 순서 설명용이다. 실제 코드에는 구역 주석을 쓰지 않는다 → [16장](#16-주석).

### 10.2 Server / Client Component (web)

- 기본은 Server Component. `useState`, `useEffect`, 이벤트 핸들러, 브라우저 API가 필요한 컴포넌트에만 `'use client'`를 붙인다.
- Client Component는 트리 아래쪽(버튼, 입력 등 작은 단위)에 둔다. 화면 전체에 `'use client'`를 붙이지 않는다.

### 10.3 `useCallback` / `useMemo`

| | 쓴다 | 안 쓴다 |
|---|---|---|
| `useCallback` | 자식 props로 넘기는 함수, effect·memo 의존성에 들어가는 함수 | 컴포넌트 안에서만 쓰는 단순 함수 |
| `useMemo` | 비싼 계산(필터·정렬), 매 렌더 새 참조면 안 되는 객체·배열, (app) 동적 스타일 | 단순 조건식, 리터럴 |

```ts
const label = isReady ? '준비 완료' : '대기 중'; // ✅ useMemo 불필요
```

### 10.4 조건부 렌더링

```tsx
{isLoading && <Spinner />}
{player ? <PlayerCard player={player} /> : <EmptyState />}
```

분기가 셋 이상이면 삼항을 중첩하지 않고 설정 객체로 뺀다.

```ts
const statusLabel: Record<GameStatus, string> = {
  waiting: '대기 중',
  playing: '진행 중',
  finished: '종료',
};
```

## 11. 스타일

색·폰트 값을 컴포넌트에 직접 쓰지 않는다. 토큰을 먼저 만들고 토큰을 쓴다.

### 11.1 web: Tailwind CSS

- `style` 속성 금지 **(자동)**. `className`만 쓴다.
- 토큰은 `src/app/globals.css`의 `@theme`에 정의하고 클래스로 쓴다 (Tailwind v4, 설정 파일 없음).

```css
@theme inline {
  --color-primary: #2079bb;
}
```

```tsx
<button className="bg-primary text-white" /> // ✅
<button className="bg-[#2079BB]" /> // ❌ 임의값으로 색 하드코딩
```

- 반응형은 `sm:` `md:` `lg:` 접두사로 처리한다.
- 조건부 클래스가 길어지면 [10.4](#104-조건부-렌더링)처럼 객체로 빼서 조합한다.

### 11.2 app: StyleSheet

- 스타일은 파일 아래쪽 `StyleSheet.create`에 둔다. `style={{...}}` 인라인 객체 금지 **(자동, warn)**.
- props·테마에 따라 바뀌는 스타일은 `useMemo`로 만들거나 `StyleSheet`에 변형을 미리 정의해 고른다.
- 색·폰트·간격은 `src/constants/theme.ts`의 `Colors`, `Fonts`, `Spacing`을 쓴다. 다크 모드 색은 `useTheme()`으로 가져온다.

```tsx
const theme = useTheme();
<ThemedText style={styles.title} />; // ✅
<Text style={{color: '#000', fontSize: 18}} />; // ❌
```

### 11.3 타이포그래피 이름

글자 스타일 토큰을 추가할 때는 `{종류}_{굵기}_{크기}`로 이름 붙인다. 종류 `h`(heading) `sh`(subheading) `bt`(button) `b`(body) `d`(detail), 굵기 `l` `r` `b`.

```ts
h_b_24, bt_b_16, b_r_14, d_r_12
```

## 12. 라우팅

### 12.1 web (Next.js App Router)

| 파일 | 역할 |
|---|---|
| `page.tsx` | 라우트 화면 (`screens/`를 re-export) |
| `layout.tsx` | 공통 레이아웃 |
| `loading.tsx` | 로딩 UI |
| `error.tsx` | 에러 바운더리 (`'use client'`) |
| `not-found.tsx` | 404 |
| `route.ts` | Route Handler |

- 관련 페이지는 라우트 그룹 `(group)/`으로 묶는다 (URL에 안 들어간다).
- 동적 라우트 props는 Next가 생성하는 `PageProps<'/경로'>` 타입을 쓴다. `params`는 Promise다.

```tsx
const PlayerDetailScreen = async ({params}: PageProps<'/players/[id]'>) => {
  const {id} = await params;
  ...
};
```

- 이동은 `<Link>`를 우선 쓰고, 코드에서 이동할 때만 `useRouter()`(`next/navigation`)를 쓴다.

### 12.2 app (Expo Router)

- `src/app/` 아래 파일 = 화면. `_layout.tsx`가 네비게이터(Stack, Tabs)를 정의한다.
- 파라미터는 `useLocalSearchParams<{id: string}>()`로 받는다.
- 이동은 `<Link href="/players/1">` 또는 `router.push()`(`expo-router`).
- 네이티브 코드를 수정하지 않는다. `ios/`, `android/`는 생성물이다 (설정은 `app.json`).

## 13. 에러 처리

| 단계 | 처리 |
|---|---|
| HTTP / 서버 에러 | `api/client.ts`가 `ApiError(code, message)`로 바꿔 던진다 |
| 조회 실패 | 훅의 `error`를 화면에서 받아 에러 UI 표시 |
| 변경 실패 | `useMutation`의 `onError`에서 사용자 알림, 낙관적 업데이트 롤백 |
| 렌더링 에러 | web `error.tsx`, app 라우트 파일의 `ErrorBoundary` export |
| 백그라운드 작업 실패 (로그 등) | 사용자에게 알리지 않는다 |

알림 방식은 단순 결과 안내면 Toast, 사용자의 확인·선택이 필요하면 모달을 쓴다.

사용자에게 보이는 메시지:

- 기술적 메시지(`Network request failed`, `500`, `error.message`)를 그대로 보여주지 않는다.
- 사용자가 할 수 있는 행동을 안내한다 (`잠시 후 다시 시도해 주세요.`).
- 서버가 준 `message`는 사용자용 문구이므로 그대로 보여줘도 된다.

## 14. 날짜

- 날짜 계산·포맷은 `dayjs`로 한다. `Date` 메서드로 직접 문자열을 만들지 않는다.
- 서버와 주고받는 값은 ISO 문자열(`2026-11-21T08:00:00.000Z`) 그대로 두고, 화면에 보여줄 때만 포맷한다.
- 자주 쓰는 포맷은 `src/utils/date.ts`에 함수로 둔다.

```ts
// src/utils/date.ts
import dayjs from 'dayjs';

export const formatDateTime = (iso: string) =>
  dayjs(iso).format('YYYY.MM.DD HH:mm');
```

## 15. import 순서

네 그룹으로 나누고 그룹 사이에 빈 줄을 둔다.

```ts
// 1. React / 프레임워크
import {useState} from 'react';
import {StyleSheet, View} from 'react-native'; // app
import {useRouter} from 'next/navigation'; // web

// 2. 외부 패키지
import {useQuery} from '@tanstack/react-query';
import dayjs from 'dayjs';

// 3. 내부 별칭 (@/)
import API from '@/api';
import PlayerCard from '@/components/PlayerCard';
import useTheme from '@/hooks/useTheme';

// 4. 같은 폴더
import PlayerRow from './PlayerRow';
```

## 16. 주석

주석은 최소로 쓴다. 먼저 이름과 구조로 설명하고, 코드만 봐서는 알 수 없는 것만 주석으로 남긴다.

| 쓴다 | 쓰지 않는다 |
|---|---|
| 코드만으로 알 수 없는 이유 (플랫폼 버그 우회, 서버 제약, 일부러 다르게 처리한 이유) | 코드가 하는 일을 그대로 옮긴 설명 (`// 버튼 누르면 이동`) |
| 우회 코드의 근거가 되는 이슈·문서 링크 | 주석 처리한 옛 코드 (git에 남아 있다) |
| | 구역 나누기 (`// state`, `// handlers`) |
| | 작성자, 날짜, 변경 이력 |
| | `TODO` (작업은 브랜치·이슈로 관리한다) |

```ts
// ❌ 코드를 반복하는 주석
// 대기 중인 플레이어만 거른다
const list = players.filter((player) => player.status === 'waiting');

// ✅ 이름으로 설명
const waitingPlayers = players.filter((player) => player.status === 'waiting');

// ✅ 코드만으로 알 수 없는 이유
// Android는 키보드가 열려도 레이아웃이 다시 계산되지 않아 높이를 직접 보정한다.
const bottomInset = Platform.OS === 'android' ? keyboardHeight : 0;
```

- 설명이 길게 필요하면 함수로 빼고 이름을 붙인다.
- JSDoc은 여러 곳에서 쓰는 유틸·훅인데 이름과 타입만으로 사용법이 드러나지 않을 때만 쓴다.

## 17. 체크리스트

- [ ] `pnpm lint` 통과 (포맷, `any`, 미사용 코드, 파일명, 인라인 스타일)
- [ ] 컴포넌트·화면 PascalCase, 훅 `use*`, 나머지 camelCase, 라우트는 프레임워크 규칙
- [ ] 컴포넌트·훅·API 모듈은 default export, 유틸·상수·타입은 named export
- [ ] 서버와 주고받는 타입은 `shared/`의 zod 스키마에서 `import type`, props·훅 반환 타입은 `interface`
- [ ] 라우트 파일은 `screens/`를 re-export만 한다
- [ ] 화면·컴포넌트에서 `API`/`fetch`를 직접 부르지 않고 훅을 쓴다
- [ ] 서버 데이터는 TanStack Query 캐시에만 둔다
- [ ] (web) `'use client'`는 필요한 컴포넌트에만
- [ ] 색·폰트 하드코딩 없음 (web `@theme` 토큰, app `constants/theme.ts`)
- [ ] `useCallback`/`useMemo`는 기준에 맞을 때만
- [ ] 기술적 에러 메시지를 사용자에게 보여주지 않는다
- [ ] 날짜는 dayjs
- [ ] import 4그룹 순서
- [ ] 주석은 코드만으로 알 수 없는 이유만. 옛 코드·구역 주석·`TODO` 없음
- [ ] 커밋 메시지 `<type>: <설명>`
