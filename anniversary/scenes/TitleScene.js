import { el, append, button } from '../systems/ui.js';
import { TEXTS } from '../data/texts.js';
import { CONFIG } from '../config.js';
import { GameSession } from '../systems/session.js';
import { daysTogether } from '../systems/anniversary.js';
import { SPRITES } from '../systems/sprites.js';
import { settleRush } from '../systems/economy.js';
import { RUSH_LEVEL } from '../data/levels.js';
import { setDevActive } from '../systems/save.js';

/** 开发者代码校验：输入 → SHA-256 → 与 config.devCodeHash 比对。明文代码不出现在本项目。 */
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
    append(bottom, startBtn, el('div', 'footnote', '全 7 关' + progress + (g.isDev ? ' · 开发者模式' : '')));

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

    // 开发者模式：调试入口——不用真通关，直接预览各"通关后"的内容（见 showDebug）
    if (g.isDev) {
      const dev = el('button', 'dev-btn', '调试');
      dev.type = 'button';
      dev.setAttribute('aria-label', '开发者调试');
      dev.addEventListener('click', (e) => {
        e.stopPropagation();
        g.audio.unlock();
        g.audio.play('click');
        this.showDebug();
      });
      root.appendChild(dev);
    } else {
      // 非开发者模式：右下角不起眼的小圆点，点开输入开发者代码（只有你知道）
      const dot = el('button', 'dev-secret', '·');
      dot.type = 'button';
      dot.setAttribute('aria-label', '关于');
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        g.audio.unlock();
        g.audio.play('click');
        this.showCodeModal();
      });
      root.appendChild(dot);
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

  /** 开发者代码输入：校验通过 → 记住在本机并刷新（以开发者模式重新启动） */
  showCodeModal() {
    if (this.modal) return;
    const g = this.game;
    const wrap = el('div', 'interactive');
    wrap.style.position = 'absolute';
    wrap.style.inset = '0';
    wrap.addEventListener('click', (e) => e.stopPropagation());
    const panel = el('div', 'panel modal dev-menu dev-code');
    append(panel, el('h2', null, '·'), el('p', 'dev-note', '请输入代码'));
    const input = el('input', 'dev-code-input');
    input.type = 'password';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.maxLength = 16;
    const hint = el('p', 'dev-code-hint', '');
    const submit = async () => {
      const code = input.value.trim();
      if (!code) return;
      let ok = false;
      try {
        ok = (await sha256Hex(code)) === CONFIG.devCodeHash;
      } catch (e) {
        ok = false;
      }
      if (ok) {
        setDevActive(true);
        location.reload();
      } else {
        hint.textContent = '代码不对，再想想。';
        input.value = '';
        panel.classList.remove('shake');
        void panel.offsetWidth;
        panel.classList.add('shake');
        input.focus();
      }
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    append(
      panel,
      input,
      hint,
      button(g, '确定', 'dev-item', () => submit()),
      button(g, '关闭', 'dev-item', () => this.closeModal()),
    );
    append(wrap, el('div', 'dim'), panel);
    this.root.appendChild(wrap);
    this.modal = wrap;
    input.focus();
  }

  /** 开发者调试面板：一键直达各个"通关后"的内容（写入的是开发者独立存档，不影响正式存档） */
  showDebug() {
    if (this.modal) return;
    const g = this.game;
    const wrap = el('div', 'interactive');
    wrap.style.position = 'absolute';
    wrap.style.inset = '0';
    wrap.addEventListener('click', (e) => e.stopPropagation());
    const panel = el('div', 'panel modal dev-menu');
    append(panel, el('h2', null, '开发者调试'), el('p', 'dev-note', '不用通关，直接预览对应内容。写入的是开发者独立存档。'));

    const item = (label, fn) => append(panel, button(g, label, 'ghost dev-item', () => { this.closeModal(); fn(); }));
    // 第 7 关通关的真实流程：ending 演出 → result(finale) →（照片集齐时）进入回忆放映厅
    item('▶ 第 7 关通关动画（结局演出 → 通关结算）', () => {
      g.useLevel(7);
      g.switchScene('ending', { session: new GameSession(7, g.save.data.settings.difficulty, g.save, []) });
    });
    // Boss Rush 通关的真实流程：群星之夜 → result(rush)。settleRush 会像真通关一样记账（白金奖章 / 星光皮肤）
    item('★ 群星之夜（Boss Rush 通关动画 → 结算）', () => {
      const s = new GameSession(RUSH_LEVEL.id, 'standard', g.save, []);
      const res = settleRush(g.save, s, true, { time: 299.9, noDamage: 7, reached: 7 });
      g.switchScene('starry', { rushRes: res, session: s });
    });
    item('☰ 回忆放映厅（21 张照片放映 + 那封信）', () => g.switchScene('theater', { from: 'title' }));
    item('⚑ 解锁全部照片碎片（图鉴 21/21 · 标题出现放映厅之门）', () => {
      for (let i = 1; i <= 7; i++) g.save.getLevel(i).photos = [true, true, true];
      g.save.save();
      g.switchScene('title');
    });
    item('◈ 标记 Boss Rush 已通关（白金奖章 + 星光皮肤，不播动画）', () => {
      const r = g.save.data.rush;
      r.cleared = true;
      r.clears = Math.max(1, r.clears || 0);
      if (!r.bestTime) r.bestTime = 299.9;
      r.bestNoDamage = Math.max(r.bestNoDamage || 0, 7);
      if (!g.save.data.skins.owned.includes('starlight')) g.save.data.skins.owned.push('starlight');
      g.save.save();
      g.switchScene('title');
    });
    append(panel, button(g, '关闭', 'dev-item', () => this.closeModal()));
    append(
      panel,
      el('p', 'footnote-dark dev-note', '快捷键需网址加 ?debug=1：B 跳过跑酷段 · G 无敌 · K 受伤 · T 慢速 · M +5000金币（选关/商店）· U 全关通关（选关）· F 全照片 · 0 清档'),
    );
    if (g.isDev && !CONFIG.devMode) {
      append(
        panel,
        button(g, '退出开发者模式（回到正式状态）', 'dev-item', () => {
          setDevActive(false);
          location.reload();
        }),
      );
    }

    append(wrap, el('div', 'dim'), panel);
    this.root.appendChild(wrap);
    this.modal = wrap;
  }

  closeModal() {
    if (this.modal && this.modal.parentNode) this.modal.parentNode.removeChild(this.modal);
    this.modal = null;
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
