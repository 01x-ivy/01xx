/**
 * Screen for 芝芝消消. The board lives in MatchGame.
 * React reads score, best, line, bounces, callout, hunger and the daily menu.
 * It never owns game state — the loop publishes a snapshot string each frame.
 */
import { useEffect, useRef, useState } from "react";
import { COLS, ROWS } from "@/game/model";
import { DEFAULT_LINE, FOOD_NAMES, FOODS, HUNGER_MAX } from "@/game/content";
import { menuProgress, type Menu } from "@/game/menu";
import { MatchGame, type Callout } from "@/game/play";
import mengzhiImg from "@/assets/mengzhi_chibi.png";

type Progress = ReturnType<typeof menuProgress>;

export function ZhizhiGame() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<MatchGame | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [line, setLine] = useState(DEFAULT_LINE);
  const [bounce, setBounce] = useState(0);
  const [callout, setCallout] = useState<Callout | null>(null);
  const [musicOn, setMusicOn] = useState(true);
  const [hunger, setHunger] = useState(0);
  const [doubleLeft, setDoubleLeft] = useState(0);
  const [flash, setFlash] = useState(false);
  const [finished, setFinished] = useState(false);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [progress, setProgress] = useState<Progress>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const game = new MatchGame();
    gameRef.current = game;
    // 带 ?debug 访问时把对局挂到 window 上，控制台就能驱动真实一局。
    if (new URLSearchParams(window.location.search).has("debug")) {
      (window as unknown as { __zhizhi?: MatchGame }).__zhizhi = game;
    }
    setBest(game.best);
    setMenu(game.menu);
    setProgress(menuProgress(game.menu, game.eaten));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const widthBudget = Math.max(240, Math.floor(wrap.clientWidth));
      const heightBudget = Math.max(240, Math.floor(wrap.clientHeight || widthBudget));
      const pad = 6;
      const gap = 3;
      const cellByWidth = Math.floor((widthBudget - pad * 2 - gap * (COLS - 1)) / COLS);
      const cellByHeight = Math.floor((heightBudget - pad * 2 - gap * (ROWS - 1)) / ROWS);
      const cell = Math.max(28, Math.min(cellByWidth, cellByHeight));
      const width = pad * 2 + cell * COLS + gap * (COLS - 1);
      const height = pad * 2 + cell * ROWS + gap * (ROWS - 1);
      game.layout = { pad, gap, cell, width, height };
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    let raf = 0;
    let last = performance.now();
    let published = "";
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const step = reduce ? Math.min(0.05, dt * 4) : dt;
      game.update(step);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
        game.draw(ctx, now);
      }
      const roundHunger = Math.round(game.hunger);
      const eatenKey = [...game.eaten].map(([type, count]) => `${type}:${count}`).join(",");
      const snap = [
        game.score,
        game.best,
        game.line,
        game.bounces,
        roundHunger,
        Math.ceil(game.doubleUntil),
        game.finished ? 1 : 0,
        eatenKey,
      ].join("|");
      if (snap !== published) {
        published = snap;
        setScore(game.score);
        setBest(game.best);
        setLine(game.line);
        setBounce(game.bounces);
        setCallout(game.callout);
        setHunger(roundHunger);
        setDoubleLeft(Math.ceil(game.doubleUntil));
        setFlash(game.hungerFlash > 0.35);
        setFinished(game.finished);
        setMenu(game.menu);
        setProgress(menuProgress(game.menu, game.eaten));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      game.bgm.stop();
      gameRef.current = null;
    };
  }, []);

  const pct = Math.max(0, Math.min(100, (hunger / HUNGER_MAX) * 100));
  const full = pct >= 99.5;
  const cleared = progress.length > 0 && progress.every((item) => item.ok);
  const missing = progress.reduce((sum, item) => sum + Math.max(0, item.need - item.got), 0);

  return (
    <main className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-bg px-4 pt-3 pb-4 text-fg">
      {callout ? (
        <div
          key={callout.id}
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
        >
          <div className="flex flex-col items-center gap-2 px-6">
            {callout.lines.map((item) => (
              <p key={`${callout.id}-${item.type}`} className={`callout callout-${item.type}`}>
                {item.text}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <header className="flex shrink-0 items-center gap-3">
        <div
          key={bounce}
          className={`ye-anchor ye-face ${bounce > 0 ? "ye-hop" : ""}`}
          aria-hidden="true"
        >
          <img src={mengzhiImg} className="ye-portrait" alt="" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-primary">给叶梦芝</p>
          <h1 className="text-2xl font-semibold leading-tight">芝芝消消</h1>
          <p className="truncate text-sm text-muted">{line}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">分数</p>
          <p className="text-2xl font-semibold tabular-nums leading-none">{score}</p>
          <p className="mt-1 text-xs text-muted">最高 {best}</p>
          <button
            type="button"
            className="mt-1 text-xs text-muted"
            onClick={() => setMusicOn(gameRef.current?.toggleMusic() ?? false)}
          >
            {musicOn ? "音乐开" : "音乐关"}
          </button>
        </div>
      </header>

      <section className="mt-2 shrink-0" aria-label="饥饿条">
        <div className="flex items-baseline justify-between text-xs">
          <span className={full ? "font-semibold text-primary" : "text-muted"}>
            {full ? (doubleLeft > 0 ? "吃饱了 · 双倍" : "吃不下了") : "还饿着"}
          </span>
          <span className={`tabular-nums ${doubleLeft > 0 ? "text-primary" : "text-muted"}`}>
            {doubleLeft > 0 ? `${doubleLeft}s ×2` : `${Math.round(hunger)}`}
          </span>
        </div>
        <div className="mt-1 h-3 w-full overflow-hidden rounded-full border border-border bg-surface">
          <div
            className={`hunger-fill h-full rounded-full ${flash ? "hunger-pop" : ""} ${
              full ? "hunger-full" : ""
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      <section className="mt-2 grid shrink-0 grid-cols-2 gap-2" aria-label="今日菜单">
        {progress.map((item) => (
          <div
            key={item.type}
            className={`flex items-center gap-2 rounded-xl border px-2 py-1 ${
              item.ok ? "border-primary bg-surface" : "border-border bg-surface"
            }`}
          >
            <span className="text-base leading-none">{FOODS[item.type]?.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] leading-tight text-muted">
                {FOOD_NAMES[item.type] ?? "好吃"}
              </p>
              <p
                className={`text-xs font-semibold leading-tight tabular-nums ${
                  item.ok ? "text-primary" : "text-fg"
                }`}
              >
                {item.ok ? "吃了 ✓" : `${item.got}/${item.need}`}
              </p>
            </div>
          </div>
        ))}
      </section>

      <div ref={wrapRef} className="mt-2 flex min-h-0 w-full flex-1 items-center justify-center">
        <canvas
          ref={canvasRef}
          className="touch-none"
          role="application"
          aria-label="芝芝消消。点相邻两块，或滑动交换"
          onPointerDown={(event) => {
            canvasRef.current?.setPointerCapture(event.pointerId);
            gameRef.current?.pointerDown(
              event.currentTarget,
              event.pointerId,
              event.clientX,
              event.clientY,
            );
          }}
          onPointerUp={(event) => {
            gameRef.current?.pointerUp(
              event.currentTarget,
              event.pointerId,
              event.clientX,
              event.clientY,
            );
          }}
          onPointerCancel={(event) => gameRef.current?.pointerCancel(event.pointerId)}
        />
      </div>

      <div className="mt-3 grid shrink-0 grid-cols-2 gap-3">
        <button
          type="button"
          className="h-12 rounded-xl border border-border bg-surface text-base font-semibold text-fg"
          onClick={() => gameRef.current?.nudge()}
        >
          帮我消
        </button>
        <button
          type="button"
          className="h-12 rounded-xl bg-primary text-base font-semibold text-bg"
          onClick={() => {
            gameRef.current?.unlock();
            gameRef.current?.restart();
          }}
        >
          再来一局
        </button>
      </div>

      {finished ? (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-bg/90 px-8 text-center backdrop-blur-sm">
          <p className="text-sm tracking-[0.3em] text-muted">这盘吃完了</p>
          <p className="text-6xl font-black leading-none tabular-nums text-primary">{score}</p>
          <p className="text-sm text-muted">最高 {best}</p>
          <p className={`text-base ${cleared ? "text-primary" : "text-fg"}`}>
            {cleared ? "今日菜单，一样没落" : `菜单还差 ${missing} 份`}
          </p>
          <p className="text-xs text-muted">{menu?.day ?? ""}</p>
          <button
            type="button"
            className="mt-2 h-12 w-full max-w-[16rem] rounded-xl bg-primary text-base font-semibold text-bg"
            onClick={() => {
              gameRef.current?.unlock();
              gameRef.current?.restart();
            }}
          >
            再喂一盘
          </button>
        </div>
      ) : null}
    </main>
  );
}