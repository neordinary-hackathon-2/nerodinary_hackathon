# 콘텐츠 DB 구조 제안

서비스 채널별로 YouTube 영상 후보를 저장하고, 채널을 열 때 후보 하나를 선택하기 위한 설계안입니다. 프론트·백엔드·기획 검토용 문서이며, 현재 서버에는 채널·영상 테이블이 아직 구현되지 않았습니다.

## 1. 관계와 범위

    channels (서비스 채널 1개) ──< videos (후보 영상 여러 개)

- channels는 CH05 예능, CH07 금융처럼 앱에서 편성한 가상 채널입니다. 현재 기획에서 카테고리와 서비스 채널이 1:1이므로 별도 categories 테이블은 두지 않습니다.
- videos는 YouTube에서 찾고 검증한 재생 후보입니다. MVP에서는 영상 하나가 서비스 채널 하나에 속한다고 가정합니다.
- 로그인·개인화가 없으므로 users 테이블은 필요하지 않습니다.
- YouTube 원본 제작자 채널과 앱의 서비스 채널은 서로 다른 개념입니다.

## 2. channels — 서비스 가상 채널

| 컬럼 | 타입 예시 | 필수 여부 | 역할 |
|---|---|---|---|
| id | BIGINT PK | 필수 | 내부 식별자. videos.app_channel_id가 참조합니다. |
| code | VARCHAR(10), UNIQUE | 필수 | CH05 같은 서비스 채널 코드입니다. |
| name | VARCHAR(50) | 필수 | 예능·금융·뉴스 등 화면 표시 이름입니다. |
| slogan | VARCHAR(150) | 선택 | 채널의 화면 자막입니다. |
| role | VARCHAR(200) | 선택 | 이 채널의 콘텐츠 역할과 분위기입니다. |
| display_order | TINYINT | 필수 | 화면 배치와 다음 채널 이동 순서입니다. |
| seed_keywords | JSON | 조건부 | 검색어를 DB에서 관리할 때 문자열 배열로 저장합니다. |
| created_at, updated_at | TIMESTAMP | 필수 | 생성·수정 시각입니다. |

검색어를 DB에 둔다면 seed_keywords는 ["예능 클립", "웃긴 모음"]처럼 배열로 저장하고 검색 요청을 만들 때만 OR 검색어로 합칩니다. 설정 파일을 검색어의 단일 원본으로 사용한다면 이 컬럼은 생략합니다.

아이콘과 대표 색상은 현재 기획에서 채널별로 고정된 화면 디자인입니다. 백엔드는 채널 코드(code)를 보내고, 웹·앱은 그 코드에 맞는 아이콘과 색상을 프론트의 상수 또는 디자인 토큰에서 선택합니다. 운영 중 서버 설정으로 디자인을 바꿔야 하는 요구가 생기면 저장 위치를 다시 검토합니다.

## 3. videos — 채널별 재생 후보

| 컬럼 | 타입 예시 | 필수 여부 | 역할 |
|---|---|---|---|
| id | BIGINT PK | 필수 | 내부 식별자입니다. |
| app_channel_id | BIGINT FK → channels.id | 필수 | 영상이 속한 서비스 채널입니다. |
| youtube_video_id | VARCHAR(32), UNIQUE | 필수 | YouTube 영상 ID. 중복 방지와 플레이어 URL 생성에 사용합니다. |
| title | VARCHAR(255) | 필수 | YouTube 영상 제목입니다. |
| thumbnail_url | VARCHAR(1000) | 필수 | YouTube API가 준 썸네일 주소입니다. 이미지 파일은 저장하지 않습니다. |
| duration_seconds | INT UNSIGNED | 필수 | 정확한 영상 길이입니다. 600–7,200초 후보를 선별합니다. |
| published_at | DATETIME | 선택 | YouTube 공개 시각입니다. |
| source_youtube_channel_id | VARCHAR(64) | 선택 | 원본 제작자 채널 ID입니다. 앱 채널 ID와 다릅니다. |
| source_channel_title | VARCHAR(255) | 선택 | 화면에 제작자명을 표시할 때 저장합니다. |
| last_refreshed_at | DATETIME | 선택 | 저장된 영상의 YouTube 메타데이터를 마지막으로 재확인한 시각입니다. 같은 영상이 검색된 횟수와는 무관합니다. |
| created_at, updated_at | TIMESTAMP | 필수 | 생성·수정 시각입니다. |

일반 시청 URL과 iframe URL은 저장하지 않습니다. 프론트는 youtube_video_id로 YouTube 임베드 주소를 만듭니다. thumbnail_url은 영상 카드와 랜덤 연출에 쓰므로 저장합니다.

## 4. 저장·조회 규칙

1. YouTube videos.list로 길이 600–7,200초, 공개 상태, 임베드 허용 여부를 확인한 뒤 조건을 통과한 영상만 저장합니다. 임베드 불가 영상은 저장하지 않습니다.
2. youtube_video_id를 기준으로 중복 없이 저장·갱신합니다. 같은 영상이 다시 검색돼도 행을 추가하지 않습니다.
3. 하루 한 번 수집할 때 기존 후보를 전부 지우지 않습니다. 기획의 채널당 8–10개는 초기 시드 수이며, DB 최대 보유 개수는 아직 정하지 않았습니다. 새 영상의 누적·교체 기준은 별도로 결정합니다.
4. 저장된 영상도 재검증합니다. 검색 결과에 다시 안 나왔다는 이유만으로 삭제하지 않습니다. 영상 삭제·비공개·임베드 불가 등 재생 조건을 잃은 것이 확인되면 해당 행만 제거하고 보충합니다. 수집 작업 자체가 실패하면 기존 후보를 유지합니다.
5. 채널을 열면 해당 app_channel_id의 저장 후보 중 하나를 랜덤으로 선택합니다. 조회를 위해 videos(app_channel_id) 인덱스를 두고, channels.code와 videos.youtube_video_id에는 고유 제약을 둡니다.

## 5. 구현 시 체크리스트

- [ ] 신규 후보는 videos.list의 정확한 길이·공개 상태·status.embeddable을 확인한 뒤에만 저장한다.
- [ ] status.embeddable이 false인 후보는 DB에 넣지 않는다. 서비스 자체의 노출 플래그도 두지 않는다.
- [ ] 기존 영상의 YouTube 상태가 바뀌면 해당 영상만 제거하고, API 호출 실패만으로 후보를 삭제하지 않는다.
- [ ] youtube_video_id 고유 제약으로 재수집 중복을 막는다. 초기 시드 8–10개와 별개로, 장기 보유 개수·교체 기준은 구현 전에 결정한다.
- [ ] API에서 임베드 가능으로 확인된 영상도 실제 플레이어에서 실패할 수 있으므로 프론트 재생 오류 처리를 둔다.

youtube_video_id의 고유 제약은 한 YouTube 영상이 앱 채널 하나에만 속한다는 가정에 맞습니다. 같은 영상을 여러 서비스 채널에 편성해야 한다면 영상 원본 테이블과 채널 연결 테이블을 분리해 검토합니다.

## 6. 구현 상태

서버는 NestJS·Drizzle·MySQL을 사용합니다. 현재 server/src/database/schema/에는 공통 ID·시각 컬럼 헬퍼만 있고, channels와 videos 테이블 정의 및 마이그레이션은 없습니다. 구현 시 Drizzle 스키마를 정의한 뒤 RDS MySQL에 마이그레이션을 적용합니다.

YouTube에서 각 필드를 어떻게 수집하는지는 [YouTube Data API 연동 스펙](youtube-data-api.md)을 참고합니다.
