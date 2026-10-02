import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
import { Chessboard, FEN } from "https://cdn.jsdelivr.net/npm/cm-chessboard@8.7.11/+esm";
import { evaluateMoves } from "./stockfish.js";

const ASSETS_URL = "https://cdn.jsdelivr.net/npm/cm-chessboard@8.7.11/assets/";

const form = document.querySelector("#load-form");
const pgnInput = document.querySelector("#pgn");
const statusEl = document.querySelector("#status");
const stage = document.querySelector("#stage");
const playersEl = document.querySelector("#players");
const movesEl = document.querySelector("#moves");
const plyLabel = document.querySelector("#ply-label");
const boardEl = document.querySelector("#board");

let board;
let fens = [];
let sans = [];
let evals = [];
let analysis = [];
let ply = 0;
let analysisRun = 0;
let loadedPgn = "";

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function header(pgn, name) {
  const match = pgn.match(new RegExp(`\\[${name}\\s+"([^"]*)"\\]`));
  return match?.[1] ?? "";
}

function positionsFromPgn(pgn) {
  const chess = new Chess();
  chess.loadPgn(pgn, { strict: false });
  const history = chess.history();
  if (history.length === 0) {
    throw new Error("PGN has no moves");
  }
  chess.reset();
  const nextFens = [chess.fen()];
  for (const san of history) {
    const move = chess.move(san);
    if (!move) {
      throw new Error(`Illegal move: ${san}`);
    }
    nextFens.push(chess.fen());
  }
  return { fens: nextFens, sans: history };
}

function formatEval(score) {
  if (!score) {
    return "";
  }
  if (score.mate != null) {
    const sign = score.mate > 0 ? "+" : "-";
    return `${sign}#${Math.abs(score.mate)}`;
  }
  if (score.eval == null) {
    return "";
  }
  const sign = score.eval > 0 ? "+" : "";
  return `${sign}${score.eval.toFixed(2)}`;
}

function moveButton(index) {
  const button = document.createElement("button");
  button.type = "button";
  if (!sans[index]) {
    button.disabled = true;
    return button;
  }
  button.textContent = sans[index];
  button.classList.toggle("active", ply === index + 1);
  button.addEventListener("click", () => showPly(index + 1));
  return button;
}

function moveCell(index) {
  const cell = document.createElement("div");
  cell.className = "move-cell";
  if (!sans[index]) {
    return cell;
  }
  const score = document.createElement("span");
  score.className = "eval";
  score.textContent = formatEval(evals[index]);
  cell.append(moveButton(index), score);
  return cell;
}

function renderMoves() {
  movesEl.replaceChildren();
  for (let i = 0; i < sans.length; i += 2) {
    const row = document.createElement("li");
    const number = document.createElement("span");
    number.textContent = `${i / 2 + 1}.`;
    row.append(number, moveCell(i), moveCell(i + 1));
    movesEl.append(row);
  }
}

function showPly(next) {
  ply = Math.max(0, Math.min(next, fens.length - 1));
  board.setPosition(fens[ply], true);
  plyLabel.textContent = `${ply} / ${fens.length - 1}`;
  renderMoves();
}

function ensureBoard() {
  if (board) {
    return;
  }
  board = new Chessboard(boardEl, {
    position: FEN.start,
    assetsUrl: ASSETS_URL,
    style: { animationDuration: 180 },
  });
}

function showGame(pgn) {
  const parsed = positionsFromPgn(pgn);
  fens = parsed.fens;
  sans = parsed.sans;
  evals = [];
  analysis = [];
  analysisRun += 1;
  loadedPgn = pgn;
  const white = header(pgn, "White") || "White";
  const black = header(pgn, "Black") || "Black";
  playersEl.textContent = `${white} vs ${black}`;
  stage.hidden = false;
  ensureBoard();
  showPly(0);
}

document.querySelector("#btn-eval").addEventListener("click", async () => {
  if (fens.length < 2) {
    return;
  }
  const run = ++analysisRun;
  const button = document.querySelector("#btn-eval");
  button.disabled = true;
  evals = sans.map(() => null);
  renderMoves();
  try {
    const scores = await evaluateMoves(fens, (index, last, score) => {
      if (run !== analysisRun) {
        return;
      }
      if (index >= 1) {
        evals[index - 1] = score;
        renderMoves();
      }
      const done = index + 1;
      const total = last + 1;
      setStatus(done === total ? "Evaluation ready." : `Evaluating ${done} / ${total}`);
    });
    if (run !== analysisRun) {
      return;
    }
    analysis = sans.map((_, index) => ({
      before: scores[index]?.eval ?? null,
      after: scores[index + 1]?.eval ?? null,
      bestMove: scores[index]?.bestMove ?? null,
    }));
  } catch (error) {
    if (run === analysisRun) {
      setStatus(error.message || "Stockfish failed.", true);
    }
  } finally {
    button.disabled = false;
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const pgn = pgnInput.value.trim();
  if (!pgn) {
    setStatus("Paste a PGN.", true);
    return;
  }
  try {
    showGame(pgn);
    setStatus("Loaded.");
  } catch (error) {
    setStatus(error.message || "Could not read that PGN.", true);
  }
});

document.querySelector("#btn-save").addEventListener("click", async () => {
  if (!loadedPgn) {
    setStatus("Load a game first.", true);
    return;
  }

  // Save the loaded game and its moves.
  try {
    const response = await fetch("/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pgn: loadedPgn,
        ...(analysis.length === sans.length ? { analysis } : {}),
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = Array.isArray(body.message) ? body.message[0] : body.message;
      throw new Error(message || "Could not save the game.");
    }
    setStatus("Saved.");
  } catch (error) {
    setStatus(error.message || "Could not save the game.", true);
  }
});

document.querySelector("#btn-start").addEventListener("click", () => showPly(0));
document.querySelector("#btn-prev").addEventListener("click", () => showPly(ply - 1));
document.querySelector("#btn-next").addEventListener("click", () => showPly(ply + 1));
document.querySelector("#btn-end").addEventListener("click", () => showPly(fens.length - 1));

document.addEventListener("keydown", (event) => {
  if (stage.hidden || event.target === pgnInput) {
    return;
  }
  if (event.key === "ArrowLeft") showPly(ply - 1);
  if (event.key === "ArrowRight") showPly(ply + 1);
});
