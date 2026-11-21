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
	CONSTRAINT `videos_youtube_video_id_uq` UNIQUE(`youtube_video_id`)
);
--> statement-breakpoint
ALTER TABLE `videos` ADD CONSTRAINT `videos_app_channel_id_channels_id_fk` FOREIGN KEY (`app_channel_id`) REFERENCES `channels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `videos_app_channel_id_idx` ON `videos` (`app_channel_id`);
