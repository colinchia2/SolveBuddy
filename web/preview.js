// A small picture of a puzzle's board for the Resume / View solved sheet (Colin, 10/22: "add a photo of the current
// board"). Drawn from the save (or your finished board / the answer when solved), the same colours as each game.
import { shikakuBoard, shikakuColors, shikakuPicture } from "./screens.js";

const SB_COLORS = { A: "#D8C3EA", B: "#FFD08A", C: "#A6D8D0", D: "#C6E2A6", E: "#F5C2C9", F: "#FFB48A", G: "#BFD3F2", H: "#E9D9B8",
  I: "#E2EA98", J: "#D3D0C8", K: "#CDB497", L: "#E7AEDB" };
const WS_COLORS = { A: "#E8574F", B: "#3E86E8", C: "#F4C542", D: "#4CB86A", E: "#9B6BD6", F: "#F28C38",
  G: "#EE7BB0", H: "#2BB3B1", I: "#9C6B4E", J: "#A8D45A", K: "#2F4A8A", L: "#9AA3AD" };
const STAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.5 6.6-.8z" fill="#2A211B"/></svg>`;

// puzzle = the pack's puzzle; board = the saved state ({ marks } / { entries } / { tubes }), or null for "solved, show the answer".
export function boardPreview(g, puzzle, board) {
  if (g === "starbattle") {
    const n = puzzle.regions.length;
    const marks = board?.marks ?? Object.fromEntries(puzzle.solution.flatMap((c, r) => [c].flat().map((x) => [`${r},${x}`, 2])));
    const cells = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const l = puzzle.regions[r][c], m = marks[`${r},${c}`];
      const br = c < n - 1 && puzzle.regions[r][c + 1] !== l ? " br" : "", bb = r < n - 1 && puzzle.regions[r + 1][c] !== l ? " bb" : "";
      cells.push(`<i class="pv-c${br}${bb}" style="background:${SB_COLORS[l]}">${m === 2 ? STAR : m === 1 ? "×" : ""}</i>`);
    }
    return `<div class="pv pv-sb" style="--n:${n}">${cells.join("")}</div>`;
  }
  if (g === "sudoku") {
    const cells = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      const given = puzzle.givens[r][c], v = given || (board ? board.entries?.[`${r},${c}`] : puzzle.solution[r][c]);
      const br = c === 2 || c === 5 ? " br" : "", bb = r === 2 || r === 5 ? " bb" : "";
      cells.push(`<i class="pv-c${br}${bb}${given ? " given" : ""}">${v || ""}</i>`);
    }
    return `<div class="pv pv-su">${cells.join("")}${extras(puzzle)}</div>`;
  }
  if (g === "nonogram") {
    // Solved: the picture in its colour; in progress: your filled squares and × marks.
    const n = puzzle.solution.length;
    const marks = board?.marks ?? Object.fromEntries(puzzle.solution.flatMap((row, r) => [...row].map((v, c) => [`${r},${c}`, v === "X" ? 1 : 0])));
    const fill = board ? "#2A211B" : puzzle.color ?? "#2A211B";
    const cells = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const m = marks[`${r},${c}`];
      cells.push(`<i class="pv-c" style="${m === 1 ? `background:${fill}` : ""}">${m === 2 ? "×" : ""}</i>`);
    }
    return `<div class="pv pv-sb pv-nono" style="--n:${n}">${cells.join("")}</div>`;
  }
  if (g === "shikaku") {
    // Solved: the finished picture, each patch solid; in progress: the grid, your patches (soft) and every clue
    // (Colin 10/24: the card was blank).
    const patches = board?.patches ?? shikakuColors(puzzle.solution);
    const solid = !board || !!board.done;
    return `<div class="pv pv-shk">${solid ? shikakuPicture(puzzle.size, patches, 200, true) : shikakuBoard(puzzle, patches, 200)}</div>`;
  }
  if (g === "watersort") {
    const tubes = board?.tubes ?? sortedTubes(puzzle.tubes);
    return `<div class="pv pv-ws">${tubes.map((t) => `<span class="pv-tube">${t.map((x) => `<i style="background:${WS_COLORS[x] ?? "#ccc"}"></i>`).join("")}</span>`).join("")}</div>`;
  }
  return "";
}

// Killer cages (dashed, sum in the corner) and Thermo lines (grey bulb and tube) over a small Sudoku, drawn like the
// game draws them (Colin 10/27: the pack pictures and the Resume / View solved card had neither). Cells are 22px.
function extras(p) {
  const C = 22, parts = [];
  for (const line of p.thermos ?? []) {
    const pts = line.map(([r, c]) => `${c * C + C / 2},${r * C + C / 2}`).join(" ");
    parts.push(`<g opacity=".55"><polyline points="${pts}" fill="none" stroke="#BDB6AD" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<circle cx="${line[0][1] * C + C / 2}" cy="${line[0][0] * C + C / 2}" r="8" fill="#BDB6AD"/></g>`);
  }
  for (const cage of p.cages ?? []) {
    const has = (r, c) => cage.cells.some(([a, b]) => a === r && b === c), d = 2;
    for (const [r, c] of cage.cells) {
      const x0 = c * C + d, y0 = r * C + d, x1 = (c + 1) * C - d - 1, y1 = (r + 1) * C - d - 1;
      if (!has(r - 1, c)) parts.push(`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}"/>`);
      if (!has(r + 1, c)) parts.push(`<line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}"/>`);
      if (!has(r, c - 1)) parts.push(`<line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}"/>`);
      if (!has(r, c + 1)) parts.push(`<line x1="${x1}" y1="${y0}" x2="${x1}" y2="${y1}"/>`);
    }
    const [r, c] = cage.cells[0];
    parts.push(`<text x="${c * C + 3}" y="${r * C + 8}">${cage.sum}</text>`);
  }
  return parts.length ? `<svg class="pv-extra" viewBox="0 0 ${9 * C} ${9 * C}" aria-hidden="true">${parts.join("")}</svg>` : "";
}

// The finished look of a Water Sort level: each colour in its own full tube, the rest empty.
function sortedTubes(tubes) {
  const colors = [...new Set(tubes.flat())];
  return tubes.map((_, i) => (colors[i] ? Array(4).fill(colors[i]) : []));
}
