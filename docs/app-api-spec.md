# 앱 API 명세 제안

프론트·백엔드·기획이 함께 검토할 서비스 API 계약입니다. 아래 경로는 아직 구현 전인 **제안**입니다. YouTube가 제공하는 API 자체는 [YouTube Data API 연동 스펙](youtube-data-api.md)을 참고합니다.

## 1. 공통 규칙

이 절은 **현재 코드에 구현된 공통 기반**과 **앞으로 구현할 콘텐츠 API 설계**를 함께 설명합니다. 현재 구현된 공개 경로는 /api/health이며, 아래 채널·영상·수집 엔드포인트는 아직 없습니다.

예정된 콘텐츠 수집·조회 흐름:

    웹·앱 → 공개 API → NestJS → RDS
    GitHub Actions → YouTube Data API → 내부 API → NestJS → RDS

- **구현됨:** 서버 전역 경로 prefix는 /api입니다. 현재 버전에서는 v1 경로를 두지 않습니다.
- **설계 제안:** 공개 콘텐츠 API는 로그인 없이 호출합니다. 내부 수집 API는 /api/internal 아래에 모으고 X-Seed-Token으로 보호합니다. 내부 경로와 토큰 검증 로직은 아직 구현 전이며, internal이라는 경로 이름 자체가 인증을 대신하지는 않습니다.
- **구현됨:** 현재 NestJS의 API 성공·오류 응답은 전역 인터셉터와 예외 필터를 통해 다음 봉투로 감쌉니다. 타입 정의는 shared/api/envelope.ts에 있습니다.

| 응답 필드 | 타입 | 의미 |
|---|---|---|
| isSuccess | boolean | 성공 여부 |
| code | string | 결과 코드. 일반 조회 성공은 COMMON200 |
| message | string | 결과 메시지 |
| result | 객체·배열·null | API별 실제 데이터. 실패 시 null 또는 오류 상세 |

## 2. 공개 조회 API

### GET /api/channels/random-videos — 전체 채널의 랜덤 영상

한 번의 요청으로 모든 서비스 채널을 displayOrder 순서로 반환합니다. 서버는 채널마다 저장된 후보 중 영상 하나를 랜덤으로 선택합니다. 채널 목록 조회 API와 채널별 영상 조회 API는 두지 않습니다.

| 구분 | 필드 | 타입·필수 여부 | 의미 |
|---|---|---|---|
| 요청 | Path/Query/Body | 없음 | 전체 채널의 랜덤 영상을 한 번에 조회 |
| 응답 | result.channels[] | 배열, 필수 | displayOrder 순서의 모든 서비스 채널 |
| 응답 | result.channels[].channelCode | string, 필수 | CH05 같은 공개 서비스 채널 코드. DB 내부 ID는 노출하지 않음 |
| 응답 | result.channels[].displayOrder | number, 필수 | 프론트의 다음 채널 이동 순서 |
| 응답 | result.channels[].video | 객체 또는 null, 필수 | 해당 채널에서 선택한 영상. 후보가 없으면 null |
| 응답 | result.channels[].video.youtubeVideoId | string, 영상이 있을 때 | YouTube iframe 재생 주소를 만드는 ID |
| 응답 | result.channels[].video.title | string, 영상이 있을 때 | 영상 제목 |
| 응답 | result.channels[].video.thumbnailUrl | string, 영상이 있을 때 | 카드·재생 전 화면용 썸네일 주소 |
| 응답 | result.channels[].video.durationSeconds | number, 영상이 있을 때 | 영상 길이(초) |

응답 예시는 두 채널만 표시하며, 실제 응답은 등록된 모든 서비스 채널을 포함합니다.

    {
      "isSuccess": true,
      "code": "COMMON200",
      "message": "요청에 성공했습니다.",
      "result": {
        "channels": [
          {
            "channelCode": "CH05",
            "displayOrder": 1,
            "video": {
              "youtubeVideoId": "YOUTUBE_VIDEO_ID_1",
              "title": "영상 제목",
              "thumbnailUrl": "https://i.ytimg.com/...",
              "durationSeconds": 900
            }
          },
          {
            "channelCode": "CH07",
            "displayOrder": 2,
            "video": null
          }
        ]
      }
    }

프론트는 받은 배열에서 채널번호 입력 또는 다음 채널 버튼에 맞는 channelCode를 선택합니다. 채널을 바꿀 때 추가 API를 호출하지 않습니다. 같은 응답에서는 채널당 영상 하나가 유지되며, 새 랜덤 구성이 필요할 때 이 API를 다시 호출합니다. 아이콘·테마 색상·채널 자막은 프론트에서 채널 코드로 정하고 수집 검색어는 공개 응답에 포함하지 않습니다. 플레이어의 실제 재생 실패는 프론트에서 처리합니다.

video가 null인 경우는 채널 자체는 있지만 DB에 저장된 재생 후보가 0개일 때입니다. 초기 시딩 전이거나 기존 후보가 모두 재생 조건을 잃어 제거된 경우가 해당합니다. 한 채널만 비어 있어도 전체 응답은 200으로 유지하고, 프론트는 그 채널에 준비 중 안내를 보여주거나 다음 채널로 이동합니다. 즉시 같은 API를 재요청해도 후보가 생기지 않으므로 null만을 이유로 자동 재시도하지 않습니다. 네트워크 오류나 500 응답에 대한 재시도는 별도로 처리합니다.

## 3. GitHub Actions용 내부 API

X-Seed-Token은 GitHub Secrets와 서버 비밀 설정에 둡니다. YouTube API 키와 별개이며 프론트에는 노출하지 않습니다.

### GET /api/internal/youtube/seed-config — 검색어 조회 (선택)

검색어를 DB에서 관리할 때만 구현합니다. 저장소 설정 파일을 단일 원본으로 쓰면 생략합니다.

| 구분 | 필드 | 타입·필수 여부 | 의미 |
|---|---|---|---|
| 요청 Header | X-Seed-Token | string, 필수 | 내부 호출 인증 |
| 요청 | Query/Body | 없음 | 전체 채널 검색어 조회 |
| 응답 | result.channels[].code | string, 필수 | 서비스 채널 코드 |
| 응답 | result.channels[].seedKeywords[] | string 배열, 필수 | 채널별 검색어 |

    {
      "isSuccess": true,
      "code": "COMMON200",
      "message": "요청에 성공했습니다.",
      "result": {
        "channels": [
          {"code": "CH05", "seedKeywords": ["예능 클립", "웃긴 모음"]}
        ]
      }
    }

### POST /api/internal/youtube/sync — 영상 후보 저장·갱신

Actions가 YouTube Data API에서 검색·검증한 후보를 채널별로 보냅니다. 이 upsert 요청은 HTTP 200 응답으로 제안합니다. NestJS 구현 시 기본 POST 상태 201을 200으로 명시해야 합니다.

필수 여부는 DB 컬럼의 NULL 가능 여부만으로 정하지 않습니다. 내부 호출 인증, DB 채널 FK를 찾는 값, 저장에 꼭 필요한 메타데이터, 저장 자격 검증값을 필수로 둡니다. 화면·저장에 당장 필요하지 않고 DB에서도 NULL을 허용하는 메타데이터는 선택입니다. DB 내부 ID와 생성·수정 시각은 서버가 만들므로 요청에 받지 않습니다.

| 구분 | 필드 | 타입·필수 여부 | 의미 |
|---|---|---|---|
| 요청 Header | X-Seed-Token | string, 필수 | 내부 호출 인증 |
| 요청 Body | channelCode | string, 필수 | CH05 같은 서비스 채널 코드 |
| 요청 Body | videos | 배열(1개 이상), 필수 | 해당 채널의 후보 목록. 보낼 후보가 없으면 이 API 호출을 생략 |
| 요청 Body | videos[].youtubeVideoId | string, 필수 | YouTube 영상 ID. 중복 갱신 기준 |
| 요청 Body | videos[].title | string, 필수 | 영상 제목 |
| 요청 Body | videos[].thumbnailUrl | string, 필수 | YouTube 썸네일 주소 |
| 요청 Body | videos[].durationSeconds | number, 필수 | 초 단위 재생시간 |
| 요청 Body | videos[].publishedAt | ISO 8601 문자열, 선택 | 공개 시각 |
| 요청 Body | videos[].sourceYoutubeChannelId | string, 선택 | 원본 제작자 채널 ID |
| 요청 Body | videos[].sourceChannelTitle | string, 선택 | 원본 제작자 채널명 |
| 요청 Body | videos[].privacyStatus | string, 필수 | public이 아니면 해당 후보를 제외. DB에는 보관하지 않음 |
| 요청 Body | videos[].isEmbeddable | boolean, 필수 | false이면 해당 후보를 제외. DB에는 보관하지 않음 |
| 응답 | result.acceptedCount | number, 필수 | 저장·갱신한 후보 수 |
| 응답 | result.rejectedCount | number, 필수 | 검증에서 제외한 후보 수 |
| 응답 | result.rejected[].youtubeVideoId | string, 제외 시 | 제외 영상 ID |
| 응답 | result.rejected[].reason | string, 제외 시 | 제외 이유 |

요청 예:

    {
      "channelCode": "CH05",
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
      }]
    }

응답 예:

    {
      "isSuccess": true,
      "code": "COMMON200",
      "message": "요청에 성공했습니다.",
      "result": {"acceptedCount": 1, "rejectedCount": 0, "rejected": []}
    }

서버는 길이 600–7,200초, 공개·임베드 조건을 확인하고 통과한 영상만 저장합니다. 하루 수집 때 기존 영상을 전부 삭제하지 않으며, 같은 youtubeVideoId는 중복 행 대신 갱신합니다. 기획의 채널당 8–10개는 초기 시드 수입니다. 장기 보유 개수와 교체 기준은 아직 정하지 않았습니다.

## 4. 오류와 구현 상태

| HTTP 상태 | 상황 |
|---|---|
| 400 | 요청 값 또는 형식이 잘못됨 |
| 401/403 | 내부 토큰 누락·불일치 |
| 404 | 요청 경로가 없음 |
| 500 | 예상하지 못한 서버 오류 |

현재 서버에는 공통 응답 봉투와 전역 오류 처리가 구현돼 있습니다. 위 엔드포인트는 아직 구현 전이며, 합의 후 DTO·Swagger·프론트 공유 타입에 반영합니다. DB 필드와 저장 규칙은 [콘텐츠 DB 구조 제안](content-db-schema.md)을 참고합니다.
