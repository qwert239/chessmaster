import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
import { Chessboard, FEN } from "https://cdn.jsdelivr.net/npm/cm-chessboard@8.7.11/+esm";

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
let ply = 0;

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

function renderMoves() {
  movesEl.replaceChildren();
  for (let i = 0; i < sans.length; i += 2) {
    const row = document.createElement("li");
    const number = document.createElement("span");
    number.textContent = `${i / 2 + 1}.`;
    row.append(number, moveButton(i), moveButton(i + 1));
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
  const white = header(pgn, "White") || "White";
  const black = header(pgn, "Black") || "Black";
  playersEl.textContent = `${white} vs ${black}`;
  stage.hidden = false;
  ensureBoard();
  showPly(0);
}

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
