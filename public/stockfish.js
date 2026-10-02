const ENGINE_URL = "./engine/stockfish-19-lite-single.js";
const DEPTH = 12;

let worker;
let readyPromise;
let chain = Promise.resolve();

// Worker messages arrive as text or as { data: text }.
function messageText(data) {
  if (typeof data === "string") {
    return data;
  }
  if (data && typeof data.data === "string") {
    return data.data;
  }
  return "";
}

// One Stockfish worker for the page.
function engine() {
  if (!worker) {
    worker = new Worker(ENGINE_URL);
  }
  return worker;
}

// Wait until the engine answers uciok and readyok.
function ready() {
  if (!readyPromise) {
    readyPromise = new Promise((resolve, reject) => {
      const sf = engine();
      const onMessage = (event) => {
        const line = messageText(event.data);
        if (line === "uciok") {
          sf.postMessage("isready");
        }
        if (line === "readyok") {
          sf.removeEventListener("message", onMessage);
          resolve(sf);
        }
      };
      sf.addEventListener("message", onMessage);
      sf.addEventListener(
        "error",
        () => reject(new Error("Stockfish failed to start.")),
        { once: true },
      );
      sf.postMessage("uci");
    });
  }
  return readyPromise;
}

// UCI scores the side to move. Flip that to White's point of view.
function whiteScore(fen, cp, mate) {
  const whiteToMove = fen.split(" ")[1] !== "b";
  const sign = whiteToMove ? 1 : -1;
  if (mate != null) {
    return { eval: null, mate: sign * mate };
  }
  if (cp == null) {
    return { eval: null, mate: null };
  }
  return { eval: Math.round(sign * cp) / 100, mate: null };
}

// Search one position for the eval and the best move.
function analyze(fen, depth) {
  return ready().then(
    (sf) =>
      new Promise((resolve) => {
        let cp = null;
        let mate = null;
        const onMessage = (event) => {
          for (const line of messageText(event.data).split("\n")) {
            if (line.startsWith("info ")) {
              const score = line.match(/\bscore (cp|mate) (-?\d+)/);
              if (score?.[1] === "cp") {
                cp = Number(score[2]);
              } else if (score?.[1] === "mate") {
                mate = Number(score[2]);
                cp = null;
              }
            }
            if (line.startsWith("bestmove")) {
              sf.removeEventListener("message", onMessage);
              const uci = line.split(/\s+/)[1];
              resolve({
                ...whiteScore(fen, cp, mate),
                bestMove: uci && uci !== "(none)" ? uci : null,
              });
            }
          }
        };
        sf.addEventListener("message", onMessage);
        sf.postMessage(`position fen ${fen}`);
        sf.postMessage(`go depth ${depth}`);
      }),
  );
}

// Run searches one at a time. The engine is a single worker.
export function evaluateFen(fen, depth = DEPTH) {
  const result = chain.then(() => analyze(fen, depth), () => analyze(fen, depth));
  chain = result.then(
    () => {},
    () => {},
  );
  return result;
}

// Score each position, including the start, and report progress.
export async function evaluateMoves(fens, onProgress) {
  const scores = [];
  for (let index = 0; index < fens.length; index += 1) {
    const score = await evaluateFen(fens[index]);
    scores.push(score);
    onProgress?.(index, fens.length - 1, score);
  }
  return scores;
}
