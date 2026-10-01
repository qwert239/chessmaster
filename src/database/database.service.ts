import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly pool: Pool;

  constructor(config: ConfigService) {
    // Open a pool using DATABASE_URL.
    this.pool = new Pool({
      connectionString: config.get<string>('DATABASE_URL'),
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
