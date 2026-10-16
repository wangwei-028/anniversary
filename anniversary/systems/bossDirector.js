import { BOSS_RULES } from '../data/difficulty.js';
import { WORLD, SKILL, JUICE } from '../data/constants.js';
import { TEXTS } from '../data/texts.js';
import { ECONOMY } from '../data/economy.js';
import { bossSpeedMul, bossInterval } from './difficulty.js';
import { PK, CONFETTI_COLORS, GOLD_COLORS, PINK_COLORS } from './particles.js';
import { ATTACKS, PENDING } from './bossAttacks.js';

/**
 * Boss 导演：按 data/bosses.js 驱动 Boss 战（6.1 结构）。
 * 状态：intro 登场 → waves 弹幕波 → clearing 等场上清空 → stun 硬直窗口（还击） →
 *       countering 还击物飞向 Boss / 踩跳中 → hurt 受伤 → 下一阶段 … → defeat 击败演出
 *       硬直窗口内没打中 → recover 缓过来 → 从本阶段第 2 波重来
 * 还击方式（6.2）：reflect 完美反击（J/点击拍击）/ stomp 踩跳（金刚）/ throw 投掷（波哥）/ dash 冲刺（木木）
 * 组合技（P1）：wave.spawns 里可写 { combo: [子攻击, …] }——组内弹幕故意同时到达，
 *       conflictDelay 不在组内避让（例如"低空券(跳) + 左右红圈(站中道)"= 跳的同时换道）。
 *       子攻击可用 delay 字段做成节拍链（如 跳 → 0.55s → 铲）。
 */
const LANE_W = WORLD.laneWidth;
const SEQUENCE_TYPES = new Set(['beatWave', 'bunTriple', 'ballBounce']);

export class BossDirector {
  constructor(world, data, params, callbacks) {
    this.world = world;
    this.data = data;
    this.params = params;
    this.cb = callbacks;
    this.boss = {
      visible: false,
      sprite: data.sprite,
      x: 0,
      y: data.hoverY,
      z: data.z,
      targetX: 0,
      expr: 'normal',
      flash: 0,
      scale: 1,
      sx: 1,
      sy: 1,
      alpha: 1,
      stunned: false,
      screenX: 0,
      screenY: 0,
      screenTop: 0,
    };
    this.spawners = [];
    for (let i = 0; i < 4; i++) this.spawners.push({ active: false, spec: null, next: 0, seq: 0, booking: null });
    // 延时生成队列（先亮红道预警，再发射）
    this.pending = [];
    for (let i = 0; i < 24; i++) this.pending.push({ active: false, at: 0, type: '', lane: 0, lanes: 1, speedMul: 1, key: '' });
    // 组合技成员的延时发射（delay 字段）
    this.delayed = [];
    for (let i = 0; i < 8; i++) this.delayed.push({ active: false, at: 0, spec: null, sp: null });
    // 已发射弹幕的"威胁时间窗"（导演时间），用来错开不同种类的攻击
    this.threats = [];
    for (let i = 0; i < 16; i++) this.threats.push({ active: false, booked: false, type: '', t0: 0, t1: 0 });
    // 投掷型还击的蓄力条
    this.bar = { active: false, t: 0, needle: 0, zoneStart: 0.66, zoneWidth: 0.2, result: '', resultT: 0 };
    this.state = 'idle';
    this.t = 0;
    this.hp = BOSS_RULES.hp;
    this.phaseIndex = 0;
    this.waveIndex = 0;
    this.waveT = 0;
    this.stunTime = 0;
    this.giftTimer = 0;
    this.giftInFlight = null; // 场上的还击物（礼盒 / 金桶 / 菠萝油）
    this.isRetry = false;
    this.flags = {};
    this.lastFreeLane = 0;
    this.time = 0;
    // 当前生效的还击配置（混合型每个阶段换一种）
    this.curCounter = null;
    this.mixOrder = [];
    this.stunClock = 0;
    // 完美反击：挥空后的短冷却（防连点蹭判定）
    this.counterCd = 0;
    // 车道封锁（跑道塌陷 / 触手）：封锁期间"空道/随机道"类攻击避开这条道
    this.lockLane = null;
    this.lockLaneT = 0;
    // 冲刺型还击：Boss 跪在 dashLane；第一下方向键先扣住 0.3s 等第二下
    this.dashArmed = false;
    this.dashLane = 0;
    this.held = null;
    this.heldTime = 0;
    this.lastLaneKey = '';
    this.lastLaneTime = -9;
    // 反弹进阶：选落点
    this.aimLane = 0;
    this.aimT = 0;
  }

  get counter() {
    return this.curCounter || this.data.counter;
  }

  get hud() {
    return this.world.hud;
  }

  get audio() {
    return this.world.audio;
  }

  start(isRetry, attempt) {
    this.isRetry = isRetry;
    this.attempt = attempt;
    this.state = 'intro';
    this.t = 0;
    this.hp = BOSS_RULES.hp;
    this.phaseIndex = 0;
    this.giftInFlight = null;
    this.bar.active = false;
    this.flags = {};
    for (const s of this.spawners) s.active = false;
    for (const p of this.pending) p.active = false;
    for (const th of this.threats) th.active = false;
    this.curCounter = null;
    this.disarmDash();
    this.counterCd = 0;
    this.lockLane = null;
    this.lockLaneT = 0;
    this.world.sandTarget = 0;
    this.world.aimLane = null;
    this.world.reflectWindow = 0;
    for (const d of this.delayed) d.active = false;
    if (this.data.counter.type === 'mixed') {
      const keys = Object.keys(this.data.counter.variants);
      for (let i = keys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = keys[i];
        keys[i] = keys[j];
        keys[j] = tmp;
      }
      this.mixOrder = keys;
    }
    const b = this.boss;
    b.visible = true;
    b.x = 0;
    b.targetX = 0;
    b.y = this.hoverY() + 16;
    b.z = this.data.z;
    b.expr = 'normal';
    b.flash = 0;
    b.scale = 1;
    b.sx = 1;
    b.sy = 1;
    b.alpha = 1;
    b.stunned = false;
    this.audio.play('bossAppear');
    if (isRetry) this.hud.banner('第 ' + attempt + ' 次挑战', '金币一枚都没少，加油！', 1.4);
  }

  // ------------------------------------------------------------
  update(dt) {
    this.t += dt;
    this.time += dt;
    const b = this.boss;
    if (b.flash > 0) b.flash -= dt;
    b.sx += (1 - b.sx) * Math.min(1, dt * 10);
    b.sy += (1 - b.sy) * Math.min(1, dt * 10);
    if (this.state !== 'intro' && this.state !== 'defeat') {
      const low = this.state === 'countering' || this.dashArmed;
      if (this.data.grounded) {
        // 地面 Boss：边跑边蹦，被踩完退回原位；冲刺型还击时跪到近处
        b.y = this.dashArmed ? 0 : Math.abs(Math.sin(this.time * 7)) * 0.25;
        const zt = this.dashArmed ? this.counter.kneelZ : this.data.z;
        if (this.state !== 'countering') b.z += (zt - b.z) * Math.min(1, dt * 3);
      } else {
        // 悬浮晃动；还击时落到低处
        const hy = low ? 1 : this.hoverY() + Math.sin(this.time * 2.2) * 0.35;
        b.y += (hy - b.y) * Math.min(1, dt * 6);
        if (this.state !== 'countering') {
          const zt = this.dashArmed ? this.counter.kneelZ : this.data.z;
          b.z += (zt - b.z) * Math.min(1, dt * 3);
        }
      }
      const dx = b.targetX - b.x;
      const step = this.data.moveSpeed * dt;
      b.x += Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
    }
    this.updatePending(dt);
    this.updateDelayed(dt);
    this.updateBar(dt);
    if (this.counterCd > 0) this.counterCd -= dt;
    if (this.lockLaneT > 0) {
      this.lockLaneT -= dt;
      if (this.lockLaneT <= 0) this.lockLane = null;
    }

    switch (this.state) {
      case 'intro':
        this.updateIntro(dt);
        break;
      case 'waves':
        this.updateWaves(dt);
        break;
      case 'clearing':
        if (!this.anyBullets() || this.t > 3.5) this.enterStun();
        break;
      case 'stun':
        this.updateStun(dt);
        break;
      case 'countering':
        this.updateCountering(dt);
        break;
      case 'hurt':
        if (this.t >= this.data.hurtTime) {
          if (this.hp <= 0) this.enterDefeat();
          else this.startPhase(this.phaseIndex + 1, 0);
        }
        break;
      case 'recover':
        if (this.t >= this.data.stunRecoverTime) this.startPhase(this.phaseIndex, 1);
        break;
      case 'aiming':
        this.aimT += dt;
        if (this.aimT >= this.counter.aimTime) this.resolveAim(this.world.player.lane);
        break;
      case 'defeat':
        this.updateDefeat(dt);
        break;
    }
  }

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  /** 悬停高度：矮屏幕上自动压低，保证 Boss 头顶不压到顶部 HUD（缓冲像素 y ≥ 46） */
  hoverY() {
    if (this.data.grounded) return 0;
    const cam = this.world.camera;
    const ps = cam.focal / (this.data.z + cam.back);
    const spriteH = 62;
    const maxY = cam.height - (46 + spriteH - cam.hz) / ps;
    return Math.max(1.5, Math.min(this.data.hoverY, maxY));
  }

  // ---------------- 登场演出（6.4） ----------------
  updateIntro() {
    const b = this.boss;
    const dur = this.isRetry ? BOSS_RULES.retryIntroDuration : BOSS_RULES.introDuration;
    const dropT = 0.55;
    const hy = this.hoverY();
    if (this.t < dropT) {
      const k = this.t / dropT;
      b.y = hy + 16 * (1 - k * k);
    } else if (!this.flags.landed) {
      this.flags.landed = true;
      b.y = hy;
      b.sx = 1.25;
      b.sy = 0.75;
      this.world.camera.shake(JUICE.shakeBossLand);
      this.audio.play('bossLand');
      if (b.screenX) this.world.particles.burst(PK.CONFETTI, b.screenX, b.screenY + 20, 24, 90, 0.9, CONFETTI_COLORS, 120);
    }
    // Boss 名条压屏
    if (!this.isRetry && this.t >= 0.45 && !this.flags.name) {
      this.flags.name = true;
      this.hud.showNameCard(this.data.name, this.data.title, 1.15);
      this.audio.play('bump', 0.6);
    }
    // 约 1.5s 后：LOVE FEVER!!
    const feverAt = this.isRetry ? 0.55 : 1.5;
    if (this.t >= feverAt && !this.flags.fever) {
      this.flags.fever = true;
      this.hud.showFever(this.isRetry ? 0.9 : 1.4);
      this.world.fever = true;
      this.world.flashWhite = 0.35;
      this.audio.play('fever');
      this.audio.play('heartbeat');
      this.world.particles.burst(PK.HEART, this.world.camera.cx, this.world.camera.H * 0.4, 24, 110, 1.1, PINK_COLORS, 30);
    }
    if (this.t >= feverAt + 0.42 && !this.flags.beat2) {
      this.flags.beat2 = true;
      this.audio.play('heartbeat', 1.1);
    }
    if (this.t >= dur) this.startPhase(0, 0);
  }

  // ---------------- 弹幕波 ----------------
  startPhase(i, fromWave) {
    this.phaseIndex = i;
    // Boss Rush：跳过每个阶段最温和的第 1 波
    this.waveIndex = Math.max(fromWave, this.params.skipWaves || 0);
    const ph = this.data.phases[i];
    this.boss.expr = ph.expression;
    this.boss.stunned = false;
    this.world.sandTarget = ph.sand ? 1 : 0;
    this.setState('waves');
    this.setupWave(-0.9);
    this.hud.banner(TEXTS.phaseLabel + ' ' + (i + 1) + ' · ' + ph.name, ph.hint, 2.2);
    if (!this.flags['tip' + i] && fromWave === 0) {
      this.flags['tip' + i] = true;
      this.hud.tip(ph.hint, 3.2);
    }
  }

  setupWave(startT) {
    this.waveT = startT;
    const wave = this.data.phases[this.phaseIndex].waves[this.waveIndex];
    for (const th of this.threats) if (th.booked) th.active = false;
    for (let i = 0; i < this.spawners.length; i++) {
      const sp = this.spawners[i];
      const spec = wave.spawns[i];
      sp.active = !!spec;
      sp.spec = spec || null;
      sp.next = spec ? spec.offset || 0 : 0;
      sp.seq = 0;
      sp.booking = null;
    }
  }

  updateWaves(dt) {
    this.waveT += dt;
    const dur = this.data.waveDuration;
    if (this.waveT >= 0 && this.waveT < dur) {
      for (let i = 0; i < this.spawners.length; i++) {
        const sp = this.spawners[i];
        if (!sp.active) continue;
        if (this.waveT >= sp.next) {
          if (sp.booking) {
            sp.booking.active = false;
            sp.booking = null;
          } else {
            const wait = this.conflictDelaySpec(sp.spec);
            if (wait > 0) {
              // 推迟并先占住时间段，其他种类反过来让它（避免某种攻击一直被挤掉）
              sp.next = this.waveT + wait;
              sp.booking = this.reserveThreatSpec(sp.spec, wait, true);
              continue;
            }
          }
          this.fire(sp);
          this.reserveThreatSpec(sp.spec, 0, false);
          sp.next += bossInterval(this.params, sp.spec.every, this.phaseIndex);
        }
      }
    }
    if (this.waveT >= dur) {
      const waves = this.data.phases[this.phaseIndex].waves;
      if (this.waveIndex < waves.length - 1) {
        this.waveIndex++;
        this.setupWave(-Math.max(0.3, this.data.waveGap + (this.params.waveGapAdd || 0)));
      } else {
        this.setState('clearing');
      }
    }
  }

  /** 组合技 = 一个发射单位：组内所有成员的威胁窗都要检查冲突，取最大推迟量（整组一起挪） */
  conflictDelaySpec(spec) {
    if (!spec.combo) return this.conflictDelayOne(spec);
    let d = 0;
    for (const sub of spec.combo) d = Math.max(d, this.conflictDelayOne(sub));
    return d;
  }

  reserveThreatSpec(spec, delay, booked) {
    if (!spec.combo) return this.reserveThreatOne(spec, delay, booked);
    let last = null;
    for (const sub of spec.combo) last = this.reserveThreatOne(sub, delay + (sub.delay || 0), booked) || last;
    return last;
  }

  /** 如果现在发射 spec，它威胁主角的时间段 [开始, 结束]（秒，相对现在）；不认识的类型返回 null */
  threatWindow(spec) {
    const type = typeof spec === 'string' ? spec : spec.type;
    const b = this.data.bullets;
    const m = this.speedMul();
    const warn = this.params.warning;
    const travel = (c) => (this.data.z - 1) / (c.speed * m);
    const lobT = (c) => Math.max(warn + 0.3, c.flightTime / m);
    switch (type) {
      case 'milkTea':
      case 'cartSweep': {
        const c = b[type];
        const t = warn + c.telegraphExtra + travel(c);
        return [t - 0.2, t + 0.3];
      }
      case 'wokWave':
      case 'barrel':
      case 'couponWall': {
        const t = travel(b[type]);
        return [t - 0.2, t + 0.3];
      }
      case 'band': {
        const c = b[typeof spec === 'object' && spec.bullet ? spec.bullet : 'band'];
        if (!c) return null;
        return [travel(c) - 0.2, travel(c) + 0.3];
      }
      case 'bananaCarpet': {
        const c = b.bananaCarpet;
        const t = warn + c.telegraphExtra + travel(c);
        return [t - 0.3, t + Math.max(c.springAir, (c.springAhead + c.length) / (c.speed * m)) + 0.1];
      }
      case 'bananaLob': {
        const T = lobT(b.bananaLob);
        return [T - 0.2, T + 0.2];
      }
      case 'bunTriple': {
        const c = b.bunTriple;
        const T = lobT(c);
        return [T - 0.2, T + (c.count - 1) * c.gap + 0.2];
      }
      case 'blindBox': {
        const c = b[type];
        const t = Math.max(warn, c.flightTime / m) + c.landZ / (c.confettiSpeed * m);
        return [t - 0.2, t + 0.3];
      }
    }
    const atk = ATTACKS[type];
    return atk && atk.threat ? atk.threat(this, spec) : null;
  }

  /** 和已发射的其他种类攻击冲突时，需要推迟多少秒再发射（0 = 可以直接发）
   *  连击型攻击（木鱼三连波 / 菠萝油三连 / 弹珠）也不和自己重叠，否则节拍会乱成一团
   *  组合技（combo）的成员之间不避让 —— 那是故意叠在一起的 */
  conflictDelayOne(spec) {
    if (this.data.stagger === false) return 0;
    const type = typeof spec === 'string' ? spec : spec.type;
    const w = this.threatWindow(spec);
    if (!w) return 0;
    const gap = this.params.mixedGap || BOSS_RULES.mixedGap;
    const selfToo = SEQUENCE_TYPES.has(type);
    const now = this.time;
    let delay = 0;
    for (let iter = 0; iter < 4; iter++) {
      let moved = false;
      for (const th of this.threats) {
        if (!th.active || (th.type === type && !selfToo)) continue;
        const a = now + delay + w[0];
        const z = now + delay + w[1];
        if (a < th.t1 + gap && z > th.t0 - gap) {
          delay += th.t1 + gap - a;
          moved = true;
        }
      }
      if (!moved) break;
    }
    return delay;
  }

  reserveThreatOne(spec, delay, booked) {
    const type = typeof spec === 'string' ? spec : spec.type;
    const w = this.threatWindow(spec);
    if (!w) return null;
    const now = this.time + delay;
    let slot = null;
    for (const th of this.threats) {
      if (th.active && th.t1 < this.time) th.active = false;
      if (!th.active && !slot) slot = th;
    }
    if (!slot) return null;
    slot.active = true;
    slot.booked = booked;
    slot.type = type;
    slot.t0 = now + w[0];
    slot.t1 = now + w[1];
    return slot;
  }

  anyBullets() {
    const items = this.world.hazards.items;
    for (let i = 0; i < items.length; i++) {
      const h = items[i];
      if (h.active && !h.passed) return true;
    }
    for (const p of this.pending) if (p.active) return true;
    return false;
  }

  speedMul() {
    return bossSpeedMul(this.params, this.phaseIndex);
  }

  fire(sp) {
    const spec = sp.spec;
    if (spec.combo) {
      // 组合技：组内成员同时（或按 delay 节拍）到达，冲突检查不在组内避让
      for (const sub of spec.combo) {
        if (sub.delay) {
          this.scheduleDelayed(sub, sp);
          this.reserveThreatOne(sub, sub.delay, true);
        } else {
          this.fireSub(sub, sp);
        }
      }
    } else {
      this.fireSub(spec, sp);
    }
    this.boss.sy = 0.85;
    this.boss.sx = 1.12;
  }

  /** 组合技成员的延时发射（节拍链：delay 秒后再发） */
  scheduleDelayed(sub, sp) {
    for (const d of this.delayed) {
      if (!d.active) {
        d.active = true;
        d.at = sub.delay;
        d.spec = sub;
        d.sp = sp;
        return;
      }
    }
  }

  updateDelayed(dt) {
    for (const d of this.delayed) {
      if (!d.active) continue;
      d.at -= dt;
      if (d.at > 0) continue;
      d.active = false;
      if (this.state === 'defeat' || this.state === 'intro') continue;
      this.fireSub(d.spec, d.sp);
    }
  }

  fireSub(spec, sp) {
    switch (spec.type) {
      case 'blindBox':
        this.fireBlindBox(spec);
        break;
      case 'cartSweep':
        this.fireCartSweep(spec);
        break;
      case 'couponWall':
        this.fireCoupon(spec, sp);
        break;
      case 'band':
        this.fireBand(spec, sp);
        break;
      case 'barrel':
        this.fireBarrel(spec);
        break;
      case 'bananaCarpet':
        this.fireCarpet('bananaCarpet');
        break;
      case 'bananaLob':
        this.fireLob('banana', this.pickLane(spec.lane), this.data.bullets.bananaLob);
        break;
      case 'milkTea':
        this.fireMilkTea();
        break;
      case 'bunTriple':
        this.fireBunTriple();
        break;
      case 'wokWave':
        this.fireWok();
        break;
      default: {
        const atk = ATTACKS[spec.type];
        if (atk) atk.fire(this, spec, sp);
      }
    }
  }

  pickLane(mode) {
    const pl = this.world.player.lane;
    if (mode === 'player') return pl;
    if (mode === 'others') {
      const opts = pl === -1 ? [0, 1] : pl === 1 ? [-1, 0] : [-1, 1];
      const filtered = this.lockLane !== null ? opts.filter((l) => l !== this.lockLane) : opts;
      const use = filtered.length ? filtered : opts;
      return use[Math.floor(Math.random() * use.length)];
    }
    const all = this.lockLane !== null ? [-1, 0, 1].filter((l) => l !== this.lockLane) : [-1, 0, 1];
    return all[Math.floor(Math.random() * all.length)];
  }

  /** 选一条安全道（尽量不和上次一样逼玩家移动；车道封锁期间也不选被锁的道） */
  pickFreeLane() {
    let free = Math.floor(Math.random() * 3) - 1;
    if (free === this.lastFreeLane && Math.random() < 0.7) free = ((free + 2 + Math.floor(Math.random() * 2)) % 3) - 1;
    if (this.lockLane !== null && free === this.lockLane) {
      const opts = [-1, 0, 1].filter((l) => l !== this.lockLane);
      free = opts[Math.floor(Math.random() * opts.length)];
    }
    this.lastFreeLane = free;
    return free;
  }

  fireBlindBox(spec) {
    const cfg = this.data.bullets.blindBox;
    const lane = this.pickLane(spec.lane);
    const b = this.boss;
    b.targetX = lane * LANE_W;
    const m = this.speedMul();
    const h = this.world.spawnBullet('blindBox', 'none');
    h.behavior = 'lob';
    h.x0 = b.x;
    h.y0 = b.y + 1.5;
    h.z0 = b.z - 1;
    h.x1 = lane * LANE_W;
    h.z1 = cfg.landZ;
    h.x = h.x1;
    h.z = h.z1;
    h.len = 0.1;
    h.T = Math.max(this.params.warning, cfg.flightTime / m);
    h.arcH = cfg.arcHeight;
    h.fan = spec.fan;
    h.cfg = cfg;
    h.speedMul = m;
    this.audio.play('throw');
  }

  /** 盲盒落地 → 扇形彩纸地波（跳过）；章鱼烧弹珠落地 → 弹到旁边的道 */
  onLobLand(h) {
    if (h.bounces > 0) {
      const atk = ATTACKS.ballBounce;
      if (atk) atk.bounce(this, h);
      return;
    }
    if (h.type !== 'blindBox') return;
    const cfg = h.cfg;
    const c = this.world.spawnBullet('confetti', 'low');
    c.behavior = 'fan';
    c.draw = 'stretch';
    c.fps = 12;
    c.x = h.x1;
    c.z = h.z1;
    c.len = cfg.confettiLength;
    c.height = cfg.confettiHeight;
    c.vz = cfg.confettiSpeed * (h.speedMul || 1);
    c.baseHalfW = LANE_W / 2 - 0.3;
    c.halfW = c.baseHalfW;
    c.fan = h.fan;
    c.fanTime = cfg.fanTime;
    const cam = this.world.camera;
    if (cam.project(h.x1, 0.3, h.z1)) {
      this.world.particles.burst(PK.CONFETTI, cam.px, cam.py, 22, 70, 0.8, CONFETTI_COLORS, 110, 1, 30);
    }
    this.audio.play('giftLand');
  }

  fireCartSweep(spec) {
    const cfg = this.data.bullets.cartSweep;
    // 随机一条空道（尽量不和上一次相同，逼玩家移动；避开被封锁的道）
    const free = this.pickFreeLane();
    const m = this.speedMul();
    const telegraph = this.params.warning + cfg.telegraphExtra;
    // 不亮红灯：购物车阵只有 1.3m，低于跳跃顶点 1.8m，原地起跳就能过（红灯只留给跳不过也铲不过的攻击）
    this.boss.targetX = free === 0 ? 0 : -free * LANE_W * 0.5;
    if (free === 0) {
      this.schedule(telegraph, 'cart', -1, 1, m);
      this.schedule(telegraph, 'cart', 1, 1, m);
    } else {
      this.schedule(telegraph, 'cart', free === -1 ? 0 : -1, 2, m);
    }
    this.audio.play('warning');
  }

  schedule(delay, type, lane, lanes, speedMul, key) {
    for (const p of this.pending) {
      if (!p.active) {
        p.active = true;
        p.at = delay;
        p.type = type;
        p.lane = lane;
        p.lanes = lanes;
        p.speedMul = speedMul;
        p.key = key || '';
        return;
      }
    }
  }

  updatePending(dt) {
    for (const p of this.pending) {
      if (!p.active) continue;
      p.at -= dt;
      if (p.at > 0) continue;
      p.active = false;
      if (this.state === 'defeat' || this.state === 'intro') continue;
      switch (p.type) {
        case 'cart': {
          const cfg = this.data.bullets.cartSweep;
          const h = this.world.spawnBullet('bossCart', 'full');
          h.sprite = 'cartBoss';
          h.deep = 2;
          h.lane = p.lane;
          h.lanes = p.lanes;
          h.x = (p.lane + (p.lanes - 1) / 2) * LANE_W;
          h.halfW = (p.lanes * LANE_W) / 2 - 0.35;
          h.z = this.data.z - 1;
          h.len = cfg.length;
          h.height = cfg.height;
          h.vz = cfg.speed * p.speedMul;
          this.audio.play('throw', 0.7);
          break;
        }
        case 'milkTea': {
          const cfg = this.data.bullets.milkTea;
          const h = this.world.spawnBullet('milkTea', 'full');
          h.lane = p.lane;
          h.x = p.lane * LANE_W;
          h.halfW = LANE_W / 2 - 0.35;
          h.z = this.data.z - 1;
          h.len = cfg.length;
          h.height = cfg.height;
          h.vz = cfg.speed * p.speedMul;
          this.audio.play('throw', 1.1);
          break;
        }
        case 'carpet':
          this.spawnCarpet(p.lane, p.speedMul, p.key || 'bananaCarpet');
          break;
        case 'bun':
          this.fireLob('bunLob', p.lane, this.data.bullets.bunTriple, p.speedMul);
          break;
        default: {
          const f = PENDING[p.type];
          if (f) f(this, p);
        }
      }
    }
  }

  // ---------------- 金刚：滚桶 / 香蕉皮地毯 / 香蕉 ----------------
  fireBarrel(spec) {
    const cfg = this.data.bullets.barrel;
    const lane = this.pickLane(spec.lane);
    this.boss.targetX = lane * LANE_W;
    const h = this.world.spawnBullet('barrel', 'low');
    h.fps = 10;
    h.lane = lane;
    h.x = lane * LANE_W;
    h.halfW = LANE_W / 2 - 0.4;
    h.z = this.data.z - 1;
    h.len = cfg.length;
    h.height = cfg.height;
    h.vz = cfg.speed * this.speedMul();
    this.audio.play('throw', 0.6);
  }

  /** 铺满三道的地毯类攻击（香蕉皮地毯 / 转盘冲刺）：亮红两条道，第三条道前面放跳板 */
  fireCarpet(key) {
    const cfg = this.data.bullets[key];
    const springLane = this.pickFreeLane();
    const m = this.speedMul();
    const telegraph = this.params.warning + cfg.telegraphExtra;
    const travel = (this.data.z - 1) / (cfg.speed * m);
    // 保留红灯：地毯长 8m，普通跳跃滞空 0.6s 飞不完全程，只有弹床那条道能活 = 事实上的"必须变道"
    for (let l = -1; l <= 1; l++) if (l !== springLane) this.world.laneWarn[l + 1] = telegraph + travel;
    this.boss.targetX = springLane * LANE_W;
    this.schedule(telegraph, 'carpet', springLane, 1, m, key);
    this.audio.play('warning');
  }

  spawnCarpet(springLane, m, key) {
    const cfg = this.data.bullets[key];
    const z0 = this.data.z - 1;
    const sp = this.world.spawnBullet('springboard', 'spring');
    sp.draw = 'decal';
    sp.x = springLane * LANE_W;
    sp.halfW = LANE_W / 2 - 0.3;
    sp.z = z0;
    sp.len = 1.2;
    sp.vz = cfg.speed * m;
    sp.cfg = { airTime: cfg.springAir };
    const c = this.world.spawnBullet(key, 'low');
    c.sprite = cfg.sprite || key;
    c.draw = 'stretch';
    c.fps = 8;
    c.x = 0;
    c.halfW = 1.5 * LANE_W - 0.2;
    c.z = z0 + cfg.springAhead;
    c.len = cfg.length;
    c.height = cfg.height;
    c.vz = cfg.speed * m;
    this.audio.play('throw', 0.5);
  }

  /** 抛物线砸向主角脚下的弹幕（香蕉 / 菠萝油 / 彩环 / 章鱼烧）：红圈预警，落地同道即受击 */
  fireLob(sprite, lane, cfg, speedMul) {
    const b = this.boss;
    const m = speedMul || this.speedMul();
    const h = this.world.spawnBullet(sprite, 'drop');
    h.behavior = 'lob';
    h.landHit = true;
    h.x0 = b.x;
    h.y0 = b.y + 2;
    h.z0 = b.z - 1;
    h.x1 = lane * LANE_W;
    h.z1 = 0.3;
    h.x = h.x1;
    h.z = h.z1;
    h.len = 0.1;
    h.halfW = LANE_W / 2 - 0.4;
    h.T = Math.max(this.params.warning + 0.3, cfg.flightTime / m);
    h.arcH = cfg.arcHeight;
    this.audio.play('throw', 1.2);
    return h;
  }

  // ---------------- 波哥：丝袜奶茶 / 菠萝油三连 / 锅铲地波 ----------------
  fireMilkTea() {
    const cfg = this.data.bullets.milkTea;
    const free = this.pickFreeLane();
    const m = this.speedMul();
    const telegraph = this.params.warning + cfg.telegraphExtra;
    const travel = (this.data.z - 1) / (cfg.speed * m);
    for (let l = -1; l <= 1; l++) {
      if (l === free) continue;
      this.world.laneWarn[l + 1] = telegraph + travel + 0.2;
      this.schedule(telegraph, 'milkTea', l, 1, m);
    }
    this.boss.targetX = free * LANE_W * 0.5;
    this.audio.play('warning');
  }

  fireBunTriple() {
    const cfg = this.data.bullets.bunTriple;
    const m = this.speedMul();
    let lane = this.world.player.lane;
    for (let i = 0; i < cfg.count; i++) {
      this.schedule(i * cfg.gap, 'bun', lane, 1, m);
      // 下一颗落在另一条道（形成连环落点）
      lane = lane === 1 ? 0 : lane === -1 ? 0 : Math.random() < 0.5 ? -1 : 1;
    }
  }

  fireWok() {
    const cfg = this.data.bullets.wokWave;
    const h = this.world.spawnBullet('wokWave', 'low');
    h.draw = 'stretch';
    h.fps = 10;
    h.x = 0;
    h.halfW = 1.5 * LANE_W - 0.2;
    h.z = this.data.z - 1;
    h.len = cfg.length;
    h.height = cfg.height;
    h.vz = cfg.speed * this.speedMul();
    this.boss.sy = 0.7;
    this.world.camera.shake(1.5);
    this.audio.play('bossLand', 1.4, 0.6);
  }

  fireCoupon(spec, sp) {
    const cfg = this.data.bullets.couponWall;
    const band = spec.sequence[sp.seq % spec.sequence.length];
    sp.seq++;
    const m = this.speedMul();
    const h = this.world.spawnBullet('coupon', band === 'low' ? 'low' : 'high');
    h.sprite = band === 'low' ? 'couponLow' : 'couponHigh';
    h.draw = 'stretch';
    h.band = band;
    h.x = 0;
    h.halfW = 1.5 * LANE_W - 0.2;
    h.z = this.data.z - 1;
    h.len = cfg.length;
    h.vz = cfg.speed * m;
    if (band === 'low') {
      h.height = cfg.lowHeight;
    } else {
      h.clearance = cfg.highClearance;
      h.top = cfg.highTop;
    }
    this.boss.targetX = (Math.random() - 0.5) * LANE_W;
    this.audio.play('throw', band === 'low' ? 1.2 : 0.8);
  }

  /**
   * 通用横幅带（气球幕墙 / 彩带横梁 / 餐盘链）：横贯三道的带状物。
   * bullets 配置：speed / length / lowHeight（低空·跳）/ highClearance + highTop（高空·铲）/
   *   spriteLow / spriteHigh / draw（'lanes' 每道一簇 或 'stretch' 一整条）/ fps
   * spec：bullet = bullets 键名；band = 'low'|'high' 或 sequence 数组按序循环
   */
  fireBand(spec, sp) {
    const cfg = this.data.bullets[spec.bullet];
    const band = spec.sequence ? spec.sequence[(sp ? sp.seq++ : 0) % spec.sequence.length] : spec.band || 'low';
    const low = band === 'low';
    const m = this.speedMul();
    const h = this.world.spawnBullet(low ? cfg.spriteLow : cfg.spriteHigh, low ? 'low' : 'high');
    h.draw = cfg.draw || 'lanes';
    h.fps = cfg.fps || 4;
    h.anim = !!cfg.anim;
    h.band = band;
    h.lanes = 3;
    h.lane = -1;
    h.x = 0;
    h.halfW = 1.5 * LANE_W - 0.2;
    h.z = this.data.z - 1;
    h.len = cfg.length;
    h.vz = cfg.speed * m;
    if (low) h.height = cfg.lowHeight;
    else {
      h.clearance = cfg.highClearance;
      h.top = cfg.highTop;
    }
    this.boss.sy = low ? 1.05 : 0.8;
    this.boss.targetX = (Math.random() - 0.5) * LANE_W;
    this.audio.play('throw', low ? 1.2 : 0.8);
  }

  // ---------------- 硬直窗口 & 还击 ----------------
  enterStun() {
    const s = this.world.session;
    this.setState('stun');
    this.stunTime = this.params.stunWindow;
    if (s.energy >= 0.999) {
      // 技能满：提示可以放"回忆闪光"换更宽的反击判定（不再直接消耗能量加时）
      this.hud.tip('技能满了！双击屏幕 / L 放闪光 → 本次反击更好命中！', 2.8);
    }
    if (this.data.counter.type === 'mixed') {
      this.curCounter = this.data.counter.variants[this.mixOrder[this.phaseIndex % this.mixOrder.length]];
    }
    const c = this.counter;
    this.boss.expr = 'dizzy';
    this.boss.stunned = true;
    this.boss.targetX = 0;
    this.giftTimer = c.firstDelay;
    this.giftInFlight = null;
    this.bar.active = false;
    this.counterCd = 0;
    this.stunClock = 0;
    this.hud.center(TEXTS.bossStun, 1.3);
    this.hud.tip(c.type === 'throw' && s.ammo > 0 ? c.hintAmmo : c.hint, 3.6);
    this.audio.play('stun');
  }

  updateStun(dt) {
    this.stunClock += dt;
    if (this.dashArmed) {
      this.updateDashHold();
      if (this.stunClock >= this.stunTime) {
        this.disarmDash();
        this.recover();
      }
      return;
    }
    if (this.giftInFlight || this.bar.active) return;
    this.giftTimer -= dt;
    if (this.giftTimer <= 0 && this.stunClock < this.stunTime - 0.8) this.fireCounterObject();
    if (this.stunClock >= this.stunTime && !this.giftInFlight) this.recover();
  }

  recover() {
    this.boss.expr = 'angry';
    this.boss.stunned = false;
    this.hud.center(this.data.name + '缓过来了！', 1.2);
    this.setState('recover');
  }

  /** 硬直窗口里给出"还击物"：巨型礼盒 / 章鱼烧（反弹）/ 金色滚桶 / 金色跳板（踩跳）/ 发光菠萝油（投掷）/ 跪地（冲刺） */
  fireCounterObject() {
    const b = this.boss;
    const lane = this.world.player.lane;
    b.targetX = lane * LANE_W;
    b.sy = 0.8;
    b.sx = 1.15;
    const c = this.counter;
    const type = c.type;
    if (type === 'throw') {
      // 手一抖，菠萝油掉在前面的路上（随路面一起过来）
      const it = this.world.spawnPickup('bun', lane * LANE_W, 0.6, 26);
      this.giftInFlight = it;
      this.audio.play('throw', 0.8);
      return;
    }
    if (type === 'dash') {
      this.armDash();
      return;
    }
    if (type === 'stomp' && c.object === 'spring') {
      // 踩跳进阶：推来金色跳板，踩上去弹起来踩弱点
      const cfg = this.data.bullets.springGold;
      const h = this.world.spawnBullet('springGold', 'spring');
      h.draw = 'decal';
      h.counterBullet = true;
      h.lane = lane;
      h.x = lane * LANE_W;
      h.halfW = LANE_W / 2 - 0.3;
      h.z = b.z - 1;
      h.len = 1.6;
      h.vz = cfg.speed * this.params.bossBulletSpeed;
      h.cfg = { airTime: c.springAir || 1.1 };
      this.giftInFlight = h;
      this.audio.play('throw', 0.6);
      return;
    }
    const reflect = type === 'reflect';
    const key = c.bullet || (reflect ? 'giantGift' : 'goldBarrel');
    const cfg = this.data.bullets[key];
    const h = this.world.spawnBullet(key, reflect ? 'full' : 'low');
    h.draw = reflect ? 'giant' : 'lanes';
    h.fps = 10;
    h.reflectable = reflect;
    h.stompable = !reflect;
    h.harmless = true;
    h.counterBullet = true;
    h.lane = lane;
    h.x = lane * LANE_W;
    h.halfW = LANE_W / 2 - 0.35;
    h.z = b.z - 1;
    h.len = reflect ? 1.4 : cfg.length;
    h.height = cfg.height;
    h.vz = cfg.speed * this.params.bossBulletSpeed;
    this.giftInFlight = h;
    if (reflect) this.world.reflectWindow = this.counterWindow(); // 渲染层用它画"该拍了"的金圈
    this.audio.play('throw', 0.6);
  }

  // ---------------- 冲刺型还击 ----------------
  armDash() {
    const pl = this.world.player.lane;
    const opts = [-1, 0, 1].filter((l) => l !== pl);
    const L = opts[Math.floor(Math.random() * opts.length)];
    this.dashArmed = true;
    this.dashLane = L;
    this.world.dashLane = L;
    this.boss.targetX = L * LANE_W;
    this.held = null;
    this.lastLaneKey = '';
    this.audio.play('warning');
  }

  disarmDash() {
    this.dashArmed = false;
    this.held = null;
    this.world.dashLane = null;
  }

  /** 扣住的第一下方向键 0.3s 内没等到第二下 → 当作普通变道 */
  updateDashHold() {
    if (this.held && performance.now() / 1000 - this.heldTime > 0.3) {
      const a = this.held;
      this.held = null;
      this.world.player.handleAction(a, this.heldTime);
    }
  }

  /**
   * 场景把玩家动作先交给导演：返回 true = 已处理（不再交给主角）。
   * 冲刺型：对准绿箭头道时连按两次方向键（或 J）→ 冲刺；反弹进阶：选落点。
   */
  interceptAction(a, time) {
    if (this.state === 'aiming') {
      if (a === 'left') this.resolveAim(-1);
      else if (a === 'right') this.resolveAim(1);
      else if (a === 'up' || a === 'counter') this.resolveAim(0);
      return true;
    }
    if (!this.dashArmed || this.state !== 'stun') return false;
    const p = this.world.player;
    if (a === 'counter') {
      this.tryDash();
      return true;
    }
    if (a !== 'left' && a !== 'right') return false;
    const aligned = p.lane === this.dashLane;
    if (this.held) {
      this.held = null;
      if (aligned) this.tryDash();
      return true;
    }
    if (aligned) {
      // 已对准：先扣住这一下，看是不是连按
      this.held = a;
      this.heldTime = time;
      return true;
    }
    if (this.lastLaneKey === a && time - this.lastLaneTime < 0.35 && p.lane === this.dashLane) {
      this.tryDash();
      return true;
    }
    this.lastLaneKey = a;
    this.lastLaneTime = time;
    return false;
  }

  tryDash() {
    const p = this.world.player;
    if (p.lane !== this.dashLane) {
      this.hud.tip(this.counter.hintAgain, 1.8);
      return;
    }
    this.disarmDash();
    this.setState('countering');
    this.flags.dashHit = false;
    this.flags.dashZ0 = this.boss.z;
    p.startGhosts(0.5);
    this.world.flashWhite = 0.25;
    this.world.camera.shake(2);
    this.audio.play('dash');
    this.hud.pop('冲刺！', this.world.playerScreenX(), this.world.camera.feetY - 50, '#7dff9a', 13, 0.8);
  }

  // ---------------- 反弹进阶：选落点 ----------------
  startAim(h) {
    h.active = false;
    this.giftInFlight = null;
    this.setState('aiming');
    this.aimT = 0;
    const opts = [-1, 0, 1];
    this.aimLane = opts[Math.floor(Math.random() * 3)];
    this.boss.targetX = this.aimLane * LANE_W;
    this.world.slowmo = 2.2;
    this.world.aimLane = this.aimLane;
    this.hud.center('选落点！', 1.2);
    this.hud.tip(this.counter.hintAim, 2.4);
    this.audio.play('reflect');
  }

  resolveAim(lane) {
    if (this.state !== 'aiming') return;
    this.world.slowmo = 0;
    this.world.aimLane = null;
    const p = this.world.player;
    const key = this.counter.bullet || 'giantGift';
    const h = this.world.spawnBullet(key, 'none');
    this.launchReturn(h, key, p.x, 1.0, 0.8);
    h.x1 = lane * LANE_W;
    h.aimMiss = lane !== this.aimLane;
    this.setState('countering');
    this.audio.play('throw', 1.3);
  }

  /** 把还击物变成飞向 Boss 的投射物（反弹的礼盒 / 扔出去的菠萝油） */
  launchReturn(h, sprite, fromX, fromY, fromZ) {
    const b = this.boss;
    h.type = sprite;
    h.sprite = sprite;
    h.behavior = 'return';
    h.kind = 'none';
    h.reflected = true;
    h.active = true; // 拍击时本体可能已被关掉，这里重新激活成"飞向 Boss"
    h.t = 0;
    h.T = this.counter.returnTime || 0.5;
    h.aimMiss = false;
    h.x0 = fromX;
    h.y0 = fromY;
    h.z0 = Math.max(0.5, fromZ);
    h.x1 = b.x;
    h.y1 = b.y + 2.5;
    h.z1 = b.z;
    h.vz = 0;
    h.anchored = false;
  }

  /** 完美反击的命中窗口（秒）：技能「回忆闪光」在硬直窗口内释放过 → 更宽 */
  counterWindow() {
    const base = this.counter.hitWindow || 0.18;
    return base + (this.world.skillBoostT > 0 ? SKILL.counterWindowBonus : 0);
  }

  /**
   * 完美反击（反弹型·P3）：礼盒飞来时按 J / 点击屏幕挥拍，
   * 在它到达前的命中窗口内拍中 → 弹回去；拍早了进入短冷却，拍晚了会被砸懵。
   * 闪避不再触发反弹 —— 躲开只是错过机会。
   */
  tryReflectSwing(h) {
    if (this.counterCd > 0) return;
    const c = this.counter;
    const tti = this.world.timeToImpact(h);
    if (tti >= 0 && tti <= this.counterWindow()) {
      // 拍中！
      this.world.hitStop = 0.08;
      this.world.flashWhite = 0.3;
      this.world.camera.shake(1.5);
      this.world.player.startGhosts(0.35);
      if (c.aim) {
        this.startAim(h);
        return;
      }
      const key = c.bullet || 'giantGift';
      h.active = false;
      this.launchReturn(h, key, h.x, 0.6, h.z);
      this.giftInFlight = null;
      this.setState('countering');
      this.audio.play('reflect');
      this.hud.pop('拍回去!', this.world.camera.cx, this.world.camera.feetY - 70, '#ffffff', 11, 0.8);
      return;
    }
    if (tti < 0) return; // 已经飞过去了，等下一发
    // 挥空：短冷却，防止连点蹭判定
    this.counterCd = 0.3;
    this.audio.play('bump', 1.3, 0.4);
    this.hud.pop('太早了！等金圈!', this.world.playerScreenX(), this.world.camera.feetY - 56, '#ffffff', 8, 0.6);
  }

  /** 技能「回忆闪光」释放：清掉已排程未发射的弹幕（预警一起消失，不留"无预警偷袭"）；硬直窗口内还放宽反击判定 */
  onSkillCast() {
    for (const p of this.pending) p.active = false;
    for (const d of this.delayed) d.active = false;
    if (this.state !== 'stun') return;
    this.hud.tip('回忆闪光！本次反击判定更宽！', 2);
    if (this.bar.active) this.bar.zoneWidth = this.counter.zoneWidth * (1 + SKILL.throwZoneBonus);
    if (this.giftInFlight && this.counter.type === 'reflect') this.world.reflectWindow = this.counterWindow();
  }

  /** 踩跳型：跳上金色滚桶 / 踩上金色跳板 → 弹起来，Boss 冲到脚下被一脚踩中 */
  onStomp(h) {
    h.active = false;
    const p = this.world.player;
    // 跳板已经在 world.onSpring 里把人弹起来了
    if (h.kind !== 'spring') p.springLaunch(1.1);
    this.giftInFlight = null;
    this.setState('countering');
    this.flags.stompHit = false;
    this.boss.targetX = p.lane * LANE_W;
    this.audio.play('spring');
    this.hud.pop('踩！', this.world.playerScreenX(), this.world.camera.feetY - 50, '#ffe066', 12, 0.8);
  }

  /** 投掷型：捡到菠萝油 → 出现蓄力条 */
  onAmmoPickup() {
    this.giftInFlight = null;
    this.armBar();
  }

  armBar() {
    const c = this.counter;
    const bar = this.bar;
    bar.active = true;
    bar.t = 0;
    bar.zoneStart = c.zoneStart;
    bar.zoneWidth = c.zoneWidth * (this.world.skillBoostT > 0 ? 1 + SKILL.throwZoneBonus : 1);
    bar.result = '';
    this.hud.tip('指针进红区时按 J / 点屏幕！', 2.5);
  }

  updateBar(dt) {
    const bar = this.bar;
    if (bar.resultT > 0) bar.resultT -= dt;
    if (!bar.active) return;
    const c = this.counter;
    bar.t += dt;
    bar.needle = 0.5 - 0.5 * Math.cos((bar.t / c.barPeriod) * Math.PI * 2);
    if (bar.t >= c.barTimeout) this.releaseThrow();
  }

  /** 玩家按下反击键（J / 点击）：反弹型 = 金圈时刻拍击；投掷型 = 指针条出手 */
  onCounter() {
    if (this.state !== 'stun') return;
    const c = this.counter;
    if (c.type === 'throw') {
      if (this.bar.active) {
        this.releaseThrow();
        return;
      }
      const s = this.world.session;
      if (!this.giftInFlight && s.ammo > 0) {
        s.ammo--;
        this.armBar();
      }
      return;
    }
    if (c.type === 'reflect') {
      if (this.giftInFlight) this.tryReflectSwing(this.giftInFlight);
      else this.hud.tip(c.hint, 2.2);
      return;
    }
    this.hud.tip(c.hint, 2.2);
  }

  releaseThrow() {
    const bar = this.bar;
    bar.active = false;
    bar.resultT = 0.8;
    const hit = bar.needle >= bar.zoneStart && bar.needle <= bar.zoneStart + bar.zoneWidth;
    const p = this.world.player;
    const h = this.world.spawnBullet('bun', 'none');
    if (hit) {
      bar.result = 'hit';
      this.launchReturn(h, 'bun', p.x, 1.2, 0.5);
      this.setState('countering');
      this.audio.play('reflect', 1.2);
      this.hud.pop('扔中啦!', this.world.playerScreenX(), this.world.camera.feetY - 60, '#ffe066', 11, 0.8);
    } else {
      // 扔偏：飞向路边
      bar.result = 'miss';
      this.launchReturn(h, 'bun', p.x, 1.2, 0.5);
      h.behavior = 'lob';
      h.landHit = false;
      h.x1 = (bar.needle < bar.zoneStart ? -1 : 1) * 6;
      h.z1 = 14;
      h.arcH = 3;
      h.T = 0.7;
      this.giftTimer = this.counter.interval;
      this.audio.play('throw', 0.6);
      this.hud.tip(this.counter.hintMiss, 2);
    }
  }

  updateCountering() {
    const c = this.counter;
    const b = this.boss;
    if (c.type === 'dash') {
      // 冲刺：主角冲向跪地的 Boss（镜头里表现为 Boss 迅速逼近），撞上后把它撞回远处
      if (!this.flags.dashHit) {
        const k = Math.min(1, this.t / c.dashTime);
        b.z = this.flags.dashZ0 + (1.6 - this.flags.dashZ0) * k;
        if (Math.random() < 0.6) this.world.player.startGhosts(0.2);
        if (this.t >= c.dashTime) {
          this.flags.dashHit = true;
          this.onReflectHit();
        }
      }
      return;
    }
    // 踩跳：Boss 冲到脚下，稍后被踩中，然后被踹回原位
    if (c.type !== 'stomp') return;
    const dash = c.dashTime;
    if (!this.flags.stompHit) {
      const k = Math.min(1, this.t / dash);
      b.z = this.data.z + (2.5 - this.data.z) * k * k;
      if (this.t >= dash) {
        this.flags.stompHit = true;
        this.world.player.springLaunch(0.7);
        this.onReflectHit();
      }
    }
  }

  /** 还击命中 Boss（反弹进阶选错落点时 h.aimMiss = true：砸偏） */
  onReflectHit(h) {
    const b = this.boss;
    if (h && h.aimMiss) {
      this.world.particles.burst(PK.CONFETTI, b.screenX || this.world.camera.cx, (b.screenY || 60) + 20, 12, 60, 0.6, CONFETTI_COLORS, 110);
      this.audio.play('giftLand');
      this.hud.tip(this.counter.hintMissAim || this.counter.hintAgain, 2.2);
      this.giftTimer = this.counter.interval;
      this.state = 'stun';
      return;
    }
    this.hp--;
    b.flash = 0.18; // 白剪影一闪即止：反击频繁时太长会像"Boss 一直在闪"
    b.expr = 'hurt';
    b.stunned = false;
    b.sx = 1.3;
    b.sy = 0.7;
    this.world.hitStop = 0.14;
    this.world.camera.shake(JUICE.shakeBossHit);
    this.world.flashWhite = 0.2;
    this.audio.play('bossHit');
    if (b.screenX) {
      this.world.particles.burst(PK.STAR, b.screenX, b.screenY, 14, 90, 0.7, GOLD_COLORS, 40);
      this.world.particles.burst(PK.CONFETTI, b.screenX, b.screenY, 26, 100, 0.9, CONFETTI_COLORS, 110);
      this.world.particles.ring(b.screenX, b.screenY, 40, 0.4, '#ffffff');
    }
    for (let i = 0; i < 5; i++) {
      const v = this.world.session.addCoins(1);
      this.world.hud.coinFly((b.screenX || this.world.camera.cx) + (Math.random() - 0.5) * 20, b.screenY || 60, v);
    }
    this.hud.center(TEXTS.bossHit, 1);
    this.setState('hurt');
  }

  onCounterMissed() {
    this.giftInFlight = null;
    this.giftTimer = this.counter.interval;
    this.hud.tip(this.counter.hintAgain, 2.2);
  }

  onCounterBonk() {
    this.giftInFlight = null;
    this.giftTimer = this.counter.interval;
    if (this.counter.hintBonk) this.hud.tip(this.counter.hintBonk, 2.2);
  }

  /** 投掷型：菠萝油没捡到、跑到身后了 */
  onBunMissed() {
    this.giftInFlight = null;
    this.giftTimer = this.counter.interval * 0.6;
  }

  // ---------------- 击败演出（5s） ----------------
  enterDefeat() {
    this.setState('defeat');
    this.disarmDash();
    this.world.sandTarget = 0;
    this.world.slowmo = 0;
    this.world.aimLane = null;
    this.world.fever = true;
    this.flags.defeatCoins = 0;
    for (const s of this.spawners) s.active = false;
    this.audio.stopMusic();
  }

  updateDefeat() {
    const b = this.boss;
    const t = this.t;
    const cam = this.world.camera;
    if (!this.flags.deflate && t >= 0.3) {
      this.flags.deflate = true;
      this.audio.play(this.data.grounded ? 'bossLand' : 'deflate');
      this.hud.banner(this.data.name + '被打败啦！', this.data.defeatText || '', 2.4);
    }
    if (t >= 0.3 && t < 2.6) {
      const k = (t - 0.3) / 2.3;
      b.expr = 'dizzy';
      if (this.data.grounded) {
        // 地面 Boss：晕乎乎地蹦跳着逃向远处
        b.z = this.data.z + k * k * 45;
        b.y = Math.abs(Math.sin(t * 9)) * 1.6;
        b.x = Math.sin(t * 5) * 2;
      } else {
        // 漏气乱飞：李萨如曲线 + 缩小
        b.x = Math.sin(t * 7) * 4 * (1 - k * 0.5);
        b.y = this.hoverY() + Math.sin(t * 11) * 2 + k * 6;
        b.scale = 1 - k * 0.65;
      }
      b.flash = Math.floor(t * 12) % 4 === 0 ? 0.05 : 0;
      if (b.screenX && Math.random() < 0.5) {
        this.world.particles.spawn(PK.SQUARE, b.screenX, b.screenY + 10, (Math.random() - 0.5) * 40, 30, 0.5, 2, '#ffffff', 0, 2);
      }
      // 最终 Boss：吐出被吞掉的回忆光点，飘向天空
      if (this.data.finale && b.screenX) {
        for (let i = 0; i < 3; i++) {
          const col = GOLD_COLORS[(Math.random() * GOLD_COLORS.length) | 0];
          this.world.particles.spawn(PK.STAR, b.screenX + (Math.random() - 0.5) * 20, b.screenY, (Math.random() - 0.5) * 90, -40 - Math.random() * 70, 1.6, 1, col, -20);
        }
      }
    }
    if (t >= 2.6 && b.visible) {
      b.visible = false;
      this.world.particles.burst(PK.CONFETTI, cam.cx, cam.H * 0.3, 60, 140, 1.6, CONFETTI_COLORS, 90, 1, 40);
      this.world.particles.burst(PK.HEART, cam.cx, cam.H * 0.3, 16, 90, 1.4, PINK_COLORS, 30);
      this.audio.play('victory');
    }
    // 爆金币：飞向计数器
    if (t >= 0.5 && this.flags.defeatCoins < ECONOMY.bossDefeatCoins) {
      const want = Math.min(ECONOMY.bossDefeatCoins, Math.floor((t - 0.5) / 0.06));
      while (this.flags.defeatCoins < want) {
        this.flags.defeatCoins++;
        const v = this.world.session.addCoins(1);
        const sx = b.visible && b.screenX ? b.screenX : cam.cx;
        const sy = b.visible && b.screenY ? b.screenY : cam.H * 0.3;
        this.world.hud.coinFly(sx + (Math.random() - 0.5) * 30, sy + (Math.random() - 0.5) * 20, v);
        if (this.flags.defeatCoins % 3 === 0) this.audio.play('coin', 1 + (this.flags.defeatCoins % 10) * 0.05, 0.6);
      }
    }
    if (t >= BOSS_RULES.defeatDuration) {
      this.setState('done');
      this.cb.onDefeated();
    }
  }

  /** 调试：直接让 Boss 掉 1 血 */
  debugHit() {
    if (this.state === 'intro' || this.state === 'defeat' || this.state === 'done') return;
    this.world.clearHazards();
    for (const s of this.spawners) s.active = false;
    for (const p of this.pending) p.active = false;
    this.disarmDash();
    this.world.slowmo = 0;
    this.world.aimLane = null;
    this.onReflectHit();
  }
}
