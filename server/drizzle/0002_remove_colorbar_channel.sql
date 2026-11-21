DELETE FROM `channels` WHERE `channel_number` = 0;
--> statement-breakpoint
ALTER TABLE `channels` ADD CONSTRAINT `channels_channel_number_range_ck` CHECK (`channels`.`channel_number` between 1 and 9);