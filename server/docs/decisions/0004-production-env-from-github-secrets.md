# 0004. 운영 환경변수는 GitHub Secrets/Variables에 두고 배포할 때 주입한다

- 상태: 결정됨 (2026-11-22)
- 결정자: sychoi
- 범위: `.github/workflows/deploy.yml`, `server/deploy/render-env.sh`, 인스턴스의 `~/app/.env.production`

## 배경

운영 환경변수는 Lightsail 인스턴스의 `~/app/.env.production`에 사람이 SSH로 들어가 직접 써 두는 방식이었다. 배포 파이프라인은 이 파일을 전달하지 않고 "이미 있다"고만 가정했다.

이 방식의 문제:

- 값을 바꾸려면 평소 닫아 둔 22번 포트를 열고 인스턴스에 접속해야 한다.
- 인스턴스를 다시 만들면 값이 사라진다. 원본이 인스턴스 한 곳에만 있다.
- 코드에 필수 변수를 추가하고 서버 파일 수정을 잊으면 부팅 검증에서 죽어 배포가 실패한다. 리뷰에서 잡을 방법이 없다.
- 내부 수집 API가 생기면서 `SEED_TOKEN`을 수집 워크플로(GitHub Secrets)와 서버(인스턴스 파일) 양쪽에 같은 값으로 넣어야 하게 됐다.

## 결정

운영 환경변수의 원본을 GitHub Secrets/Variables로 옮긴다. 배포할 때마다 워크플로가 그 값으로 `.env.production`을 만들어 인스턴스에 쓴다.

| 항목 | 값 | 근거 |
| --- | --- | --- |
| 저장 형태 | 항목별로 등록한다. 파일 전체를 Secret 하나에 넣지 않는다 | 아래 "검토한 대안" |
| Secret (필수) | `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `SEED_TOKEN` | 레포가 public이라 Actions 로그도 공개된다. Secret은 로그에 찍혀도 `***`로 가려진다 |
| Secret (선택) | `DB_PORT`(기본 3306), `DB_LOGGING`(기본 false) | 위와 같은 이유로 DB 관련 값은 모두 Secret에 둔다 |
| Secret (배포 인프라) | `AWS_REGION`, `LIGHTSAIL_INSTANCE_NAME`, `LIGHTSAIL_HOST` | 기존에는 Variable이었다. 인스턴스 IP와 이름이 로그에 남지 않게 옮겼다 |
| Variable | `CORS_ORIGINS` | 프론트 주소라 공개 정보다. UI에서 현재 값을 보고 고칠 일이 잦다 |
| 고정값 | `NODE_ENV=production`, `PORT=3000`, `DB_MIGRATE_ON_START=true` | 운영에서 바뀔 일이 없어 `render-env.sh`에 적는다 |
| 파일 생성 | `server/deploy/render-env.sh`가 러너에서 표준출력으로 만든다 | 로컬에서 그대로 실행해 검증할 수 있다 |
| 빈 값 처리 | 필수 값이 하나라도 비면 SSH 접속 전에 배포를 중단한다 | 빈 값으로 기존 파일을 덮어써 서비스가 죽는 것을 막는다 |
| 전송 | SSH 표준입력으로 보낸다 | 명령 인자, 러너 임시 파일, 릴리스 tarball에 값을 남기지 않는다 |
| 인스턴스 파일 | `umask 077`로 쓴다(권한 600). 직전 파일은 `.env.production.prev`로 남긴다 | 되돌릴 수단. 배포 한 번 분량만 보관된다 |
| 값 표기 | 작은따옴표로 감싼다. 작은따옴표나 줄바꿈이 든 값은 거부한다 | dotenv가 `#`, 공백, `$`를 그대로 읽는다 |
| Secret 노출 범위 | 앱 환경변수는 `Upload and deploy` 단계의 `env`에만 넣는다. job 전체에는 인스턴스 이름과 주소만 둔다 | 서드파티 액션에 DB 접속 정보와 토큰이 전달되지 않게 한다 |

## 운영 절차

- **값 변경**: GitHub → Settings → Secrets and variables → Actions에서 고친 뒤 Actions 탭에서 `Server Deploy`를 수동 실행한다. Secret을 고치는 것만으로는 배포가 돌지 않는다.
- **변수 추가**: `src/config/env.validation.ts`, `.env.example`, `deploy/render-env.sh`, `deploy.yml`의 env 블록을 같은 PR에서 고친다. 값은 **머지 전에** GitHub에 등록한다.
- **되돌리기**: Secret을 고쳐 다시 실행한다. 급하면 인스턴스에서 `cp ~/app/.env.production.prev ~/app/.env.production` 후 `pm2 reload ecosystem.config.cjs --env production`. 단 다음 배포 때 GitHub의 값으로 다시 덮어써진다.
- 인스턴스에서 `.env.production`을 직접 고치지 않는다. 다음 배포에 사라진다.

## 검토한 대안

| 대안 | 채택하지 않은 이유 |
| --- | --- |
| 인스턴스에 수동 작성 (기존) | 배경에 적은 문제 |
| 파일 전체를 Secret 하나(`ENV_PRODUCTION`)에 저장 | Secret은 다시 읽을 수 없어 값 하나를 바꿔도 전체를 다시 붙여넣어야 하고, 결국 원본을 다른 곳에 따로 보관하게 된다. `SEED_TOKEN`이 수집 워크플로용 Secret과 중복된다. 어떤 키가 주입되는지 저장소에서 보이지 않는다 |
| AWS SSM Parameter Store (SecureString) | KMS 암호화와 CloudTrail 감사 이력이 생기지만 IAM 정책 추가와 파라미터 등록이 필요하다. 해커톤 일정에서 작업량 대비 이득이 작다고 판단했다. Lightsail 인스턴스에는 IAM 역할을 붙일 수 없어, 쓰더라도 러너가 읽어 주입하는 같은 구조가 된다 |

## 감수하는 것

- 비밀값이 AWS 밖(GitHub)에 있다. 누가 언제 값을 읽었는지에 대한 감사 이력은 없다.
- Secret은 등록 후 값을 다시 볼 수 없다. DB 엔드포인트나 인스턴스 IP를 확인하려면 AWS 콘솔을 봐야 한다.
- Secret으로 둔 값과 같은 문자열은 로그에서 모두 `***`로 바뀐다(예: 리전 이름, DB 이름). 로그가 읽기 불편해질 수 있다.
- 변수 하나를 추가할 때 고칠 곳이 네 군데(검증 스키마, 예시 파일, `render-env.sh`, `deploy.yml`)와 GitHub 설정이다.
- 잘못된 값으로 배포하면 헬스체크가 실패하고, pm2가 단일 인스턴스라 고칠 때까지 서비스가 중단된다. 빈 값은 사전에 막지만 틀린 값(예: 잘못된 비밀번호)은 막지 못한다.
- `SEED_TOKEN`을 배포 필수값으로 뒀다. 서버가 이 값을 필수로 요구하기 전이라도, 등록하지 않으면 배포가 중단된다.

## 확인하지 못한 것

- 실제 인스턴스에 대한 배포. 로컬에서는 파일 생성 스크립트만 검증했다. 전환 후 첫 `Server Deploy` 실행의 헬스체크 통과와 로그 마스킹은 직접 확인해야 한다.
- 전환 전 인스턴스에 있던 `.env.production`의 값. GitHub에 등록할 때 직접 옮겨야 한다.

## 다시 검토할 조건

- 비밀값 접근 감사가 필요해지거나 AWS 안에서만 비밀값을 관리해야 하면 → SSM Parameter Store로 전환.
- 운영 변수가 많아져 `deploy.yml`의 env 블록 관리가 부담되면 → GitHub Environment 단위로 묶거나 SSM 경로 조회로 전환.
