/**
 * 今日菜单（点单）。纯函数：同一个日期进，同一张单出。
 * 没有 DOM、没有存储、没有副作用——UI 和 play.ts 都能直接调。
 */

import { TYPES } from "./model";

export type MenuItem = { type: number; need: number };
export type Menu = { day: string; items: MenuItem[] };

/** 优先用本地日期；跨天只影响"今天列的是哪道菜"，不影响进度记录。 */
export function dayKey(d = new Date()) {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function todayMenu(d = new Date()): Menu {
  const rng = mulberry32(
    d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(),
  );
  const pool = Array.from({ length: TYPES }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  const items = pool.slice(0, 2).map((type) => ({
    type,
    need: 6 + Math.floor(rng() * 6),
  }));
  return { day: dayKey(d), items };
}

/** eaten 是「本局已吃掉的每种食物数量」，Map<type, count>。 */
export function menuProgress(menu: Menu, eaten: Map<number, number>) {
  return menu.items.map((it) => {
    const got = eaten.get(it.type) ?? 0;
    return { ...it, got: Math.min(it.need, got), ok: got >= it.need };
  });
}

/** 单全部达成 → true。用在一局结算时判断「今日菜单完成」。 */
export function menuComplete(menu: Menu, eaten: Map<number, number>) {
  return menuProgress(menu, eaten).every((it) => it.ok);
}