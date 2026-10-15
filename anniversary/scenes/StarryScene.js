import { el, append, button } from '../systems/ui.js';
import { drawText } from '../systems/hud.js';
import { drawNightSky, drawHomeScene, drawLineup, drawCouple, textPoints } from '../systems/finale.js';
import { CONFIG } from '../config.js';
import { BOSSES } from '../data/bosses.js';
import { daysTogether } from '../systems/anniversary.js';

/**
 * Boss Rush 通关纪念动画「群星之夜」（5.8）：
 * 7 只被打服的 Boss 从各自的地图赶来，聚到星空下的家门口和主角合影 →
 * 烟花在夜空中拼出 365，再缓缓化作 ∞ → 镜头定格成一张拍立得，飞进回忆放映厅（第 22 张照片）→ 制作名单。
 */
const T_GATHER = 1.5;
const T_COUPLE = 8.5;
const T_FIRE = 10;
const T_MORPH = 15;
const T_SHOT = 19;
const T_CREDITS = 21.5;

export class StarryScene {
  constructor(game) {
    this.game = game;
  }

  enter(params) {
    const g = this.game;
    this.params = params || {};
    this.t = 0;
    this.shot = null;
    this.creditsShown = false;
    this.done = false;
    g.audio.stopMusic();
    g.audio.playMusic('theater');
    const p365 = textPoints('365', 30, 2);
    const pInf = textPoints('∞', 44, 2);
    this.sparks = [];
    const n = Math.max(p365.length, 60);
    for (let i = 0; i < n; i++) {
      const a = p365[i % p365.length];
      const b = pInf[i % pInf.length];
      this.sparks.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, d: Math.random() * 1.2, c: ['#ffe066', '#ff6fa5', '#9fe3ff', '#ffffff', '#b9a6ff'][i % 5] });
    }
    this.booms = [];
    this.root = el('div', 'scene-root interactive');
    g.ui.appendChild(this.root);
  }

  showCredits() {
    const g = this.game;
    this.creditsShown = true;
    const n = daysTogether();
    const lines = [
      ['h', '群星之夜'],
      ['p', '《奔向你 · 我们的365天》'],
      ['s', ''],
      ['t', '出品人'],
      ['p', CONFIG.makerName],
      ['t', '主演'],
      ['p', '女友酱 & 男友酱'],
      ['t', '特别出演'],
      ['p', Object.values(BOSSES).map((b) => b.name).join(' · ')],
      ['t', '献给'],
      ['p', CONFIG.partnerCallName],
      ['s', ''],
    ];
    for (const th of CONFIG.creditsThanks || []) lines.push(['p', th]);
    if (n !== null && n >= 0) lines.push(['s', ''], ['p', '今天是在一起的第 ' + n + ' 天']);
    lines.push(['s', ''], ['h', '下一关，一起玩。']);
    const wrap = el('div', 'credits');
    const roll = el('div', 'credits-roll');
    for (const [k, text] of lines) roll.appendChild(el('div', 'credit-' + k, text));
    wrap.appendChild(roll);
    const btn = button(g, '继续', 'big credits-btn', () => this.finish());
    append(this.root, wrap, btn);
  }

  finish() {
    if (this.done) return;
    this.done = true;
    const g = this.game;
    if (this.params.rushRes) g.switchScene('result', { rush: this.params.rushRes, session: this.params.session });
    else g.switchScene('title');
  }

  exit() {}

  update(dt) {
    const g = this.game;
    const prev = this.t;
    this.t += dt;
    while (g.input.next() !== null) {
      /* 动画中不处理游戏动作 */
    }
    if (g.input.consumeConfirm() && this.creditsShown) this.finish();
    const t = this.t;
    // 赶来时的脚步声 / 烟花 / 快门
    if (t > T_GATHER && t < T_COUPLE && Math.floor(t * 3) !== Math.floor(prev * 3)) g.audio.play('land', 1.2, 0.4);
    if (t > T_FIRE && t < T_SHOT && Math.random() < dt * 2.5) {
      this.booms.push({ x: Math.random(), y: 0.1 + Math.random() * 0.25, t: 0, c: ['#ffe066', '#ff6fa5', '#9fe3ff'][(Math.random() * 3) | 0] });
      g.audio.play('firework', 0.8 + Math.random() * 0.4, 0.5);
    }
    for (const b of this.booms) b.t += dt;
    this.booms = this.booms.filter((b) => b.t < 1.2);
    if (prev < T_SHOT && t >= T_SHOT) {
      g.audio.play('shutter');
      this.flash = 1;
      // 定格：把当前画面拷成拍立得
      const sc = g.screen;
      const c = document.createElement('canvas');
      c.width = sc.W;
      c.height = sc.H;
      c.getContext('2d').drawImage(sc.buffer, 0, 0);
      this.shot = c;
    }
    if (this.flash > 0) this.flash -= dt * 1.5;
    if (t >= T_CREDITS && !this.creditsShown) this.showCredits();
  }

  render() {
    const g = this.game;
    const sc = g.screen;
    const W = sc.W;
    const H = sc.H;
    const b = sc.bctx;
    const t = this.t;
    b.imageSmoothingEnabled = false;
    if (this.shot && t >= T_SHOT) {
      // 拍立得缩小飞向上方（飞进放映厅）
      drawNightSky(b, W, H, t);
      const k = Math.min(1, (t - T_SHOT - 0.4) / 1.6);
      const kk = k < 0 ? 0 : k * k;
      const s = 0.8 - kk * 0.55;
      const pw = W * s;
      const ph = H * s;
      const x = W / 2 - pw / 2;
      const y = H * 0.12 + (H * 0.35 - ph / 2) * (1 - kk) - kk * H * 0.3;
      b.fillStyle = '#ffffff';
      b.fillRect(Math.round(x - 4), Math.round(y - 4), Math.round(pw + 8), Math.round(ph + 18));
      b.drawImage(this.shot, Math.round(x), Math.round(y), Math.round(pw), Math.round(ph));
    } else {
      drawNightSky(b, W, H, t);
      drawHomeScene(b, W, H, Math.min(1, t / 2));
      drawLineup(b, W, H, Math.max(0, (t - T_GATHER) / 6), t);
      if (t > T_COUPLE) drawCouple(b, W, H, Math.min(1, (t - T_COUPLE) / 0.8), t);
      // 背景小烟花
      for (const bm of this.booms) {
        const r = bm.t * 26;
        b.globalAlpha = Math.max(0, 1 - bm.t / 1.2);
        b.fillStyle = bm.c;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          b.fillRect(Math.round(bm.x * W + Math.cos(a) * r), Math.round(bm.y * H + Math.sin(a) * r + bm.t * bm.t * 8), 1, 1);
        }
      }
      b.globalAlpha = 1;
      // 烟花拼字：365 → ∞
      if (t > T_FIRE) {
        const cx = W / 2;
        const cy = H * 0.24;
        for (const s of this.sparks) {
          const k = Math.max(0, Math.min(1, (t - T_FIRE - s.d) / 1.4));
          if (k <= 0) continue;
          const m = Math.max(0, Math.min(1, (t - T_MORPH - s.d * 0.5) / 1.6));
          const tx = s.ax + (s.bx - s.ax) * m;
          const ty = s.ay + (s.by - s.ay) * m;
          const e = 1 - (1 - k) * (1 - k);
          const x = cx + tx * e;
          const y = H * 0.75 + (cy + ty - H * 0.75) * e;
          b.fillStyle = s.c;
          b.globalAlpha = 0.7 + 0.3 * Math.sin(t * 8 + s.d * 10);
          b.fillRect(Math.round(x), Math.round(y), 2, 2);
        }
        b.globalAlpha = 1;
      }
    }
    if (this.flash > 0) {
      b.globalAlpha = Math.min(1, this.flash);
      b.fillStyle = '#ffffff';
      b.fillRect(0, 0, W, H);
      b.globalAlpha = 1;
    }
    sc.present(0, 0);
    const ctx = sc.ctx;
    if (t < T_FIRE) {
      ctx.globalAlpha = Math.min(1, t / 1) * (t > T_FIRE - 1 ? T_FIRE - t : 1);
      drawText(ctx, '这一年被打服的 Boss 们，都赶来了……', W / 2, H * 0.1, 7, '#fff6c2');
      ctx.globalAlpha = 1;
    } else if (t > T_SHOT + 0.5 && t < T_CREDITS + 1) {
      drawText(ctx, '第 22 张照片「群星之夜」', W / 2, H * 0.86, 8, '#ffe066');
      drawText(ctx, '已放进回忆放映厅', W / 2, H * 0.86 + 12, 6, '#ffffff');
    }
    sc.endFrame();
  }
}
