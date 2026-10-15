import { el, append, button } from '../systems/ui.js';
import { TEXTS } from '../data/texts.js';
import { LEVELS, getLevel, RUSH_LEVEL } from '../data/levels.js';
import { OBSTACLES } from '../data/obstacles.js';
import { BOSSES } from '../data/bosses.js';
import { DIFFICULTY_MODES } from '../data/difficulty.js';
import { ITEMS, LOADOUT_MAX, PARTNER } from '../data/shop.js';
import { GameSession } from '../systems/session.js';
import { consumeLoadout } from '../systems/economy.js';

/**
 * 地图选择 + 关卡准备弹窗（本关障碍 / 专属机制 / Boss 预告 / 难度选择 / 出战道具 / 出发）。
 * 7 张地图全部列出，未开放的显示为锁定，让"这一年的路线"一开始就看得见。
 * 顶部：金币、星星 / 照片碎片总数、商店和图鉴入口。
 * params：{ openLevel } 进入后直接打开某关的准备弹窗（结算页"下一关"用）
 */
export class MapSelectScene {
  constructor(game) {
    this.game = game;
  }

  enter(params) {
    const g = this.game;
    const w = g.world;
    if (w.mode !== 'demo') w.begin(new GameSession(1), null, 'demo');
    w.targetSpeed = 6;
    w.hidePlayer = false;
    g.audio.playMusic('title');
    this.prep = null;
    this.prepLevel = null;

    const root = el('div', 'scene-root');
    root.appendChild(el('div', 'dim'));
    const header = el('div', 'select-header', TEXTS.selectTitle);
    header.style.position = 'relative';
    const stats = el('div', 'select-stats');
    append(
      stats,
      el('span', 'select-coins', TEXTS.coinsLabel + ' ' + g.save.data.coins),
      el('span', 'select-chip', '★ ' + g.save.totalStars()),
      el('span', 'select-chip', '照片 ' + g.save.totalPhotos() + '/21'),
    );
    const tabs = el('div', 'select-tabs');
    append(
      tabs,
      button(g, TEXTS.shop, 'small', () => g.switchScene('shop')),
      button(g, TEXTS.gallery, 'small ghost', () => g.switchScene('gallery')),
    );
    if (g.save.allCleared()) tabs.appendChild(button(g, '无尽模式', 'small ghost', () => this.openEndlessPrep()));
    const list = el('div', 'level-list');
    list.style.position = 'relative';
    for (const lv of LEVELS) list.appendChild(this.makeCard(lv));
    // 照片碎片 21/21 → "家"之后浮现第 8 个星光节点
    if (g.save.isRushUnlocked()) list.appendChild(this.makeRushCard());

    const back = el('button', 'icon-btn', '←');
    back.type = 'button';
    back.style.top = 'calc(var(--px) * 4)';
    back.style.left = 'calc(var(--px) * 4)';
    back.setAttribute('aria-label', TEXTS.back);
    back.addEventListener('click', () => {
      g.audio.play('click');
      g.switchScene('title');
    });

    append(root, header, stats, tabs, list, back);
    g.ui.appendChild(root);
    this.root = root;
    if (params && params.openLevel) {
      const lv = getLevel(params.openLevel);
      if (lv && lv.available && g.save.isLevelUnlocked(lv.id)) this.openPrep(lv);
    }
  }

  makeCard(lv) {
    const g = this.game;
    const unlocked = lv.available && g.save.isLevelUnlocked(lv.id);
    const rec = g.save.data.levels[String(lv.id)];
    const card = el('button', 'level-card' + (unlocked ? '' : ' locked'));
    card.type = 'button';
    card.style.setProperty('--lv-color', lv.palette.ui || '#ff6fa5');
    const info = el('div', 'info');
    append(info, el('div', 'name', unlocked ? lv.name : lv.available ? lv.name : '？？？'), el('div', 'memo', unlocked ? lv.memory : lv.available ? TEXTS.locked + ' · 先通关第 ' + (lv.id - 1) + ' 关' : TEXTS.comingSoon));
    if (unlocked) {
      const st = rec && rec.stars ? rec.stars : [false, false, false];
      const ph = rec && rec.photos ? rec.photos.filter(Boolean).length : 0;
      const starRow = el('div', 'stars');
      for (let i = 0; i < 3; i++) starRow.appendChild(el('span', st[i] ? 'star on' : 'star', st[i] ? '★' : '☆'));
      starRow.appendChild(el('span', 'photo-count', ' 照片 ' + ph + '/3'));
      info.appendChild(starRow);
    }
    let badgeText = '';
    if (unlocked) badgeText = rec && rec.cleared ? TEXTS.cleared : TEXTS.newBadge;
    else badgeText = TEXTS.locked;
    append(card, el('div', 'num', String(lv.id)), info, el('div', 'badge', badgeText));
    if (unlocked) {
      card.addEventListener('click', () => {
        g.audio.unlock();
        g.audio.play('click');
        this.openPrep(lv);
      });
    } else {
      card.disabled = true;
    }
    return card;
  }

  makeRushCard() {
    const g = this.game;
    const r = g.save.data.rush;
    const card = el('button', 'level-card star-node');
    card.type = 'button';
    const info = el('div', 'info');
    append(info, el('div', 'name', RUSH_LEVEL.name), el('div', 'memo', RUSH_LEVEL.memory));
    if (r.cleared) {
      const mm = Math.floor(r.bestTime / 60);
      const ss = Math.floor(r.bestTime % 60);
      info.appendChild(el('div', 'memo', '最快 ' + mm + ' 分 ' + ss + ' 秒 · 无伤最多 ' + r.bestNoDamage + ' 只'));
    }
    append(card, el('div', 'num', '★'), info, el('div', 'badge', r.cleared ? '白金' : '隐藏'));
    card.addEventListener('click', () => {
      g.audio.unlock();
      g.audio.play('click');
      this.openRushPrep();
    });
    return card;
  }

  openModal(children) {
    if (this.prep) return null;
    const wrap = el('div', 'interactive');
    wrap.style.position = 'absolute';
    wrap.style.inset = '0';
    const panel = el('div', 'panel prep');
    for (const c of children) panel.appendChild(c);
    append(wrap, el('div', 'dim'), panel);
    this.root.appendChild(wrap);
    this.prep = wrap;
    return panel;
  }

  openRushPrep() {
    const g = this.game;
    const ul = el('ul');
    for (const t of [
      '7 只 Boss 按登场顺序连战，吞吞压轴（约 9 分钟，每个阶段直接从第 2 波打起）',
      '全程共享 2 颗心；两场之间的星光补给段最多回 1 颗',
      '以【疯狂】难度为底再加压：弹幕更快、更密、波与波几乎不停，每打败一只下一只更密',
      '单场无伤击败 → 立刻回 1 心',
      '失败从当前这只 Boss 重开，不限次数，金币不损失',
    ])
      ul.appendChild(el('li', null, t));
    const row = el('div', 'row');
    append(
      row,
      button(g, TEXTS.back, 'ghost', () => this.closePrep()),
      button(g, '开始挑战！', '', () => g.switchScene('rush')),
    );
    this.openModal([
      el('h2', null, '★ ' + RUSH_LEVEL.name),
      el('div', 'memo', '给全收集完成者的终极邀请函'),
      ul,
      el('div', 'memo small', '通关奖励：群星之夜动画 · 白金奖章「年度最佳搭档」 · 专属皮肤「星光礼服」'),
      el('div', 'memo small', 'Boss Rush 不提供难度切换（甜蜜难度玩家自动改用热恋参数 -10%）'),
      row,
    ]);
  }

  openEndlessPrep() {
    const g = this.game;
    const save = g.save;
    this.endlessMap = 1;
    this.mode = DIFFICULTY_MODES[save.data.settings.difficulty] ? save.data.settings.difficulty : 'standard';
    const mapRow = el('div', 'chip-row');
    const mapBtns = [];
    const bestLine = el('div', 'memo small', '');
    const showBest = () => {
      bestLine.textContent = '这张地图的最高分：' + (save.data.endless.best[String(this.endlessMap)] || 0);
    };
    for (const lv of LEVELS) {
      const b = button(g, lv.name, 'chip' + (lv.id === this.endlessMap ? ' on' : ''), () => {
        this.endlessMap = lv.id;
        for (const x of mapBtns) x.classList.toggle('on', x.dataset.id === String(lv.id));
        showBest();
        g.useLevel(lv.id);
      });
      b.dataset.id = String(lv.id);
      mapBtns.push(b);
      mapRow.appendChild(b);
    }
    showBest();
    const diffRow = el('div', 'chip-row');
    const diffBtns = [];
    for (const id of ['sweet', 'standard', 'crazy']) {
      const m = DIFFICULTY_MODES[id];
      const b = button(g, m.name, 'chip' + (id === this.mode ? ' on' : ''), () => {
        this.mode = id;
        for (const x of diffBtns) x.classList.toggle('on', x.dataset.id === id);
      });
      b.dataset.id = id;
      diffBtns.push(b);
      diffRow.appendChild(b);
    }
    const row = el('div', 'row');
    append(
      row,
      button(g, TEXTS.back, 'ghost', () => this.closePrep()),
      button(g, TEXTS.go, '', () => g.switchScene('endless', { mapId: this.endlessMap, mode: this.mode })),
    );
    this.openModal([
      el('h2', null, '无尽模式'),
      el('div', 'memo', '前 6 关的障碍随机混编，越跑越快；每隔一会儿会有 Boss 客串扔弹幕。分数 = 距离 + 金币×5 + 完美闪避×20'),
      el('h3', null, '选地图'),
      mapRow,
      bestLine,
      el('h3', null, TEXTS.difficulty),
      diffRow,
      row,
    ]);
  }

  openPrep(lv) {
    const g = this.game;
    if (this.prep) return;
    const save = g.save;
    const boss = BOSSES[lv.bossId];
    this.prepLevel = lv;
    // 背景切换到这张地图，提前感受一下氛围
    g.useLevel(lv.id);
    this.mode = DIFFICULTY_MODES[save.data.settings.difficulty] ? save.data.settings.difficulty : 'standard';
    this.loadoutSel = (save.data.loadout || []).filter((id) => save.itemCount(id) > 0).slice(0, LOADOUT_MAX);

    const wrap = el('div', 'interactive');
    wrap.style.position = 'absolute';
    wrap.style.inset = '0';
    const panel = el('div', 'panel prep');
    const ul = el('ul');
    for (const id of lv.introObstacles || []) {
      const o = OBSTACLES[id];
      ul.appendChild(el('li', null, o.name + '（' + o.category + '）· ' + o.tip.replace(/\s+/g, ' ')));
    }
    if (lv.mechanic) ul.appendChild(el('li', null, lv.mechanic));
    const rec = save.data.levels[String(lv.id)];
    const best = rec ? '最佳：金币 ' + rec.bestCoins + ' · 完美闪避 ' + rec.bestPerfects : '第一次来这里哦';

    // 难度选择（8.5）
    const diffRow = el('div', 'chip-row');
    const diffBtns = [];
    for (const id of ['sweet', 'standard', 'crazy']) {
      const m = DIFFICULTY_MODES[id];
      const b = button(g, m.name + ' · ' + m.desc, 'chip' + (id === this.mode ? ' on' : ''), () => {
        this.mode = id;
        save.data.settings.difficulty = id;
        save.save();
        for (const x of diffBtns) x.classList.toggle('on', x.dataset.id === id);
        diffNote.textContent = this.diffText(id);
      });
      b.dataset.id = id;
      diffBtns.push(b);
      diffRow.appendChild(b);
    }
    const diffNote = el('div', 'memo small', this.diffText(this.mode));

    // 出战道具（8.2B）：每关最多 2 个，进关时扣除库存
    const itemRow = el('div', 'chip-row');
    const itemBtns = [];
    let owned = 0;
    for (const it of ITEMS) {
      const n = save.itemCount(it.id);
      if (n <= 0) continue;
      owned++;
      const b = button(g, it.name + ' ×' + n, 'chip' + (this.loadoutSel.includes(it.id) ? ' on' : ''), () => {
        const i = this.loadoutSel.indexOf(it.id);
        if (i >= 0) this.loadoutSel.splice(i, 1);
        else if (this.loadoutSel.length < LOADOUT_MAX) this.loadoutSel.push(it.id);
        else {
          this.loadoutSel.shift();
          this.loadoutSel.push(it.id);
        }
        for (const x of itemBtns) x.classList.toggle('on', this.loadoutSel.includes(x.dataset.id));
      });
      b.dataset.id = it.id;
      b.title = it.desc;
      itemBtns.push(b);
      itemRow.appendChild(b);
    }
    if (!owned) itemRow.appendChild(el('div', 'memo small', TEXTS.noItems));

    const partnerText = save.data.partner.unlocked
      ? '男友酱：在你身边 ♥ 受击时自动换上来挡伤（冷却 ' + Math.max(PARTNER.cdMin, PARTNER.cdRun - save.upgradeLevel('bond') * PARTNER.cdPerBond) + ' 秒）'
      : '男友酱：去商店解锁后，受击时会自动换上来替你挡伤';

    const row = el('div', 'row');
    append(
      row,
      button(g, TEXTS.back, 'ghost', () => this.closePrep()),
      button(g, TEXTS.go, '', () => this.go()),
    );
    append(
      panel,
      el('h2', null, '第 ' + lv.id + ' 关 · ' + lv.name),
      el('div', 'memo', lv.memory + ' · ' + best),
      el('h3', null, TEXTS.newObstacles),
      ul,
      el('h3', null, TEXTS.bossPreview),
      el('div', 'boss-line', boss ? boss.title + '「' + boss.name + '」 · ' + TEXTS.counterLabel + '：' + lv.counterType : '？？？'),
      el('div', 'memo', lv.counterHint || ''),
      el('h3', null, TEXTS.difficulty),
      diffRow,
      diffNote,
      el('h3', null, TEXTS.loadout),
      itemRow,
      el('div', 'memo small', partnerText),
      el('div', 'memo small', TEXTS.controlsShort + ' · 键盘：方向键 / WASD / 空格 · J 反击'),
      row,
    );
    append(wrap, el('div', 'dim'), panel);
    this.root.appendChild(wrap);
    this.prep = wrap;
  }

  diffText(id) {
    const m = DIFFICULTY_MODES[id];
    if (id === 'sweet') return m.name + '：' + m.hearts + ' 颗心 · 障碍间隔更宽 · 预警更早 · 弹幕更慢';
    if (id === 'crazy') return m.name + '：1 颗心 · 弹幕更快 · 金币 ×' + m.coinMul;
    return m.name + '：1 颗心 · 标准节奏';
  }

  go() {
    const g = this.game;
    const lv = this.prepLevel;
    if (!lv) return;
    const used = consumeLoadout(g.save, this.loadoutSel || []);
    g.switchScene('run', { levelId: lv.id, mode: this.mode, loadout: used });
  }

  closePrep() {
    if (this.prep && this.prep.parentNode) this.prep.parentNode.removeChild(this.prep);
    this.prep = null;
    this.prepLevel = null;
  }

  exit() {
    this.prep = null;
    this.prepLevel = null;
  }

  update(dt) {
    const g = this.game;
    g.world.updateDemo(dt);
    while (g.input.next() !== null) {
      /* 选关画面不处理游戏动作 */
    }
    if (g.input.consumeConfirm()) {
      if (this.prep) this.go();
      else {
        // 键盘：打开最新解锁的那一关
        let target = LEVELS[0];
        for (const lv of LEVELS) if (lv.available && g.save.isLevelUnlocked(lv.id)) target = lv;
        this.openPrep(target);
      }
    }
  }

  render() {
    const g = this.game;
    g.world.render(g.screen);
    g.screen.present(0, 0);
    g.screen.endFrame();
  }
}
