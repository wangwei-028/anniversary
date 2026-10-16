import { PLAYER, WORLD } from '../data/constants.js';
import { ACTION } from '../systems/input.js';

/**
 * 主角（女友酱）：三车道移动、跳跃 / 二段跳 / 急降、滑铲、郊狼时间、输入缓冲。
 * 跳跃参数由"滞空 0.6s、顶点 1.6m"反推：重力 g = 8h/T²，起跳速度 v0 = 4h/T。
 */
const GRAVITY = (8 * PLAYER.jumpHeight) / (PLAYER.jumpAirTime * PLAYER.jumpAirTime);
const JUMP_V0 = (4 * PLAYER.jumpHeight) / PLAYER.jumpAirTime;
const RUN_KEYS = ['run0', 'run1', 'run2', 'run3'];
const GHOST_COUNT = 5;

export class Player {
  constructor(world) {
    this.world = world;
    this.ghosts = [];
    for (let i = 0; i < GHOST_COUNT; i++) this.ghosts.push({ x: 0, y: 0, key: 'run0', life: 0 });
    this.ghostIndex = 0;
    this.reset();
  }

  reset() {
    this.lane = 0;
    this.prevLane = 0;
    this.x = 0;
    this.fromX = 0;
    this.laneT = 1;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.sinceGrounded = 0;
    this.jumpedSinceGround = false;
    this.airJumpsUsed = 0;
    this.sliding = 0;
    this.slideOnLand = false;
    this.fastFall = false;
    this.invincible = 0;
    this.skillInvT = 0; // 技能附带的无敌剩余时间：这段无敌不闪烁（受击无敌才闪）
    this.locked = 0; // 被弹回 / 被砸懵时短暂不能操作（输入会被缓冲）
    this.lockKind = '';
    this.flash = 0;
    this.buffered = null;
    this.bufferedAt = 0;
    this.animTime = 0;
    this.squash = 0;
    this.dead = false;
    this.slipTimer = 0;
    this.ghostTime = 0;
    this.ghostTimer = 0;
    // 动作前的状态（完美闪避判定用）
    this.preX = 0;
    this.preY = 0;
    this.preAir = false;
    this.preSlide = false;
    for (const g of this.ghosts) g.life = 0;
  }

  static laneX(l) {
    return l * WORLD.laneWidth;
  }

  get height() {
    return this.sliding > 0 ? PLAYER.slideHeight : PLAYER.standHeight;
  }

  // ---------------- 输入 ----------------

  /** 收到一个动作：能执行就立刻执行，否则放进输入缓冲（0.15s 内条件满足自动执行） */
  handleAction(a, now) {
    if (a === ACTION.PAUSE) return;
    if (this.tryAction(a)) return;
    if (a !== ACTION.COUNTER && a !== ACTION.SKILL) {
      this.buffered = a;
      this.bufferedAt = now;
    }
  }

  updateBuffer(now) {
    if (!this.buffered) return;
    if (now - this.bufferedAt > PLAYER.inputBuffer) {
      this.buffered = null;
      return;
    }
    if (this.tryAction(this.buffered)) this.buffered = null;
  }

  tryAction(a) {
    if (this.dead) return true;
    if (a === ACTION.COUNTER) {
      this.world.onCounter();
      return true;
    }
    if (a === ACTION.SKILL) {
      this.world.castSkill();
      return true;
    }
    if (this.locked > 0) return false;
    switch (a) {
      case ACTION.LEFT:
        return this.changeLane(-1);
      case ACTION.RIGHT:
        return this.changeLane(1);
      case ACTION.UP:
        return this.jump();
      case ACTION.DOWN:
        return this.slide();
    }
    return true;
  }

  capturePre() {
    this.preX = Player.laneX(this.lane);
    this.preY = this.y;
    this.preAir = !this.grounded;
    this.preSlide = this.sliding > 0;
  }

  changeLane(dir) {
    if (this.slipTimer > 0) dir = -dir;
    const target = this.lane + dir;
    if (target < -1 || target > 1) {
      this.world.onEdgeBump(dir);
      return true;
    }
    this.capturePre();
    this.prevLane = this.lane;
    this.lane = target;
    this.fromX = this.x;
    this.laneT = 0;
    this.world.onPlayerAction('lane');
    return true;
  }

  jump() {
    const coyote = !this.grounded && this.sinceGrounded <= PLAYER.coyoteTime && !this.jumpedSinceGround;
    if (this.grounded || coyote) {
      this.capturePre();
      this.vy = JUMP_V0;
      this.grounded = false;
      this.jumpedSinceGround = true;
      this.sliding = 0;
      this.slideOnLand = false;
      this.fastFall = false;
      this.airJumpsUsed = 0;
      this.squash = -1;
      this.world.onPlayerAction(coyote ? 'coyoteJump' : 'jump');
      return true;
    }
    if (this.world.canDoubleJump() && this.airJumpsUsed < 1) {
      this.capturePre();
      this.vy = JUMP_V0 * PLAYER.doubleJumpRatio;
      this.airJumpsUsed++;
      this.slideOnLand = false;
      this.fastFall = false;
      this.squash = -1;
      this.world.onPlayerAction('doubleJump');
      return true;
    }
    return false;
  }

  slide() {
    this.capturePre();
    if (!this.grounded) {
      // 空中下滑 = 急降，落地自动滑铲
      this.vy = Math.min(this.vy, -PLAYER.fastFallSpeed);
      this.slideOnLand = true;
      this.fastFall = true;
      this.world.onPlayerAction('fastFall');
      return true;
    }
    this.sliding = PLAYER.slideDuration;
    this.world.onPlayerAction('slide');
    return true;
  }

  // ---------------- 状态变化 ----------------

  /** 侧面擦碰：弹回原车道 */
  bump(awayDir) {
    let back = this.prevLane;
    if (back === this.lane) back = Math.max(-1, Math.min(1, this.lane + awayDir));
    this.prevLane = this.lane;
    this.lane = back;
    this.fromX = this.x;
    this.laneT = 0;
    this.locked = PLAYER.sideBumpTime;
    this.lockKind = 'bump';
    this.flash = 0.08;
  }

  /** 被还击礼盒砸懵（不扣心） */
  stagger(time) {
    this.locked = time;
    this.lockKind = 'stagger';
    this.flash = 0.12;
    if (this.grounded) {
      this.vy = 5;
      this.grounded = false;
      this.jumpedSinceGround = true;
    }
  }

  die() {
    this.dead = true;
    this.sliding = 0;
    this.vy = 7;
    this.grounded = false;
    this.flash = 0.15;
  }

  revive() {
    this.dead = false;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.sliding = 0;
    this.locked = 0;
    this.lockKind = '';
    this.slipTimer = 0;
    this.flash = 0.2;
  }

  /** 踩到动物便便：一小段时间内左右颠倒 */
  slip(time) {
    this.slipTimer = time;
    this.flash = 0.1;
  }

  /** 踩到跳板：强制高弹跳（滞空 airTime 秒） */
  springLaunch(airTime) {
    this.vy = (GRAVITY * airTime) / 2;
    this.grounded = false;
    this.jumpedSinceGround = true;
    this.sliding = 0;
    this.slideOnLand = false;
    this.airJumpsUsed = 0;
    this.squash = -1;
  }

  startGhosts(duration) {
    this.ghostTime = duration;
    this.ghostTimer = 0;
  }

  // ---------------- 每帧更新 ----------------

  update(dt, groundY) {
    this.animTime += dt;

    // 变道插值（缓出曲线，前快后稳）
    const tx = Player.laneX(this.lane);
    if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dt / PLAYER.laneChangeTime);
      const t = 1 - (1 - this.laneT) * (1 - this.laneT);
      this.x = this.fromX + (tx - this.fromX) * t;
    } else {
      this.x = tx;
    }

    // 竖直方向
    if (this.grounded) {
      if (groundY < this.y - 0.02) {
        // 走下了购物车顶 → 腾空，开始计郊狼时间
        this.grounded = false;
        this.sinceGrounded = 0;
        this.jumpedSinceGround = false;
        this.vy = 0;
      } else {
        this.y = groundY;
      }
    }
    if (!this.grounded) {
      this.sinceGrounded += dt;
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= groundY && this.vy <= 0 && !this.dead) {
        const impact = -this.vy;
        this.y = groundY;
        this.vy = 0;
        this.grounded = true;
        this.airJumpsUsed = 0;
        this.fastFall = false;
        this.squash = Math.min(1, 0.4 + impact / 20);
        this.world.onPlayerLand(impact);
        if (this.slideOnLand) {
          this.slideOnLand = false;
          this.sliding = PLAYER.slideDuration;
          this.world.onPlayerAction('slideLand');
        }
      } else if (this.dead && this.y < -2) {
        this.y = -2;
        this.vy = 0;
      }
    }

    if (this.sliding > 0) this.sliding -= dt;
    if (this.slipTimer > 0) this.slipTimer -= dt;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.skillInvT > 0) this.skillInvT -= dt;
    if (this.locked > 0) this.locked -= dt;
    if (this.flash > 0) this.flash -= dt;
    this.squash *= Math.exp(-12 * dt);

    // 完美闪避残影
    for (const g of this.ghosts) if (g.life > 0) g.life -= dt;
    if (this.ghostTime > 0) {
      this.ghostTime -= dt;
      this.ghostTimer -= dt;
      if (this.ghostTimer <= 0) {
        this.ghostTimer = 0.035;
        const g = this.ghosts[this.ghostIndex];
        this.ghostIndex = (this.ghostIndex + 1) % GHOST_COUNT;
        g.x = this.x;
        g.y = this.y;
        g.key = this.frameKey();
        g.life = 0.22;
      }
    }
  }

  frameKey() {
    if (this.dead) return 'hit';
    if (this.locked > 0 && this.lockKind) return 'hit';
    if (this.sliding > 0) return 'slide';
    if (!this.grounded) return this.vy > 1.5 ? 'jump' : 'fall';
    const fps = 7 + this.world.speedNow * 0.45;
    return RUN_KEYS[Math.floor(this.animTime * fps) & 3];
  }
}
