import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { GamesService } from './games.service.js';

@Controller('games')
export class GamesController {
  constructor(private readonly games: GamesService) {}

  // Save a pasted PGN.
  @Post()
  create(@Body('pgn') pgn: unknown) {
    if (typeof pgn !== 'string' || pgn.trim() === '') {
      throw new BadRequestException('Paste a PGN.');
    }
    return this.games.save(pgn.trim());
  }
}
