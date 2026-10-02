import { Chessboard } from "https://cdn.jsdelivr.net/npm/cm-chessboard@8.7.11/+esm";

const ASSETS_URL = "https://cdn.jsdelivr.net/npm/cm-chessboard@8.7.11/assets/";
const form = document.querySelector("#filter-form");
const statusEl = document.querySelector("#status");
const results = document.querySelector("#results");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

// Signed pawn score, such as +0.34.
function formatEval(value) {
  if (value == null) {
    return "";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

// Center of a square in the arrow overlay.
function squarePoint(square, size) {
  const squareSize = size / 8;
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return {
    x: (file + 0.5) * squareSize,
    y: (7 - rank + 0.5) * squareSize,
  };
}

// Red is the played move. Green is the best move.
function drawArrows(frame, move) {
  const size = frame.clientWidth;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "arrows");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  svg.append(defs);
  for (const [from, to, color] of [
    [move.playedFrom, move.playedTo, "#e07a5f"],
    [move.bestFrom, move.bestTo, "#7dbf7a"],
  ]) {
    if (!from || !to) {
      continue;
    }
    const id = `head-${color.slice(1)}`;
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", id);
    marker.setAttribute("markerWidth", "8");
    marker.setAttribute("markerHeight", "8");
    marker.setAttribute("refX", "6");
    marker.setAttribute("refY", "4");
    marker.setAttribute("orient", "auto");
    const head = document.createElementNS("http://www.w3.org/2000/svg", "path");
    head.setAttribute("d", "M0,0 L8,4 L0,8 Z");
    head.setAttribute("fill", color);
    marker.append(head);
    defs.append(marker);
    const start = squarePoint(from, size);
    const end = squarePoint(to, size);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(start.x));
    line.setAttribute("y1", String(start.y));
    line.setAttribute("x2", String(end.x));
    line.setAttribute("y2", String(end.y));
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", "5");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("marker-end", `url(#${id})`);
    svg.append(line);
  }
  frame.append(svg);
}

// Toggle the board under one move.
function showBoard(article, move) {
  const slot = article.querySelector(".board-slot");
  const button = article.querySelector("button");
  if (!slot.hidden) {
    slot.hidden = true;
    slot.replaceChildren();
    button.textContent = "Show board";
    return;
  }
  for (const open of results.querySelectorAll(".board-slot")) {
    if (open !== slot) {
      open.hidden = true;
      open.replaceChildren();
      open.closest(".mistake").querySelector("button").textContent = "Show board";
    }
  }
  slot.hidden = false;
  button.textContent = "Hide board";
  const frame = document.createElement("div");
  frame.className = "board-frame";
  const target = document.createElement("div");
  target.className = "board-target";
  frame.append(target);
  slot.append(frame);
  new Chessboard(target, {
    position: move.fen,
    assetsUrl: ASSETS_URL,
    style: { animationDuration: 0 },
  });
  requestAnimationFrame(() => drawArrows(frame, move));
}

// White vs Black, plus the result when the game has one.
function gameTitle(game) {
  const names = `${game.white || "White"} vs ${game.black || "Black"}`;
  return game.result && game.result !== "*" ? `${names} ${game.result}` : names;
}

// List mistakes grouped by game.
function render(games) {
  results.replaceChildren();
  const count = games.reduce((sum, game) => sum + game.moves.length, 0);
  if (count === 0) {
    setStatus("No moves for that name.");
    return;
  }
  setStatus(
    `${count} move${count === 1 ? "" : "s"} in ${games.length} game${games.length === 1 ? "" : "s"}.`,
  );
  for (const game of games) {
    const section = document.createElement("section");
    section.className = "game";
    const title = document.createElement("h2");
    title.textContent = gameTitle(game);
    section.append(title);
    const heading = document.createElement("div");
    heading.className = "mistake-row";
    for (const text of ["Move", "Eval", "Best move", ""]) {
      const cell = document.createElement("span");
      cell.textContent = text;
      heading.append(cell);
    }
    section.append(heading);
    for (const move of game.moves) {
      const article = document.createElement("article");
      article.className = "mistake";
      const row = document.createElement("div");
      row.className = "mistake-row";
      for (const text of [move.san, formatEval(move.eval), move.bestMove ?? ""]) {
        const cell = document.createElement("span");
        cell.textContent = text;
        row.append(cell);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Show board";
      button.addEventListener("click", () => showBoard(article, move));
      row.append(button);
      const slot = document.createElement("div");
      slot.className = "board-slot";
      slot.hidden = true;
      article.append(row, slot);
      section.append(article);
    }
    results.append(section);
  }
}

// Load mistakes for an in-game username and a verdict.
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = new FormData(form).get("name");
  const verdict = new FormData(form).get("verdict");
  if (typeof name !== "string" || name.trim() === "") {
    setStatus("Enter a name.", true);
    results.replaceChildren();
    return;
  }
  const params = new URLSearchParams({ name: name.trim(), verdict: String(verdict) });
  try {
    const response = await fetch(`/mistakes?${params}`);
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
      throw new Error(message || "Could not load mistakes.");
    }
    render(body);
  } catch (error) {
    results.replaceChildren();
    setStatus(error.message || "Could not load mistakes.", true);
  }
});
