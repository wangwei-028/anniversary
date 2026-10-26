import { PlayScene } from './PlayScene.js';
import { BossDirector } from '../systems/bossDirector.js';
import { GameSession } from '../systems/session.js';
import { getRushParams } from '../systems/difficulty.js';
import { settleRush } from '../systems/economy.js';
import { BOSSES } from '../data/bosses.js';
import { BOSS_RULES } from '../data/difficulty.js';
import { RUSH_LEVEL } from '../data/levels.js';
import { SPEED, WORLD } from '../data/constants.js';
import { TEXTS } from '../data/texts.js';
import { el, append, button } from '../systems/ui.js';
import { PK, GOLD_COLORS } from '../systems/particles.js';

/**
 * 隐藏关 Boss Rush「回忆风暴」（5.8）：无跑段，7 只 Boss 按登场顺序连战（吞吞压轴），
 * 两场之间 5 秒星光补给段（地面铺爱心与拾取物，背景切到下一只 Boss 的地图）。
 * - 难度：每只 Boss 用它所在关卡的【疯狂】参数再加压（参数见 data/difficulty.js 的 BOSS_RUSH）；甜蜜玩家改用热恋 -10%
 * - 生命：全程共享 2 心（甜心加点 +1）；补给段最多回 1 心；单场无伤击败 → 金光 + 立刻回 1 心
 * - 失败：直接结束本局（不允许从当前 Boss 重来）；有复活道具 / 复活加点时照常先问要不要原地复活
 */
const SUPPLY_TIME = 5;
const LANE_W = WORLD.laneWidth;

export class BossRushScene extends PlayScene {
  enter() {
    const g = this.game;
    const save = g.save;
    this.sweet = save.data.settings.difficulty === 'sweet';
    const s = new GameSession(RUSH_LEVEL.id, 'standard', save, []);
    s.maxHearts = 2 + (save.upgradeLevel('sweetheart') ? 1 : 0);
    s.hearts = s.maxHearts;
    s.phase = 'boss';
    this.session = s;
    this.banked = false;
    this.idx = 0;
    this.attempt = 1;
    this.noDamage = 0;
    this.elapsed = 0;
    this.state = 'play';
    this.paused = false;
    this.deathT = 0;
    const w = g.world;
    g.useLevel(RUSH_LEVEL.order[0].levelId);
    w.begin(s, this, 'boss');
    w.hidePlayer = false;
    w.targetSpeed = SPEED.boss;
    g.audio.stopMusic();
    g.audio.playMusic('boss');
    this.buildHud();
    this.startBoss(false);
    w.hud.banner('回忆风暴', '7 只 Boss 连战 · 失败即结束 · 共享 ' + s.maxHearts + ' 颗心', 2.6);
  }

  /** Boss Rush 参数：在对应关卡的难度上再加压 */
  rushParams(levelId, k) {
    return getRushParams(levelId, k, this.sweet);
  }

  startBoss(isRetry) {
    const g = this.game;
    const w = this.world;
    const s = this.session;
    const st = RUSH_LEVEL.order[this.idx];
    this.data = BOSSES[st.bossId];
    this.params = this.rushParams(st.levelId, this.idx);
    s.params = this.params;
    w.clearHazards();
    w.fever = false;
    this.director = new BossDirector(w, this.data, this.params, { onDefeated: () => this.onBossDefeated() });
    w.boss = this.director.boss;
    s.snapshotForBoss();
    this.heartsLostAtStart = s.heartsLost;
    this.director.start(isRetry, this.attempt);
    this.phase = 'fight';
    if (!isRetry) w.hud.banner('第 ' + (this.idx + 1) + ' / 7 只', this.data.title + '「' + this.data.name + '」', 1.6);
    g.audio.playMusic('boss');
  }

  onBossDefeated() {
    const w = this.world;
    const s = this.session;
    if (s.heartsLost === this.heartsLostAtStart) {
      // 单场无伤：金光特效 + 立刻回 1 心
      this.noDamage++;
      if (s.hearts < s.maxHearts) s.hearts++;
      w.flashWhite = 0.6;
      w.particles.burst(PK.STAR, w.camera.cx, w.camera.H * 0.45, 30, 120, 1.2, GOLD_COLORS, 40);
      w.hud.pop('无伤击破！+1 心', w.camera.cx, w.camera.H * 0.5, '#ffe066', 12, 1.6);
      this.game.audio.play('shieldGet');
    }
    if (this.idx >= RUSH_LEVEL.order.length - 1) {
      this.finish(true);
      return;
    }
    this.startSupply();
  }

  /** 5 秒星光补给段：爱心（最多 1 颗）+ 金币 + 拾取物，期间背景切到下一只 Boss 的地图 */
  startSupply() {
    const w = this.world;
    const s = this.session;
    this.phase = 'supply';
    this.supplyT = 0;
    this.switched = false;
    w.boss = null;
    w.fever = false;
    const next = BOSSES[RUSH_LEVEL.order[this.idx + 1].bossId];
    w.hud.banner('星光补给', '下一只：' + next.title + '「' + next.name + '」', 2.2);
    if (s.hearts < s.maxHearts) w.spawnPickup('heart', 0, 0.9, 30);
    const extras = ['shield', 'magnet', 'coinRain'];
    w.spawnPickup(extras[Math.floor(Math.random() * extras.length)], (Math.random() < 0.5 ? -1 : 1) * LANE_W, 0.9, 42);
    for (let i = 0; i < 24; i++) {
      const z = 22 + i * 1.6;
      w.spawnCoin(Math.sin(i * 0.4) * LANE_W, 0.9, z);
    }
    this.game.audio.play('fever');
  }

  updateSupply(dt) {
    const g = this.game;
    this.supplyT += dt;
    if (!this.switched && this.supplyT >= SUPPLY_TIME * 0.55) {
      this.switched = true;
      this.world.flashWhite = 0.8;
      g.audio.play('sparkle');
      g.useLevel(RUSH_LEVEL.order[this.idx + 1].levelId);
    }
    if (this.supplyT >= SUPPLY_TIME) {
      this.idx++;
      this.attempt = 1;
      this.startBoss(false);
    }
  }

  update(dtReal) {
    const w = this.world;
    this.updateTapImmediate();
    this.handleInput();
    if (this.paused) return;
    const dt = w.step(dtReal);
    w.targetSpeed = SPEED.boss;
    if (this.state === 'play') {
      this.elapsed += dtReal;
      if (this.phase === 'fight') this.director.update(dt);
      else if (this.phase === 'supply') this.updateSupply(dt);
      if (this.state !== 'play' && this.state !== 'dying') return;
    }
    w.update(dt);
    w.hud.update(dtReal);
    if (this.state === 'dying') this.updateDying(dtReal);
  }

  /** 同 BossScene：完美反击 / 投掷出手的瞬间让点击零延迟生效 */
  updateTapImmediate() {
    const d = this.director;
    const c = d && d.counter;
    this.game.input.tapImmediate =
      this.state === 'play' &&
      this.phase === 'fight' &&
      !!c &&
      d.state === 'stun' &&
      !d.dashArmed &&
      (c.type === 'reflect' || (c.type === 'throw' && d.bar.active));
  }

  acceptInput() {
    return this.state === 'play';
  }

  interceptAction(a, time) {
    return this.phase === 'fight' && this.director.interceptAction(a, time);
  }

  musicName() {
    return 'boss';
  }

  /** 倒下：直接失败结算（复活机会在更早的流程里已经问过了） */
  onDeathFinal() {
    this.state = 'retryMenu';
    const g = this.game;
    const s = this.session;
    const wrap = el('div', 'interactive');
    wrap.style.position = 'absolute';
    wrap.style.inset = '0';
    const panel = el('div', 'panel modal');
    const btns = el('div', 'btns');
    append(
      btns,
      button(g, '查看结算', 'big', () => this.finish(false)),
    );
    append(panel, el('h2', null, TEXTS.bossRetryTitle), el('p', null, 'Boss Rush 失败即结束，不能从当前 Boss 重来'), el('p', null, '进度：第 ' + (this.idx + 1) + ' / 7 只 · 金币 ' + s.coins + '（全额入账）'), btns);
    append(wrap, el('div', 'dim'), panel);
    this.root.appendChild(wrap);
    this.modal = wrap;
    g.input.clear();
  }

  /** 中途退出也结算（金币永不损失） */
  bankCoins() {
    if (this.banked) return;
    this.banked = true;
    settleRush(this.game.save, this.session, false, { time: this.elapsed, noDamage: this.noDamage, reached: this.idx + 1 });
  }

  finish(cleared) {
    if (this.banked) return;
    this.banked = true;
    const g = this.game;
    const s = this.session;
    this.world.hud.flushCoins(s.coins);
    const res = settleRush(g.save, s, cleared, { time: this.elapsed, noDamage: this.noDamage, reached: cleared ? 7 : this.idx + 1 });
    if (cleared) g.switchScene('starry', { rushRes: res, session: s });
    else g.switchScene('result', { rush: res, session: s });
  }

  render() {
    const boss = this.phase === 'fight' && this.director;
    this.renderCommon({
      mode: 'boss',
      bossName: boss ? this.data.title + ' · ' + this.data.name : '星光补给',
      bossHp: boss ? Math.max(0, this.director.hp) : 0,
      bossMaxHp: boss ? BOSS_RULES.hp : 0,
      rushLabel: '回忆风暴 ' + (this.idx + 1) + '/7',
      throwBar: boss ? this.director.bar : null,
    });
  }

  debugHit() {
    if (this.state === 'play' && this.phase === 'fight') this.director.debugHit();
  }

  restart() {
    this.game.switchScene('rush');
  }

  // ---- World 回调 → 当前 Boss 导演 ----
  onReflectHit(h) {
    this.director.onReflectHit(h);
  }

  onCounterMissed(h) {
    this.director.onCounterMissed(h);
  }

  onCounterBonk(h) {
    this.director.onCounterBonk(h);
  }

  onLobLand(h) {
    this.director.onLobLand(h);
  }

  onStomp(h) {
    this.director.onStomp(h);
  }

  onAmmoPickup(it) {
    this.director.onAmmoPickup(it);
  }

  onBunMissed(it) {
    this.director.onBunMissed(it);
  }

  onCounter() {
    if (this.phase === 'fight') this.director.onCounter();
  }

  onSkillCast(cleared) {
    if (this.phase === 'fight') this.director.onSkillCast(cleared);
  }

  debugSkip() {
    if (this.state === 'play' && this.phase === 'fight') {
      this.director.hp = 1;
      this.director.debugHit();
    }
  }
}
