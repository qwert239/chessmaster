import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { GamesService } from './games.service.js';

type AnalysisBody = {
  before?: unknown;
  after?: unknown;
  bestMove?: unknown;
};

@Controller()
export class GamesController {
  constructor(private readonly games: GamesService) {}

  // Save a pasted PGN.
  @Post('games')
  create(@Body() body: { pgn?: unknown; analysis?: unknown }) {
    if (typeof body?.pgn !== 'string' || body.pgn.trim() === '') {
      throw new BadRequestException('Paste a PGN.');
    }
    return this.games.save(body.pgn.trim(), this.analysis(body.analysis));
  }

  // List one player's inaccuracies, mistakes, or blunders.
  @Get('mistakes')
  mistakes(@Query('name') name: unknown, @Query('verdict') verdict: unknown) {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new BadRequestException('Enter a name.');
    }
    if (typeof verdict !== 'string') {
      throw new BadRequestException('Choose inaccuracies, mistakes, or blunders.');
    }
    return this.games.findMistakes(name.trim(), verdict);
  }

  // Keep numeric evals and a string best move from the request.
  private analysis(value: unknown) {
    if (value == null) {
      return undefined;
    }
    if (!Array.isArray(value)) {
      throw new BadRequestException('Analysis does not match the moves.');
    }
    return value.map((item: AnalysisBody) => ({
      before: typeof item?.before === 'number' ? item.before : null,
      after: typeof item?.after === 'number' ? item.after : null,
      bestMove: typeof item?.bestMove === 'string' ? item.bestMove : null,
    }));
  }
}
