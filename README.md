# Ne(o)rdinary Hackathon

11th Ne(o)rdinary Hackathon 모노레포.

| 폴더 | 파트 | 배포 |
|---|---|---|
| [server/](server/) | 백엔드 API (NestJS) | AWS — `main` 푸시 시 GitHub Actions |

파트별 실행 방법은 각 폴더의 README를 참고한다.
각 폴더는 독립된 프로젝트다. 의존성 설치와 명령 실행은 해당 폴더 안에서 한다.

```bash
cd server && pnpm install && pnpm start:dev
```

CI/CD 워크플로는 `.github/workflows/`에 있고, `paths` 필터로 해당 폴더가 바뀔 때만 실행된다.
