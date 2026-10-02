import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

// Shared Postgres pool.
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
