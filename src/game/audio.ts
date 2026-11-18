/** Square-wave effects and a looping chiptune. Playback starts only after a user gesture via Sfx.unlock. */

export class Sfx {
  ctx: AudioContext | null = null;

  unlock() {
    try {
      if (!this.ctx) this.ctx = new AudioContext();
      void this.ctx.resume();
    } catch {
      /* autoplay can refuse before a gesture */
    }
  }

  private tone(freq: number, dur: number, gain = 0.045) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, now);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  swap() {
    this.tone(520, 0.05);
  }

  bad() {
    this.tone(150, 0.07, 0.04);
  }

  pop(combo: number) {
    this.tone(420 + combo * 55, 0.07, 0.05);
    this.tone(640 + combo * 40, 0.09, 0.03);
  }
}

export class Bgm {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  enabled = true;

  attach(ctx: AudioContext) {
    this.ctx = ctx;
    if (!this.master) {
      this.master = ctx.createGain();
      this.master.gain.value = 0.045;
      this.master.connect(ctx.destination);
    }
  }

  start() {
    if (!this.enabled || !this.ctx || this.timer != null) return;
    this.timer = window.setInterval(() => this.beat(), 260);
  }

  stop() {
    if (this.timer != null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.start();
    else this.stop();
  }

  private blip(freq: number, dur: number, gain: number, type: OscillatorType) {
    if (!this.ctx || !this.master || freq <= 0) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(now);
    osc.stop(now + dur);
  }

  private beat() {
    const lead = [659, 784, 880, 784, 659, 587, 523, 587, 659, 784, 659, 523, 587, 659, 523, 392];
    const bass = [196, 0, 262, 0, 220, 0, 175, 0, 196, 0, 247, 0, 220, 0, 196, 0];
    const i = this.step % lead.length;
    this.blip(lead[i], 0.18, 0.07, "square");
    if (bass[i]) this.blip(bass[i], 0.22, 0.05, "triangle");
    this.step += 1;
  }
}
