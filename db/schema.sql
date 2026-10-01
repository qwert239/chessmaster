CREATE TABLE games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text,
  pgn text NOT NULL,
  white text,
  black text,
  result text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games (id) ON DELETE CASCADE,
  ply integer NOT NULL,
  san text NOT NULL,
  verdict text,
  best_move text,
  UNIQUE (game_id, ply)
);
