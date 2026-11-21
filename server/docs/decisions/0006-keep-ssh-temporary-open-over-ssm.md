# 0006. 배포는 SSH 22번 한시 개방 방식을 유지한다 (SSM Run Command 전환 보류)

- 상태: 결정됨 (2026-11-22)
- 결정자: sychoi
- 범위: `.github/workflows/deploy.yml`, Lightsail 방화벽, 배포용 IAM
- 조사 자료: [ssm-deploy-investigation.md](../ssm-deploy-investigation.md)

## 배경

지금 배포(`deploy.yml`)는 Lightsail 방화벽의 22번을 **러너 IP/32에만, 배포하는 동안만** 열고 scp/ssh로 산출물과 `.env.production`(표준입력, 결정 0004)을 보낸 뒤 `always()` 단계에서 닫는다.

인프라 심사 항목인 '불필요한 포트 비공개'를 더 강하게 만족시키려고, 인바운드 22번을 아예 쓰지 않는 **AWS SSM Run Command** 방식을 검토했다. 이 방식에서는 인스턴스의 SSM Agent가 아웃바운드 443으로 AWS에 연결하고, Actions는 `ssm:SendCommand`만 호출한다.

현재 방식에서 확인된 약점:

1. 배포하는 몇 분 동안 22번이 인터넷(러너 IP 1개)에 열린다.
2. 러너가 강제 종료되면 닫기 단계가 실행되지 않아 규칙이 남을 수 있다.
3. SSH 개인키(`LIGHTSAIL_SSH_KEY`)와 Lightsail 포트 제어용 정적 AWS 키가 GitHub Secrets에 있다.
4. `StrictHostKeyChecking=accept-new`라 첫 접속 때 호스트를 검증하지 않는다.

## 결정

**현재 구조를 유지한다.** SSM Run Command 전환은 하지 않는다. 이번에는 코드를 바꾸지 않는다.

## 이유

- 지금 구조도 심사 항목을 설명할 수 있다. 22번은 평소 닫혀 있고, 배포 중에도 /32 한 개에만 열린다. 민감정보는 GitHub Secrets가 원본이고 표준입력으로 전달된다(0004). CI/CD는 verify → deploy → `/api/health` 확인으로 자동화돼 있다.
- SSM으로 전환하려면 AWS 쪽에 S3 버킷, SSM 서비스 역할, 하이브리드 활성화, (권장안 기준) GitHub OIDC 공급자와 배포 역할을 새로 만들어야 한다. 인스턴스에는 SSM Agent 등록과 AWS CLI 설치가 필요하다.
- 새 경로는 `main`에 머지해 운영에 배포해야만 검증된다(OIDC 신뢰를 `main`으로 제한하므로 에픽 브랜치에서 미리 돌릴 수 없다). 해커톤 일정에서는 얻는 점수보다 운영 배포가 실패할 위험이 더 크다고 판단했다.

## 검토한 대안

| 대안 | 채택하지 않은 이유 |
| --- | --- |
| SSM Run Command + S3 presigned URL + Parameter Store(배포 후 삭제) + GitHub OIDC (조사 권장안) | 위 "이유". 새로 만들 AWS 리소스가 많고, 운영 배포로만 검증할 수 있다 |
| 위 방식 + SSM Session Manager로 긴급 접속 | 하이브리드 노드에서 쓰려면 advanced tier(월 약 $5)가 필요하다 |
| 현재 구조 + 작은 보강(호스트 키 고정, job `timeout-minutes`, 배포 전에 남은 22번 규칙 정리) | 효과는 있지만 이번에는 변경하지 않기로 했다. 다시 검토할 때 1순위다 |

## 감수하는 것

- 위 "배경"의 약점 1~4가 그대로 남는다.
- 2번(규칙이 남는 경우)이 생기면 Lightsail 콘솔 → 네트워킹에서 22번 규칙을 직접 지워야 한다.

## 다시 검토할 조건

- 해커톤 이후 서비스를 계속 운영하면 → 먼저 작은 보강(호스트 키 고정, 타임아웃, 남은 규칙 정리)을 적용하고, 다음으로 SSM 전환을 검토한다. 절차·IAM 정책 초안·검증 계획은 조사 자료에 있다.
- SSH 키나 AWS 키가 유출됐다고 의심되면 → 키를 즉시 교체하고 SSM + OIDC 전환을 우선 진행한다.
