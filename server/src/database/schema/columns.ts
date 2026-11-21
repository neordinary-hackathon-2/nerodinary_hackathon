import { bigint, timestamp } from 'drizzle-orm/mysql-core';

/**
 * 모든 테이블이 공유하는 컬럼.
 *
 * 사용 예:
 *   export const contents = mysqlTable('contents', {
 *     id: primaryId(),
 *     title: varchar({ length: 100 }).notNull(),
 *     ...timestamps,
 *   });
 */
export const primaryId = () =>
  bigint({ mode: 'number', unsigned: true }).autoincrement().primaryKey();

/** 다른 테이블의 primaryId를 가리키는 FK 컬럼 타입. .references(() => table.id) 와 함께 쓴다. */
export const foreignId = () => bigint({ mode: 'number', unsigned: true });

export const timestamps = {
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow().onUpdateNow(),
};
