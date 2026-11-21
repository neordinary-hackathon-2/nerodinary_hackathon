import {
  check,
  json,
  mysqlTable,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
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
    seedKeywords: json().$type<string[]>().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('channels_channel_number_uq').on(table.channelNumber),
    check(
      'channels_channel_number_range_ck',
      sql`${table.channelNumber} between 1 and 9`,
    ),
  ],
);

type _ChannelEntityCheck = AssertNoMismatch<
  EntityMismatch<typeof channels.$inferSelect, Channel>
>;
