# YouTube Data API 연동 스펙

프론트엔드와 백엔드가 함께 참고할 YouTube 영상 검색·검증·저장·재생 가이드입니다.

- 작성 기준: 2026-11-21
- 대상 기획: 1~9번 카테고리 채널. 현재 채널 목록과 YouTube 수집 대상은 1~9번입니다.
- 원칙: YouTube 페이지를 HTML로 스크래핑하지 않고 YouTube Data API와 공식 임베드 플레이어를 사용합니다.
- 용어: 이 문서의 채널은 앱의 가상 채널을 뜻합니다. YouTube 영상의 실제 업로더는 원본 제작자 채널이라고 부릅니다.

## 1. 구성 요약

    GitHub Actions (예약 실행)
      → 필요 시 앱의 내부 설정 API에서 채널별 검색어 조회
      → YouTube Data API: search.list로 후보 검색
      → YouTube Data API: videos.list로 길이와 상태 확인
      → 앱의 보호된 동기화 API로 후보 전송
      → NestJS가 RDS에 중복 없이 upsert

    웹 프론트
      → 앱 API에서 전체 채널의 랜덤 영상 목록 조회
      → youtubeVideoId로 YouTube iframe 플레이어 구성

GitHub Actions는 YouTube API 키와 내부 동기화 토큰을 GitHub Secrets에 보관합니다. Actions가 RDS에 직접 접속하지 않습니다.

검색어를 Channel 테이블에서 관리한다면 Actions는 보호된 설정 API에서 검색어를 읽습니다. 검색어가 고정이고 추가 API를 줄이고 싶다면 저장소의 JSON 설정 파일을 단일 원본으로 사용해도 됩니다. DB와 파일에 같은 검색어를 중복 관리하지 마세요.

## 2. 이 기획에서 사용할 YouTube API

### 용어 먼저 보기

| 용어 | 쉬운 설명 | 이 문서에서의 예 |
|---|---|---|
| `part` | 응답에 어떤 종류의 정보를 넣을지 고르는 요청 옵션입니다. API가 반환하는 전체 객체 중 필요한 큰 묶음을 지정합니다. | `videos.list`의 `part=snippet,contentDetails,status`는 표시 정보, 재생시간 정보, 공개·임베드 상태를 요청합니다. |
| `snippet` | 제목·설명·게시 시각·썸네일·원본 채널처럼 기본 설명 정보가 모인 JSON 객체입니다. 객체는 `{}` 안에 이름과 값이 묶여 있는 데이터 구조이며 DB 엔티티나 별도 API를 뜻하지 않습니다. | 아래 예시처럼 `snippet.title`은 `snippet` 객체 안의 `title` 값을 가리킵니다. |
| `contentDetails` | 재생시간이나 자막 여부처럼 콘텐츠의 세부 속성이 모인 객체입니다. | `contentDetails.duration`이 `PT15M`이면 15분입니다. |
| `status` | 영상 공개 범위나 임베드 허용 여부처럼 상태 정보가 모인 객체입니다. | `status.embeddable=true`는 외부 웹페이지 플레이어에 삽입하는 것이 허용된 상태를 나타냅니다. |
| 임베드(Embed) | YouTube 영상 페이지로 이동하지 않고, 우리 웹페이지 안에 YouTube 플레이어를 넣어 재생하는 방식입니다. | 프론트가 `https://www.youtube.com/embed/{videoId}` 형태의 iframe을 표시합니다. |
| YouTube 공식 카테고리 | YouTube가 영상에 붙이는 자체 분류 체계입니다. 앱의 예능·금융·뉴스 서비스 채널 분류와는 별개입니다. | 필요할 때 `videoCategories.list`로 국가별 분류 목록을 조회합니다. |

`part`는 필요한 응답 묶음을 선택하고, 그 안의 실제 값은 `snippet.title`처럼 경로로 접근합니다. 즉 `part=snippet`을 요청하면 응답의 `snippet` 객체가 포함되고, 그 안에서 `title`, `description`, `thumbnails` 등을 읽는 구조입니다.

    "snippet": {
      "title": "영상 제목",
      "thumbnails": {
        "medium": { "url": "https://i.ytimg.com/..." }
      }
    }

여기서 `snippet`은 관련 필드를 담는 중괄호 객체이고, 점(`.`)으로 안쪽 필드에 접근합니다.

### 2.1 search.list — 키워드로 후보 영상 발견

한 가상 채널의 여러 검색어는 OR 연산자 | 로 묶을 수 있습니다. URL을 직접 만들 때는 |를 %7C로 인코딩합니다. 실제 코드에서는 URLSearchParams 또는 Google API 클라이언트를 사용해 인코딩하는 편이 안전합니다.

    GET https://www.googleapis.com/youtube/v3/search
      ?part=snippet
      &type=video
      &q=예능%20클립%7C웃긴%20모음%7C레전드%20장면
      &regionCode=KR
      &relevanceLanguage=ko
      &videoEmbeddable=true
      &videoSyndicated=true
      &videoDuration=medium
      &maxResults=50
      &key=YOUR_API_KEY

#### 요청 필드

| 필드 | 필수 여부 | 예시 | 의미·기획에서의 사용 |
|---|---|---|---|
| part | API 필수 | snippet | 응답에 포함할 데이터 묶음입니다. 검색 결과 기본 정보는 snippet을 요청합니다. |
| type | 기획상 필수 | video | 영상만 검색합니다. 아래 영상 필터를 쓸 때도 video로 지정해야 합니다. |
| q | 검색에 필수 | 예능 클립\|웃긴 모음\|레전드 장면 | 채널별 검색어입니다. 여러 단어를 OR 검색으로 묶을 수 있습니다. |
| regionCode | 권장 | KR | 한국에서 볼 수 있는 결과를 우선합니다. |
| relevanceLanguage | 권장 | ko | 한국어와 관련된 결과를 우선합니다. |
| videoEmbeddable | 권장 | true | 웹페이지에 임베드할 수 있는 후보를 우선합니다. |
| videoSyndicated | 권장 | true | YouTube 외부에서도 재생할 수 있는 후보를 우선합니다. |
| videoDuration | 조건부 | medium 또는 long | 10분~2시간 후보를 위해 두 구간을 각각 검색한 뒤 상세 조회에서 600–7,200초만 남깁니다. |
| maxResults | 선택 | 50 | 한 페이지에서 받을 후보 수입니다. 최대 50입니다. |
| pageToken | 선택 | nextPageToken 값 | 다음 페이지를 가져올 때 사용합니다. 페이지를 요청할 때마다 search.list 호출 한 번으로 계산합니다. |
| key | API 키 사용 시 필수 | YOUR_API_KEY | Google Cloud에서 발급한 YouTube Data API 키입니다. 서버나 Actions 비밀 설정에 둡니다. |

위 예시는 `videoDuration=medium` 호출입니다. 같은 검색 조건으로 `videoDuration=long`도 별도 호출합니다.

#### 검색 호출량·페이지 상한

YouTube의 현재 기본 할당량은 `search.list` 전용 버킷에서 하루 100회이며, 요청 한 번의 비용은 1유닛입니다. `pageToken`으로 다음 페이지를 요청해도 별도 `search.list` 호출로 계산됩니다. 다른 Data API 메서드에는 별도로 하루 10,000유닛의 기본 할당량이 적용됩니다. 최신 할당량은 [공식 할당량 안내](https://developers.google.com/youtube/data/determine_quota_cost)에서 확인합니다.

- 서비스 채널별 `search.list` 호출 상한을 둡니다. 다음 페이지 요청도 상한에 포함하며, 상한 수치는 서버에서 확정합니다.
- 상한에 도달하면 더 페이지를 넘기지 않고 그때까지 모은 후보로 검증·저장을 진행합니다.
- 할당량 초과나 일시적 수집 실패 때는 기존의 마지막 정상 후보를 유지합니다.

#### 응답 필드

| 필드 | 응답 예 | 의미·기획에서의 사용 |
|---|---|---|
| items[].id.videoId | YOUTUBE_VIDEO_ID | 영상 ID입니다. DB에 저장하고 프론트 플레이어 URL 생성에 사용합니다. |
| items[].snippet.title | 영상 제목 | 영상 카드나 플레이어 제목에 표시합니다. |
| items[].snippet.description | 영상 설명 | 상세 설명이 필요할 때 사용합니다. 현재 MVP에서는 선택 사항입니다. |
| items[].snippet.publishedAt | 2026-11-20T12:00:00Z | YouTube에 공개된 시각입니다. 최신 후보 우선 정렬에 사용할 수 있습니다. |
| items[].snippet.channelId | UC_CREATOR_CHANNEL_ID | 원본 제작자 채널 ID입니다. 앱의 1~9번 서비스 채널 번호와는 다른 값입니다. |
| items[].snippet.channelTitle | 원본 제작자 채널명 | 화면에 제작자명을 표시할 때 사용합니다. |
| items[].snippet.thumbnails.medium.url | https://i.ytimg.com/... | 중간 크기 썸네일 주소입니다. 카드·선택 연출에서 사용합니다. 이미지 파일 자체는 저장하지 않습니다. |
| items[].snippet.thumbnails.medium.width / height | 320 / 180 | 썸네일 표시 크기 정보입니다. |
| nextPageToken | 토큰 문자열 | 다음 검색 결과 페이지가 있는지 확인하고 추가 요청할 때 사용합니다. |

검색 API는 후보를 발견하는 단계이고, 상세 길이·임베드 확인은 다음 videos.list 요청에서 합니다.

검색 응답에서 사용할 핵심 구조:

    {
      "items": [
        {
          "id": {
            "kind": "youtube#video",
            "videoId": "YOUTUBE_VIDEO_ID"
          },
          "snippet": {
            "publishedAt": "2026-11-20T12:00:00Z",
            "channelId": "UC_CREATOR_CHANNEL_ID",
            "title": "영상 제목",
            "description": "영상 설명",
            "thumbnails": {
              "medium": {
                "url": "https://i.ytimg.com/...",
                "width": 320,
                "height": 180
              }
            },
            "channelTitle": "원본 제작자 채널명"
          }
        }
      ],
      "nextPageToken": "..."
    }

snippet.channelId는 YouTube 원본 제작자 채널 ID입니다. 앱의 1~9번 서비스 채널 번호와 다릅니다. 검색만으로 영상의 정확한 길이와 최종 재생 가능 여부를 판정하지 않습니다.

### 2.2 videos.list — 재생시간·임베드 상태 확인

search.list에서 받은 ID로 상세 정보를 요청합니다. 한 번에 최대 50개 ID를 전달할 수 있습니다.

    GET https://www.googleapis.com/youtube/v3/videos
      ?part=snippet,contentDetails,status
      &id=VIDEO_ID_1,VIDEO_ID_2
      &key=YOUR_API_KEY

#### 요청 필드

| 필드 | 필수 여부 | 예시 | 의미·기획에서의 사용 |
|---|---|---|---|
| part | API 필수 | snippet,contentDetails,status | 제목·썸네일, 재생시간, 임베드 상태를 응답에 포함합니다. |
| id | API 필수 | VIDEO_ID_1,VIDEO_ID_2 | 상세 조회할 YouTube 영상 ID 목록입니다. 한 요청에 최대 50개입니다. |
| key | API 키 사용 시 필수 | YOUR_API_KEY | Google Cloud에서 발급한 YouTube Data API 키입니다. |

앱에서 사용할 수 있는 응답 예:

    {
      "items": [
        {
          "id": "YOUTUBE_VIDEO_ID",
          "snippet": {
            "title": "영상 제목",
            "publishedAt": "2026-11-20T12:00:00Z",
            "channelId": "UC_CREATOR_CHANNEL_ID",
            "channelTitle": "원본 제작자 채널명",
            "thumbnails": {
              "medium": {
                "url": "https://i.ytimg.com/...",
                "width": 320,
                "height": 180
              }
            }
          },
          "contentDetails": {
            "duration": "PT3M42S",
            "caption": "false"
          },
          "status": {
            "embeddable": true,
            "privacyStatus": "public"
          }
        }
      ]
    }

#### 응답 필드

| 필드 | 응답 예 | 의미·기획에서의 사용 |
|---|---|---|
| items[].id | YOUTUBE_VIDEO_ID | 요청한 YouTube 영상 ID입니다. search.list의 videoId와 연결합니다. |
| items[].snippet.title | 영상 제목 | 화면 표시용 제목입니다. |
| items[].snippet.publishedAt | 2026-11-20T12:00:00Z | 공개 일시입니다. |
| items[].snippet.channelId | UC_CREATOR_CHANNEL_ID | 원본 제작자 채널 ID입니다. |
| items[].snippet.channelTitle | 원본 제작자 채널명 | 제작자 정보를 보여줄 때 사용합니다. |
| items[].snippet.thumbnails.medium.url | https://i.ytimg.com/... | API가 반환한 썸네일 URL입니다. |
| items[].contentDetails.duration | PT15M | ISO 8601 재생시간입니다. 초로 변환해 600–7,200초 범위인지 확인합니다. |
| items[].contentDetails.caption | true 또는 false | 자막 제공 여부입니다. 현재 MVP 재생에는 선택 정보입니다. |
| items[].status.embeddable | true 또는 false | iframe 임베드 허용 상태입니다. true여도 실제 재생은 별도 오류가 날 수 있습니다. |
| items[].status.privacyStatus | public 등 | 영상 공개 상태입니다. 공개 후보 검증에 사용합니다. |

contentDetails.duration는 ISO 8601 기간 문자열입니다. 예를 들어 PT15M은 900초입니다. 이를 초로 변환해 600–7,200초(10분~2시간)인 후보만 남깁니다. `medium`은 4~20분, `long`은 20분 초과 구간이므로 두 구간에서 검색한 뒤 상세 조회에서 상한 2시간을 적용합니다. `long`에는 2시간을 초과하는 영상도 포함됩니다. `status.embeddable`도 확인하되, API에서 임베드 가능하다고 나와도 권리 주장이나 정책에 따라 실제 재생이 막힐 수 있으므로 프론트에 재생 오류 처리가 필요합니다.

여기서 **임베드 가능 여부 확인**은 영상을 서버가 직접 재생해 보는 검사가 아닙니다. `videos.list` 응답의 `status.embeddable` 값을 확인해 외부 웹페이지 플레이어 사용이 허용된 영상인지 거르는 단계입니다. 검색 요청의 `videoEmbeddable=true`도 후보를 미리 좁히는 필터이고, 상세 조회의 `status.embeddable`은 받은 영상의 상태를 확인하는 값입니다. 둘 다 통과해도 영상 삭제·지역 제한·권리 설정 등으로 실제 재생이 실패할 수 있으므로 프론트는 플레이어 오류를 처리해야 합니다.

### 2.3 MVP 제외 API — 참고용

현재 MVP 수집에는 `search.list`와 `videos.list`만 사용합니다. 아래 `channels.list`, `playlistItems.list`, `videoCategories.list`는 향후 특정 제작자 목록을 관리하거나 YouTube 공식 분류를 활용할 때 참고할 API이며 MVP 범위에서는 호출하지 않습니다.

#### `channels.list` — 제작자 채널 정보 조회

    GET https://www.googleapis.com/youtube/v3/channels
      ?part=snippet,contentDetails
      &id=UC_CREATOR_CHANNEL_ID
      &key=YOUR_API_KEY

| 구분 | 필드 | 필수 여부 | 의미·기획상 사용 |
|---|---|---|---|
| 요청 | part | 필수 | 응답에 포함할 리소스 묶음입니다. snippet은 이름·이미지, contentDetails는 업로드 재생목록 정보를 요청합니다. |
| 요청 | id | 이 예시 요청에서 필수 | 조회할 YouTube 원본 제작자 채널 ID입니다. 다른 요청 방식에서는 `forUsername` 등으로 식별할 수도 있습니다. |
| 요청 | key | API 키 사용 시 필수 | YouTube Data API 키입니다. |
| 응답 | items[].id | 응답 시 | 원본 제작자 채널 ID입니다. 앱의 가상 채널 ID와 별개입니다. |
| 응답 | items[].snippet.title | 응답 시 | 제작자 채널명입니다. 화면에 제작자 정보를 표시할 때 사용합니다. |
| 응답 | items[].snippet.thumbnails | 응답 시 | 제작자 채널 이미지입니다. 영상 썸네일과 다른 데이터입니다. |
| 응답 | items[].contentDetails.relatedPlaylists.uploads | 요청한 경우 | 해당 제작자의 업로드 영상 재생목록 ID입니다. playlistItems.list에 전달합니다. |

#### `playlistItems.list` — 지정한 제작자의 업로드 목록 조회

    GET https://www.googleapis.com/youtube/v3/playlistItems
      ?part=snippet,contentDetails
      &playlistId=UPLOADS_PLAYLIST_ID
      &maxResults=50
      &key=YOUR_API_KEY

| 구분 | 필드 | 필수 여부 | 의미·기획상 사용 |
|---|---|---|---|
| 요청 | part | 필수 | snippet과 contentDetails를 응답에 포함합니다. |
| 요청 | playlistId | 필수 | channels.list에서 확인한 업로드 재생목록 ID입니다. |
| 요청 | maxResults | 선택 | 페이지당 결과 수이며 최대 50입니다. |
| 요청 | pageToken | 다음 페이지 조회 시 | 이전 응답의 nextPageToken을 전달합니다. 추가 페이지도 API 호출입니다. |
| 요청 | key | API 키 사용 시 필수 | YouTube Data API 키입니다. |
| 응답 | items[].snippet.resourceId.videoId | 응답 시 | 재생목록 안 영상의 YouTube 영상 ID입니다. videos.list에 전달해 길이·임베드 상태를 확인합니다. |
| 응답 | items[].snippet.title | 응답 시 | 영상 제목입니다. |
| 응답 | items[].snippet.publishedAt | 응답 시 | 재생목록 항목의 공개 시각 정보입니다. |
| 응답 | items[].snippet.videoOwnerChannelId / videoOwnerChannelTitle | 제공되는 경우 | 영상 소유 채널의 ID와 이름입니다. 일부 항목에는 없을 수 있습니다. |
| 응답 | items[].snippet.thumbnails | 응답 시 | 영상 썸네일 후보입니다. |
| 응답 | nextPageToken | 다음 페이지가 있으면 | 다음 목록 조회에 사용할 토큰입니다. |

#### `videoCategories.list` — YouTube 공식 카테고리 조회

    GET https://www.googleapis.com/youtube/v3/videoCategories
      ?part=snippet
      &regionCode=KR
      &key=YOUR_API_KEY

| 구분 | 필드 | 필수 여부 | 의미·기획상 사용 |
|---|---|---|---|
| 요청 | part | 필수 | 카테고리의 snippet 정보를 요청합니다. |
| 요청 | regionCode | 선택 | 국가별 적용 카테고리를 확인할 때 `KR`을 전달합니다. |
| 요청 | key | API 키 사용 시 필수 | YouTube Data API 키입니다. |
| 응답 | items[].id | 응답 시 | YouTube 공식 카테고리 ID입니다. |
| 응답 | items[].snippet.title | 응답 시 | 게임·음악 등 YouTube 공식 분류명입니다. |
| 응답 | items[].snippet.assignable | 응답 시 | 영상에 해당 카테고리를 지정할 수 있는지 나타냅니다. |

이 응답은 YouTube 자체 분류이므로 앱의 1~9번 서비스 채널을 만들거나 분류하지 않습니다.

예를 들어 YouTube의 공식 분류에는 음악·게임·뉴스/정치처럼 **YouTube 전체에서 사용하는 콘텐츠 주제**가 있습니다. `videoCategories.list`는 이 분류들의 ID와 이름, 해당 지역에서 영상에 지정 가능한지(`assignable`)를 돌려줍니다. 이를 조회하는 것만으로 우리 앱의 카테고리가 자동 생성되거나, 특정 서비스 채널에 맞는 영상이 자동 선별되는 것은 아닙니다. 현재 MVP에서는 이 API를 사용하지 않습니다.


## 3. 검색어 관리 및 수집 처리

### 검색어 저장

검색어는 채널별 배열로 관리하는 것이 좋습니다. 구분자 문자열 한 덩어리로 저장하는 것보다 추가·수정·검증이 쉽습니다.

    Channel.seedKeywords = [
      "예능 클립",
      "웃긴 모음",
      "레전드 장면"
    ]

수집 작업에서 검색 요청을 만들 때만 배열을 OR 검색어로 합칩니다.

    const q = seedKeywords.join("|");
    params.set("q", q); // URLSearchParams가 인코딩 처리

### 수집 단계

1. 수집 대상인 1~9번 채널과 검색어를 읽습니다.
2. 채널별로 `videoDuration=medium`과 `videoDuration=long` 후보를 각각 검색합니다. 채널별 `search.list` 요청은 페이지 호출을 포함해 정해진 상한을 넘기지 않습니다.
3. search.list 응답의 영상 ID를 모읍니다.
4. ID를 최대 50개씩 묶어 videos.list로 상세 정보를 요청합니다.
5. 길이 600–7,200초, 공개 상태, 임베드 가능 여부와 서비스 채널의 기획 방향을 확인해 후보를 필터링합니다.
6. youtubeVideoId 고유값 기준으로 upsert합니다.
7. 유효한 응답이 완성되기 전에 기존 후보 전체를 지우지 않습니다. 수집 실패 시 마지막 정상 후보를 유지합니다.
8. 기존 영상도 하루 한 번 재검증하고 lastRefreshedAt을 갱신합니다. 삭제·비공개·임베드 불가가 확인된 영상은 행을 삭제합니다. 일시적 API 오류나 검색 결과에 다시 나타나지 않았다는 이유만으로 기존 행을 삭제하지 않습니다.
9. 채널마다 최근 7일 안에 공개된 영상을 하루 최대 10개 새로 저장하고, 채널당 100개를 넘으면 `last_refreshed_at`이 오래된 영상부터 초과분을 삭제합니다. 재확인 시각이 같으면 `created_at`, `id` 순으로 정하고, 재확인 시각이 없는 행을 먼저 삭제합니다. 새 영상을 저장하지 못한 날에는 초과분 삭제를 하지 않습니다. 근거와 조건은 `server/docs/decisions/0005-youtube-daily-rotation.md`를 따릅니다.

일일 수집 목표는 채널당 영상 100개 유지와 채널당 하루 10개 교체입니다(2026-11-22 서버 확정). 1~9번 채널에 같은 값을 적용합니다. 중복 영상은 youtubeVideoId 기준으로 갱신합니다. 임베드 불가 영상은 저장하지 않으며 DB에는 서비스 노출용 `is_active` 플래그를 두지 않습니다.

## 4. 프론트에서 영상 재생 및 썸네일 표시

프론트는 YouTube Data API를 직접 호출하지 않습니다. 앱의 랜덤 영상 API에서 youtubeVideoId와 썸네일 URL을 받은 뒤, ID를 iframe 주소로 조합합니다.

### YouTube 임베드 플레이어 필드

임베드 주소는 YouTube Data API 요청이 아니라 HTML iframe에 넣는 플레이어 URL입니다.

| 항목 | 위치 | 필수 여부 | 의미 |
|---|---|---|---|
| videoId | embed URL 경로의 {videoId} | 필수 | 재생할 영상 ID입니다. 앱 랜덤 영상 API 응답에서 받습니다. |
| playsinline=1 | URL query | 모바일에서 권장 | iOS/WebView에서 전체 화면 대신 인라인 재생을 요청합니다. |
| autoplay=1 | URL query | 선택 | 자동 재생을 요청합니다. 브라우저가 차단할 수 있어 실패 시 재생 버튼이 필요합니다. |
| enablejsapi=1 | URL query | JS 제어 시 필요 | IFrame Player API로 재생 상태 등을 제어할 때 활성화합니다. |
| origin | URL query | JS API 사용 시 권장 | 플레이어를 포함한 프론트의 정확한 origin을 지정합니다. |
| onReady | 플레이어 이벤트 | 선택 | 플레이어 준비 완료 이벤트입니다. |
| onStateChange | 플레이어 이벤트 | 선택 | 재생·일시정지·종료·버퍼링 상태 변경 이벤트입니다. |
| onError | 플레이어 이벤트 | 선택 | 현재 영상이 재생되지 않을 때 오류 처리를 연결합니다. |
| onAutoplayBlocked | 플레이어 이벤트 | 선택 | 브라우저가 자동 재생을 막았을 때 재생 버튼을 보여주는 데 사용합니다. |

    const embedUrl =
      "https://www.youtube.com/embed/" + video.youtubeVideoId + "?playsinline=1";

    <iframe
      src={embedUrl}
      title={video.title}
      allow="autoplay; encrypted-media; picture-in-picture; web-share"
      allowFullScreen
    />

- DB에는 youtubeVideoId만 저장하고, 일반 시청 URL이나 iframe URL은 필요할 때 생성합니다.
- 일반 시청 링크는 https://www.youtube.com/watch?v={youtubeVideoId}입니다.
- iframe 재생 링크는 https://www.youtube.com/embed/{youtubeVideoId}입니다.
- 썸네일 URL은 YouTube API가 반환한 snippet.thumbnails.medium.url 등을 저장합니다. 이미지 파일을 내려받아 서버나 S3에 복사할 필요는 없습니다.
- 플레이어 자체가 미리보기를 표시하므로, 별도 카드·랜덤 연출에서 썸네일을 쓸 때만 앱 화면에서 직접 표시하면 됩니다.
- 자동 재생은 브라우저나 WebView가 차단할 수 있습니다. 차단될 때 플레이 버튼을 보여주세요.
- 플레이 상태 이벤트와 코드 기반 영상 전환이 필요하면 YouTube IFrame Player API를 검토합니다. enablejsapi=1 사용 시 origin에 프론트 도메인을 지정합니다.
- YouTube 플레이어의 기본 컨트롤, 제목, 썸네일 표시를 임의로 숨기거나 수정하지 않습니다.

## 5. 정책 및 안정성 체크

- YouTube HTML 페이지 스크래핑 금지. 공식 API 문서에 있는 엔드포인트만 사용합니다.
- API 키는 GitHub Secrets 또는 서버 비밀 설정에 저장하고 프론트에 포함하지 않습니다.
- API에서 받은 영상 제목·썸네일 URL 등 데이터는 최신 상태를 유지해야 합니다. 일반 API 데이터는 30일 넘게 저장하려면 갱신하거나 삭제해야 하므로 last_refreshed_at을 관리합니다.
- API에서 임베드 가능으로 확인된 영상도 권리 주장이나 정책에 따라 실제 재생이 막힐 수 있습니다. 후보를 여유 있게 유지하고 프론트에 재생 실패 처리를 둡니다.
- 수집 API 실패나 할당량 초과가 사용자 조회 API까지 장애로 이어지지 않게 합니다. 마지막 정상 후보를 유지합니다.
- 일반 플레이어를 사용해 재생하며 YouTube 영상을 내려받거나 자체 호스팅하지 않습니다.

## 6. 공식 참고 문서

- [Search: list](https://developers.google.com/youtube/data/reference/rest/v3/search/list)
- [Videos: list](https://developers.google.com/youtube/data/reference/rest/v3/videos/list)
- [Channels: list](https://developers.google.com/youtube/data/reference/rest/v3/channels/list)
- [PlaylistItems: list](https://developers.google.com/youtube/data/reference/rest/v3/playlistItems/list)
- [YouTube Data API quota calculator](https://developers.google.com/youtube/data/determine_quota_cost)
- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
- [YouTube player parameters](https://developers.google.com/youtube/player_parameters)
- [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies)

