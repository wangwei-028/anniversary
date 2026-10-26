import { PlayScene } from './PlayScene.js';
import { BossDirector } from '../systems/bossDirector.js';
import { BOSSES } from '../data/bosses.js';
import { BOSS_RULES, DIFFICULTY_MODES } from '../data/difficulty.js';
import { SPEED } from '../data/constants.js';
import { TEXTS } from '../data/texts.js';
import { el, append, button } from '../systems/ui.js';
import { GameSession } from '../systems/session.js';

/**
 * Boss 战：登场演出（名条 + LOVE FEVER）→ 三阶段弹幕 → 硬直窗口还击（反弹 / 踩跳 / 投掷）→ 击败演出。
 * 失败：可用复活先复活（不消耗重开次数）；否则从 Boss 战开头重开（金币不损失），每关 2 次；
 *       第 3 次失败 = 本关失败（金币仍全额入账）。
 * 练习模式（params.practice，来自 Boss 练习场）：无限重试、胜利 / 失败弹练习面板、金币与进度不入账。
 */
export class BossScene extends PlayScene {
  enter(params) {
    const g = this.game;
    const s = params.session;
    this.practice = !!params.practice;
    this.session = s;
    this.banked = false;
    const w = g.world;
    w.listener = this;
    w.mode = 'boss';
    w.hidePlayer = false;
    s.phase = 'boss';
    s.snapshotForBoss();
    s.bossAttempt = 1;
    w.clearHazards();
    w.targetSpeed = SPEED.boss;
    this.data = BOSSES[s.level.bossId];
    this.director = new BossDirector(w, this.data, s.params, { onDefeated: () => this.onDefeated() });
    w.boss = this.director.boss;
    this.director.start(false, 1);
    this.state = 'play';
    this.paused = false;
    this.deathT = 0;
    if (!this.practice) {
      // 练习场解锁条件：主线中遇到过这只 Boss（进过它的 Boss 战，输赢都算）
      const rec = g.save.getLevel(s.levelId);
      if (!rec.bossSeen) {
        rec.bossSeen = true;
        g.save.save();
      }
    }
    g.audio.stopMusic();
    g.audio.playMusic(s.level.bossMusic);
    this.buildHud();
  }

  musicName() {
    return this.session.level.bossMusic;
  }

  update(dtReal) {
    const w = this.world;
    this.updateTapImmediate();
    this.handleInput();
    if (this.paused) return;
    const dt = w.step(dtReal);
    w.targetSpeed = SPEED.boss;
    if (this.state === 'play') {
      this.director.update(dt);
      if (this.state === 'won') return;
    }
    w.update(dt);
    w.hud.update(dtReal);
    if (this.state === 'dying') this.updateDying(dtReal);
  }

  /**
   * 完美反击（金圈拍击）与投掷（红区出手）是"点屏幕"判定且窗口只有零点几秒：
   * 这两种时刻让点击在按下瞬间生效，消除"等松手"的输入延迟。
   * 冲刺 / 选落点 / 捡菠萝油还需要滑动变道，保持原来的松手判定。
   */
  updateTapImmediate() {
    const d = this.director;
    const c = d && d.counter;
    this.game.input.tapImmediate =
      this.state === 'play' &&
      !!c &&
      d.state === 'stun' &&
      !d.dashArmed &&
      (c.type === 'reflect' || (c.type === 'throw' && d.bar.active));
  }

  onDeathFinal() {
    this.state = 'retryMenu';
    this.showRetry();
  }

  render() {
    this.renderCommon({
      mode: 'boss',
      bossName: this.data.title + ' · ' + this.data.name,
      bossHp: Math.max(0, this.director.hp),
      bossMaxHp: BOSS_RULES.hp,
      attempt: this.session.bossAttempt,
      maxAttempts: 1 + BOSS_RULES.retriesPerLevel,
      throwBar: this.director.bar,
    });
  }

  acceptInput() {
    return this.state === 'play';
  }

  // ---- World 回调 → Boss 导演 ----
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

  /** J / 点击：投掷型还击的出手键；其他还击方式下提醒正确做法 */
  onCounter() {
    this.director.onCounter();
  }

  /** 双击 / L：技能「回忆闪光」（硬直窗口内释放会放宽反击判定） */
  onSkillCast(cleared) {
    this.director.onSkillCast(cleared);
  }

  interceptAction(a, time) {
    return this.director.interceptAction(a, time);
  }

  onDefeated() {
    this.state = 'won';
    if (this.practice) {
      this.showPracticePanel(true);
      return;
    }
    // 最终关：先播"回家"演出，再结算
    if (this.session.level.finale) this.game.switchScene('ending', { session: this.session });
    else this.game.switchScene('result', { session: this.session, cleared: true });
  }

  showRetry() {
    const g = this.game;
    const s = this.session;
    if (this.practice) {
      this.showPracticePanel(false);
      return;
    }
    if (s.bossRetriesLeft <= 0) {
      g.switchScene('result', { session: s, cleared: false, reason: 'boss' });
      return;
    }
    const wrap = el('div', 'interactive');
    wrap.style.position = 'absolute';
    wrap.style.inset = '0';
    const panel = el('div', 'panel modal');
    const chances = el('p', 'chances');
    chances.appendChild(document.createTextNode(TEXTS.chancesLeft + '  '));
    for (let i = 0; i < BOSS_RULES.retriesPerLevel; i++) {
      chances.appendChild(el('span', i < s.bossRetriesLeft ? 'heart-on' : 'heart-off', '♥'));
    }
    const btns = el('div', 'btns');
    append(
      btns,
      button(g, TEXTS.bossRetry, 'big', () => this.retry()),
      button(g, TEXTS.giveUp, 'ghost', () => g.switchScene('result', { session: s, cleared: false, reason: 'giveup' })),
    );
    append(panel, el('h2', null, TEXTS.bossRetryTitle), el('p', null, TEXTS.bossRetryDesc), el('p', null, '目前金币：' + s.coins), chances, btns);
    append(wrap, el('div', 'dim'), panel);
    this.root.appendChild(wrap);
    this.modal = wrap;
    g.input.clear();
  }

  /** 从 Boss 战开头重来：恢复进入 Boss 战时的状态，金币保留 */
  retry() {
    const g = this.game;
    const s = this.session;
    const w = this.world;
    if (this.modal && this.modal.parentNode) this.modal.parentNode.removeChild(this.modal);
    this.modal = null;
    s.bossRetriesLeft--;
    s.bossAttempt++;
    s.restoreBossSnapshot();
    w.clearHazards();
    w.player.reset();
    w.particles.clear();
    w.fever = false;
    w.slowmo = 0;
    w.hitStop = 0;
    w.bulletTime = 0;
    w.swapT = 1;
    w.hud.reset(s.coins);
    this.director.start(true, s.bossAttempt);
    this.state = 'play';
    g.input.clear();
    g.audio.stopMusic();
    g.audio.playMusic(s.level.bossMusic);
  }

  // ---------------- 练习模式（Boss 练习场） ----------------

  /** 练习结束面板（胜利 / 倒下共用）：无限次再战，随时回练习场 */
  showPracticePanel(won) {
    const g = this.game;
    const wrap = el('div', 'interactive');
    wrap.style.position = 'absolute';
    wrap.style.inset = '0';
    const panel = el('div', 'panel modal');
    const btns = el('div', 'btns');
    append(
      btns,
      button(g, won ? '再练一次' : '再战一次', 'big', () => this.restartPractice()),
      button(g, '返回练习场', 'ghost', () => g.switchScene('practice')),
    );
    append(panel, el('h2', null, won ? '胜利！' : '差一点！'), el('p', null, (won ? '击败了 ' : '被 ') + this.data.title + ' ' + this.data.name + (won ? '！' : ' 拿下了，再来！') + '（练习不影响主线进度）'), btns);
    append(wrap, el('div', 'dim'), panel);
    this.root.appendChild(wrap);
    this.modal = wrap;
    g.input.clear();
  }

  /** 练习重开：用和主线一致的能力重新构建一局（满状态从头打） */
  restartPractice() {
    const g = this.game;
    const dif = g.save.data.settings.difficulty;
    const mode = DIFFICULTY_MODES[dif] ? dif : 'standard';
    g.switchScene('boss', { session: new GameSession(this.session.levelId, mode, g.save, []), practice: true });
  }

  /** 练习不入账：金币 / 通关 / 存档进度都不动 */
  bankCoins() {
    if (this.practice) {
      this.banked = true;
      return;
    }
    super.bankCoins();
  }

  pauseInfo() {
    return this.practice ? 'Boss 练习场 · 金币与进度不会保存' : super.pauseInfo();
  }

  menuRestart() {
    if (!this.practice) {
      super.menuRestart();
      return;
    }
    this.game.audio.resume();
    this.restartPractice();
  }

  menuQuit() {
    if (!this.practice) {
      super.menuQuit();
      return;
    }
    this.game.audio.resume();
    this.game.switchScene('practice');
  }

  debugHit() {
    if (this.state === 'play') this.director.debugHit();
  }
}
