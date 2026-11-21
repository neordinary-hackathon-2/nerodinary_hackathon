# 기획 문서

PM이 관리하는 기획 문서 모음입니다. **원본(SSOT)은 PM의 로컬이며, 이 폴더는 변경 시마다 PR로 동기화됩니다.**
개발자는 읽기 전용으로 참고해 주세요. 수정이 필요하면 PM에게 요청하거나 이슈/PR 코멘트로 남겨 주세요.

## 구조

| 폴더 | 내용 |
|---|---|
| [planning/](planning/) | 기획 본문 (타임라인·문제 정의·기능·플로우·발표) |
| [meetings/](meetings/) | 회의록 (결정 사항·R&R·열린 질문) |
| [guides/](guides/) | 직무별 해커톤 가이드 (PM·Design·Web·Android·iOS·Server) |

## 기획 문서

| 파일 | 내용 |
|---|---|
| [planning/00-timeline.md](planning/00-timeline.md) | PM 체크 타임라인 |
| [planning/01-problem.md](planning/01-problem.md) | 문제 정의·타겟·근거 |
| [planning/02-features.md](planning/02-features.md) | MVP 기능 목록·필요 데이터 |
| [planning/03-flow.md](planning/03-flow.md) | 화면·사용자 플로우 |
| [planning/04-presentation.md](planning/04-presentation.md) | 발표 구성·협업 로그 |
| [meetings/05-meeting-01.md](meetings/05-meeting-01.md) | 1차 회의록 |

## 직무별 가이드

[PM](guides/PM.md) · [Design](guides/Design.md) · [Web](guides/Web.md) · [Android](guides/Android.md) · [iOS](guides/iOS.md) · [Server](guides/Server.md)

출처: https://cmc-11th-hackathon.vercel.app

## 변경 규칙

- 브랜치: `epic/common/docs-<설명>` → `main` PR (브랜치 정책상 문서는 `common` 서비스)
- 문서만 바뀌므로 `app/`, `web/`, `server/` CI·배포는 트리거되지 않음
