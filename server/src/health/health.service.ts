import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { sql } from 'drizzle-orm';
import type { Database } from '../database/database.types.js';
import type { HealthResponseDto } from '../../../shared/index.js';

@Injectable()
export class HealthService {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  async check(): Promise<HealthResponseDto> {
    return {
      status: 'UP',
      database: (await this.isDatabaseUp()) ? 'UP' : 'DOWN',
      timestamp: new Date().toISOString(),
    };
  }

  private async isDatabaseUp(): Promise<boolean> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return true;
    } catch {
      return false;
    }
  }
}
