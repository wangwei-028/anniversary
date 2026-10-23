import { el, append, button } from '../systems/ui.js';
import { TEXTS } from '../data/texts.js';
import { LEVELS } from '../data/levels.js';
import { BOSSES } from '../data/bosses.js';
import { DIFFICULTY_MODES } from '../data/difficulty.js';
import { GameSession } from '../systems/session.js';

/**
 * Boss 练习场：直接选一只 Boss 开打（跳过跑酷段）。
 * - 血量与能力和主线一致：按当前难度 + 商店加点构建本局（伙伴 / 复活机会 / 每局弹跳鞋次数照常生效）
 * - 解锁条件：主线中"遇到过"该 Boss（进过它的 Boss 战，输赢都算）；开发者模式（save.dev）全解锁
 * - 练习不产出：金币不入账、不计通关、不影响存档进度
 */
export class BossPracticeScene {
  constructor(game) {
    this.game = game;
    this.root = null;
  }

  enter() {
    const g = this.game;
    const w = g.world;
    if (w.mode !== 'demo') w.begin(new GameSession(1), null, 'demo');
    w.targetSpeed = 6;
    w.hidePlayer = false;
    g.audio.playMusic('title');

    const root = el('div', 'scene-root');
    root.appendChild(el('div', 'dim'));
    const header = el('div', 'select-header', 'Boss 练习场');
    header.style.position = 'relative';
    const stats = el('div', 'select-stats');
    append(
      stats,
      el('span', 'select-chip', '血量 / 能力与主线一致'),
      el('span', 'select-chip', '练习不影响进度'),
      el('span', 'select-chip', g.save.dev ? '开发者模式 · 全部解锁' : '主线遇到过即解锁'),
    );
    const list = el('div', 'level-list');
    list.style.position = 'relative';
    for (const lv of LEVELS) list.appendChild(this.makeCard(lv));

    const back = el('button', 'icon-btn', '←');
    back.type = 'button';
    back.style.top = 'calc(var(--px) * 4)';
    back.style.left = 'calc(var(--px) * 4)';
    back.setAttribute('aria-label', TEXTS.back);
    back.addEventListener('click', () => {
      g.audio.play('click');
      g.switchScene('select');
    });

    append(root, header, stats, list, back);
    g.ui.appendChild(root);
    this.root = root;
  }

  exit() {
    this.root = null;
  }

  makeCard(lv) {
    const g = this.game;
    const boss = BOSSES[lv.bossId];
    const unlocked = g.save.dev || g.save.getLevel(lv.id).bossSeen;
    const card = el('button', 'level-card' + (unlocked ? '' : ' locked'));
    card.type = 'button';
    card.style.setProperty('--lv-color', lv.palette.ui || '#ff6fa5');
    const info = el('div', 'info');
    append(
      info,
      el('div', 'name', unlocked ? boss.title + ' ' + boss.name : '？？？'),
      el(
        'div',
        'memo',
        unlocked
          ? '第 ' + lv.id + ' 关 ' + lv.name + ' · 还击：' + lv.counterType
          : '主线推进到第 ' + lv.id + ' 关遇到 TA 后解锁（输赢都算）',
      ),
    );
    append(card, el('div', 'num', String(lv.id)), info, el('div', 'badge', unlocked ? '练习' : '锁定'));
    if (unlocked) {
      card.addEventListener('click', () => {
        g.audio.unlock();
        g.audio.play('click');
        this.start(lv);
      });
    } else {
      card.disabled = true;
    }
    return card;
  }

  /** 用和主线完全一致的能力构建一局，直接进 Boss 战 */
  start(lv) {
    const g = this.game;
    const dif = g.save.data.settings.difficulty;
    const mode = DIFFICULTY_MODES[dif] ? dif : 'standard';
    const s = new GameSession(lv.id, mode, g.save, []);
    g.useLevel(lv.id); // Boss 场地配色按所选关卡切换（主线里这步由跑酷段完成）
    g.world.begin(s, null, 'boss'); // 跳过跑酷段：全量重置世界后直接开打
    g.switchScene('boss', { session: s, practice: true });
  }

  update(dt) {
    const g = this.game;
    g.world.updateDemo(dt);
    while (g.input.next() !== null) {
      /* 列表画面不处理游戏动作 */
    }
  }

  render() {
    const g = this.game;
    g.world.render(g.screen);
    g.screen.present(0, 0);
    g.screen.endFrame();
  }
}
