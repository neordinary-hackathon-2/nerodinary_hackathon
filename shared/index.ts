/**
 * server, web, app 이 함께 쓰는 타입과 zod 스키마.
 *
 * - entities/ : 도메인 엔티티 (zod 스키마 + 타입)
 * - api/      : API 요청/응답 스키마. 엔티티에서 파생시킨다
 * - bridge/   : 웹(WebView 안) → 앱 메시지 스키마. web이 보내고 app이 받는다
 *
 * 사용
 * - server : 스키마를 값으로 import 해 검증과 Swagger 문서에 쓴다.
 * - web/app: `import type {...} from '@shared'` 로 타입만 가져간다.
 *
 * 규칙
 * - 이 폴더의 파일은 `zod`와 이 폴더 안의 파일만 import 한다. (서버 빌드와 FE 타입체크에 함께 걸린다)
 * - 이 폴더는 의존성을 설치하지 않는다. `zod`는 가져다 쓰는 쪽(server, web, app)의 것을 쓴다.
 *   package.json 은 서버 빌드가 이 폴더를 ESM으로 컴파일하도록 `type: module` 만 선언한다.
 */
export * from './api/index.js';
export * from './bridge/index.js';
export * from './entities/index.js';
