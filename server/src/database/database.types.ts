import type { MySql2Database } from 'drizzle-orm/mysql2';
import type * as schema from './schema/index.js';

/**
 * 주입받는 DB 타입.
 * 사용: constructor(@InjectDrizzle() private readonly db: Database) {}
 */
export type Database = MySql2Database<typeof schema>;
