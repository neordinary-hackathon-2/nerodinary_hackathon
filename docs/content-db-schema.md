# 콘텐츠 DB 구조 제안

서비스 채널별로 YouTube 영상 후보를 저장하고, 채널별 후보 목록을 조회하기 위한 설계·구현 기준입니다. 프론트·백엔드·기획이 함께 참고합니다.

## 1. 관계와 범위

    channels (서비스 채널 1개) ──< videos (후보 영상 여러 개)

- channels는 번호 0~9의 서비스 채널입니다. 카테고리와 서비스 채널이 1:1이므로 별도 categories 테이블은 두지 않습니다. 0번 컬러바도 편성표 표시를 위해 채널 행으로 저장하고 영상과 검색어는 두지 않습니다.
- videos는 YouTube에서 찾고 검증한 재생 후보입니다. MVP에서는 영상 하나가 서비스 채널 하나에 속한다고 가정합니다.
- 로그인·개인화가 없으므로 users 테이블은 필요하지 않습니다.
- YouTube 원본 제작자 채널과 앱의 서비스 채널은 서로 다른 개념입니다.

## 2. channels — 서비스 가상 채널

| 컬럼 | 타입 예시 | 필수 여부 | 역할 |
|---|---|---|---|
| id | BIGINT PK | 필수 | 내부 식별자. videos.app_channel_id가 참조합니다. |
| channel_number | TINYINT UNSIGNED, UNIQUE | 필수 | 리모컨에 표시하는 채널 번호(0~9)이며 번호순 정렬 기준입니다. |
| name | VARCHAR(50) | 필수 | 예능·금융·뉴스 등 화면 표시 이름입니다. |
| slogan | VARCHAR(150) | 필수 | 편성표에 표시할 채널 자막입니다. |
| role | VARCHAR(200) | 선택 | 이 채널의 콘텐츠 역할과 분위기입니다. |
| seed_keywords | JSON | 필수 | GitHub Actions가 채널별 검색에 사용할 검색어를 문자열 배열로 저장합니다. |
| created_at, updated_at | TIMESTAMP | 필수 | 생성·수정 시각입니다. |

seed_keywords는 ["예능 클립", "웃긴 모음"]처럼 JSON 배열로 저장하고, 검색 요청을 만들 때만 OR 검색어로 합칩니다. 0번 컬러바는 빈 배열을 사용하며 수집 대상에서 제외합니다. 내부 검색어 조회 API는 이 컬럼을 읽어 GitHub Actions에 전달합니다.

초기 `0000.sql` 마이그레이션은 편성표의 0~9번 채널 메타데이터와 검색어를 함께 시딩합니다. 0번 채널에는 영상 후보를 넣지 않습니다.

아이콘과 대표 색상은 현재 기획에서 채널별로 고정된 화면 디자인입니다. 웹·앱은 channel_number에 맞는 아이콘과 색상을 프론트 상수 또는 디자인 토큰에서 선택합니다.

## 3. videos — 채널별 재생 후보

| 컬럼 | 타입 예시 | 필수 여부 | 역할 |
|---|---|---|---|
| id | BIGINT PK | 필수 | 내부 식별자입니다. |
| app_channel_id | BIGINT FK → channels.id | 필수 | 영상이 속한 서비스 채널입니다. |
| youtube_video_id | VARCHAR(32), (app_channel_id, youtube_video_id) 복합 UNIQUE | 필수 | YouTube 영상 ID. 중복 방지와 플레이어 URL 생성에 사용합니다. |
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
2. (app_channel_id, youtube_video_id)를 기준으로 채널 안에서 중복 없이 저장·갱신합니다. 같은 영상이 다른 서비스 채널에서도 검색되면 채널별 행으로 각각 저장합니다.
3. 하루 한 번 수집할 때 기존 후보를 전부 지우지 않습니다. 기획의 채널당 8–10개는 초기 시드 수이며, DB 최대 보유 개수는 아직 정하지 않았습니다. 새 영상의 누적·교체 기준은 별도로 결정합니다.
4. 저장된 영상도 재검증합니다. 검색 결과에 다시 안 나왔다는 이유만으로 삭제하지 않습니다. 영상 삭제·비공개·임베드 불가 등 재생 조건을 잃은 것이 확인되면 해당 행만 제거하고 보충합니다. 수집 작업 자체가 실패하면 기존 후보를 유지합니다.
5. 전체 채널 랜덤 영상 API는 채널별 후보 중 중복 없이 최대 10개를 반환합니다. 0번은 videos가 빈 배열입니다. videos(app_channel_id) 인덱스를 두고, channels.channel_number와 (videos.app_channel_id, videos.youtube_video_id)에 고유 제약을 둡니다.

## 5. 구현 시 체크리스트

- [ ] 신규 후보는 videos.list의 정확한 길이·공개 상태·status.embeddable을 확인한 뒤에만 저장한다.
- [ ] status.embeddable이 false인 후보는 DB에 넣지 않는다. 서비스 자체의 노출 플래그도 두지 않는다.
- [ ] 기존 영상의 YouTube 상태가 바뀌면 해당 영상만 제거하고, API 호출 실패만으로 후보를 삭제하지 않는다.
- [ ] (app_channel_id, youtube_video_id) 복합 고유 제약으로 같은 채널 안의 재수집 중복을 막는다. 초기 시드 8–10개와 별개로, 장기 보유 개수·교체 기준은 구현 전에 결정한다.
- [ ] API에서 임베드 가능으로 확인된 영상도 실제 플레이어에서 실패할 수 있으므로 프론트 재생 오류 처리를 둔다.

같은 YouTube 영상 ID는 서비스 채널마다 각각 저장할 수 있습니다. 각 채널 안에서는 같은 영상 ID가 중복 저장되지 않도록 app_channel_id와 youtube_video_id에 복합 고유 제약을 둡니다.

## 6. 구현 상태

서버는 NestJS·Drizzle·MySQL을 사용합니다. `server/src/database/schema/`에 channels와 videos의 Drizzle 테이블 정의가 있으며, shared 엔티티와의 타입 불일치를 컴파일 단계에서 확인합니다. Drizzle 마이그레이션 생성·검토와 RDS 적용은 별도 단계로 진행합니다.

YouTube에서 각 필드를 어떻게 수집하는지는 [YouTube Data API 연동 스펙](youtube-data-api.md)을 참고합니다.
