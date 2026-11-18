/**
 * Runtime loop for 芝芝消消. Rules live in ./model.ts. Names and colors live in ./content.ts.
 *
 * Phases: idle -> swap -> pop -> fall -> settle (which may pop again).
 * `moved` stores the two cells AFTER a successful swap; collectClear uses them
 * so a special the player just moved will detonate, while a special just created will not.
 * React reads score, best, line, bounces, and callout. It does not own the board.
 */
import {
  COLS,
  ROWS,
  adjacent,
  canSwap,
  collapse,
  collectClear,
  createBoard,
  findHint,
  findMatches,
  scoreFor,
  swap,
  type Board,
  type Hint,
  type Special,
  type Tile,
} from "./model";
import {
  BEST_KEY,
  DEFAULT_LINE,
  DOUBLE_SEC,
  FALL_SPEED,
  FEED_CHAIN_BONUS,
  FEED_PER_CELL,
  FOOD_NAMES,
  FOODS,
  HUNGER_DECAY,
  HUNGER_IDLE_DELAY,
  HUNGER_MAX,
  LINES,
  POP_DUR,
  POWER_LABEL,
  SWAP_DUR,
  TILE_COLORS,
  pickLine,
} from "./content";
import { menuComplete, todayMenu, type Menu } from "./menu";
import { Bgm, Sfx } from "./audio";
import jituiImg from "@/assets/food_jitui.png";
import burgerImg from "@/assets/food_burger.png";
import baozaiImg from "@/assets/food_baozai.png";
import fudingImg from "@/assets/food_fuding.png";

/** 食物像素贴图，顺序必须与 model.ts 的 type 0..3 / content.ts 的 FOODS 一致。 */
const FOOD_IMAGES: HTMLImageElement[] = [jituiImg, burgerImg, baozaiImg, fudingImg].map((src) => {
  const img = new Image();
  img.src = src;
  return img;
});

export type CalloutLine = { type: number; text: string };
export type Callout = { id: number; lines: CalloutLine[] };

type Vis = {
  id: number;
  type: number;
  special: Tile["special"];
  r: number;
  c: number;
  homeR: number;
  homeC: number;
  pop: number;
};

/** 投喂粒子：从消除格飞向立绘。c/r 是网格坐标（含小数），c0/r0 是起点，tx/ty 是目标。 */
type Particle = {
  c: number;
  r: number;
  c0: number;
  r0: number;
  tx: number;
  ty: number;
  life: number;
  max: number;
  color: string;
};

/** 立绘在画布左上方的画布外，所以目标是负行号 + 左侧列。 */
const FEED_TX = 0.6;
const FEED_TY = -1.2;

type Floater = { c: number; r: number; text: string; life: number; max: number; size: number };

/** 拖拽跟手：格子本体实时贴在手指上，x/y 是格子左上角的画布坐标。 */
type Drag = {
  id: number;
  visId: number;
  homeR: number;
  homeC: number;
  grabDX: number;
  grabDY: number;
  x: number;
  y: number;
  target: { r: number; c: number } | null;
};

/** 松手没落点时的回弹时长（秒）。 */
const RETURN_DUR = 0.2;

type Phase =
  | { kind: "idle" }
  | {
      kind: "swap";
      a: number;
      b: number;
      ar: number;
      ac: number;
      br: number;
      bc: number;
      t: number;
      back: boolean;
      valid: boolean;
    }
  | { kind: "pop"; ids: number[]; cells: Array<[number, number]>; t: number }
  | { kind: "fall" };

type Layout = { pad: number; gap: number; cell: number; width: number; height: number };

function ease(u: number) {
  const t = Math.min(1, Math.max(0, u));
  return 1 - (1 - t) ** 3;
}

function tilesFrom(board: Board): Vis[] {
  const out: Vis[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = board[r][c];
      if (!tile) continue;
      out.push({
        id: tile.id,
        type: tile.type,
        special: tile.special,
        r,
        c,
        homeR: r,
        homeC: c,
        pop: 0,
      });
    }
  }
  return out;
}

export class MatchGame {
  board: Board;
  tiles: Vis[];
  score = 0;
  best = 0;
  chain = 0;
  line = DEFAULT_LINE;
  lineTimer = 0;
  phase: Phase = { kind: "idle" };
  selected: { r: number; c: number } | null = null;
  hint: Hint | null = null;
  idleFor = 0;
  shake = 0;
  flash = 0;
  bounces = 0;
  callout: Callout | null = null;
  /** 饥饿条 0..HUNGER_MAX。喂满是这一局的唯一目标。 */
  hunger = 0;
  /** 满过条了（一局一次）。 */
  satiated = false;
  /** 双倍剩余秒数，满条后开 8 秒。 */
  doubleUntil = 0;
  /** 双倍窗口结束 = 这盘吃完了，UI 出结算。 */
  finished = false;
  /** 满条瞬间的闪光，UI 把条炸一下用。 */
  hungerFlash = 0;
  /** 本局每种食物吃掉几个，今日菜单靠它勾。 */
  eaten = new Map<number, number>();
  /** 今天点的是哪两道菜。 */
  menu: Menu = todayMenu();
  private lineSeq = 0;
  private idlePing = 0;
  private menuToasted = false;
  bgm = new Bgm();
  private moved: Array<[number, number]> = [];
  particles: Particle[] = [];
  floaters: Floater[] = [];
  layout: Layout = { pad: 8, gap: 4, cell: 44, width: 320, height: 420 };
  private pointer: { id: number; r: number; c: number; x: number; y: number } | null = null;
  /** 跟手拖拽中的格子；null = 没有拖拽。 */
  private drag: Drag | null = null;
  /** 松手没落点时的回弹动画队列。 */
  private returns: Array<{ id: number; x: number; y: number; t: number }> = [];
  private sfx = new Sfx();

  constructor() {
    try {
      const saved = Number(localStorage.getItem(BEST_KEY) || 0);
      if (Number.isFinite(saved) && saved > 0) this.best = saved;
    } catch {
      /* private mode */
    }
    this.board = createBoard();
    this.tiles = tilesFrom(this.board);
  }

  unlock() {
    this.sfx.unlock();
    if (this.sfx.ctx) {
      this.bgm.attach(this.sfx.ctx);
      this.bgm.start();
    }
  }

  toggleMusic() {
    this.unlock();
    this.bgm.setEnabled(!this.bgm.enabled);
    return this.bgm.enabled;
  }

  nudge() {
    this.unlock();
    if (this.busy()) return;
    const hint = this.hint ?? findHint(this.board);
    if (!hint) return;
    this.trySwap(hint.r1, hint.c1, hint.r2, hint.c2);
  }

  restart() {
    this.score = 0;
    this.chain = 0;
    this.selected = null;
    this.hint = null;
    this.idleFor = 0;
    this.particles = [];
    this.floaters = [];
    this.moved = [];
    this.drag = null;
    this.returns = [];
    this.phase = { kind: "idle" };
    this.board = createBoard();
    this.tiles = tilesFrom(this.board);
    this.hunger = 0;
    this.satiated = false;
    this.doubleUntil = 0;
    this.finished = false;
    this.hungerFlash = 0;
    this.eaten = new Map();
    this.menu = todayMenu();
    this.lineSeq = 0;
    this.idlePing = 0;
    this.menuToasted = false;
    this.say(DEFAULT_LINE, 0);
  }

  private say(text: string, seconds: number) {
    this.line = text;
    this.lineTimer = seconds;
  }

  private visById(id: number) {
    return this.tiles.find((tile) => tile.id === id);
  }

  private busy() {
    return this.phase.kind !== "idle";
  }

  private trySwap(r1: number, c1: number, r2: number, c2: number) {
    if (this.busy()) return;
    if (!adjacent(r1, c1, r2, c2)) return;
    const a = this.board[r1][c1];
    const b = this.board[r2][c2];
    if (!a || !b) return;
    if (this.finished) return;
    this.selected = null;
    this.hint = null;
    this.idleFor = 0;
    this.idlePing = 0;
    const valid = canSwap(this.board, r1, c1, r2, c2);
    if (valid) this.moved = [
      [r2, c2],
      [r1, c1],
    ];
    this.phase = {
      kind: "swap",
      a: a.id,
      b: b.id,
      ar: r1,
      ac: c1,
      br: r2,
      bc: c2,
      t: 0,
      back: false,
      valid,
    };
    this.sfx.swap();
  }

  pointerDown(canvas: HTMLCanvasElement, id: number, clientX: number, clientY: number) {
    this.unlock();
    if (this.pointer) return;
    const cell = this.cellAt(canvas, clientX, clientY);
    if (!cell) return;
    this.pointer = { id, r: cell.r, c: cell.c, x: clientX, y: clientY };
  }

  /** 手指/鼠标移动：位移过阈值就抓起格子，之后格子实时贴在手指上走。 */
  pointerMove(canvas: HTMLCanvasElement, id: number, clientX: number, clientY: number) {
    if (!this.pointer || this.pointer.id !== id) return;
    this.pointer.x = clientX;
    this.pointer.y = clientY;
    if (this.busy() || this.finished) return;
    const start = this.pointer;
    const { pad, cell, gap } = this.layout;
    const stride = cell + gap;
    if (!this.drag) {
      // 7px 内算"点"不算"拖"，保住点选交换的手感
      if (Math.hypot(clientX - start.x, clientY - start.y) < 7) return;
      const vis = this.tiles.find((tile) => tile.homeR === start.r && tile.homeC === start.c);
      if (!vis) return;
      const p = this.toLayout(canvas, clientX, clientY);
      const cx = pad + start.c * stride + cell / 2;
      const cy = pad + start.r * stride + cell / 2;
      this.drag = {
        id,
        visId: vis.id,
        homeR: start.r,
        homeC: start.c,
        grabDX: p.x - cx,
        grabDY: p.y - cy,
        x: cx - cell / 2,
        y: cy - cell / 2,
        target: null,
      };
      this.selected = null;
      this.hint = null;
      this.idleFor = 0;
      this.idlePing = 0;
    }
    const p = this.toLayout(canvas, clientX, clientY);
    this.drag.x = p.x - this.drag.grabDX - cell / 2;
    this.drag.y = p.y - this.drag.grabDY - cell / 2;
    // 落点 = 被拖格子中心压住的相邻格；压不到相邻格就是 null（松手回弹）
    const fc = (this.drag.x + cell / 2 - pad) / stride - 0.5;
    const fr = (this.drag.y + cell / 2 - pad) / stride - 0.5;
    const tc = Math.round(fc);
    const tr = Math.round(fr);
    this.drag.target =
      tr >= 0 && tc >= 0 && tr < ROWS && tc < COLS && adjacent(this.drag.homeR, this.drag.homeC, tr, tc)
        ? { r: tr, c: tc }
        : null;
  }

  pointerUp(canvas: HTMLCanvasElement, id: number, clientX: number, clientY: number) {
    if (!this.pointer || this.pointer.id !== id) return;
    const start = this.pointer;
    this.pointer = null;
    if (this.drag && this.drag.id === id) {
      const drag = this.drag;
      this.drag = null;
      if (this.busy() || this.finished) return;
      if (drag.target) {
        this.trySwap(drag.homeR, drag.homeC, drag.target.r, drag.target.c);
        return;
      }
      this.returns.push({ id: drag.visId, x: drag.x, y: drag.y, t: 0 });
      return;
    }
    if (this.busy()) return;
    const dx = clientX - start.x;
    const dy = clientY - start.y;
    // 兜底：拖拽没起来（按下瞬间在忙）时的老滑动手势
    if (Math.hypot(dx, dy) > 16) {
      const horizontal = Math.abs(dx) > Math.abs(dy);
      const r2 = start.r + (horizontal ? 0 : dy > 0 ? 1 : -1);
      const c2 = start.c + (horizontal ? (dx > 0 ? 1 : -1) : 0);
      if (r2 >= 0 && c2 >= 0 && r2 < ROWS && c2 < COLS) this.trySwap(start.r, start.c, r2, c2);
      return;
    }
    const cell = this.cellAt(canvas, clientX, clientY);
    if (!cell) return;
    if (this.selected && adjacent(this.selected.r, this.selected.c, cell.r, cell.c)) {
      this.trySwap(this.selected.r, this.selected.c, cell.r, cell.c);
      return;
    }
    if (this.selected && this.selected.r === cell.r && this.selected.c === cell.c) {
      this.selected = null;
      return;
    }
    this.selected = { r: cell.r, c: cell.c };
  }

  pointerCancel(id: number) {
    if (this.pointer?.id === id) this.pointer = null;
    if (this.drag?.id === id) {
      this.returns.push({ id: this.drag.visId, x: this.drag.x, y: this.drag.y, t: 0 });
      this.drag = null;
    }
  }

  private toLayout(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * this.layout.width,
      y: ((clientY - rect.top) / rect.height) * this.layout.height,
    };
  }

  private cellAt(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
    const { x, y } = this.toLayout(canvas, clientX, clientY);
    if (this.layout.width <= 0 || this.layout.height <= 0) return null;
    const stride = this.layout.cell + this.layout.gap;
    const c = Math.floor((x - this.layout.pad) / stride);
    const r = Math.floor((y - this.layout.pad) / stride);
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return null;
    const left = this.layout.pad + c * stride;
    const top = this.layout.pad + r * stride;
    if (x > left + this.layout.cell || y > top + this.layout.cell) return null;
    return { r, c };
  }

  private beginPop() {
    const activate = this.moved;
    this.moved = [];
    const { cells, powers } = collectClear(this.board, activate);
    if (!cells.length) {
      this.phase = { kind: "idle" };
      return;
    }
    this.chain += 1;
    const gained = scoreFor(cells.length, this.chain);
    this.score += gained;
    // 喂她：每格 FEED_PER_CELL，连消第 n 次再补 (n-1)*FEED_CHAIN_BONUS；双倍窗口内翻倍。
    const feed = Math.max(
      1,
      Math.round(cells.length * FEED_PER_CELL + (this.chain - 1) * FEED_CHAIN_BONUS),
    );
    this.hunger = Math.min(
      HUNGER_MAX,
      this.hunger + (this.doubleUntil > 0 ? feed * 2 : feed),
    );
    if (this.score > this.best) {
      this.best = this.score;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch {
        /* ignore */
      }
    }
    const ids: number[] = [];
    // 每格几粒：一次消得越少，每格越显眼；总数封顶 40，避免 50 格时糊成一团。
    const per = cells.length > 18 ? 1 : cells.length > 8 ? 2 : 4;
    const stride = Math.max(1, Math.ceil((cells.length * per) / 40));
    let slot = 0;
    for (const [r, c] of cells) {
      const tile = this.board[r][c];
      if (!tile) continue;
      ids.push(tile.id);
      const color = TILE_COLORS[tile.type] ?? TILE_COLORS[0];
      for (let i = 0; i < per; i++) {
        slot += 1;
        if (slot % stride !== 0) continue;
        const life = 0.4 + Math.random() * 0.12;
        this.particles.push({
          c: c + 0.5,
          r: r + 0.5,
          c0: c + 0.5,
          r0: r + 0.5,
          tx: FEED_TX + (Math.random() - 0.5) * 0.9,
          ty: FEED_TY - Math.random() * 0.3,
          life,
          max: life,
          color,
        });
      }
    }
    for (const vis of this.tiles) {
      const tile = this.board[vis.homeR]?.[vis.homeC];
      if (tile && tile.id === vis.id) vis.special = tile.special;
    }
    // 台词只归她说；特效名和"食物 x 数量"交给 callout 播报，不混进她嘴里。
    if (this.chain >= 3) this.say(pickLine(LINES.combo3, (this.lineSeq += 1)), 1.1);
    else if (this.chain === 2) this.say(pickLine(LINES.combo2, (this.lineSeq += 1)), 0.9);
    this.shake = Math.min(1.8, 0.75 + (this.chain - 1) * 0.3 + (powers.length ? 0.45 : 0));
    this.flash = Math.min(0.7, 0.28 + this.chain * 0.08);
    const counts = new Map<number, number>();
    for (const [r, c] of cells) {
      const tile = this.board[r][c];
      if (tile) counts.set(tile.type, (counts.get(tile.type) ?? 0) + 1);
    }
    for (const [type, count] of counts) {
      this.eaten.set(type, (this.eaten.get(type) ?? 0) + count);
    }
    if (!this.menuToasted && menuComplete(this.menu, this.eaten)) {
      this.menuToasted = true;
      this.say(pickLine(LINES.menu, (this.lineSeq += 1)), 2);
    }
    if (this.hunger >= HUNGER_MAX && !this.satiated) {
      this.satiated = true;
      this.doubleUntil = DOUBLE_SEC;
      this.hungerFlash = 1;
      this.say(pickLine(LINES.satiated, (this.lineSeq += 1)), 2.4);
    }
    const powerText = [...new Set(powers)]
      .filter((power): power is Exclude<Special, "none"> => power !== "none")
      .map((power) => POWER_LABEL[power]);
    this.bounces += 1;
    this.callout = {
      id: this.bounces,
      lines: [
        ...(powerText.length ? [{ type: 4, text: `${powerText.join("·")}！` }] : []),
        ...[...counts.entries()].map(([type, count]) => ({
          type,
          text: `${FOOD_NAMES[type] ?? "好吃"}x${count}！`,
        })),
      ],
    };
    this.sfx.pop(this.chain + powers.length);
    this.phase = { kind: "pop", ids, cells, t: 0 };
  }

  private finishPop() {
    const popping = new Set(this.phase.kind === "pop" ? this.phase.ids : []);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = this.board[r][c];
        if (tile && popping.has(tile.id)) this.board[r][c] = null;
      }
    }
    this.tiles = this.tiles.filter((tile) => !popping.has(tile.id));
    const next = collapse(this.board);
    this.syncFall(next);
    this.board = next;
    this.phase = { kind: "fall" };
  }

  private syncFall(next: Board) {
    const old = new Map(this.tiles.map((tile) => [tile.id, tile]));
    const keep: Vis[] = [];
    const spawned: Array<{ tile: Tile; r: number; c: number }> = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = next[r][c];
        if (!tile) continue;
        const vis = old.get(tile.id);
        if (vis) {
          vis.homeR = r;
          vis.homeC = c;
          vis.pop = 0;
          keep.push(vis);
        } else {
          spawned.push({ tile, r, c });
        }
      }
    }
    const byCol = new Map<number, typeof spawned>();
    for (const item of spawned) {
      const list = byCol.get(item.c) ?? [];
      list.push(item);
      byCol.set(item.c, list);
    }
    for (const list of byCol.values()) {
      list.sort((a, b) => a.r - b.r);
      list.forEach((item, index) => {
        keep.push({
          id: item.tile.id,
          type: item.tile.type,
          special: item.tile.special,
          c: item.c,
          homeC: item.c,
          homeR: item.r,
          r: index - list.length,
          pop: 0,
        });
      });
    }
    this.tiles = keep;
  }

  private settle() {
    for (const tile of this.tiles) {
      tile.r = tile.homeR;
      tile.c = tile.homeC;
    }
    const matches = findMatches(this.board);
    if (matches.length) {
      this.beginPop();
      return;
    }
    this.chain = 0;
    this.phase = { kind: "idle" };
    if (!findHint(this.board)) {
      this.board = createBoard();
      this.tiles = tilesFrom(this.board);
      this.say("重新摆好了", 1.2);
      this.shake = 0.6;
    }
  }

  update(dt: number) {
    if (this.lineTimer > 0) {
      this.lineTimer -= dt;
      if (this.lineTimer <= 0) this.line = DEFAULT_LINE;
    }
    this.hungerFlash = Math.max(0, this.hungerFlash - dt * 2.2);
    if (this.doubleUntil > 0) {
      this.doubleUntil = Math.max(0, this.doubleUntil - dt);
      if (this.doubleUntil === 0 && !this.finished) {
        // 双倍窗口走完 = 这盘吃完了。剩的分数已经进账，人停下来出结算。
        this.finished = true;
        this.phase = { kind: "idle" };
        this.say(pickLine(LINES.settle, (this.lineSeq += 1)), 0);
      }
    }
    this.shake = Math.max(0, this.shake - dt * 1.7);
    this.flash = Math.max(0, this.flash - dt * 1.8);
    for (const particle of this.particles) {
      particle.life -= dt;
      // ease 是归一化进度：0 起步快、1 接近时减速；life 归零时正好落在目标点上。
      const e = ease(1 - Math.max(0, particle.life) / particle.max);
      particle.c = particle.c0 + (particle.tx - particle.c0) * e;
      particle.r = particle.r0 + (particle.ty - particle.r0) * e;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    for (const floater of this.floaters) {
      floater.life -= dt;
      floater.r -= dt * 0.8;
    }
    this.floaters = this.floaters.filter((floater) => floater.life > 0);
    for (const ret of this.returns) ret.t += dt;
    this.returns = this.returns.filter((ret) => ret.t < RETURN_DUR);
    // 拖到一半游戏进入忙态（结算/连锁）：强制松手回弹，不卡死输入
    if (this.drag && (this.busy() || this.finished)) {
      this.returns.push({ id: this.drag.visId, x: this.drag.x, y: this.drag.y, t: 0 });
      this.drag = null;
    }

    const phase = this.phase;
    if (phase.kind === "swap") {
      phase.t += dt;
      if (phase.t >= SWAP_DUR) {
        if (!phase.back && phase.valid) {
          swap(this.board, phase.ar, phase.ac, phase.br, phase.bc);
          const a = this.visById(phase.a);
          const b = this.visById(phase.b);
          if (a) {
            a.homeR = phase.br;
            a.homeC = phase.bc;
            a.r = phase.br;
            a.c = phase.bc;
          }
          if (b) {
            b.homeR = phase.ar;
            b.homeC = phase.ac;
            b.r = phase.ar;
            b.c = phase.ac;
          }
          this.beginPop();
        } else if (!phase.back) {
          phase.back = true;
          phase.t = 0;
          this.sfx.bad();
        } else {
          this.phase = { kind: "idle" };
        }
      }
      return;
    }

    if (phase.kind === "pop") {
      phase.t += dt;
      const pop = Math.min(1, phase.t / POP_DUR);
      for (const id of phase.ids) {
        const vis = this.visById(id);
        if (vis) vis.pop = pop;
      }
      if (phase.t >= POP_DUR) this.finishPop();
      return;
    }

    if (phase.kind === "fall") {
      let done = true;
      for (const tile of this.tiles) {
        const dr = tile.homeR - tile.r;
        const dc = tile.homeC - tile.c;
        const dist = Math.hypot(dr, dc);
        if (dist < 0.02) {
          tile.r = tile.homeR;
          tile.c = tile.homeC;
        } else {
          const step = Math.min(dist, FALL_SPEED * dt);
          tile.r += (dr / dist) * step;
          tile.c += (dc / dist) * step;
          done = false;
        }
      }
      if (done) this.settle();
      return;
    }

    this.idleFor += dt;
    if (this.idleFor > 3.2 && !this.hint) this.hint = findHint(this.board);
    // 停手就掉条，不倒扣；掉到 0 就停在那里，不惩罚。
    if (!this.satiated && this.idleFor > HUNGER_IDLE_DELAY) {
      this.hunger = Math.max(0, this.hunger - HUNGER_DECAY * dt);
    }
    // 她催你：5 秒不吭声第一句，之后每 6 秒一句。
    if (
      !this.satiated &&
      !this.finished &&
      this.hunger > 0 &&
      this.lineTimer <= 0 &&
      this.idleFor > 5 &&
      this.idleFor - this.idlePing > 6
    ) {
      this.idlePing = this.idleFor;
      this.say(pickLine(LINES.hungry, (this.lineSeq += 1)), 1.6);
    }
  }

  private visualCell(vis: Vis) {
    const phase = this.phase;
    if (phase.kind === "swap" && (vis.id === phase.a || vis.id === phase.b)) {
      const mine = vis.id === phase.a;
      const r0 = mine ? phase.ar : phase.br;
      const c0 = mine ? phase.ac : phase.bc;
      const r1 = mine ? phase.br : phase.ar;
      const c1 = mine ? phase.bc : phase.ac;
      const u = ease(phase.t / SWAP_DUR);
      if (phase.back) return { r: r1 + (r0 - r1) * u, c: c1 + (c0 - c1) * u };
      return { r: r0 + (r1 - r0) * u, c: c0 + (c1 - c0) * u };
    }
    return { r: vis.r, c: vis.c };
  }

  draw(ctx: CanvasRenderingContext2D, time: number) {
    const { pad, gap, cell, width, height } = this.layout;
    const stride = cell + gap;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    if (this.shake > 0) {
      const mag = 2 + this.shake * 5;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }
    ctx.fillStyle = "#241b2e";
    ctx.fillRect(0, 0, width, height);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(246, 231, 193, ${this.flash * 0.35})`;
      ctx.fillRect(0, 0, width, height);
    }

    const hinting = this.phase.kind === "idle" ? this.hint : null;
    const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time / 160));

    const drag = this.drag;
    let dragged: { vis: Vis; x: number; y: number } | null = null;
    for (const vis of this.tiles) {
      const pos = this.visualCell(vis);
      let x = pad + pos.c * stride;
      let y = pad + pos.r * stride;
      if (drag && vis.id === drag.visId) {
        // 本体跟手指走，这里只留空槽；循环结束后单独画在最上层
        ctx.fillStyle = "#1a1322";
        ctx.fillRect(x, y, cell, cell);
        ctx.strokeStyle = "rgba(246,231,193,0.28)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
        dragged = { vis, x: drag.x, y: drag.y };
        continue;
      }
      const ret = this.returns.find((item) => item.id === vis.id);
      if (ret) {
        const u = ease(ret.t / RETURN_DUR);
        x = ret.x + (pad + vis.homeC * stride - ret.x) * u;
        y = ret.y + (pad + vis.homeR * stride - ret.y) * u;
      } else if (
        drag?.target &&
        vis.homeR === drag.target.r &&
        vis.homeC === drag.target.c
      ) {
        // 落点预览：目标格往来源方向让位 30%，暗示松手会交换
        x += (pad + drag.homeC * stride - x) * 0.3;
        y += (pad + drag.homeR * stride - y) * 0.3;
      }
      const scale = 1 - vis.pop * 0.85;
      ctx.save();
      ctx.globalAlpha = 1 - vis.pop * 0.9;
      ctx.translate(x + cell / 2, y + cell / 2);
      ctx.scale(scale, scale);
      ctx.translate(-cell / 2, -cell / 2);
      ctx.fillStyle = "#1a1322";
      ctx.fillRect(0, 0, cell, cell);
      drawFood(ctx, vis.type, cell);
      drawSpecial(ctx, vis.special, cell, time);
      ctx.restore();

      const hinted =
        hinting &&
        ((hinting.r1 === vis.homeR && hinting.c1 === vis.homeC) ||
          (hinting.r2 === vis.homeR && hinting.c2 === vis.homeC));
      const selected =
        this.selected && this.selected.r === vis.homeR && this.selected.c === vis.homeC;
      if (hinted || selected) {
        ctx.save();
        ctx.globalAlpha = hinted && !selected ? pulse : 1;
        ctx.strokeStyle = selected ? "#f0a05a" : "#e8b84a";
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
        ctx.restore();
      }
    }
    if (drag && dragged) {
      if (drag.target) {
        const tx = pad + drag.target.c * stride;
        const ty = pad + drag.target.r * stride;
        ctx.strokeStyle = "#f0a05a";
        ctx.lineWidth = 3;
        ctx.strokeRect(tx + 1.5, ty + 1.5, cell - 3, cell - 3);
      }
      const { vis, x, y } = dragged;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.translate(x + cell / 2, y + cell / 2);
      ctx.scale(1.1, 1.1);
      ctx.translate(-cell / 2, -cell / 2);
      ctx.fillStyle = "#1a1322";
      ctx.fillRect(0, 0, cell, cell);
      drawFood(ctx, vis.type, cell);
      drawSpecial(ctx, vis.special, cell, time);
      ctx.restore();
    }

    for (const particle of this.particles) {
      const x = pad + particle.c * stride;
      const y = pad + particle.r * stride;
      ctx.globalAlpha = Math.max(0, particle.life / particle.max);
      ctx.fillStyle = particle.color;
      ctx.fillRect(x - 1, y - 1, 6, 6);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#f6e7c1";
    ctx.font = `700 16px 'PingFang SC', 'Noto Sans SC', sans-serif`;
    ctx.textAlign = "center";
    for (const floater of this.floaters) {
      ctx.globalAlpha = Math.max(0, floater.life / floater.max);
      ctx.font = `700 ${floater.size}px 'PingFang SC', 'Noto Sans SC', sans-serif`;
      const x = pad + (floater.c + 0.5) * stride;
      const y = pad + floater.r * stride;
      ctx.fillText(floater.text, x, y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function drawSpecial(
  ctx: CanvasRenderingContext2D,
  special: Tile["special"],
  cell: number,
  time: number,
) {
  if (special === "none") return;
  ctx.save();
  if (special === "row") {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(1, Math.floor(cell / 2) - 2, cell - 2, 4);
  } else if (special === "col") {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(Math.floor(cell / 2) - 2, 1, 4, cell - 2);
  } else if (special === "wrap") {
    ctx.strokeStyle = "#ff5a1f";
    ctx.lineWidth = 3;
    ctx.strokeRect(2.5, 2.5, cell - 5, cell - 5);
    ctx.fillStyle = "#ffe08a";
    const s = 5;
    ctx.fillRect(Math.floor(cell / 2) - 2, 3, s, s);
    ctx.fillRect(Math.floor(cell / 2) - 2, cell - 8, s, s);
    ctx.fillRect(3, Math.floor(cell / 2) - 2, s, s);
    ctx.fillRect(cell - 8, Math.floor(cell / 2) - 2, s, s);
  } else {
    const hues = ["#ff5a45", "#ffe08a", "#7dffb2", "#7ad0ff", "#e39bff"];
    ctx.strokeStyle = hues[Math.floor(time / 120) % hues.length];
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, cell - 4, cell - 4);
    ctx.fillStyle = "#fff6d8";
    ctx.fillRect(Math.floor(cell / 2) - 3, Math.floor(cell / 2) - 3, 6, 6);
  }
  ctx.restore();
}

function drawFood(ctx: CanvasRenderingContext2D, type: number, cell: number) {
  const img = FOOD_IMAGES[type] ?? FOOD_IMAGES[0];
  if (img.complete && img.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, cell, cell);
    return;
  }
  // 贴图还没加载完时用色块 + emoji 兜底，避免开局闪白格
  const food = FOODS[type] ?? FOODS[0];
  const inset = Math.max(3, Math.floor(cell * 0.08));
  ctx.fillStyle = food.color;
  ctx.fillRect(inset, inset, cell - inset * 2, cell - inset * 2);
  ctx.font = `${Math.floor(cell * 0.42)}px "PingFang SC", "Noto Sans SC", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(food.emoji, cell / 2, cell / 2 + 1);
}

