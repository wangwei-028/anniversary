import { PlayScene } from './PlayScene.js';
import { BossDirector } from '../systems/bossDirector.js';
import { BOSSES } from '../data/bosses.js';
import { BOSS_RULES } from '../data/difficulty.js';
import { SPEED } from '../data/constants.js';
import { TEXTS } from '../data/texts.js';
import { el, append, button } from '../systems/ui.js';

/**
 * Boss 战：登场演出（名条 + LOVE FEVER）→ 三阶段弹幕 → 硬直窗口还击（反弹 / 踩跳 / 投掷）→ 击败演出。
 * 失败：可用复活先复活（不消耗重开次数）；否则从 Boss 战开头重开（金币不损失），每关 2 次；
 *       第 3 次失败 = 本关失败（金币仍全额入账）。
 */
export class BossScene extends PlayScene {
  enter(params) {
    const g = this.game;
    const s = params.session;
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
    g.audio.stopMusic();
    g.audio.playMusic(s.level.bossMusic);
    this.buildHud();
  }

  musicName() {
    return this.session.level.bossMusic;
  }

  update(dtReal) {
    const w = this.world;
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
    // 最终关：先播"回家"演出，再结算
    if (this.session.level.finale) this.game.switchScene('ending', { session: this.session });
    else this.game.switchScene('result', { session: this.session, cleared: true });
  }

  showRetry() {
    const g = this.game;
    const s = this.session;
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

  debugHit() {
    if (this.state === 'play') this.director.debugHit();
  }
}
