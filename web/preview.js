// A small picture of a puzzle's board for the Resume / View solved sheet (Colin, 10/22: "add a photo of the current
// board"). Drawn from the save (or your finished board / the answer when solved), the same colours as each game.

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
    return `<div class="pv pv-su">${cells.join("")}</div>`;
  }
  if (g === "watersort") {
    const tubes = board?.tubes ?? sortedTubes(puzzle.tubes);
    return `<div class="pv pv-ws">${tubes.map((t) => `<span class="pv-tube">${t.map((x) => `<i style="background:${WS_COLORS[x] ?? "#ccc"}"></i>`).join("")}</span>`).join("")}</div>`;
  }
  return "";
}

// The finished look of a Water Sort level: each colour in its own full tube, the rest empty.
function sortedTubes(tubes) {
  const colors = [...new Set(tubes.flat())];
  return tubes.map((_, i) => (colors[i] ? Array(4).fill(colors[i]) : []));
}
