# YouTube 수집 작업 로드맵

기준 시점: 2026-11-22. 새 세션은 이 문서만 읽고 이어서 작업할 수 있어야 한다.
상태가 바뀌면 [3. 로드맵](#3-로드맵) 표의 상태 칸과 기준 시점을 고친다.

## 1. 목표

채널 1~9에 채널당 영상 100개를 유지하고, 매일 채널당 10개를 최근 영상으로 바꾼다.
수집은 GitHub Actions(`YouTube Collect` 워크플로)가 하고, 저장과 삭제는 운영 서버의 내부 API가 한다.

끝난 상태는 이렇다.

- 운영 서버에 `GET /api/internal/youtube/seed-config`, `POST /api/internal/youtube/sync`가 있다.
- 수집 워크플로가 매일 한 번 돌고 9개 채널에 영상이 채워진다.
- `GET /api/channels/random-videos`가 채널마다 영상을 돌려준다(지금은 영상 목록이 비어 있다).

## 2. 지금 상태 한눈에

- 다음에 할 일: **이 문서를 에픽에 넣기 → 에픽 → main PR 올리기**
- 작업 폴더의 브랜치: `feat/server/youtube-daily-rotation`. 작업 트리는 깨끗하다.
- 이 문서는 PR #35가 병합된 뒤에 같은 브랜치에 커밋됐다. 그래서 에픽에는 아직 없다. 에픽으로 보내는 PR을 따로 올려야 한다.
- `origin/epic/server/youtube-collector`는 `origin/main`보다 16커밋 앞서 있고 뒤처진 커밋은 없다. `git merge-tree`로 본 충돌은 없다.
- 운영 서버에는 아직 내부 API가 없다. 에픽이 main에 들어가야 배포된다.

## 3. 로드맵

상태 표기: ✅ 끝남 · 🔄 진행 중(사람 대기 포함) · ⬜ 시작 전

| # | 단계 | 상태 | 담당 | 근거 또는 끝났다고 보는 조건 |
| --- | --- | --- | --- | --- |
| 1 | 수집기 추가, 내부 API 스키마를 서버로 이동 | ✅ | — | PR #22 병합 (에픽) |
| 2 | 운영 환경변수를 GitHub Secrets/Variables에서 배포 시 주입 | ✅ | — | PR #26, #30 병합. 배포 성공, `/api/health`에서 서버와 DB 모두 UP 확인 |
| 3 | 내부 수집 API 구현 (`seed-config`, `sync`, `X-Seed-Token`) | ✅ | — | PR #33 병합 (에픽). 단위 62개, e2e 27개 통과 |
| 4 | 하루 10개 교체 (수집기 교체 큐, 서버 초과분 삭제) | ✅ | — | PR #35 병합 (에픽, 병합 커밋 `01d05d1`). 단위 71개, e2e 27개 통과 |
| 5 | 에픽 → main PR | ⬜ | 세션 | 바로 올릴 수 있다. 이 문서를 에픽에 먼저 넣을지는 사람이 정한다. 절차는 [4.1](#41-에픽--main-pr-5번) |
| 6 | 배포 확인 | ⬜ | 세션 | #5 병합 후. 절차는 [4.2](#42-배포-확인-6번) |
| 7 | `YOUTUBE_API_KEY` Secret, `SYNC_API_BASE_URL` Variable 등록 | ⬜ | 사람 | 값은 사람만 안다. 세션은 이름이 등록됐는지만 확인한다 |
| 8 | 수집 워크플로 dry-run 1회 | ⬜ | 세션 | #7 후. 채널 1개로 먼저 돌려 검색 할당량 사용량을 본다 |
| 9 | 수집 워크플로 실제 실행 (9개 채널) | ⬜ | 세션 | #6, #8 후. 절차는 [4.3](#43-수집-실행-8-9번) |
| 10 | 매일 실행 켜기 (`youtube-collect.yml`의 `schedule` 주석 해제) | ⬜ | 사람 결정 | #9가 성공한 뒤. 운영 데이터를 매일 지우고 채우기 시작하는 결정이다 |
| 11 | 정리 | ⬜ | 사람 결정 | [6. 정리할 것](#6-정리할-것) |

## 4. 남은 단계 절차

### 4.1 에픽 → main PR (5번)

1. `git fetch origin` 후 에픽이 #35 병합 커밋(`01d05d1`)을 포함하는지 확인한다: `git merge-base --is-ancestor 01d05d1 origin/epic/server/youtube-collector`
2. `origin/main`과 충돌이 없는지 본다: `git merge-tree --write-tree origin/main origin/epic/server/youtube-collector`
3. PR을 올린다. base는 `main`, head는 `epic/server/youtube-collector`. Branch Policy CI가 `epic/*` → `main`만 허용한다.
4. PR 본문에는 "병합하면 운영에 배포된다"와 아래 두 가지를 적는다.
   - 서버가 부팅할 때 `SEED_TOKEN`(16자 이상)을 요구한다. Secret은 등록돼 있지만 **값이 16자 이상인지는 확인한 적이 없다.** 짧으면 서버가 뜨지 않는다.
   - DB 스키마 변경은 없다(`pnpm db:generate` 결과 변경 없음).

### 4.2 배포 확인 (6번)

- `gh run list --json databaseId,name,status,conclusion,headBranch`로 Server Deploy 실행을 찾고 `gh run watch <id> --exit-status`로 본다.
- `/api/health`가 UP이고 database가 UP인지 본다.
- 토큰 없이 `GET /api/internal/youtube/seed-config`를 호출해 401(`COMMON401`)이 오는지 본다. 내부 API가 배포됐고 가드가 걸려 있다는 증거다.
- 배포가 실패하면 먼저 `SEED_TOKEN` 길이를 의심한다. 사람이 Secret을 다시 등록하고 배포를 재실행한다.

### 4.3 수집 실행 (8, 9번)

워크플로 입력은 `dry_run`(기본 true)과 `channel`(1~9, 비우면 전체)이다.

1. `dry_run=true`, `channel=1`로 실행한다. 실행 요약의 "교체" 열과 검색 호출 수를 본다.
2. `dry_run=false`, `channel=1`로 실행한다. `seed-config`의 채널 1 저장 개수가 늘었는지 본다.
3. `dry_run=false`, 채널을 비워 전체를 실행한다.
4. `GET /api/channels/random-videos`에서 채널 1~9에 영상이 오는지 본다.

`search.list`는 하루 100회까지다. 이전 실측에서 60회쯤 썼다고 보고됐으니 같은 날 여러 번 돌리지 않는다.
`SYNC_API_BASE_URL`은 `/api`까지 포함한 주소다(예: `https://<서버 주소>/api`). 수집기가 그 뒤에 `/internal/youtube/...`를 붙인다.

## 5. 검증 상태

확인한 것:

- 내부 API 브랜치 단독: lint, build, `db:generate`(변경 없음), 단위 62개, e2e 27개.
- 교체 브랜치: 단위 71개, e2e 27개.
- 서버 초과분 삭제 SQL: 임시 MySQL 9.3과 현재 스키마에서 `TARGET_PER_CHANNEL=5`로 9개 시나리오 18개 확인 통과. 시나리오 목록은 PR #35 본문에 있다. 스크립트는 저장소에 없다.

확인하지 못한 것:

- 삭제 SQL의 자동 테스트가 없다. e2e는 서비스를 가짜로 바꿔 돌린다.
- 같은 채널에 `sync`가 동시에 들어오는 경우.
- 실제 규모(채널당 100개, 50개 묶음 전송).
- 실제 YouTube 키로 최근 7일 조건 검색이 채널당 10개를 채우는지.
- 9개 채널 전체 수집, 운영 환경 실행.

## 6. 정리할 것

전부 사람이 결정한다. 세션이 먼저 지우지 않는다.

| 대상 | 내용 | 지워도 되는 시점 |
| --- | --- | --- |
| stash 2개 | `combined-before-split (internal api + rotation)`, `internal-api-wip` | 지금 (#35 병합됨) |
| 백업 ref 2개 | `refs/backup/youtube-combined`, `refs/backup/youtube-combined-on-main` | 지금 (#35 병합됨) |
| worktree | `.claude/worktrees/deploy-env-secrets` (브랜치 `chore/server/deploy-env-secrets`, PR #26으로 병합됨) | 지금 |
| GitHub Variables | `AWS_REGION`, `LIGHTSAIL_HOST`, `LIGHTSAIL_INSTANCE_NAME`. 같은 이름의 Secret을 쓰게 바뀌어 더는 읽지 않는다 | 지금 |
| `CORS_ORIGINS` | 지금 값은 `*`다. 웹 배포 주소가 정해지면 좁힌다 | 웹 주소 확정 후 |

## 7. 주의할 것

- **채널은 1~9번만 사용한다.** 기존 `0000`이 넣던 0번 컬러바는 `0002_remove_colorbar_channel` 마이그레이션에서 삭제하고, 채널 번호 CHECK 제약도 1~9로 제한한다. 수집 대상은 계속 1~9번이다.
- 작업 브랜치는 `epic/*`에서 따고 PR도 에픽으로 보낸다. `feat/*` → `main`은 Branch Policy CI가 막는다.
- 커밋 메시지와 PR 본문에 Claude 표기를 넣지 않는다. commit-msg 훅이 막는다.
- 프로젝트 절대경로는 끝에 공백이 있다: `/Users/sychoi/Desktop/Project/neordinary_hackthon /`
- 설치된 `gh`는 2.4.0이다. `gh pr edit`(Projects 오류), `gh variable`, `gh run list --branch`, `gh pr checks --watch`가 안 된다. PR 본문은 `gh api -X PATCH repos/<owner>/<repo>/pulls/<n> -F body=@파일`로 고치고, Variable 목록은 `gh api repos/<owner>/<repo>/actions/variables`로 본다.
- Secret 값은 출력하지 않는다. 이름만 확인한다.
- 같은 폴더를 쓰는 세션이 둘 더 있다("YouTube 데이터 seeding 함수", "수집기 영상 갱신 및 DB 관리"). 브랜치 분리 중에 폴더를 건드리지 말라고 전달된 상태 그대로다. 그 세션들의 작업은 PR #33, #35에 모두 들어갔으니 다시 깨울 필요는 없다.
- 웹 쪽 PR #29와 발표 문서 PR #32는 다른 사람 것이다. 건드리지 않는다.

## 8. GitHub 설정 현황

| 종류 | 등록됨 | 빠진 것 |
| --- | --- | --- |
| Secrets | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `LIGHTSAIL_HOST`, `LIGHTSAIL_INSTANCE_NAME`, `LIGHTSAIL_SSH_KEY`, `SEED_TOKEN` | `YOUTUBE_API_KEY` |
| Variables | `CORS_ORIGINS`, `AWS_REGION`, `LIGHTSAIL_HOST`, `LIGHTSAIL_INSTANCE_NAME` | `SYNC_API_BASE_URL` |

## 9. 관련 문서

- [0003 YouTube 수집기](decisions/0003-youtube-collector.md): 수집기 구조, 내부 API 계약, 재실행 정책
- [0004 운영 환경변수](decisions/0004-production-env-from-github-secrets.md): 배포가 `.env.production`을 만드는 방식
- [0005 하루 10개 교체](decisions/0005-youtube-daily-rotation.md): 교체 정책과 조건
- [수집 실측 기록](youtube-collector-measurement.md)
- 워크플로: `.github/workflows/youtube-collect.yml`
