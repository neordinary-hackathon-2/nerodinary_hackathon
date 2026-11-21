# 앱 API 명세

프론트·백엔드·기획이 함께 참고할 서비스 API 계약입니다. 공개 조회 API와 GitHub Actions용 내부 수집 API가 구현돼 있습니다. YouTube가 제공하는 API 자체는 [YouTube Data API 연동 스펙](youtube-data-api.md)을 참고합니다.

## 1. 공통 규칙

이 절은 현재 서버에 구현된 공통 기반과 콘텐츠 API 계약을 설명합니다. 공개 상태 확인 경로는 `/api/health`입니다. 채널 목록·전체 채널 랜덤 영상 API와 내부 YouTube 수집 API가 구현돼 있습니다.

예정된 콘텐츠 수집·조회 흐름:

    웹·앱 → 공개 API → NestJS → RDS
    GitHub Actions → YouTube Data API → 내부 API → NestJS → RDS

- 서버 전역 경로 prefix는 `/api`이며, 현재 버전에서는 `v1` 경로를 두지 않습니다.
- 공개 콘텐츠 API는 로그인 없이 호출합니다. 내부 수집 API는 `/api/internal` 아래에 있으며 `X-Seed-Token`으로 보호합니다. `internal` 경로 자체는 인증 수단이 아닙니다.
- NestJS의 성공·오류 응답은 전역 인터셉터와 예외 필터를 통해 다음 봉투로 반환합니다. 타입 정의는 `shared/api/envelope.ts`에 있습니다.

| 응답 필드 | 타입 | 의미 |
|---|---|---|
| isSuccess | boolean | 성공 여부 |
| code | string | 결과 코드. 일반 조회 성공은 COMMON200 |
| message | string | 결과 메시지 |
| result | 객체·배열·null | API별 실제 데이터. 실패 시 null 또는 오류 상세 |

## 2. 공개 조회 API

### GET /api/channels — 채널 목록 조회 (F1)

채널 번호, 카테고리명, 슬로건을 번호순으로 반환합니다. F1에서 채널 정보를 로딩하고 F9 편성표 팝업을 표시할 때 사용합니다. 랜덤 영상 API에는 이름과 슬로건이 없으므로 채널 메타데이터는 이 API에서 받습니다. 0번 컬러바도 목록에 포함하며, 이 채널에는 영상 후보가 없습니다. DB 내부 ID는 노출하지 않습니다.

| 구분 | 필드 | 타입·필수 여부 | 의미 |
|---|---|---|---|
| 요청 | Path/Query/Body | 없음 | 전체 채널 목록 조회 |
| 응답 | result.channels[] | 배열, 필수, 최대 10개 | 등록된 0~9번 채널을 번호순으로 반환. 시딩 전에는 빈 배열 |
| 응답 | result.channels[].channelNumber | number, 필수 | 리모컨과 화면에 표시할 채널 번호(0~9) |
| 응답 | result.channels[].name | string, 필수 | 카테고리명. 예: 예능, 금융 |
| 응답 | result.channels[].slogan | string, 필수 | 편성표에 표시할 채널 슬로건 |

응답 예:

    {
      "isSuccess": true,
      "code": "COMMON200",
      "message": "요청에 성공했습니다.",
      "result": {
        "channels": [
          {"channelNumber": 0, "name": "컬러바", "slogan": "전원을 켜면 처음 뜨는 대기 화면"},
          {"channelNumber": 1, "name": "예능", "slogan": "웃다 체하지 마세요"},
          {"channelNumber": 2, "name": "금융", "slogan": "밥상에서 갑자기 재테크"},
          {"channelNumber": 3, "name": "뉴스", "slogan": "오늘 일을 밥값 시간에"},
          {"channelNumber": 4, "name": "먹방", "slogan": "남이 먹는 걸 보며 먹기"},
          {"channelNumber": 5, "name": "요리", "slogan": "오늘 반찬은 구경으로"},
          {"channelNumber": 6, "name": "동물", "slogan": "힐링 한 숟갈"},
          {"channelNumber": 7, "name": "음악", "slogan": "수저 내려놓고 감상"},
          {"channelNumber": 8, "name": "스포츠", "slogan": "밥 먹다 응원 시작"},
          {"channelNumber": 9, "name": "홈쇼핑", "slogan": "지금 안 사면 밥 식어요"}
        ]
      }
    }

채널 시딩 전에는 `channels: []`을 반환합니다. 0~9번 채널을 시딩하면 편성표에 10개가 표시됩니다.

### GET /api/channels/random-videos — 전체 채널의 랜덤 영상 10개씩

한 번의 요청으로 0~9번 채널을 번호순으로 반환하고, 채널마다 저장된 후보 중 중복 없이 최대 10개를 랜덤으로 선택합니다. 후보가 10개보다 적으면 저장된 후보를 모두 반환하고, 후보가 없으면 빈 배열을 반환합니다. 이 API는 재생 후보용이며, 채널 정보 표시는 `GET /api/channels`를 사용합니다. 채널별 영상 조회 API는 두지 않습니다.

| 구분 | 필드 | 타입·필수 여부 | 의미 |
|---|---|---|---|
| 요청 | Path/Query/Body | 없음 | 전체 채널의 랜덤 영상을 한 번에 조회 |
| 응답 | result.channels[] | 배열, 필수 | channelNumber 오름차순의 모든 채널 |
| 응답 | result.channels[].channelNumber | number, 필수 | 리모컨과 화면에 표시할 채널 번호(0~9). DB 내부 PK는 노출하지 않음 |
| 응답 | result.channels[].videos | 배열, 필수, 최대 10개 | 해당 채널에서 무작위로 선택한 영상. 후보가 없으면 빈 배열 |
| 응답 | result.channels[].videos[].youtubeVideoId | string | YouTube iframe 재생 주소를 만드는 ID |
| 응답 | result.channels[].videos[].title | string | 영상 제목 |
| 응답 | result.channels[].videos[].thumbnailUrl | string | 카드·재생 전 화면용 썸네일 주소 |
| 응답 | result.channels[].videos[].durationSeconds | number | 영상 길이(초) |

응답 예시는 두 채널만 표시합니다. 1번 채널은 저장 후보가 2개, 2번 채널은 후보가 없는 경우이며, 실제 응답은 0~9번 채널을 포함합니다. 0번 컬러바와 영상 후보가 없는 채널은 빈 videos 배열을 반환합니다. 후보가 10개 이상인 채널은 videos에 10개를 반환합니다.

    {
      "isSuccess": true,
      "code": "COMMON200",
      "message": "요청에 성공했습니다.",
      "result": {
        "channels": [
          {
            "channelNumber": 1,
            "videos": [
              {
                "youtubeVideoId": "YOUTUBE_VIDEO_ID_1",
                "title": "영상 제목 1",
                "thumbnailUrl": "https://i.ytimg.com/...",
                "durationSeconds": 900
              },
              {
                "youtubeVideoId": "YOUTUBE_VIDEO_ID_2",
                "title": "영상 제목 2",
                "thumbnailUrl": "https://i.ytimg.com/...",
                "durationSeconds": 1200
              }
            ]
          },
          {
            "channelNumber": 2,
            "videos": []
          }
        ]
      }
    }

프론트는 받은 배열에서 채널번호 입력 또는 다음 채널 버튼에 맞는 channelNumber를 선택하고, 그 채널의 videos 중에서 재생할 영상을 고릅니다. 채널을 바꿀 때 추가 API를 호출하지 않습니다. 새 랜덤 후보 묶음이 필요할 때 이 API를 다시 호출합니다. 아이콘·테마 색상은 프론트에서 정하고 수집 검색어는 공개 응답에 포함하지 않습니다. 플레이어의 실제 재생 실패는 프론트에서 처리합니다.

videos가 빈 배열인 경우는 채널 자체는 있지만 DB에 저장된 재생 후보가 0개일 때입니다. 초기 시딩 전이거나 기존 후보가 모두 재생 조건을 잃어 제거된 경우가 해당합니다. 한 채널만 비어 있어도 전체 응답은 200으로 유지하고, 프론트는 그 채널에 준비 중 안내를 보여주거나 다음 채널로 이동합니다. 즉시 같은 API를 재요청해도 후보가 생기지 않으므로 빈 배열만을 이유로 자동 재시도하지 않습니다. 네트워크 오류나 500 응답에 대한 재시도는 별도로 처리합니다.

## 3. GitHub Actions용 내부 API

X-Seed-Token은 GitHub Secrets와 서버 비밀 설정에 둡니다. YouTube API 키와 별개이며 프론트에는 노출하지 않습니다. 두 엔드포인트 모두 현재 구현되어 GitHub Actions 수집기가 사용합니다.

### GET /api/internal/youtube/seed-config — 수집 설정 조회

채널별 검색어와 이미 저장된 영상 ID를 반환합니다. 수집기는 검색어를 사용해 후보를 찾고, 저장된 ID를 재검증·중복 방지에 사용합니다. 0번 컬러바를 포함해 등록된 채널을 반환합니다.

| 구분 | 필드 | 타입·필수 여부 | 의미 |
|---|---|---|---|
| 요청 Header | X-Seed-Token | string, 필수 | 내부 호출 인증 |
| 요청 | Query/Body | 없음 | 전체 채널 검색어 조회 |
| 응답 | result.channels[].channelNumber | number, 필수 | 서비스 채널 번호(0~9) |
| 응답 | result.channels[].seedKeywords[] | string 배열, 필수 | 채널별 검색어 |
| 응답 | result.channels[].storedVideoIds[] | string 배열, 필수 | 해당 채널에 현재 저장된 YouTube 영상 ID 목록. 채널에 저장 영상이 없으면 빈 배열 |

    {
      "isSuccess": true,
      "code": "COMMON200",
      "message": "요청에 성공했습니다.",
      "result": {
        "channels": [
          {"channelNumber": 1, "seedKeywords": ["예능 클립", "웃긴 모음"], "storedVideoIds": ["YOUTUBE_VIDEO_ID"]}
        ]
      }
    }

### POST /api/internal/youtube/sync — 영상 후보 저장·갱신

Actions가 YouTube Data API에서 검색·검증한 후보와 재검증에서 제거할 영상을 채널별로 보냅니다. 이 API는 HTTP 200을 반환합니다. `videos`가 빈 배열이어도 유효하므로 삭제 대상만 보내는 요청도 가능합니다.

필수 여부는 DB 컬럼의 NULL 가능 여부만으로 정하지 않습니다. 내부 호출 인증, DB 채널 FK를 찾는 값, 저장에 꼭 필요한 메타데이터, 저장 자격 검증값을 필수로 둡니다. 화면·저장에 당장 필요하지 않고 DB에서도 NULL을 허용하는 메타데이터는 선택입니다. DB 내부 ID와 생성·수정 시각은 서버가 만들므로 요청에 받지 않습니다.

| 구분 | 필드 | 타입·필수 여부 | 의미 |
|---|---|---|---|
| 요청 Header | X-Seed-Token | string, 필수 | 내부 호출 인증 |
| 요청 Body | channelNumber | number, 필수 | 영상 수집 대상 채널 번호(1~9). 0번 컬러바는 수집하지 않음 |
| 요청 Body | videos | 배열(0개 이상), 필수 | 새 후보와 갱신할 기존 후보. 빈 배열을 허용하며 삭제 대상만 보낼 수 있음 |
| 요청 Body | videos[].youtubeVideoId | string, 필수 | YouTube 영상 ID. 중복 갱신 기준 |
| 요청 Body | videos[].title | string, 필수 | 영상 제목 |
| 요청 Body | videos[].thumbnailUrl | string, 필수 | YouTube 썸네일 주소 |
| 요청 Body | videos[].durationSeconds | number, 필수 | 초 단위 재생시간 |
| 요청 Body | videos[].publishedAt | ISO 8601 문자열, 선택 | 공개 시각 |
| 요청 Body | videos[].sourceYoutubeChannelId | string, 선택 | 원본 제작자 채널 ID |
| 요청 Body | videos[].sourceChannelTitle | string, 선택 | 원본 제작자 채널명 |
| 요청 Body | videos[].privacyStatus | string, 필수 | public이 아니면 해당 후보를 제외. DB에는 보관하지 않음 |
| 요청 Body | videos[].isEmbeddable | boolean, 필수 | false이면 해당 후보를 제외. DB에는 보관하지 않음 |
| 요청 Body | removedVideoIds | string 배열, 선택 | 삭제·비공개·임베드 불가 등으로 이 채널에서 제거할 영상 ID. 다른 채널에 저장된 같은 영상에는 영향 없음 |
| 응답 | result.acceptedCount | number, 필수 | 저장·갱신한 후보 수 |
| 응답 | result.rejectedCount | number, 필수 | 검증에서 제외한 후보 수 |
| 응답 | result.rejected[].youtubeVideoId | string, 제외 시 | 제외 영상 ID |
| 응답 | result.rejected[].reason | string, 제외 시 | 제외 이유 |
| 응답 | result.evictedCount | number, 필수 | 채널당 보유 상한을 초과해 서버가 오래된 순서로 삭제한 영상 수 |

요청 예:

    {
      "channelNumber": 1,
      "videos": [{
        "youtubeVideoId": "YOUTUBE_VIDEO_ID",
        "title": "영상 제목",
        "thumbnailUrl": "https://i.ytimg.com/...",
        "durationSeconds": 900,
        "publishedAt": "2026-11-20T12:00:00Z",
        "sourceYoutubeChannelId": "UC_CREATOR_CHANNEL_ID",
        "sourceChannelTitle": "원본 제작자 채널명",
        "privacyStatus": "public",
        "isEmbeddable": true
      }],
      "removedVideoIds": []
    }

응답 예:

    {
      "isSuccess": true,
      "code": "COMMON200",
      "message": "요청에 성공했습니다.",
      "result": {"acceptedCount": 1, "rejectedCount": 0, "rejected": [], "evictedCount": 0}
    }

서버는 길이 600–7,200초, 공개·임베드 조건을 확인하고 통과한 영상만 저장합니다. 같은 YouTube 영상을 같은 채널에 다시 보내면 중복 행을 만들지 않고 메타데이터와 `lastRefreshedAt`을 갱신합니다. 같은 영상은 다른 채널에도 별도로 저장할 수 있습니다. 서버는 채널당 최대 100개를 유지하며, 수집기가 하루 최대 10개의 최근 후보를 보내면 초과분을 `lastRefreshedAt`, `createdAt`, ID 순으로 오래된 것부터 제거합니다. 삭제·비공개·임베드 불가가 확인된 영상은 `removedVideoIds`로 해당 채널에서 제거합니다. 자세한 교체 정책은 [결정 문서 0005](../server/docs/decisions/0005-youtube-daily-rotation.md)를 참고합니다.

## 4. 오류와 구현 상태

| HTTP 상태 | 상황 |
|---|---|
| 400 | 요청 값 또는 형식이 잘못됨 |
| 401 | 내부 API의 `X-Seed-Token` 누락 또는 불일치 |
| 404 | 요청 경로가 없음 |
| 500 | 예상하지 못한 서버 오류 |

공개 API와 GitHub Actions용 내부 API가 모두 구현돼 있습니다. 잘못된 sync 본문은 400, 토큰 누락·불일치는 401, 없는 수집 채널은 404, 예상하지 못한 서버 오류는 500으로 공통 응답 봉투를 반환합니다. DB 필드와 저장 규칙은 [콘텐츠 DB 구조 제안](content-db-schema.md)을 참고합니다.
