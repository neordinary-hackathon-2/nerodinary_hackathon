# AGENTS.md

이 저장소에서 작업하는 모든 에이전트(및 하위 세션)가 지켜야 하는 규칙.

## 브랜치 전략 (반드시 준수)

에픽 기반 브랜치 전략을 쓴다. 자세한 내용은 [README의 '브랜치 전략'](README.md#브랜치-전략). 코드를 바꾸는 작업을 **시작하기 전에**:

- 작업 브랜치(`feat`/`fix`/`chore`/`refact`)는 **반드시 해당 서비스의 `epic/<서비스>/<작업>` 브랜치에서 딴다.** `main`에서 바로 따지 않는다.
- 해당 에픽이 없으면 **먼저 `main`에서 에픽 브랜치를 만든 뒤** 그 위에서 작업 브랜치를 딴다.
- PR 대상: 작업 브랜치 → 에픽, 에픽 → `main`.
- 브랜치 이름: `<type>/<service>/<설명>`
  - `type`: `epic` | `feat` | `fix` | `chore` | `refact`
  - `service`: `app` | `web` | `server` | `common`
  - 예: `epic/server/auth`, `feat/server/login-api`, `chore/common/ci-setup`
- 하위 세션(sub-agent/session)에 작업을 넘길 때는 **어느 에픽에서 브랜치를 따야 하는지 브리핑에 명시**한다. 에픽이 없으면 먼저 만들라고 지시한다.

CI의 `Branch Policy` 워크플로([.github/workflows/branch-policy.yml](.github/workflows/branch-policy.yml))가 모든 PR에서 이 규칙을 자동 검사한다. 규칙을 어기면 PR 체크가 실패한다.

## 서버

서버 전용 규칙은 [server/AGENTS.md](server/AGENTS.md) 참고.
