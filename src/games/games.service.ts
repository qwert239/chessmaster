import { BadRequestException, Injectable } from '@nestjs/common';
import { Chess } from 'chess.js';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class GamesService {
  constructor(private readonly database: DatabaseService) {}

  async save(pgn: string) {
    // Parse the PGN into players, result, and moves.
    const parsed = this.parse(pgn);
    const client = await this.database.pool.connect();

    try {
      await client.query('BEGIN');

      // Store the game. username will change with future account feature updates.
      const username = 'admin1000';
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO games (username, pgn, white, black, result)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [username, pgn, parsed.white, parsed.black, parsed.result],
      );
      const gameId = inserted.rows[0].id;

      // Store one row per ply.
      await client.query(
        `INSERT INTO moves (game_id, username, ply, san)
         SELECT $1, $2, move.ply, move.san
         FROM unnest($3::int[], $4::text[]) AS move(ply, san)`,
        [gameId, username, parsed.plies, parsed.sans],
      );

      await client.query('COMMIT');
      return { id: gameId, moves: parsed.sans.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private parse(pgn: string) {
    const chess = new Chess();
    try {
      chess.loadPgn(pgn, { strict: false });
    } catch {
      throw new BadRequestException('Could not read that PGN.');
    }

    const sans = chess.history();
    if (sans.length === 0) {
      throw new BadRequestException('PGN has no moves.');
    }

    const headers = chess.getHeaders();
    return {
      white: headers.White ?? null,
      black: headers.Black ?? null,
      result: headers.Result ?? null,
      plies: sans.map((_, index) => index + 1),
      sans,
    };
  }
}
