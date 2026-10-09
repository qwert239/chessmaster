import { BadRequestException, Injectable } from '@nestjs/common';
import { Chess, type Square } from 'chess.js';
import { DatabaseService } from '../database/database.service.js';

const VERDICTS = ['inaccuracy', 'mistake', 'blunder'] as const;

type AnalysisMove = {
  before: number | null;
  after: number | null;
  bestMove: string | null;
};

@Injectable()
export class GamesService {
  constructor(private readonly database: DatabaseService) {}

  // Save a game and one row per move.
  async save(pgn: string, analysis?: AnalysisMove[]) {
    // Parse the PGN into players, result, and moves.
    const parsed = this.parse(pgn);
    if (analysis && analysis.length !== parsed.sans.length) {
      throw new BadRequestException('Analysis does not match the moves.');
    }
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

      // Store one row per ply. eval is the score after the move.
      const rows = this.moveRows(parsed.sans, analysis);
      await client.query(
        `INSERT INTO moves (game_id, username, ply, san, eval, verdict, best_move)
         SELECT $1, $2, move.ply, move.san, move.eval, move.verdict, move.best_move
         FROM unnest($3::int[], $4::text[], $5::numeric[], $6::text[], $7::text[])
           AS move(ply, san, eval, verdict, best_move)`,
        [
          gameId,
          username,
          rows.plies,
          rows.sans,
          rows.evals,
          rows.verdicts,
          rows.bestMoves,
        ],
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

  // List one player's inaccuracies, mistakes, or blunders, grouped by game.
  async findMistakes(name: string, verdict: string) {
    if (!VERDICTS.includes(verdict as (typeof VERDICTS)[number])) {
      throw new BadRequestException('Choose inaccuracies, mistakes, or blunders.');
    }

    // Keep moves played by the name stored as White or Black.
    const found = await this.database.pool.query<{
      id: string;
      white: string | null;
      black: string | null;
      result: string | null;
      ply: number;
      san: string;
      eval: string | null;
      best_move: string | null;
      pgn: string;
    }>(
      `SELECT g.id, g.white, g.black, g.result, m.ply, m.san, m.eval, m.best_move, g.pgn
       FROM moves m
       JOIN games g ON g.id = m.game_id
       WHERE m.verdict = $2
         AND (
           (LOWER(g.white) = LOWER($1) AND m.ply % 2 = 1)
           OR (LOWER(g.black) = LOWER($1) AND m.ply % 2 = 0)
         )
       ORDER BY g.created_at DESC, m.ply`,
      [name, verdict],
    );

    return this.gamesFrom(found.rows);
  }

  // Eval after the move, verdict, and best move. No verdict when the played move is best.
  private moveRows(sans: string[], analysis?: AnalysisMove[]) {
    const chess = new Chess();
    const rows = {
      plies: [] as number[],
      sans: [] as string[],
      evals: [] as Array<number | null>,
      verdicts: [] as Array<string | null>,
      bestMoves: [] as Array<string | null>,
    };
    sans.forEach((san, index) => {
      const ply = index + 1;
      const item = analysis?.[index];
      const playedIsBest = item != null && this.sameMove(chess.fen(), san, item.bestMove);
      const verdict = item && !playedIsBest ? this.verdictFor(ply, item.before, item.after) : null;
      rows.plies.push(ply);
      rows.sans.push(san);
      rows.evals.push(item?.after ?? null);
      rows.verdicts.push(verdict);
      rows.bestMoves.push(item?.bestMove ?? null);
      chess.move(san);
    });
    return rows;
  }

  // True when the played move and the engine move are the same squares.
  private sameMove(fen: string, san: string, uci: string | null) {
    if (!uci || uci.length < 4) {
      return false;
    }
    const played = new Chess(fen).move(san);
    if (!played) {
      return false;
    }
    const promotion = uci.length > 4 ? uci[4] : undefined;
    return played.from === uci.slice(0, 2) && played.to === uci.slice(2, 4) && played.promotion === promotion;
  }

  // Group flat move rows under each game.
  private gamesFrom(
    rows: Array<{
      id: string;
      white: string | null;
      black: string | null;
      result: string | null;
      ply: number;
      san: string;
      eval: string | null;
      best_move: string | null;
      pgn: string;
    }>,
  ) {
    const games: Array<{
      white: string | null;
      black: string | null;
      result: string | null;
      moves: ReturnType<GamesService['mistakeView']>[];
    }> = [];
    const indexById = new Map<string, number>();
    for (const row of rows) {
      let index = indexById.get(row.id);
      if (index == null) {
        index = games.length;
        indexById.set(row.id, index);
        games.push({ white: row.white, black: row.black, result: row.result, moves: [] });
      }
      games[index].moves.push(this.mistakeView(row));
    }
    return games;
  }

  // Inaccuracy from a 0.1 win-chance drop, mistake from 0.2, blunder from 0.3.
  private verdictFor(ply: number, before: number | null, after: number | null) {
    const loss = this.lossForMover(ply, before, after);
    if (loss == null || loss < 0.1) {
      return null;
    }
    if (loss < 0.2) {
      return 'inaccuracy';
    }
    if (loss < 0.3) {
      return 'mistake';
    }
    return 'blunder';
  }

  // Win chances the mover lost, from -1 to 1. Odd ply is White.
  private lossForMover(ply: number, before: number | null, after: number | null) {
    if (before == null || after == null) {
      return null;
    }
    const from = this.winningChances(before);
    const to = this.winningChances(after);
    return ply % 2 === 1 ? from - to : to - from;
  }

  // White's win chances from a pawn score.
  private winningChances(pawns: number) {
    const chances = 2 / (1 + Math.exp(-0.00368208 * pawns * 100)) - 1;
    return Math.max(-1, Math.min(1, chances));
  }

  // One mistake, plus the squares for the red and green arrows.
  private mistakeView(row: {
    ply: number;
    san: string;
    eval: string | null;
    best_move: string | null;
    pgn: string;
  }) {
    const fen = this.fenBefore(row.pgn, row.ply);
    const played = this.playedSquares(fen, row.san);
    const best = this.bestSquares(fen, row.best_move);
    return {
      san: row.san,
      eval: row.eval == null ? null : Number(row.eval),
      bestMove: best?.san ?? null,
      fen,
      playedFrom: played?.from ?? null,
      playedTo: played?.to ?? null,
      bestFrom: best?.from ?? null,
      bestTo: best?.to ?? null,
    };
  }

  // Position before this ply.
  private fenBefore(pgn: string, ply: number) {
    const chess = new Chess();
    chess.loadPgn(pgn, { strict: false });
    const sans = chess.history();
    chess.reset();
    for (let index = 0; index < ply - 1; index += 1) {
      chess.move(sans[index]);
    }
    return chess.fen();
  }

  // From and to squares of the played move.
  private playedSquares(fen: string, san: string) {
    const move = new Chess(fen).move(san);
    if (!move) {
      return null;
    }
    return { from: move.from, to: move.to };
  }

  // From, to, and SAN of the engine move.
  private bestSquares(fen: string, uci: string | null) {
    if (!uci || uci.length < 4) {
      return null;
    }
    const move = new Chess(fen).move({
      from: uci.slice(0, 2) as Square,
      to: uci.slice(2, 4) as Square,
      promotion: uci.length > 4 ? uci[4] : undefined,
    });
    if (!move) {
      return null;
    }
    return { from: move.from, to: move.to, san: move.san };
  }

  // Players, result, and SAN moves from a PGN.
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
      sans,
    };
  }
}
