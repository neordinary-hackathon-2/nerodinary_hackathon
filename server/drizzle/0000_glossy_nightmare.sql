CREATE TABLE `channels` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`channel_number` tinyint unsigned NOT NULL,
	`name` varchar(50) NOT NULL,
	`slogan` varchar(150) NOT NULL,
	`role` varchar(200),
	`seed_keywords` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `channels_id` PRIMARY KEY(`id`),
	CONSTRAINT `channels_channel_number_uq` UNIQUE(`channel_number`)
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`app_channel_id` bigint unsigned NOT NULL,
	`youtube_video_id` varchar(32) NOT NULL,
	`title` varchar(255) NOT NULL,
	`thumbnail_url` varchar(1000) NOT NULL,
	`duration_seconds` int unsigned NOT NULL,
	`published_at` datetime,
	`source_youtube_channel_id` varchar(64),
	`source_channel_title` varchar(255),
	`last_refreshed_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videos_id` PRIMARY KEY(`id`),
	CONSTRAINT `videos_app_channel_youtube_video_uq` UNIQUE(`app_channel_id`,`youtube_video_id`)
);
--> statement-breakpoint
ALTER TABLE `videos` ADD CONSTRAINT `videos_app_channel_id_channels_id_fk` FOREIGN KEY (`app_channel_id`) REFERENCES `channels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `videos_app_channel_id_idx` ON `videos` (`app_channel_id`);
--> statement-breakpoint
INSERT INTO `channels` (`channel_number`, `name`, `slogan`, `role`, `seed_keywords`) VALUES
	(0, '컬러바', '전원을 켜면 처음 뜨는 대기 화면', '전원을 켜면 처음 뜨는 기본 채널. 영상 없는 컬러바 화면', JSON_ARRAY()),
	(1, '예능', '웃다 체하지 마세요', '가벼운 웃음', JSON_ARRAY('예능 클립', '웃긴 모음', '레전드 장면')),
	(2, '금융', '밥상에서 갑자기 재테크', '낙차용 엉뚱 채널', JSON_ARRAY('재테크 쉽게', '경제 5분', '주식 기초')),
	(3, '뉴스', '오늘 일을 밥값 시간에', '정보형, 현실감', JSON_ARRAY('뉴스 요약', '오늘의 이슈', '1분 뉴스')),
	(4, '먹방', '남이 먹는 걸 보며 먹기', '식사 상황과 직결', JSON_ARRAY('먹방', '라면 먹방', 'ASMR 식사')),
	(5, '요리', '오늘 반찬은 구경으로', '식사 연관, 눈요기', JSON_ARRAY('자취 요리', '5분 레시피', '요리 대결')),
	(6, '동물', '힐링 한 숟갈', '부담 없는 휴식', JSON_ARRAY('고양이 영상', '강아지 모음', '동물 구조')),
	(7, '음악', '수저 내려놓고 감상', '분위기 전환', JSON_ARRAY('라이브 클립', '플레이리스트', '뮤직비디오')),
	(8, '스포츠', '밥 먹다 응원 시작', '에너지 전환', JSON_ARRAY('경기 하이라이트', '야구·축구 명장면', '스포츠 레전드')),
	(9, '홈쇼핑', '지금 안 사면 밥 식어요', '가장 엉뚱한 반전 채널 (TV 느낌 극대화)', JSON_ARRAY('홈쇼핑 방송 클립', '쇼호스트 멘트 모음', '홈쇼핑 레전드'));
