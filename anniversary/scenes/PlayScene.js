import { ACTION } from '../systems/input.js';
import { TEXTS } from '../data/texts.js';
import { el, append, button } from '../systems/ui.js';
import { settleLevel } from '../systems/economy.js';

/**
 * 局内场景的公共部分（跑酷段 RunScene / Boss 战 BossScene 共用）：
 * 输入分发、暂停菜单、画面合成（世界 → 放大 → HUD）、World 回调的默认实现。
 */
export class PlayScene {
  constructor(game) {
    this.game = game;
    this.paused = false;
    this.root = null;
    this.modal = null;
    this.state = 'play';
    this.session = null;
  }

  get world() {
    return this.game.world;
  }

  buildHud() {
    const root = el('div', 'scene-root');
    const pb = el('button', 'icon-btn hud-pause interactive', 'Ⅱ');
    pb.type = 'button';
    pb.setAttribute('aria-label', '暂停');
    pb.addEventListener('click', (e) => {
      e.stopPropagation();
      this.game.audio.unlock();
      this.pause();
    });
    root.appendChild(pb);
    this.game.ui.appendChild(root);
    this.root = root;
  }

  exit() {
    this.paused = false;
    this.modal = null;
    this.root = null;
  }

  /** 正在游戏中时才响应操作 */
  acceptInput() {
    return this.state === 'play' || this.state === 'toBoss';
  }

  handleInput() {
    const input = this.game.input;
    let a;
    while ((a = input.next()) !== null) {
      if (a === ACTION.PAUSE) {
        if (this.paused) this.resume();
        else this.pause();
        continue;
      }
      if (this.paused || !this.acceptInput()) continue;
      if (this.interceptAction(a, input.lastTime)) continue;
      this.world.player.handleAction(a, input.lastTime);
    }
    if (!this.paused) this.world.player.updateBuffer(performance.now() / 1000);
  }

  pause() {
    if (this.paused || !this.acceptInput()) return;
    this.paused = true;
    this.game.audio.suspend();
    const g = this.game;
    const wrap = el('div', 'interactive');
    wrap.style.position = 'absolute';
    wrap.style.inset = '0';
    const dim = el('div', 'dim');
    const panel = el('div', 'panel modal');
    const btns = el('div', 'btns');
    append(
      btns,
      button(g, TEXTS.resume, 'big', () => this.resume()),
      button(g, TEXTS.restart, 'ghost', () => {
        this.game.audio.resume();
        this.bankCoins();
        this.restart();
      }),
      button(g, TEXTS.quit, 'ghost', () => {
        this.game.audio.resume();
        this.bankCoins();
        g.switchScene('select');
      }),
    );
    append(panel, el('h2', null, TEXTS.pauseTitle), el('p', null, this.session.level.name + ' · 金币 ' + this.session.coins + '（中途退出也会入账）'), btns, el('div', 'hint-keys', TEXTS.pauseKeys));
    append(wrap, dim, panel);
    this.root.appendChild(wrap);
    this.modal = wrap;
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.game.audio.resume();
    if (this.modal && this.modal.parentNode) this.modal.parentNode.removeChild(this.modal);
    this.modal = null;
    this.game.input.clear();
  }

  /** 暂停菜单"重新开始"：默认重开本关跑酷段 */
  restart() {
    this.game.switchScene('run', { levelId: this.session.levelId, mode: this.session.params.mode });
  }

  /** 切到后台自动暂停 */
  onHidden() {
    this.pause();
  }

  renderCommon(opts) {
    const g = this.game;
    const sc = g.screen;
    const w = this.world;
    w.render(sc);
    sc.present(w.camera.shakeX, w.camera.shakeY);
    if (g.debug) opts.debug = g.debugText(this);
    w.hud.render(sc.ctx, sc.W, sc.H, this.session, opts);
    sc.endFrame();
  }

  /** 中途退出 / 重开：已收集的金币和照片碎片照样入账 */
  bankCoins() {
    if (this.banked) return;
    this.banked = true;
    settleLevel(this.game.save, this.session, false);
  }

  /** 倒下之后：有复活次数就问要不要复活，否则走各场景自己的失败流程 */
  onPlayerDeath() {
    this.state = 'dying';
    this.deathT = 1.4;
    this.game.audio.stopMusic();
    setTimeout(() => this.game.audio.play('fail'), 450);
  }

  updateDying(dtReal) {
    this.deathT -= dtReal;
    if (this.deathT > 0) return;
    if (this.session.revives > 0) {
      this.state = 'reviveMenu';
      this.showRevive();
    } else {
      this.state = 'dead';
      this.onDeathFinal();
    }
  }

  showRevive() {
    const g = this.game;
    const wrap = el('div', 'interactive');
    wrap.style.position = 'absolute';
    wrap.style.inset = '0';
    const panel = el('div', 'panel modal');
    const btns = el('div', 'btns');
    append(
      btns,
      button(g, TEXTS.revive + '（剩余 ' + this.session.revives + ' 次）', 'big', () => {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        this.modal = null;
        this.world.revivePlayer();
        this.state = 'play';
        g.input.clear();
        g.audio.playMusic(this.musicName());
      }),
      button(g, TEXTS.reviveGiveUp, 'ghost', () => {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        this.modal = null;
        this.state = 'dead';
        this.onDeathFinal();
      }),
    );
    append(panel, el('h2', null, TEXTS.reviveTitle), el('p', null, TEXTS.reviveDesc), btns);
    append(wrap, el('div', 'dim'), panel);
    this.root.appendChild(wrap);
    this.modal = wrap;
    g.input.clear();
  }

  musicName() {
    return this.session.level.music;
  }

  onDeathFinal() {}

  /** 场景可以先拦下玩家动作（Boss 战的冲刺 / 选落点），返回 true = 不再交给主角 */
  interceptAction() {
    return false;
  }

  // ---- World 回调（默认空实现）----
  onReflectHit() {}
  onCounterMissed() {}
  onCounterBonk() {}
  onLobLand() {}
  onStomp() {}
  onAmmoPickup() {}
  onBunMissed() {}
  onCounter() {}
  onSkillCast() {}
}
