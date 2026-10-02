-- One saved game.
CREATE TABLE games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text,
  pgn text NOT NULL,
  white text,
  black text,
  result text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per ply. eval is White's score after the move.
CREATE TABLE moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games (id) ON DELETE CASCADE,
  username text,
  ply integer NOT NULL,
  san text NOT NULL,
  eval numeric,
  verdict text,
  best_move text,
  UNIQUE (game_id, ply)
);
