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
    code: varchar({ length: 10 }).notNull(),
    name: varchar({ length: 50 }).notNull(),
    slogan: varchar({ length: 150 }),
    role: varchar({ length: 200 }),
    displayOrder: tinyint({ unsigned: true }).notNull(),
    seedKeywords: json().$type<string[]>().notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('channels_code_uq').on(table.code)],
);

type _ChannelEntityCheck = AssertNoMismatch<
  EntityMismatch<typeof channels.$inferSelect, Channel>
>;
