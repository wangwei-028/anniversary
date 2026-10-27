import { el, append, button } from '../systems/ui.js';
import { drawText } from '../systems/hud.js';
import { drawNightSky, drawHomeScene, drawCouple } from '../systems/finale.js';
import { SPRITES } from '../systems/sprites.js';

/**
 * 第 7 关通关后的"回家"演出（约 10 秒）：
 * 吞吞吐出的回忆光点一颗颗飞回家 → 窗户一盏盏亮起来 → 两个人站在家门口 → 进入结算。
 * 只能点右上角「跳过」按钮跳过（2 秒后才生效）：Boss 战要求连点屏幕反击，收尾的连点
 * 惯性很容易误把整段演出跳掉，所以点屏幕 / 空格一律不响应。
 */
const LINES = [
  { at: 0.3, text: '吞吞把这一年被吞掉的回忆，全都吐了出来……' },
  { at: 3.4, text: '光点一颗一颗，飞回了家。' },
  { at: 6.6, text: '到家了。' },
];
const DURATION = 10;

export class EndingScene {
  constructor(game) {
    this.game = game;
  }

  enter(params) {
    const g = this.game;
    this.session = params.session;
    this.t = 0;
    this.done = false;
    this.dots = [];
    for (let i = 0; i < 90; i++) {
      this.dots.push({ delay: Math.random() * 5, x: Math.random(), y: -0.05 - Math.random() * 0.2, wob: Math.random() * 6, c: ['#ffe066', '#ffffff', '#ffb3cf', '#9fe3ff'][i % 4] });
    }
    g.audio.stopMusic();
    g.audio.playMusic('theater');
    g.world.hidePlayer = true;
    const root = el('div', 'scene-root interactive');
    // 注意：不在 root 上监听 click——打 Boss 的连点惯性会顺带把演出跳掉，只留「跳过」按钮。
    // 按钮前 2 秒隐藏（连点收不住的时候大概率正点在它身上），出现即可点。
    this.skipBtn = button(g, '跳过', 'small ghost ending-skip', () => this.skip());
    this.skipBtn.style.visibility = 'hidden';
    append(root, this.skipBtn);
    g.ui.appendChild(root);
  }

  skip() {
    if (this.t < 2 || this.done) return;
    this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.game.switchScene('result', { session: this.session, cleared: true, finale: true });
  }

  exit() {}

  update(dt) {
    const g = this.game;
    this.t += dt;
    while (g.input.next() !== null) {
      /* 演出中不处理游戏动作（空格 / 回车也不跳过——那是打 Boss 时的连按惯性键） */
    }
    if (Math.random() < dt * 3) g.audio.play('sparkle', 0.8 + Math.random() * 0.6, 0.4);
    if (this.t >= 2 && this.skipBtn) this.skipBtn.style.visibility = 'visible';
    if (this.t >= DURATION) this.finish();
  }

  render() {
    const g = this.game;
    const sc = g.screen;
    const W = sc.W;
    const H = sc.H;
    const b = sc.bctx;
    const t = this.t;
    b.imageSmoothingEnabled = false;
    drawNightSky(b, W, H, t);
    const glow = Math.min(1, Math.max(0, (t - 3) / 4));
    drawHomeScene(b, W, H, glow);
    // 回忆光点：从天上飘下来，飞进家的窗户
    const tx = W / 2;
    const ty = H * 0.74 - 30;
    for (const d of this.dots) {
      const k = Math.max(0, Math.min(1, (t - d.delay) / 3));
      if (k <= 0 || k >= 1) continue;
      const x0 = d.x * W;
      const y0 = d.y * H;
      const e = k * k * (3 - 2 * k);
      const x = x0 + (tx - x0) * e + Math.sin(t * 3 + d.wob) * 6 * (1 - e);
      const y = y0 + (ty - y0) * e;
      b.globalAlpha = 1 - e * 0.5;
      b.fillStyle = d.c;
      b.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
    b.globalAlpha = 1;
    if (t > 6) drawCouple(b, W, H, Math.min(1, (t - 6) / 1), t);
    // 下雨渐停
    if (t < 4) {
      b.globalAlpha = 0.4 * (1 - t / 4);
      b.fillStyle = '#b9c8ff';
      for (let i = 0; i < 40; i++) {
        const x = (i * 37 + t * 30) % W;
        const y = (i * 53 + t * 260) % H;
        b.fillRect(Math.round(x), Math.round(y), 1, 4);
      }
      b.globalAlpha = 1;
    }
    sc.present(0, 0);
    const ctx = sc.ctx;
    for (const L of LINES) {
      if (t < L.at) continue;
      const a = Math.min(1, (t - L.at) / 0.8);
      ctx.globalAlpha = a;
      const y = H * 0.16 + LINES.indexOf(L) * 16;
      drawText(ctx, L.text, W / 2, y, 7, '#fff6c2');
    }
    ctx.globalAlpha = 1;
    if (SPRITES.homeHouse && t > 7.5) {
      const a = 0.5 + 0.5 * Math.sin(t * 4);
      ctx.globalAlpha = a;
      drawText(ctx, '♥', W / 2, H * 0.74 - 72, 10, '#ff6fa5');
      ctx.globalAlpha = 1;
    }
    sc.endFrame();
  }
}
