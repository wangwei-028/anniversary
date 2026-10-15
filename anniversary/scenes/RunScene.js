import { PlayScene } from './PlayScene.js';
import { GameSession } from '../systems/session.js';
import { LevelGenerator } from '../systems/levelGenerator.js';
import { SPEED } from '../data/constants.js';
import { TEXTS } from '../data/texts.js';
import { SPRITES } from '../systems/sprites.js';
import { refreshMemoryFrames } from '../systems/spritesHome.js';

/**
 * 局内跑酷段：热身 → 波次×3（波间喘息）→ 冲刺 → 进入 Boss 战（同一个世界无缝衔接）。
 * 1 心制：跑酷段被撞（且没有护盾 / 守护换人 / 复活）即本关失败，已收集金币全额入账。
 * params：{ levelId, mode 难度, loadout 出战道具（已扣库存） }
 */
export class RunScene extends PlayScene {
  enter(params) {
    const g = this.game;
    const levelId = params.levelId || 1;
    const s = new GameSession(levelId, params.mode || g.save.data.settings.difficulty, g.save, params.loadout || []);
    this.session = s;
    this.banked = false;
    const w = g.world;
    g.useLevel(levelId);
    w.begin(s, this, 'run');
    w.hidePlayer = false;
    w.targetSpeed = SPEED.base;
    w.photosSaved = g.save.peekLevel(levelId).photos;
    if (s.level.finale) {
      // 回忆走廊的相框：按存档里 7 关收集到的碎片点亮
      const all = [];
      for (let i = 1; i <= 7; i++) all.push(...g.save.peekLevel(i).photos);
      refreshMemoryFrames(all);
    }
    this.door = null;
    this.gen = new LevelGenerator(w, s.level, s.params, w.photosSaved);
    this.gen.start(s.trackPos, s.speed);
    this.gen.onSection = (sec, idx) => {
      if (idx === 0) w.hud.banner(TEXTS.go_, s.level.name + ' · ' + sec.subtitle, 1.8);
      else w.hud.banner(sec.title, sec.subtitle, 1.8);
      if (sec.kind === 'sprint') g.audio.play('fever');
      if (sec.rain && !w.rain) {
        w.setRain(true);
        w.hud.tip(s.level.rainTip || '下雨了…霓虹灯会闪，判定不变，别慌', 2.8);
      }
    };
    this.state = 'play';
    this.paused = false;
    this.transT = 0;
    this.deathT = 0;
    g.audio.stopMusic();
    g.audio.playMusic(s.level.music);
    this.buildHud();
    if (s.loadout.length) w.hud.tip('携带道具：' + s.loadout.map((id) => g.itemName(id)).join('、'), 2.5);
  }

  update(dtReal) {
    const g = this.game;
    const w = this.world;
    const s = this.session;
    this.handleInput();
    if (this.paused) return;
    const dt = w.step(dtReal);
    if (this.state === 'play') {
      w.targetSpeed = this.gen.targetSpeedAt(this.gen.time);
      if (dt > 0) {
        this.gen.update(dt, s.trackPos, w.speedNow);
        s.runTime += dt;
      }
      if (this.gen.done) {
        this.state = 'toBoss';
        this.transT = 0;
      }
    } else if (this.state === 'toBoss') {
      // Boss 登场前：速度锁定到 12 m/s，等场上障碍跑完
      w.targetSpeed = SPEED.boss;
      this.transT += dt;
      if (s.level.finale) {
        // 最终关：跑到家门口，门被撞开 → 最终 Boss 登场
        if (!this.door && this.transT > 0.6 && !this.hazardsAhead()) this.door = w.spawnDecor(SPRITES.homeDoor, 0, 0, 40);
        if (this.door && this.door.z < 7) {
          w.flashWhite = 0.8;
          w.camera.shake(4);
          g.audio.play('door');
          this.door.active = false;
          g.switchScene('boss', { session: s });
          return;
        }
      } else if (this.transT > 0.6 && !this.hazardsAhead()) {
        g.switchScene('boss', { session: s });
        return;
      }
    } else if (this.state === 'dying') {
      this.updateDying(dtReal);
      if (this.state === 'dead') return;
    }
    w.update(dt);
    w.hud.update(dtReal);
  }

  onDeathFinal() {
    this.game.switchScene('result', { session: this.session, cleared: false, reason: 'run' });
  }

  hazardsAhead() {
    const items = this.world.hazards.items;
    for (let i = 0; i < items.length; i++) {
      const h = items[i];
      if (h.active && h.z + h.len > -1) return true;
    }
    return false;
  }

  render() {
    const boss = this.session.level.bossId;
    this.renderCommon({ mode: 'run', progress: this.gen.progress, bossIcon: SPRITES.bossIcons[boss] });
  }

  /** 调试：跳过跑酷段直接进 Boss */
  debugSkip() {
    if (this.state !== 'play') return;
    this.gen.time = this.gen.total;
    this.world.clearHazards();
  }
}
