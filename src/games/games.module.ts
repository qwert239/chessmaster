import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { GamesController } from './games.controller.js';
import { GamesService } from './games.service.js';

// Game routes and the database.
@Module({
  imports: [DatabaseModule],
  controllers: [GamesController],
  providers: [GamesService],
})
export class GamesModule {}
