# 인프라 구성도 (제출용)

Ne(o)rdinary Hackathon 서버 파트의 AWS 인프라 구성도입니다. 인프라 심사(구글폼) 제출물로 사용합니다.

## 파일

| 파일 | 용도 |
| --- | --- |
| `infra-architecture.png` | **구글폼 업로드용** 최종 이미지 (3440×2280, 가로형) |
| `infra-architecture.svg` | **수정 가능한 소스** (벡터, 모든 편집기/브라우저에서 열림) |
| `infra-architecture.mmd` | Mermaid 소스 (mermaid.live 등에서 구조 편집용) |

## 수정 방법

- **텍스트/위치 미세 수정** → `infra-architecture.svg` 를 편집한 뒤 아래로 PNG 재생성.
- **구조/노드 변경** → `infra-architecture.mmd` 를 편집(레이아웃은 PNG와 완전히 동일하지 않음).

### PNG 재생성 (SVG → PNG)

```bash
cd server/docs
npx @resvg/resvg-js-cli --fit-width 3440 infra-architecture.svg infra-architecture.png
```

또는 브라우저에서 `infra-architecture.svg` 를 열어 캡처해도 됩니다.

## 심사 항목 충족 지점 (구성도 ③ 범례 참고)

- **WAS/DB 분리** — Lightsail 인스턴스(NestJS = WAS) ↔ Amazon RDS(DB), 서로 다른 VPC + 피어링
- **HTTPS 적용** — Caddy + Let's Encrypt 자동 인증서(443)
- **DB 포트 외부 비노출** — RDS 퍼블릭 액세스 없음, 3306은 Lightsail 사설 IP /32 만 허용
- **불필요한 포트 비공개(방화벽)** — 80·443만 공개, 3000 비공개, SSH 22는 관리자/배포 시 한시 개방
- **CI/CD 자동화** — GitHub Actions: verify(lint·build·test) → deploy → `/api/health` 확인
- **민감정보 관리** — DB 비밀번호·내부 API 토큰·AWS 키·SSH 키 모두 GitHub Secrets. 배포 때 `~/app/.env.production`(권한 600)으로 주입 ([결정 0004](decisions/0004-production-env-from-github-secrets.md))
