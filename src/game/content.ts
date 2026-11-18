import type { Special } from "./model";

/** Tile type 0 is FOODS[0]. model.ts TYPES must stay equal to FOODS.length. */

export const BEST_KEY = "zhizhi-xiaoxiao-best";
export const DEFAULT_LINE = "按住拖到隔壁松手，或点相邻两块";

export const SWAP_DUR = 0.11;
export const POP_DUR = 0.2;
export const FALL_SPEED = 16;

/** 饥饿条：满值 100。停手 1.5 秒后每秒掉 1.5，不倒扣。 */
export const HUNGER_MAX = 100;
export const HUNGER_DECAY = 1.5;
export const HUNGER_IDLE_DELAY = 1.5;
/** 吃饱后 8 秒双倍，是这局最后的刷分窗口。 */
export const DOUBLE_SEC = 8;
/**
 * 喂一口涨多少：每格 0.25，连消第 n 次再加 (n-1)*1，最少 1。
 * 实测（nudge 自动连打）：12 次消除 ≈ 22 点，手打约 1 分钟喂满一盘。
 */
export const FEED_PER_CELL = 0.25;
export const FEED_CHAIN_BONUS = 1;

export const FOODS = [
  { name: "鸡腿饭", color: "#e8b84a", emoji: "🍗" },
  { name: "塔塔汀汉堡", color: "#ff5a45", emoji: "🍔" },
  { name: "煲仔仔", color: "#ffd56a", emoji: "🍚" },
  { name: "福鼎肉片", color: "#ffd0e0", emoji: "🥩" },
] as const;

export const TILE_COLORS: string[] = FOODS.map((food) => food.color);
export const FOOD_NAMES: string[] = FOODS.map((food) => food.name);

export const POWER_LABEL: Record<Exclude<Special, "none">, string> = {
  row: "横排",
  col: "竖排",
  wrap: "爆炸",
  color: "彩虹",
};

/**
 * 芝芝说的话。她挑食、嘴硬、其实很高兴。
 * 规矩：不提规则，不说"连上了""四连成排"这种系统腔。
 */
export const LINES = {
  /** 连消 2：还在吃，懒得理你 */
  combo2: ["唔。", "还要。", "这盘不算。", "再来。"],
  /** 连消 3+：嘴上嫌弃，身体很诚实 */
  combo3: ["你别停啊。", "说好了都给我。", "手速还行嘛。", "喂，我还没嚼完。"],
  /** 停手太久 */
  hungry: ["你走神了。", "我还在吃呢。", "凉了就不好吃了。", "看我干嘛，动手啊。"],
  /** 吃满了 */
  satiated: ["吃不下了……还要。", "算你厉害。", "这盘归我了。", "撑死了，但没吃饱。"],
  /** 结算 */
  settle: ["下次快一点。", "勉强及格。", "我记住这个味道了。", "明天还要。"],
  /** 今日菜单点全了 */
  menu: ["一样都没落下。", "你怎么知道我想吃这个。", "今天这顿，可以。"],
} as const;

/** 轮着念，不连着重复同一句。 */
export function pickLine(pool: readonly string[], n: number) {
  if (!pool.length) return DEFAULT_LINE;
  return pool[Math.abs(Math.trunc(n)) % pool.length] ?? DEFAULT_LINE;
}