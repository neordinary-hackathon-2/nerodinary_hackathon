# 0003. YouTube 영상은 Actions에서 도는 수집기가 모아 내부 동기화 API로 보낸다

- 상태: 결정됨 (2026-11-21). 내부 API 계약의 선택 필드 두 개는 **제안** 상태
- 결정자: sychoi
- 범위: `server/src/youtube-collector/`, `.github/workflows/youtube-collect.yml`

## 배경

채널별 영상 풀을 YouTube Data API로 채워야 한다(`docs/youtube-data-api.md`). 스크래핑은 하지 않는다. channel/video 테이블과 조회 API는 별도 작업이고, 이 결정은 **수집기**만 다룬다.

## 결정

| 항목 | 값 | 근거 |
| --- | --- | --- |
| 실행 위치 | GitHub Actions. 수집기는 DB에 직접 붙지 않고 서버의 내부 API만 호출한다 | 스펙 문서 1장. API 키와 DB 접근을 분리 |
| 코드 위치 | `server/src/youtube-collector/` (Nest 의존성 없는 순수 TS) | 기존 lint·vitest·CI·빌드를 그대로 쓴다 |
| 채널당 목표 | 활성 영상 100개 유지 (`TARGET_PER_CHANNEL`) | 11.21 결정 |
| 재실행 정책 | 부족분만 보충 | 편성이 안정적이고 풀 크기가 일정하다. 꽉 찬 채널은 검색하지 않아 할당량을 아낀다 |
| 영상 길이 | 10분 ~ 2시간 (`MIN/MAX_DURATION_SECONDS`) | 11.21 기획 결정. 하한 덕분에 숏폼(최대 3분)은 따로 판별하지 않아도 빠진다 |
| 필터 | `status.embeddable=true`, `privacyStatus=public` | 스펙 문서 2.2 |
| 검색 | 검색어별로 `videoDuration=medium`·`long` 을 따로, 채널을 돌아가며 한 페이지씩 | 검색어를 OR로 묶으면 고유 결과가 빨리 바닥난다. 한 채널이 상한을 독점하지 않게 한다 |
| 검색 상한 | 실행당 `search.list` 60회 (`SEARCH_CALL_BUDGET`), 채널당 6회 (`SEARCH_CALLS_PER_CHANNEL`, 페이지 넘김 포함) | 일일 한도 100회. 채널당 상한은 PR #12 기획 요청. 실측에서 채널당 3~4회면 100개가 찼다 |
| 재검증 | 매 실행마다 활성 영상 전체를 `videos.list`로 확인 | 삭제·비공개·임베드 차단 영상을 DB에서 지우도록 서버에 알린다(`videos` 테이블에 활성 여부 컬럼이 없다). 30일 내 데이터 갱신 정책도 충족 |
| 검색어 원본 | DB Channel 컬럼. 수집기는 내부 API로 읽는다 | 배포 없이 수정 가능 |

## YouTube API 한도 (2026-11-21 공식 문서 확인)

- `search.list`: 전용 버킷, **하루 100회**, 호출당 1. 페이지당 최대 50개.
- `videos.list` 등 나머지: 하루 10,000유닛 합산, 호출당 1 (ID 50개까지).
- 한도는 태평양 시간 자정(한국 시간 17:00, 서머타임 중에는 16:00)에 초기화된다.
- `docs/youtube-data-api.md` 의 할당량 설명은 이 체계 이전 기준일 수 있다.

실측(2026-11-21, dry-run, 기획 편성표 제안 검색어): 채널 9개 × 100개 = 900개를 처음 채우는 데 `search.list` 32회가 들었다. 채널당 3~4회, 새 후보 1,579개 중 1,089개 통과(69%), 검색 1회당 통과 34개. 통과한 영상이 채널 성격에 맞는지는 확인하지 않았다.

## 서버 내부 API 계약

원본은 `src/youtube/youtube-internal.schema.ts` 다. 수집기와 내부 API 컨트롤러가 이 파일을 함께 import하므로 한쪽만 바뀌면 컴파일에서 드러난다. 두 API 모두 `X-Seed-Token` 헤더로 보호한다. 컨트롤러는 아직 구현 전이다.

```
GET  /api/internal/youtube/seed-config
  → { channels: [{ code, seedKeywords: string[], storedVideoIds?: string[] }] }

POST /api/internal/youtube/sync      (채널당 1회)
  { channelCode,
    videos: [{ youtubeVideoId, title, thumbnailUrl, durationSeconds, publishedAt,
               sourceYoutubeChannelId, sourceChannelTitle, privacyStatus, isEmbeddable }],
    removedVideoIds?: string[] }
  → { acceptedCount, rejectedCount, rejected: [{ youtubeVideoId, reason }] }
```

- `videos`에는 새 영상과, 메타데이터를 갱신할 기존 영상이 함께 들어온다. 서버는 `youtubeVideoId` 기준으로 upsert하고 `lastRefreshedAt`을 갱신한다.
- 수집기는 공개·임베드 가능·썸네일이 있는 영상만 보낸다. 서버는 길이·공개·임베드 조건을 다시 확인하고, 제외한 영상을 `rejected`로 돌려준다. 수집기는 이를 로그와 요약에 남긴다.
- 한 영상은 한 채널에만 속한다(`youtube_video_id` 고유 제약).

### 제안: 선택 필드 두 개 (2026-11-21, 담당자 합의 전)

처음 계약(PR #17)에는 저장된 영상을 알려주거나 지우는 수단이 없어, "채널당 100개 유지"와 재검증을 할 수 없었다. 그래서 선택 필드 두 개를 더했다. 둘 다 없어도 통신은 된다.

| 필드 | 없을 때 수집기 동작 |
| --- | --- |
| `seed-config` 의 `storedVideoIds` | 현재 개수를 몰라 재검증을 건너뛰고, 매 실행마다 목표 개수만큼 새로 찾아 보낸다(영상이 계속 누적된다) |
| `sync` 의 `removedVideoIds` | 지울 영상이 없으면 수집기가 필드를 생략한다. 서버가 이 필드를 처리하지 않으면 죽은 영상이 DB에 남는다 |

`removedVideoIds`만 있고 `videos`가 빈 요청이 가능하도록 `videos`의 최소 1개 제약을 뺐다. 보낼 것도 지울 것도 없으면 수집기는 호출하지 않는다.

## 실패 시 동작

- 채널 설정 조회 실패: 아무것도 바꾸지 않고 종료 코드 1.
- `videos.list` 호출 실패: 해당 배치의 영상은 살아 있는 것으로 두고 삭제 목록에 넣지 않는다. 호출 실패를 영상 삭제로 오인하지 않는다.
- 할당량 초과(403 `quotaExceeded`)·검색 상한(실행 전체 또는 채널당) 도달: 검색을 멈추고 그때까지의 결과만 보낸다. 정상 종료.
- YouTube가 검색 요청을 거부(4xx, 잘못된 키 등): 검색을 바로 멈추고 종료 코드 1. 일시 오류(5xx·네트워크)는 그 검색만 건너뛴다.
- 한 채널의 동기화 실패: 나머지 채널은 계속 보내고 종료 코드 1.
- 목표에 못 미친 채널: 실패가 아니다. 요약에 `87/100` 처럼 표시한다.

## 실행

```bash
pnpm build

# 서버 없이 실측: YouTube 는 실제로 호출하고 서버에는 보내지 않는다.
pnpm collect:youtube --dry-run --channels-file=channels.json --channel=1

# 실제 동기화 (SYNC_API_BASE_URL, SEED_TOKEN 필요)
pnpm collect:youtube
```

`channels.json` 은 `seed-config` 의 result 와 같은 형태(`{ channels: [...] }`)다. 기획 편성표(제안)의 검색어를 옮긴 예시가 `docs/youtube-collector-channels.sample.json` 에 있다. 환경변수는 `.env.example` 참고.

## 알려진 한계

- 자동 검색이라 채널 성격에 맞지 않는 영상이 섞인다. 100개까지 내려가면 비율이 높아진다.
- 다음 날 실행은 같은 검색의 앞 페이지를 다시 받는다. 이미 아는 영상은 빠지지만 검색 횟수는 쓴다. 검색어가 적은 채널은 100개에 못 미칠 수 있고, 검색어를 늘려야 한다.
- 수집기 코드는 서버 배포물(`dist/`)에 함께 들어가지만 서버가 import하지 않아 실행되지 않는다.
