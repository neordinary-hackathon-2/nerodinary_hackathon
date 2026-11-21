import {
  json,
  mysqlTable,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
import type { Channel } from '../../../../shared/entities/channel.js';
import { AssertNoMismatch, EntityMismatch } from '../entity-check.js';
import { primaryId, timestamps } from './columns.js';

export const channels = mysqlTable(
  'channels',
  {
    id: primaryId(),
    channelNumber: tinyint({ unsigned: true }).notNull(),
    name: varchar({ length: 50 }).notNull(),
    slogan: varchar({ length: 150 }).notNull(),
    role: varchar({ length: 200 }),
    seedKeywords: json().$type<string[]>().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('channels_channel_number_uq').on(table.channelNumber),
  ],
);

type _ChannelEntityCheck = AssertNoMismatch<
  EntityMismatch<typeof channels.$inferSelect, Channel>
>;
