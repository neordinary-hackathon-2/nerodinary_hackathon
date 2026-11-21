# 조사 보고서: SSH 배포 → AWS SSM Run Command 배포 전환

- 작성일: 2026-11-22
- 상태: **보류** — 전환하지 않기로 결정했다. [결정 0006](decisions/0006-keep-ssh-temporary-open-over-ssm.md) 참조. 아래는 다시 검토할 때 쓸 자료다.
- 범위: `.github/workflows/deploy.yml`, `server/deploy/*.sh`, IAM/S3/SSM 리소스, `server/docs/README.md`, `infra-architecture.*`

---

## 1. 목표

배포 경로에서 **인바운드 SSH(22)를 완전히 없앤다.** 지금은 배포 중에 러너 IP/32로 22번을 열고 scp/ssh로 넣는다. 이걸 "인스턴스의 SSM Agent가 AWS 쪽으로 **아웃바운드 443** 연결을 유지하고, Actions는 AWS API(`ssm:SendCommand`)로 명령만 보낸다"로 바꾼다.

부수 목표(심사 항목 대응):
- 불필요한 포트 비공개: 22번 상시 닫힘(또는 Lightsail 브라우저 SSH 대역 한정, §6-D)
- 민감정보: GitHub에서 **SSH 개인키 제거**, 가능하면 **AWS 정적 키 제거(OIDC)**
- 결정 0004의 성질 유지: env 값이 로그·명령 인자·평문 파일(인스턴스 외)에 남지 않음

## 2. 사실 / 가정 / 미확인

**확인한 사실 (코드 기준)**
- `deploy.yml`: verify(ci.yml) → build → `release.tgz` 패키징 → 22 개방 → env를 SSH stdin으로 `~/app/.env.production`(umask 077, `.prev` 보관) → scp → 원격에서 압축 해제 후 `remote-deploy.sh` → `always()`로 22 닫기.
- `remote-deploy.sh`: `pnpm install --prod --frozen-lockfile` → `pm2 startOrReload` → `/api/health`에서 `"database":"UP"` 20회×2초 확인, 실패 시 `pm2 logs` 50줄 출력하고 exit 1. **ubuntu 사용자의 HOME/pm2 기준**으로 동작.
- `render-env.sh`: 필수값 검사 후 env 본문을 stdout으로 출력.
- GitHub Secrets: `AWS_ACCESS_KEY_ID/SECRET`(Lightsail 포트 제어), `LIGHTSAIL_SSH_KEY`, `LIGHTSAIL_HOST`, `LIGHTSAIL_INSTANCE_NAME`, `AWS_REGION`, DB/SEED 값.
- 레포 public → Actions 로그 공개.

**AWS 동작에 관한 사실 (AWS 문서 기준, 실제 계정에서 미검증)**
- Lightsail 인스턴스는 EC2 인스턴스 프로파일을 못 붙인다 → SSM에는 **하이브리드 활성화**(activation code/id + 서비스 역할)로 `mi-xxxx` 관리형 노드로 등록해야 한다.
- 하이브리드 **standard tier**: Run Command 무료. **Session Manager는 하이브리드 노드에서 advanced tier 필요**(노드당 시간 과금, 약 $5/월 수준).
- Run Command는 기본 **root**로 실행 → `sudo -u ubuntu -H bash -lc ...`로 감싸야 기존 pm2/HOME이 맞는다.
- `SendCommand`의 **파라미터(명령 문자열)는 SSM 명령 기록·CloudTrail에 남는다** → env 값을 명령 인자로 넣으면 결정 0004 위반.
- `GetCommandInvocation`의 stdout은 24,000자까지. `aws ssm wait command-executed`는 약 100초에서 타임아웃 → pnpm install이 길면 직접 폴링해야 한다.
- Lightsail 방화벽은 22번을 `lightsail-connect` 별칭(브라우저 SSH 대역)으로만 열 수 있다. 22를 완전히 닫으면 **브라우저 SSH도 안 된다**.

**가정**
- 인스턴스는 아웃바운드 443이 막혀 있지 않다(Lightsail 기본은 아웃바운드 전체 허용).
- Ubuntu 24.04에는 snap `amazon-ssm-agent`가 기본 설치돼 있을 수 있으나 하이브리드 등록은 별도(`amazon-ssm-agent -register`) 필요.
- AWS CLI는 인스턴스에 없다(설치 스크립트에 없음).

**미확인 → 확인 방법**
- 인스턴스에 snap agent가 이미 있는지: 브라우저 SSH로 `snap list amazon-ssm-agent`.
- 리전에서 하이브리드 활성화 가능 여부/계정 한도: 콘솔 Systems Manager → Hybrid activations.
- GitHub OIDC 공급자가 계정에 이미 있는지: IAM → Identity providers.
- 실제 배포 소요 시간(폴링 타임아웃 설정용): 최근 Actions 실행 기록.

## 3. 관련 코드 경로

| 위치 | 현재 역할 | 전환 후 |
|---|---|---|
| `.github/workflows/deploy.yml` | 22 개방·scp/ssh·22 닫기 | S3 업로드 → SendCommand → 결과 폴링 → 정리 |
| `server/deploy/render-env.sh` | env 본문 생성 | 그대로 (출력 대상만 바뀜) |
| `server/deploy/remote-deploy.sh` | 설치·pm2·헬스체크 | 그대로. 앞에 "받기/풀기/env 쓰기" 래퍼 추가(`ssm-deploy.sh` 신규 또는 SendCommand 본문) |
| `server/deploy/lightsail-setup.sh` | 최초 세팅 | SSM 등록(+필요 시 AWS CLI) 절차 추가 검토 |
| `server/docs/README.md` L32–34 | "22 한시 개방", "SSH 키 Secrets" | 문구 갱신 |
| `server/docs/infra-architecture.*` | SSH 경로 표기 | Actions→SSM→Agent(아웃바운드), S3 추가 |
| AWS: IAM 사용자, Lightsail 방화벽 | 포트 제어 키 | OIDC 역할(또는 축소 키), SSM 서비스 역할, S3 버킷 |

## 4. 원인(왜 바꾸나)

현재 약점은 모두 "인바운드 SSH를 쓴다"에서 나온다.
1. 배포 중 22가 인터넷(러너 IP)에 열린다.
2. 러너가 강제 종료(취소·타임아웃·러너 장애)되면 `Close SSH port`가 안 돌아 규칙이 남을 수 있다.
3. SSH 개인키가 GitHub Secrets에 있다(유출 시 셸 권한).
4. `StrictHostKeyChecking=accept-new` → 첫 접속 MITM에 취약.
5. Lightsail 포트를 여닫는 권한을 가진 정적 AWS 키가 GitHub에 있다.

SSM 전환은 1·2·3·4를 구조적으로 없애고, OIDC를 같이 하면 5도 없앤다.

## 5. 영향 범위와 위험

- **운영 배포 자체**: 전환 PR이 `main`에 들어가는 순간 새 방식으로 배포된다. 인스턴스 등록·IAM·버킷이 **먼저** 준비돼 있지 않으면 배포가 실패한다(앱은 이전 버전으로 계속 동작 — pm2 reload 전 단계에서 실패하므로).
- **env 전달**: 방법에 따라 값이 S3/Parameter Store에 잠시 존재한다(§6-B). 결정 0004의 "원본은 GitHub" 원칙과의 관계를 정해야 한다.
- **공개 로그**: SendCommand 출력(pnpm 로그, pm2 logs 50줄)을 Actions에 출력하면 지금과 같은 수준으로 공개된다. 사전 서명 URL을 echo하면 안 된다(`::add-mask::`).
- **실행 사용자**: root로 돌면 `~/app`이 `/root/app`이 되고 pm2 데몬이 둘이 된다 → 반드시 ubuntu로 실행.
- **긴급 접속**: 22 완전 차단 시 브라우저 SSH 불가. SSM 세션은 advanced tier 비용. (§6-D)
- **비용**: Run Command/standard tier/Parameter Store standard/OIDC 무료. S3는 수 MB·짧은 수명이라 사실상 0. Session Manager를 쓰면 advanced tier 월 ~$5.
- **되돌리기**: 기존 SSH 방식 워크플로를 git revert하면 복구 가능 — 단 SSH 키 Secret과 포트 제어 권한을 **전환 검증 후에 지워야** 되돌릴 수 있다.
- **수집 워크플로(SEED_TOKEN)**: 영향 없음.

## 6. 대안

### A. 산출물(release.tgz) 전달

| 안 | 내용 | 장점 | 단점 |
|---|---|---|---|
| **A1 (권장)** S3 + 사전 서명 GET URL | 비공개 버킷 `.../releases/<run_id>.tgz` 업로드, 10분짜리 presigned URL을 명령 파라미터로 넘김, 인스턴스는 `curl`로 받음. 버킷 수명주기 1일 삭제 | 인스턴스 역할에 S3 권한 불필요, 인스턴스에 AWS CLI 불필요 | URL이 명령 기록에 남음(10분 후 무효, 산출물은 공개 레포 빌드물이라 비밀 아님) |
| A2 S3 + 인스턴스 역할 GetObject | 인스턴스가 `aws s3 cp` | URL 노출 없음 | 인스턴스에 AWS CLI 설치, 서비스 역할 권한 확대 |
| A3 base64로 명령에 인라인 | 버킷 없음 | 리소스 최소 | 명령 크기 제한(문서 파라미터 수십 KB)으로 dist가 안 들어감 → 불가 |

### B. `.env.production` 전달 (핵심)

| 안 | 내용 | 0004 성질 | 비고 |
|---|---|---|---|
| **B1 (권장)** Parameter Store SecureString, 배포 후 삭제 | Actions가 `put-parameter --type SecureString --overwrite`(값은 stdin/`file://` 아님, `--cli-input-json` 파일 없이 환경변수로), 인스턴스가 `get-parameter --with-decryption`으로 받아 600 파일로 씀, 성공/실패와 무관하게 Actions가 `delete-parameter` | 로그·명령 인자 ✗. KMS 암호화 상태로 수 분 존재 | 인스턴스에 AWS CLI + 서비스 역할에 해당 파라미터 1개 `GetParameter` 권한 필요 |
| B1′ Parameter Store를 **상시 원본**으로 | 지우지 않음 | 위와 같음 | 원본이 GitHub+SSM 둘로 갈림 → 0004 수정 필요. 비권장 |
| B2 S3 + SSE-KMS + presigned URL | env 파일을 S3에 올리고 즉시 삭제 | 저장 시 암호화, 단 **URL 자체가 비밀이 되고 그 URL이 명령 기록에 남음**(10분) | 공개 로그에는 마스킹 가능하나 SSM 기록 열람자는 10분간 받기 가능 |
| B3 명령 인자에 직접 | — | **위반**(CloudTrail/명령 기록 평문) | 기각 |
| B4 env를 KMS로 암호화한 blob을 tgz에 동봉 | 인스턴스가 kms:Decrypt | 저장물이 암호문뿐 | KMS 키 월 $1, 인스턴스 CLI 필요, 구성 복잡 |

AWS CLI 설치가 싫다면 B2가 차선. 비밀이 "짧은 URL"로 바뀌는 대신 CLI가 필요 없다.

### C. GitHub Actions 자격 증명

| 안 | 내용 | 장단점 |
|---|---|---|
| **C1 (권장)** GitHub OIDC → IAM 역할 | 신뢰 정책 `token.actions.githubusercontent.com:sub = repo:neordinary-hackathon-2/<repo>:ref:refs/heads/main`(+`workflow_dispatch`도 main에서만), `aud=sts.amazonaws.com`. `AWS_ACCESS_KEY_ID/SECRET` Secret 삭제 | 정적 키 0개. 설정 한 번 필요 |
| C2 기존 IAM 사용자 키 유지 + 정책 교체 | 정책만 최소 권한으로 | 작업 적음, 정적 키 잔존 |

최소 권한 정책 초안(역할/사용자 공통):
- `ssm:SendCommand` — Resource: `arn:aws:ssm:<region>::document/AWS-RunShellScript` **와** `arn:aws:ssm:<region>:<acct>:managed-instance/mi-xxxx` (둘 다 있어야 대상 한정됨)
- `ssm:GetCommandInvocation`, `ssm:ListCommandInvocations` — Resource `*`(리소스 수준 제한 미지원)
- `ssm:PutParameter`, `ssm:DeleteParameter` — `arn:aws:ssm:<region>:<acct>:parameter/hackathon/deploy/env` (B1일 때)
- `s3:PutObject` — `arn:aws:s3:::<bucket>/releases/*` (presigned GET은 서명자 권한을 쓰므로 `s3:GetObject`도 같은 경로에 필요)
- Lightsail 권한은 **제거**(§D-2를 고를 경우 제외)

인스턴스 쪽 SSM 서비스 역할: `AmazonSSMManagedInstanceCore` + (B1) 해당 파라미터 `ssm:GetParameter`, 기본 KMS 키 `kms:Decrypt`(aws/ssm 키는 SSM 경유 시 자동).

### D. 긴급 접속

| 안 | 내용 | 포트 | 비용 |
|---|---|---|---|
| **D1 (권장)** 22번을 `lightsail-connect` 별칭에만 상시 허용 | 콘솔 브라우저 SSH만 가능, 인터넷에는 닫힘 | 22: Lightsail 내부 대역만 | 0 |
| D2 22 완전 차단, 필요할 때 콘솔에서 사람이 잠깐 엶 | 가장 엄격 | 평소 0개 | 0, 대응 느림 |
| D3 SSM Session Manager | advanced tier로 승격 | 22 완전 차단 | ~$5/월 |

Run Command 자체도 `AWS-RunShellScript`로 임시 명령 실행이 되므로 "읽기·재시작" 수준은 D2에서도 가능.

### E. 실행 방식(래퍼)

- **E1 (권장)** `server/deploy/ssm-deploy.sh`를 tgz에 포함하지 않고(받기 전이라), SendCommand 본문은 짧은 부트스트랩만: `curl URL → /tmp/release.tgz → sudo -u ubuntu ... tar → env 쓰기 → bash remote-deploy.sh`. 본문 스크립트를 레포 파일로 두고 워크플로에서 `jq`로 commands 배열을 만든다 → 리뷰 가능.
- 폴링: `get-command-invocation`을 10초 간격, 최대 10분. `Success` 외 상태면 stdout/stderr 출력 후 exit 1. `executionTimeout`은 900초.

## 7. 권장안

**A1 + B1 + C1 + D1 + E1.**

이유: 22번은 인터넷에서 완전히 사라지고(D1은 AWS 내부 브라우저 SSH 대역뿐), GitHub에서 SSH 키와 AWS 정적 키가 모두 빠진다. env는 KMS 암호화 상태로 배포 몇 분 동안만 존재하고 즉시 삭제되어 "원본은 GitHub" 원칙(0004)을 유지한다. 추가 비용 0. 단점은 인스턴스에 AWS CLI 설치, 최초 AWS 설정 단계가 많다는 것.

### 구현 단계 (작게 나눔)
1. **[사용자, AWS]** S3 버킷(비공개·퍼블릭 차단·수명주기 1일), SSM 서비스 역할, 하이브리드 활성화 생성 → 인스턴스에서 등록. `mi-` ID 확인.
2. **[사용자, AWS]** OIDC 공급자 + 배포 역할(위 정책). GitHub Secrets 추가: `AWS_DEPLOY_ROLE_ARN`, `SSM_INSTANCE_ID`, `DEPLOY_BUCKET`.
3. **[코드]** `lightsail-setup.sh`에 SSM 등록·AWS CLI 설치 절차(활성화 코드는 인자/프롬프트로, 파일에 남기지 않음).
4. **[코드]** `server/deploy/ssm-bootstrap.sh`(인스턴스에서 돌 부트스트랩) + `deploy.yml` 교체(`permissions: id-token: write`, S3 업로드, put-parameter, send-command, 폴링, `always()` 정리).
5. **[코드]** README·구성도·ADR 0006.
6. **[사용자]** 에픽 → main 머지 후 첫 배포 확인 → 성공하면 `LIGHTSAIL_SSH_KEY`, `LIGHTSAIL_HOST`(필요 없으면), `AWS_ACCESS_KEY_ID/SECRET` 삭제, 기존 IAM 사용자 삭제, Lightsail 22 규칙을 `lightsail-connect`로 교체.

## 8. 검증 계획

| 검사 | 무엇을 증명하나 |
|---|---|
| `actionlint` / `bash -n` / `shellcheck` | 워크플로·스크립트 문법 (로컬에서 가능) |
| `render-env.sh` → 부트스트랩의 env 쓰기 부분을 로컬 임시 HOME에서 실행 | 파일 권한 600, `.prev` 보관, 내용 일치 |
| 수동 `aws ssm send-command`로 `whoami; echo $HOME` (ubuntu로 감싼 형태) | 실행 사용자·HOME이 ubuntu인지 |
| 에픽 브랜치에서 `workflow_dispatch` 불가(main만 신뢰) → **첫 실검증은 main 머지 후** | OIDC 신뢰 조건이 main으로 제한됨을 같이 확인 |
| 실패 시나리오: 일부러 헬스체크 실패(잘못된 DB_HOST로 dispatch는 위험) 대신 폴링 로직을 `Failed` 상태 모의 JSON으로 로컬 테스트 | 종료 코드 전파 |
| 배포 후 `aws ssm get-parameter` → ParameterNotFound | env 파라미터 삭제 확인 |
| CloudTrail `SendCommand` 이벤트의 requestParameters 확인 | env 값이 인자에 없음 |
| Actions 공개 로그 검색(DB 비밀번호 일부, presigned URL) | 로그 비노출 |
| Lightsail 방화벽 조회 `get-instance-port-states` | 22가 인터넷에 없음 |
| 외부에서 `nc -vz <ip> 22` | 실제로 닫힘 |
| 되돌리기: SSH 키 삭제 전까지 기존 워크플로 revert로 배포 가능 | 롤백 경로 존재 |

**못 하는 것(로컬)**: 실제 SSM 등록·SendCommand·OIDC 신뢰는 AWS 계정과 main 브랜치가 있어야 확인된다. 첫 운영 배포가 사실상 통합 테스트다 → 머지 시점을 트래픽 적은 때로.

## 사용자가 정할 것

1. env 전달: **B1**(Parameter Store, 배포 후 삭제, 인스턴스에 AWS CLI 설치) / B2(S3+presigned, CLI 불필요)
2. 자격 증명: **C1**(OIDC, 정적 키 제거) / C2(기존 키 + 최소 권한)
3. 긴급 접속: **D1**(22를 Lightsail 브라우저 SSH 대역만) / D2(완전 차단) / D3(Session Manager, ~$5/월)
4. AWS 리소스(버킷·역할·활성화·OIDC) 생성은 사용자가 직접 하고 값만 Secrets에 넣는다 — 제가 CLI 명령을 단계별로 적어 드릴지 여부
