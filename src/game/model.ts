/**
 * Pure match-3 rules. No DOM, canvas, or audio.
 *
 * Board is ROWS x COLS. Tile.type is 0..TYPES-1 and lines up with FOODS in content.ts.
 * Tile.special:
 *   none  — ordinary food
 *   row   — made by 4 in a row; detonating clears that whole row
 *   col   — made by 4 in a column; detonating clears that whole column
 *   wrap  — made by a T or L of 5 or more; detonating clears a 3x3
 *   color — made by 5 in a straight line; detonating clears one food type
 *
 * collectClear(board, activate) is the only function that creates or fires specials.
 * It mutates Tile.special on tiles that stay, and returns the cells to remove.
 * `activate` is the two post-swap cells, or [] during a cascade.
 * A special created by this call is not detonated in the same call.
 * Swapping two color bombs clears the whole board.
 */
export const COLS = 7;
export const ROWS = 8;
export const TYPES = 4;

export type Special = "none" | "row" | "col" | "wrap" | "color";
export type Tile = { id: number; type: number; special: Special };
export type Board = (Tile | null)[][];

let seq = 1;

export function makeTile(type: number, special: Special = "none"): Tile {
  seq += 1;
  return { id: seq, type, special };
}

export function resetIds(start = 1) {
  seq = start;
}

export function findMatches(board: Board): Array<[number, number]> {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const mark: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));

  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const tile = board[r][c];
      if (!tile) {
        c += 1;
        continue;
      }
      let end = c + 1;
      while (end < cols && board[r][end]?.type === tile.type) end += 1;
      if (end - c >= 3) {
        for (let k = c; k < end; k++) mark[r][k] = true;
      }
      c = end;
    }
  }

  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      const tile = board[r][c];
      if (!tile) {
        r += 1;
        continue;
      }
      let end = r + 1;
      while (end < rows && board[end][c]?.type === tile.type) end += 1;
      if (end - r >= 3) {
        for (let k = r; k < end; k++) mark[k][c] = true;
      }
      r = end;
    }
  }

  const out: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mark[r][c]) out.push([r, c]);
    }
  }
  return out;
}

export function swap(board: Board, r1: number, c1: number, r2: number, c2: number) {
  const tmp = board[r1][c1];
  board[r1][c1] = board[r2][c2];
  board[r2][c2] = tmp;
}

export function createsMatch(board: Board, r1: number, c1: number, r2: number, c2: number) {
  swap(board, r1, c1, r2, c2);
  const ok = findMatches(board).length > 0;
  swap(board, r1, c1, r2, c2);
  return ok;
}

export function adjacent(r1: number, c1: number, r2: number, c2: number) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

export function scoreFor(count: number, combo: number) {
  const bonus = count >= 5 ? 40 : count === 4 ? 20 : 0;
  return (count * 10 + bonus) * Math.max(1, combo);
}

export type Hint = { r1: number; c1: number; r2: number; c2: number };

export function canSwap(board: Board, r1: number, c1: number, r2: number, c2: number) {
  if (!adjacent(r1, c1, r2, c2)) return false;
  const a = board[r1][c1];
  const b = board[r2][c2];
  if (!a || !b) return false;
  if (a.special !== "none" || b.special !== "none") return true;
  return createsMatch(board, r1, c1, r2, c2);
}

function cellKey(r: number, c: number) {
  return r * COLS + c;
}

function matchShapes(board: Board): Array<Array<[number, number]>> {
  const runs: Array<Array<[number, number]>> = [];
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const tile = board[r][c];
      if (!tile) {
        c += 1;
        continue;
      }
      let end = c + 1;
      while (end < cols && board[r][end]?.type === tile.type) end += 1;
      if (end - c >= 3) {
        const run: Array<[number, number]> = [];
        for (let k = c; k < end; k++) run.push([r, k]);
        runs.push(run);
      }
      c = end;
    }
  }
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      const tile = board[r][c];
      if (!tile) {
        r += 1;
        continue;
      }
      let end = r + 1;
      while (end < rows && board[end][c]?.type === tile.type) end += 1;
      if (end - r >= 3) {
        const run: Array<[number, number]> = [];
        for (let k = r; k < end; k++) run.push([k, c]);
        runs.push(run);
      }
      r = end;
    }
  }
  if (!runs.length) return [];
  const parent = runs.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const unite = (a: number, b: number) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent[pa] = pb;
  };
  const seen = new Map<number, number>();
  runs.forEach((run, index) => {
    for (const [r, c] of run) {
      const key = cellKey(r, c);
      const other = seen.get(key);
      if (other == null) seen.set(key, index);
      else unite(other, index);
    }
  });
  const groups = new Map<number, Array<[number, number]>>();
  runs.forEach((run, index) => {
    const root = find(index);
    const list = groups.get(root) ?? [];
    for (const cell of run) {
      if (!list.some(([r, c]) => r === cell[0] && c === cell[1])) list.push(cell);
    }
    groups.set(root, list);
  });
  return [...groups.values()];
}

function shapeKind(cells: Array<[number, number]>): Special {
  if (cells.length < 4) return "none";
  const rows = new Set(cells.map(([r]) => r));
  const cols = new Set(cells.map(([, c]) => c));
  const straight = rows.size === 1 || cols.size === 1;
  if (straight && cells.length >= 5) return "color";
  if (rows.size === 1 && cells.length === 4) return "row";
  if (cols.size === 1 && cells.length === 4) return "col";
  if (!straight && cells.length >= 5) return "wrap";
  return "none";
}

export function collectClear(board: Board, activate: Array<[number, number]>) {
  const clear = new Set<number>();
  const spawned = new Set<number>();
  const powers: Special[] = [];
  for (const cells of matchShapes(board)) {
    const kind = shapeKind(cells);
    let anchor: [number, number] | null = null;
    if (kind !== "none") {
      const plain = (cell: [number, number]) => board[cell[0]][cell[1]]?.special === "none";
      anchor =
        activate.find((cell) => plain(cell) && cells.some(([r, c]) => r === cell[0] && c === cell[1])) ??
        cells.find(plain) ??
        null;
      if (anchor) {
        const tile = board[anchor[0]][anchor[1]];
        if (tile) {
          tile.special = kind;
          spawned.add(cellKey(anchor[0], anchor[1]));
          powers.push(kind);
        }
      }
    }
    for (const [r, c] of cells) {
      if (anchor && r === anchor[0] && c === anchor[1]) continue;
      clear.add(cellKey(r, c));
    }
  }

  const queue: Array<[number, number]> = [];
  const queued = new Set<number>();
  const arm = (r: number, c: number) => {
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return;
    const key = cellKey(r, c);
    if (spawned.has(key)) return;
    const tile = board[r][c];
    if (!tile) return;
    clear.add(key);
    if (tile.special !== "none" && !queued.has(key)) {
      queued.add(key);
      queue.push([r, c]);
    }
  };

  for (const key of [...clear]) arm(Math.floor(key / COLS), key % COLS);
  for (const [r, c] of activate) arm(r, c);

  while (queue.length) {
    const [r, c] = queue.shift()!;
    const tile = board[r][c];
    if (!tile || tile.special === "none") continue;
    powers.push(tile.special);
    if (tile.special === "row") {
      for (let cc = 0; cc < COLS; cc++) arm(r, cc);
    } else if (tile.special === "col") {
      for (let rr = 0; rr < ROWS; rr++) arm(rr, c);
    } else if (tile.special === "wrap") {
      for (let rr = r - 1; rr <= r + 1; rr++) {
        for (let cc = c - 1; cc <= c + 1; cc++) arm(rr, cc);
      }
    } else {
      const swapped = activate.some(([rr, cc]) => rr === r && cc === c);
      const other = swapped ? activate.find(([rr, cc]) => rr !== r || cc !== c) : undefined;
      const partner = other ? board[other[0]][other[1]] : null;
      if (partner?.special === "color") {
        for (let rr = 0; rr < ROWS; rr++) {
          for (let cc = 0; cc < COLS; cc++) arm(rr, cc);
        }
      } else {
        const target = partner ? partner.type : tile.type;
        for (let rr = 0; rr < ROWS; rr++) {
          for (let cc = 0; cc < COLS; cc++) {
            if (board[rr][cc]?.type === target) arm(rr, cc);
          }
        }
      }
    }
  }

  const cells: Array<[number, number]> = [];
  for (const key of clear) cells.push([Math.floor(key / COLS), key % COLS]);
  return { cells, powers };
}

export function findHint(board: Board): Hint | null {
  const rows = board.length;
  const cols = board[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols && createsMatch(board, r, c, r, c + 1)) {
        return { r1: r, c1: c, r2: r, c2: c + 1 };
      }
      if (r + 1 < rows && createsMatch(board, r, c, r + 1, c)) {
        return { r1: r, c1: c, r2: r + 1, c2: c };
      }
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols && canSwap(board, r, c, r, c + 1)) {
        return { r1: r, c1: c, r2: r, c2: c + 1 };
      }
      if (r + 1 < rows && canSwap(board, r, c, r + 1, c)) {
        return { r1: r, c1: c, r2: r + 1, c2: c };
      }
    }
  }
  return null;
}

export function collapse(board: Board, rng: () => number = Math.random): Board {
  const rows = board.length;
  const cols = board[0].length;
  const next: Board = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (let c = 0; c < cols; c++) {
    const stack: Tile[] = [];
    for (let r = rows - 1; r >= 0; r--) {
      const tile = board[r][c];
      if (tile) stack.push(tile);
    }
    for (let i = 0; i < rows; i++) {
      const r = rows - 1 - i;
      next[r][c] = i < stack.length ? stack[i] : makeTile(Math.floor(rng() * TYPES));
    }
  }
  return next;
}

export function createBoard(rng: () => number = Math.random): Board {
  let last: Board = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    const board: Board = [];
    for (let r = 0; r < ROWS; r++) {
      const row: (Tile | null)[] = [];
      for (let c = 0; c < COLS; c++) {
        let type = 0;
        for (let t = 0; t < 16; t++) {
          type = Math.floor(rng() * TYPES);
          const left =
            c >= 2 && row[c - 1]?.type === type && row[c - 2]?.type === type;
          const up =
            r >= 2 && board[r - 1][c]?.type === type && board[r - 2][c]?.type === type;
          if (!left && !up) break;
        }
        row.push(makeTile(type));
      }
      board.push(row);
    }
    last = board;
    if (findMatches(board).length === 0 && findHint(board)) return board;
  }
  return last;
}
