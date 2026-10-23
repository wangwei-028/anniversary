import { el, append, button } from '../systems/ui.js';
import { TEXTS } from '../data/texts.js';
import { CONFIG } from '../config.js';
import { settleLevel } from '../systems/economy.js';
import { SPRITES } from '../systems/sprites.js';
import { PK, CONFETTI_COLORS } from '../systems/particles.js';
import { BOSSES } from '../data/bosses.js';
import { getLevel } from '../data/levels.js';

/**
 * 结算页：通关 / 失败、三星评价、金币明细（通关奖励 / 新星奖励 / Boss 无伤）、照片碎片、
 * 随机一句"恋爱冷知识"（config.memes.loveFacts）。失败也会把本局金币全额入账。
 */
export class ResultScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
  }

  enter(params) {
    const g = this.game;
    const w = g.world;
    const s = params.session;
    this.t = 0;
    if (params.endless || params.rush) {
      this.cleared = params.rush ? params.rush.cleared : true;
      this.setupBackground();
      if (params.endless) this.buildEndless(params.endless, s);
      else this.buildRush(params.rush);
      return;
    }
    this.cleared = !!params.cleared;
    w.hud.flushCoins(s.coins);
    const res = settleLevel(g.save, s, this.cleared);
    this.setupBackground();

    const panel = el('div', 'panel modal result-panel scrollable');

    const boss = BOSSES[s.level.bossId];
    const bossName = boss ? boss.name : 'Boss';
    const title = el('h2', 'result-title' + (this.cleared ? '' : ' fail'), this.cleared ? TEXTS.resultClear : TEXTS.resultFail);
    let reasonText = s.level.name + ' · Boss「' + bossName + '」被打败啦！';
    if (!this.cleared) {
      if (params.reason === 'run') reasonText = TEXTS.failRun + (g.world.deathCause ? '（' + g.world.deathCause + '）' : '');
      else if (params.reason === 'giveup') reasonText = '下次一定能打败' + bossName + '！';
      else reasonText = TEXTS.failBoss;
    }
    const lines = el('div', 'result-lines');
    const line = (label, value, cls) => {
      const d = el('div', 'line' + (cls ? ' ' + cls : ''));
      append(d, el('span', null, label), el('b', null, value));
      return d;
    };
    append(lines, line(TEXTS.resultCoinsRun, '+' + res.runCoins));
    if (res.clearReward) lines.appendChild(line(res.firstClear ? TEXTS.resultFirstClear : TEXTS.resultClearReward, '+' + res.clearReward));
    if (res.starReward) lines.appendChild(line(TEXTS.resultStars + '（' + res.newStars + ' 颗）', '+' + res.starReward));
    if (res.bossBonus) lines.appendChild(line(TEXTS.resultBossNoDamage, '+' + res.bossBonus));
    const nPhotos = res.photos.filter(Boolean).length;
    lines.appendChild(line(TEXTS.resultPhotos, nPhotos + '/3' + (res.newPhotos ? '（新 +' + res.newPhotos + '）' : '')));
    append(lines, line(TEXTS.resultPerfect, res.perfects + ' 次'), line('最高金币连击', res.bestCombo + ''));
    if (res.guardSwaps) lines.appendChild(line('男友酱守护', res.guardSwaps + ' 次'));
    lines.appendChild(line(TEXTS.resultTotal, String(res.balance), 'total'));

    // 三星（累计取最好）：本局新拿到的闪一下
    const starRow = el('div', 'result-stars');
    const starNames = [TEXTS.starClear, TEXTS.starNoDamage, TEXTS.starPhotos];
    for (let i = 0; i < 3; i++) {
      const on = res.stars[i];
      const isNew = this.isNewStar(res, i);
      const st = el('div', 'rstar' + (on ? ' on' : '') + (isNew ? ' new' : ''));
      append(st, el('div', 'big', on ? '★' : '☆'), el('div', 'lbl', starNames[i]));
      starRow.appendChild(st);
    }

    const facts = CONFIG.memes.loveFacts;
    const fact = facts.length ? facts[Math.floor(Math.random() * facts.length)] : '';
    const factBox = el('p', 'love-fact');
    append(factBox, el('b', null, TEXTS.resultLoveFact + '：'), document.createTextNode(fact));

    const btns = el('div', 'btns');
    const next = s.levelId < 7 ? getLevel(s.levelId + 1) : null;
    const unlockedNext = this.cleared && res.firstClear && next && next.available;
    if (unlockedNext) btns.appendChild(button(g, '去下一关：' + next.name, 'big', () => g.switchScene('select', { openLevel: next.id })));
    append(
      btns,
      button(g, TEXTS.playAgain, unlockedNext ? '' : 'big', () => g.switchScene('select', { openLevel: s.levelId })),
      button(g, TEXTS.shop + '（变强！）', 'ghost', () => g.switchScene('shop')),
      button(g, TEXTS.backToSelect, 'ghost', () => g.switchScene('select')),
    );
    append(panel, title, el('p', null, reasonText), starRow, lines, factBox);
    if (params.finale) {
      // 最终关：集齐 21 片照片碎片 → 回忆放映厅
      const n = g.save.totalPhotos();
      if (n >= 21) btns.insertBefore(button(g, '✦ 进入回忆放映厅 ✦', 'big glow', () => g.switchScene('theater', { from: 'title' })), btns.firstChild);
      else panel.appendChild(el('p', 'unlock-line', '集齐 21 片照片碎片（现在 ' + n + '/21），标题画面会出现一扇发光的门……'));
      if (res.firstClear) panel.appendChild(el('p', 'footnote-dark', '全部 7 关通关！无尽模式已开放，商店可以买「像素婚纱 & 西装」了'));
    } else if (unlockedNext) panel.appendChild(el('p', 'unlock-line', TEXTS.unlockNext + ' 第 ' + next.id + ' 关「' + next.name + '」'));
    else if (this.cleared && !(next && next.available)) panel.appendChild(el('p', 'footnote-dark', TEXTS.nextMilestone));
    panel.appendChild(btns);
    this.mount(panel);
  }

  /** 背景：回到菜单演示（世界不重置，地面接着往前走） */
  setupBackground() {
    const g = this.game;
    const w = g.world;
    w.listener = null;
    w.mode = 'demo';
    w.clearEntities();
    w.boss = null;
    w.fever = false;
    w.hidePlayer = true;
    w.sandTarget = 0;
    w.dashLane = null;
    w.aimLane = null;
    w.player.reset();
    w.targetSpeed = this.cleared ? 6 : 3;
    g.audio.stopMusic();
    if (!this.cleared) g.audio.play('fail');
    this.musicDelay = this.cleared ? 2.2 : 1.6;
    // 解锁了男友酱：结算页两个人一起出现
    this.duo = !!g.save.data.partner.unlocked;
    this.girlCanvas = el('canvas', 'girl-canvas result-girl' + (this.duo ? ' duo' : ''));
    this.girlCanvas.width = this.duo ? 128 : 64;
    this.girlCanvas.height = 64;
    this.girlCtx = this.girlCanvas.getContext('2d');
  }

  mount(panel) {
    const root = el('div', 'scene-root interactive');
    root.appendChild(el('div', 'dim'));
    const wrap = el('div', 'result-wrap');
    append(wrap, this.girlCanvas, panel);
    root.appendChild(wrap);
    this.game.ui.appendChild(root);
  }

  lineMaker() {
    return (label, value, cls) => {
      const d = el('div', 'line' + (cls ? ' ' + cls : ''));
      append(d, el('span', null, label), el('b', null, value));
      return d;
    };
  }

  /** 无尽模式结算 */
  buildEndless(res, s) {
    const g = this.game;
    const line = this.lineMaker();
    const panel = el('div', 'panel modal result-panel scrollable');
    const lines = el('div', 'result-lines');
    append(
      lines,
      line('分数', String(res.score), 'total'),
      line('这张地图的最高分', String(res.best)),
      line('跑了', Math.floor(s.trackPos) + ' 米'),
      line(TEXTS.resultCoinsRun, '+' + res.total),
      line(TEXTS.resultPerfect, res.perfects + ' 次'),
      line(TEXTS.resultTotal, String(res.balance)),
    );
    const btns = el('div', 'btns');
    append(
      btns,
      button(g, '再跑一次', 'big', () => g.switchScene('endless', { mapId: s.mapId, mode: s.params.mode })),
      button(g, TEXTS.shop, 'ghost', () => g.switchScene('shop')),
      button(g, TEXTS.backToSelect, 'ghost', () => g.switchScene('select')),
    );
    append(panel, el('h2', 'result-title', res.isBest ? '新纪录！' : '无尽模式'), el('p', null, s.level.name + ' · 跑到了第 ' + Math.max(1, Math.ceil((s.runTime - 8) / 27)) + ' 波'), lines, btns);
    this.mount(panel);
  }

  /** Boss Rush 结算（通关：白金奖章 + 星光礼服 + 第 22 张照片） */
  buildRush(res) {
    const g = this.game;
    const line = this.lineMaker();
    const panel = el('div', 'panel modal result-panel scrollable');
    const lines = el('div', 'result-lines');
    const mm = Math.floor(res.time / 60);
    const ss = Math.floor(res.time % 60);
    append(lines, line('打到第', res.reached + ' / 7 只'), line('用时', mm + ' 分 ' + ss + ' 秒'), line('无伤击破', res.noDamage + ' 只'), line(TEXTS.resultCoinsRun, '+' + res.runCoins));
    if (res.reward) lines.appendChild(line(res.first ? 'Boss Rush 首通' : 'Boss Rush 通关', '+' + res.reward));
    lines.appendChild(line(TEXTS.resultTotal, String(res.balance), 'total'));
    const btns = el('div', 'btns');
    append(
      btns,
      button(g, res.cleared ? '去看回忆放映厅' : '再挑战一次', 'big', () => g.switchScene(res.cleared ? 'theater' : 'rush', { from: 'title' })),
      button(g, TEXTS.shop, 'ghost', () => g.switchScene('shop')),
      button(g, TEXTS.backToSelect, 'ghost', () => g.switchScene('select')),
    );
    append(panel, el('h2', 'result-title' + (res.cleared ? '' : ' fail'), res.cleared ? '回忆风暴 · 通关！' : '回忆风暴'), lines);
    if (res.cleared && res.first) {
      const gift = el('div', 'rush-gifts');
      append(gift, el('div', 'medal-big', '★'), el('p', 'unlock-line', '白金奖章「年度最佳搭档」'), el('p', null, '专属皮肤「星光礼服」已解锁（商店 → 皮肤）'), el('p', null, '回忆放映厅多了第 22 张照片「群星之夜」'));
      panel.appendChild(gift);
    }
    panel.appendChild(btns);
    this.mount(panel);
  }

  /** 本局是否新拿到第 i 颗星（settleLevel 只给出数量，这里按结算前状态反推） */
  isNewStar(res, i) {
    return !!(res.starsBefore && !res.starsBefore[i] && res.stars[i]);
  }

  exit() {}

  update(dt) {
    const g = this.game;
    const w = g.world;
    this.t += dt;
    w.updateDemo(dt);
    w.hud.update(dt);
    while (g.input.next() !== null) {
      /* 结算页不处理游戏动作 */
    }
    if (this.musicDelay > 0) {
      this.musicDelay -= dt;
      if (this.musicDelay <= 0) g.audio.playMusic('title');
    }
    // 通关：持续撒彩纸
    if (this.cleared && Math.random() < dt * 14) {
      const W = w.camera.W;
      w.particles.spawn(PK.CONFETTI, Math.random() * W, -3, (Math.random() - 0.5) * 20, 25 + Math.random() * 30, 4, 1, CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0], 8, 0.5);
    }
  }

  render() {
    const g = this.game;
    g.world.render(g.screen);
    g.screen.present(0, 0);
    g.screen.endFrame();
    const F = SPRITES.girlFront;
    const t = this.t;
    let img;
    if (this.cleared) img = Math.floor(t * 4) & 1 ? F.cheer1 : F.cheer0;
    else img = F.sad;
    this.girlCtx.clearRect(0, 0, this.girlCanvas.width, 64);
    this.girlCtx.drawImage(img, 0, 0);
    if (this.duo) {
      const B = SPRITES.boyFront;
      const bi = this.cleared ? (Math.floor(t * 4 + 1) & 1 ? B.cheer0 : B.idle1) : B.idle0;
      this.girlCtx.drawImage(bi, 64, 0);
    }
  }
}
