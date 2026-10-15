import { el, append, button } from '../systems/ui.js';
import { TEXTS } from '../data/texts.js';
import { CONFIG } from '../config.js';
import { GameSession } from '../systems/session.js';
import { daysTogether } from '../systems/anniversary.js';
import { SPRITES } from '../systems/sprites.js';

/**
 * 标题画面：游戏名 + "今天是和 TA 在一起的第 N 天" + 开始按钮。
 * 背景是商场走廊自动前进的演示画面。
 */
export class TitleScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
  }

  enter() {
    const g = this.game;
    const w = g.world;
    g.useLevel(1);
    w.begin(new GameSession(1), null, 'demo');
    w.targetSpeed = 7;
    w.hidePlayer = true;
    g.audio.playMusic('title');
    this.t = 0;
    this.started = false;

    const root = el('div', 'scene-root interactive');
    const wrap = el('div', 'title-wrap');
    const days = el('div', 'title-days');
    const n = daysTogether();
    if (n === null) {
      days.textContent = '（config.js 里的 anniversaryDate 格式应为 YYYY-MM-DD）';
    } else if (n < 0) {
      append(days, document.createTextNode(TEXTS.daysBefore), el('b', null, String(-n)), document.createTextNode(TEXTS.daysSuffix));
    } else {
      append(days, document.createTextNode(TEXTS.daysPrefix + ' ' + CONFIG.partnerCallName + ' ' + TEXTS.daysMiddle), el('b', null, String(n)), document.createTextNode(TEXTS.daysSuffix));
    }
    append(wrap, el('div', 'title-logo', TEXTS.gameTitle), el('div', 'title-sub', TEXTS.gameSubtitle), days);

    this.girlCanvas = el('canvas', 'girl-canvas title-girl');
    this.girlCanvas.width = 64;
    this.girlCanvas.height = 64;
    this.girlCtx = this.girlCanvas.getContext('2d');

    const bottom = el('div', 'title-bottom');
    const startBtn = button(g, TEXTS.start, 'big', () => this.start());
    const stars = g.save.totalStars();
    const photos = g.save.totalPhotos();
    const progress = stars || photos ? ' · ★' + stars + ' · 照片 ' + photos + '/21' : '';
    append(bottom, startBtn, el('div', 'footnote', '全 7 关' + progress + (CONFIG.devMode ? ' · 开发者模式' : '')));

    // 集齐 21 片照片碎片 → 标题画面多出一扇发光的门（回忆放映厅）
    if (g.save.totalPhotos() >= 21) {
      const door = el('button', 'title-door', '');
      door.type = 'button';
      append(door, el('span', 'door-icon', ''), el('span', 'door-text', '回忆放映厅'));
      door.addEventListener('click', (e) => {
        e.stopPropagation();
        g.audio.unlock();
        g.audio.play('sparkle');
        g.switchScene('theater', { from: 'title' });
      });
      root.appendChild(door);
    }
    // Boss Rush 通关 → 白金奖章「年度最佳搭档」（点开看战绩）
    if (g.save.data.rush.cleared) {
      const medal = el('button', 'title-medal', '★');
      medal.type = 'button';
      medal.setAttribute('aria-label', '白金奖章');
      medal.addEventListener('click', (e) => {
        e.stopPropagation();
        g.audio.unlock();
        g.audio.play('click');
        this.showMedal();
      });
      root.appendChild(medal);
    }

    const mute = el('button', 'icon-btn', g.audio.muted ? TEXTS.soundOff : TEXTS.soundOn);
    mute.type = 'button';
    mute.style.top = 'calc(var(--px) * 4)';
    mute.style.right = 'calc(var(--px) * 4)';
    mute.setAttribute('aria-label', '静音开关');
    mute.addEventListener('click', (e) => {
      e.stopPropagation();
      g.audio.unlock();
      g.setMuted(!g.audio.muted);
      mute.textContent = g.audio.muted ? TEXTS.soundOff : TEXTS.soundOn;
    });

    // 点击画面任意位置也能开始
    root.addEventListener('click', () => this.start());
    append(root, wrap, this.girlCanvas, bottom, mute);
    g.ui.appendChild(root);
    this.root = root;
    this.modal = null;
  }

  showMedal() {
    const g = this.game;
    if (this.modal) return;
    const r = g.save.data.rush;
    const st = g.save.data.stats;
    const wrap = el('div', 'interactive');
    wrap.style.position = 'absolute';
    wrap.style.inset = '0';
    wrap.addEventListener('click', (e) => e.stopPropagation());
    const panel = el('div', 'panel modal');
    const mm = Math.floor(r.bestTime / 60);
    const ss = Math.floor(r.bestTime % 60);
    const lines = el('div', 'result-lines');
    const line = (a, b) => {
      const d = el('div', 'line');
      append(d, el('span', null, a), el('b', null, b));
      return d;
    };
    append(
      lines,
      line('Boss Rush 最快通关', mm + ' 分 ' + ss + ' 秒'),
      line('单次最多无伤击破', r.bestNoDamage + ' / 7 只'),
      line('Boss Rush 通关次数', r.clears + ' 次'),
      line('累计打败 Boss', st.bossDefeats + ' 次'),
      line('累计完美闪避', st.totalPerfects + ' 次'),
      line('男友酱守护', (st.guardSwaps || 0) + ' 次'),
    );
    append(
      panel,
      el('div', 'medal-big', '★'),
      el('h2', null, '年度最佳搭档'),
      el('p', null, '白金奖章 · 全游戏最高荣誉'),
      lines,
      button(g, '收好', 'big', () => {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        this.modal = null;
      }),
    );
    append(wrap, el('div', 'dim'), panel);
    this.root.appendChild(wrap);
    this.modal = wrap;
  }

  exit() {}

  start() {
    if (this.started || this.modal) return;
    this.started = true;
    this.game.audio.unlock();
    this.game.audio.play('go');
    this.game.switchScene('select');
  }

  update(dt) {
    const g = this.game;
    this.t += dt;
    g.world.updateDemo(dt);
    while (g.input.next() !== null) {
      /* 标题画面不处理游戏动作 */
    }
    if (g.input.consumeConfirm()) this.start();
  }

  render() {
    const g = this.game;
    g.world.render(g.screen);
    g.screen.present(0, 0);
    g.screen.endFrame();
    // 正面的小女孩：轻轻上下晃 + 偶尔眨眼 / 挥手
    const t = this.t;
    const F = SPRITES.girlFront;
    let img = Math.floor(t * 2.5) & 1 ? F.idle1 : F.idle0;
    if (t % 3.2 > 3.0) img = F.blink;
    if (t % 6 > 4.6) img = Math.floor(t * 4) & 1 ? F.wave0 : F.idle0;
    this.girlCtx.clearRect(0, 0, 64, 64);
    this.girlCtx.drawImage(img, 0, 0);
  }
}
