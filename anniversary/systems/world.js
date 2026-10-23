import { WORLD, PLAYER, COMBAT, ENERGY, SKILL, SPEED, CAMERA, JUICE } from '../data/constants.js';
import { OBSTACLES } from '../data/obstacles.js';
import { PICKUPS, COIN } from '../data/pickups.js';
import { ECONOMY } from '../data/economy.js';
import { TEXTS } from '../data/texts.js';
import { Pool } from './pool.js';
import { Camera } from './camera.js';
import { CorridorRenderer } from './corridor.js';
import { Particles, PK, CONFETTI_COLORS, DUST_COLORS, GOLD_COLORS, PINK_COLORS } from './particles.js';
import { Hud } from './hud.js';
import { Player } from '../entities/player.js';
import { renderWorld } from './worldRenderer.js';
import { PARTNER } from '../data/shop.js';
import { CONFIG } from '../config.js';
import { SPRITES } from './sprites.js';

/**
 * 局内世界：主角、障碍 / 弹幕（统一叫 hazard）、金币、拾取物、装饰、扶梯区段，
 * 以及碰撞、完美闪避、受击结算、子弹时间 / 顿帧、粒子与镜头反馈。
 * 跑酷段（RunScene）和 Boss 战（BossScene）共用同一个 World，镜头和地面无缝衔接。
 */
const LANE_W = WORLD.laneWidth;

function createHazard() {
  return {
    active: false,
    type: '',
    variant: '',
    kind: 'none', // low / high / full / drop / slip / spring / none
    behavior: '', // oscillate / cross / drop / lob / fan / return
    sprite: '',
    draw: 'lanes', // lanes / center / train / stretch / decal / giant
    fps: 4,
    deep: 1,
    anim: false,
    spanSprite: false,
    harmless: false, // 撞上只会"砸懵"，不扣心（还击教学物）
    stompable: false, // 踩跳型还击：跳到它顶上触发
    counterBullet: false,
    landHit: false,
    sideX: 0,
    crossSpeed: 0,
    crossLead: 0,
    crossStarted: false,
    anchored: true, // true = 随地面一起向后移动；false = 在"主角空间"里自己飞（Boss 弹幕）
    vz: 0,
    fwdSpeed: 0,
    fwdStart: 0,
    x: 0,
    halfW: 1,
    lanes: 1,
    lane: 0,
    z: 0,
    len: 1,
    height: 1,
    clearance: 1,
    top: 2,
    walkable: false,
    zOver: false,
    xOver: false,
    dodged: false,
    done: false,
    passed: false,
    reflectable: false,
    reflected: false,
    locked: false,
    appear: 0,
    fallH: 0,
    moveBase: 0,
    moveDir: 1,
    movePeriod: 1,
    moveT: 0,
    t: 0,
    T: 1,
    x0: 0,
    y0: 0,
    z0: 0,
    x1: 0,
    y1: 0,
    z1: 0,
    arcH: 0,
    age: 0,
    fan: 0,
    fanTime: 0.3,
    baseHalfW: 1,
    band: '',
    tipChecked: false,
    cfg: null,
    y: 0,
    bob: 0,
    warnLead: 0,
    warned: false,
    edgeWarn: false,
    shoutLead: 0,
    shouted: false,
    orbitR: 0,
    orbitW: 0,
    orbitP0: 0,
    bounces: 0,
    aimMiss: false,
  };
}

export class World {
  constructor(game) {
    this.game = game;
    this.audio = game.audio;
    this.camera = new Camera();
    this.corridor = new CorridorRenderer();
    this.particles = new Particles();
    this.hud = new Hud();
    this.player = new Player(this);
    this.hazards = new Pool(createHazard, 64);
    this.coins = new Pool(() => ({ x: 0, y: 0, z: 0, magnet: false, phase: 0 }), 180);
    this.pickups = new Pool(() => ({ id: '', x: 0, y: 0, z: 0, phase: 0, idx: 0 }), 12);
    this.decor = new Pool(() => ({ sprite: null, x: 0, y: 0, z: 0 }), 32);
    this.zones = [];
    for (let i = 0; i < 4; i++) this.zones.push({ active: false, start: 0, end: 0, kind: 0, air: 0.9 });
    this.laneWarn = new Float32Array(3);
    this.session = null;
    this.listener = null;
    this.level = null;
    this.mode = 'demo';
    this.time = 0;
    this.speedNow = SPEED.base;
    this.targetSpeed = SPEED.base;
    this.zoneMul = 1;
    this.lastZoneKind = 0;
    this.hitStop = 0;
    this.bulletTime = 0;
    this.slowmo = 0;
    this.flashWhite = 0;
    this.flashRed = 0;
    this.fever = false;
    this.feverTimer = 0;
    this.perfectStreak = 0;
    this.perfectStreakTimer = 0;
    this.seenTips = {};
    this.boss = null; // 由 BossDirector 填充，渲染用
    this.godMode = false;
    this.debugTimeScale = 1;
    this.deathCause = '';
    this.inputLocked = false;
    this.hidePlayer = false;
    // 守护换人"接力"动画
    this.swapT = 1;
    this.swapDur = PARTNER.animTime;
    this.swapFrom = 'girl';
    this.swapTo = 'boy';
    // 香港关霓虹夜雨（纯视觉）
    this.rain = false;
    this.rainLevel = 0;
    this.photosSaved = null; // 存档里本关已收集的照片碎片（飘字计数用）
    // M3：潮汐预警（屏幕两侧泛蓝）/ 风沙（蟹老板第 3 阶段）/ 冲刺绿箭头 / 反弹选落点
    this.tideWarn = 0;
    this.sandLevel = 0;
    this.sandTarget = 0;
    this.dashLane = null;
    this.aimLane = null;
    this.trampAir = 0.9;
    // 技能「回忆闪光」：在硬直窗口释放时，下一次反击判定放宽（倒计时）
    this.skillBoostT = 0;
    // 完美反击的命中窗口（由 Boss 导演在丢出还击物时刷新，渲染层画金圈用）
    this.reflectWindow = 0;
    // 遗忘之墨：左右颠倒的视觉强度（吞吞专用，便便打滑不触发）
    this.inkT = 0;
    this.inkLevel = 0;
    // 渲染排序用的预分配列表
    this.renderList = [];
    for (let i = 0; i < 320; i++) this.renderList.push({ z: 0, kind: 0, ref: null });
    this.renderCount = 0;
    this.feverVignette = null;
    this.feverVignetteKey = '';
  }

  /** 切换关卡素材（调色板 + 墙面 / 天空贴图 + 场景环境） */
  setLevel(level, assets) {
    this.level = level;
    this.corridor.setLevel(level.palette, assets || {}, level.env || {});
  }

  /** 开新的一局（或回到菜单演示） */
  begin(session, listener, mode) {
    this.session = session;
    this.listener = listener;
    this.mode = mode;
    this.hazards.releaseAll();
    this.coins.releaseAll();
    this.pickups.releaseAll();
    this.decor.releaseAll();
    this.particles.clear();
    for (const z of this.zones) z.active = false;
    this.laneWarn.fill(0);
    this.player.reset();
    this.camera.reset();
    this.time = 0;
    this.hitStop = 0;
    this.bulletTime = 0;
    this.slowmo = 0;
    this.flashWhite = 0;
    this.flashRed = 0;
    this.fever = false;
    this.zoneMul = 1;
    this.lastZoneKind = 0;
    this.perfectStreak = 0;
    this.boss = null;
    this.swapT = 1;
    this.rain = false;
    this.rainLevel = 0;
    this.tideWarn = 0;
    this.sandLevel = 0;
    this.sandTarget = 0;
    this.dashLane = null;
    this.aimLane = null;
    this.skillBoostT = 0;
    this.inkT = 0;
    this.inkLevel = 0;
    this.speedNow = session.speed;
    this.targetSpeed = session.speed;
    this.hud.reset(session.coins);
    this.seenTips = {};
  }

  /** 只清弹幕 / 障碍，保留地面与镜头（Boss 战开始、重开时用） */
  clearHazards() {
    this.hazards.releaseAll();
    this.pickups.releaseAll();
    this.laneWarn.fill(0);
  }

  /** 回到菜单演示时：清掉所有局内物体 */
  clearEntities() {
    this.clearHazards();
    this.coins.releaseAll();
    this.decor.releaseAll();
    for (const z of this.zones) z.active = false;
  }

  // ------------------------------------------------------------
  // 时间：顿帧 / 子弹时间 / 慢动作（都按真实时间计时）
  // ------------------------------------------------------------

  step(dtReal) {
    this.camera.updateShake(dtReal);
    if (this.flashWhite > 0) this.flashWhite -= dtReal * 2.5;
    if (this.flashRed > 0) this.flashRed -= dtReal * 2;
    if (this.hitStop > 0) {
      this.hitStop -= dtReal;
      return 0;
    }
    if (this.swapT < this.swapDur + 0.2) this.swapT += dtReal;
    let scale = 1;
    if (this.bulletTime > 0) {
      this.bulletTime -= dtReal;
      // 最后 0.08s 平滑恢复，不会"啪"地一下变快
      const t = this.bulletTime;
      scale = t > 0.08 ? COMBAT.bulletTimeScale : COMBAT.bulletTimeScale + (1 - COMBAT.bulletTimeScale) * (1 - t / 0.08);
    }
    if (this.slowmo > 0) {
      this.slowmo -= dtReal;
      scale = Math.min(scale, 0.3);
    }
    return dtReal * scale * this.debugTimeScale;
  }

  // ------------------------------------------------------------
  // 每帧更新
  // ------------------------------------------------------------

  update(dt) {
    if (dt <= 0) return;
    const s = this.session;
    this.time += dt;

    // 速度：目标速度（场景设置）× 扶梯 / 回忆走廊倍率
    const zoneKind = this.zoneAt(s.trackPos);
    const zMul = zoneKind === 1 ? SPEED.escalatorUpMul : zoneKind === 2 ? SPEED.escalatorDownMul : zoneKind === 4 ? SPEED.galleryMul : 1;
    const k = 1 - Math.exp(-SPEED.changeRate * dt);
    this.zoneMul += (zMul - this.zoneMul) * k;
    s.speed += (this.targetSpeed - s.speed) * k;
    const speed = s.speed * this.zoneMul;
    this.speedNow = speed;
    s.trackPos += speed * dt;
    this.camera.targetHeight = zoneKind === 1 ? CAMERA.escalatorUpHeight : zoneKind === 2 ? CAMERA.escalatorDownHeight : CAMERA.height;
    if (zoneKind !== this.lastZoneKind) {
      this.lastZoneKind = zoneKind;
      if (zoneKind === 1) {
        this.hud.pop('上扶梯 · 加速!', this.camera.cx, this.camera.feetY - 52, '#ffe066', 9, 1.1);
        this.audio.play('pickup', 0.8);
      } else if (zoneKind === 2) {
        this.hud.pop('下扶梯 · 减速~', this.camera.cx, this.camera.feetY - 52, '#9fe3ff', 9, 1.1);
        this.audio.play('pickup', 0.6);
      } else if (zoneKind === 3) {
        this.hud.pop('弹床区！落地就会弹起来', this.camera.cx, this.camera.feetY - 52, '#ffe066', 9, 1.3);
        this.audio.play('spring', 0.8);
      } else if (zoneKind === 4) {
        this.hud.pop('回忆走廊', this.camera.cx, this.camera.feetY - 52, '#ffd27a', 10, 1.6);
      }
    }

    const pw = s.powerups;
    if (pw.magnet > 0) pw.magnet -= dt;
    if (pw.coinRain > 0) pw.coinRain -= dt;
    if (pw.springShoes > 0) pw.springShoes -= dt;
    s.fever = this.fever && this.mode === 'boss';
    s.updatePartner(dt);
    const rk = 1 - Math.exp(-1.5 * dt);
    this.rainLevel += ((this.rain ? 1 : 0) - this.rainLevel) * rk;
    this.sandLevel += (this.sandTarget - this.sandLevel) * rk;
    if (this.inkT > 0) this.inkT -= dt;
    this.inkLevel += ((this.inkT > 0 ? 1 : 0) - this.inkLevel) * rk;
    if (this.skillBoostT > 0) this.skillBoostT -= dt;
    if (this.tideWarn > 0) this.tideWarn -= dt;
    if (s.comboTimer > 0) {
      s.comboTimer -= dt;
      if (s.comboTimer <= 0) s.coinCombo = 0;
    }
    if (this.perfectStreakTimer > 0) {
      this.perfectStreakTimer -= dt;
      if (this.perfectStreakTimer <= 0) this.perfectStreak = 0;
    }

    this.player.update(dt, this.groundHeight());
    // 弹床区：只要踩到地面就被高高弹起
    if (zoneKind === 3 && this.player.grounded && !this.player.dead && this.player.y < 0.05) {
      this.player.springLaunch(this.trampAir);
      this.audio.play('spring', 1.1, 0.6);
      const sx = this.playerScreenX();
      this.particles.ring(sx, this.camera.feetY, 14, 0.25, '#ffe066');
    }
    this.updateHazards(dt, speed);
    this.updateCoins(dt, speed);
    this.updatePickups(dt, speed);
    this.updateDecor(dt, speed);
    for (let i = 0; i < 3; i++) if (this.laneWarn[i] > 0) this.laneWarn[i] -= dt;
    for (const z of this.zones) if (z.active && z.end < s.trackPos - 30) z.active = false;
    this.camera.follow(dt, this.player.x);
    this.particles.update(dt);

    // LOVE FEVER：爱心粒子飘落
    if (this.fever) {
      this.feverTimer -= dt;
      if (this.feverTimer <= 0) {
        this.feverTimer = 0.12;
        const W = this.camera.W;
        const side = Math.random() < 0.5;
        const x = side ? Math.random() * W * 0.22 : W - Math.random() * W * 0.22;
        this.particles.spawn(Math.random() < 0.6 ? PK.HEART : PK.HEART_LIGHT, x, -4, (Math.random() - 0.5) * 10, 22 + Math.random() * 18, 3.5, 1, '#fff');
      }
    }
  }

  /** 菜单背景演示：女孩自动奔跑 */
  updateDemo(dt) {
    const s = this.session;
    s.trackPos += this.targetSpeed * dt;
    this.speedNow = this.targetSpeed;
    this.player.update(dt, 0);
    this.camera.follow(dt, 0);
    this.particles.update(dt);
  }

  // ------------------------------------------------------------
  // 生成接口（关卡生成器 / Boss 导演调用）
  // ------------------------------------------------------------

  spawnObstacle(typeId, variant, laneStart, nLanes, z) {
    const def = OBSTACLES[typeId];
    const v = variant && def.variants ? def.variants[variant] : null;
    const h = this.hazards.obtain();
    resetHazard(h);
    h.type = typeId;
    h.variant = variant || '';
    h.kind = def.kind;
    h.behavior = def.behavior || '';
    h.sprite = (v && v.sprite) || def.sprite;
    h.draw = (v && v.draw) || def.draw || 'lanes';
    h.fps = def.fps || 4;
    h.anim = !!def.anim;
    h.spanSprite = !!def.spanSprite;
    h.anchored = true;
    h.lanes = nLanes;
    h.lane = laneStart;
    h.x = (laneStart + (nLanes - 1) / 2) * LANE_W;
    h.halfW = (nLanes * LANE_W) / 2 - def.sideMargin;
    h.z = z;
    h.len = v && v.length ? v.length : def.length;
    h.height = def.height || 0;
    h.clearance = def.clearance || 0;
    h.top = def.top || def.height || 0;
    h.walkable = !!((v && v.walkable) || def.walkable);
    if (h.walkable) h.top = (v && v.walkTop) || def.walkTop;
    h.cfg = v || def;
    if (def.moving) {
      h.moveBase = h.x;
      h.moveDir = laneStart >= 1 ? -1 : laneStart <= -1 ? 1 : Math.random() < 0.5 ? -1 : 1;
      h.movePeriod = def.moving.period;
      h.moveT = Math.random() * def.moving.period * 0.3;
    }
    if (def.cross) {
      // 横穿马路：到达前 crossLead 秒从路边出发
      h.moveDir = Math.random() < 0.5 ? -1 : 1;
      h.crossSpeed = def.cross.speed;
      h.crossLead = def.cross.leadMin + Math.random() * (def.cross.leadMax - def.cross.leadMin);
      h.x = -h.moveDir * def.cross.startX;
      h.crossStarted = false;
      h.sprite = def.sprite + (h.moveDir > 0 ? 'R' : 'L');
    }
    if (def.forward) {
      h.fwdSpeed = def.forward.speed;
      h.fwdStart = def.forward.startZ || 16;
    }
    h.bob = def.bob || 0;
    h.warnLead = def.warnLead || 0;
    h.edgeWarn = !!def.edgeWarn;
    if (def.shout) h.shoutLead = def.shout.lead + (h.crossLead || 0);
    if (def.behavior === 'drop') {
      h.locked = false;
      h.appear = def.appearTime;
      h.fallH = def.fallHeight;
      h.sideX = def.fromSide ? (Math.random() < 0.5 ? -1 : 1) * def.fromSide : 0;
      if (h.sideX && SPRITES.monkey) this.spawnDecor(SPRITES.monkey, h.sideX * 1.06, 0, z);
    }
    return h;
  }

  spawnCoin(x, y, z) {
    const c = this.coins.obtain();
    c.x = x;
    c.y = y;
    c.z = z;
    c.magnet = false;
    c.phase = Math.random() * 6;
    return c;
  }

  spawnPickup(id, x, y, z, idx = 0) {
    const p = this.pickups.obtain();
    p.id = id;
    p.x = x;
    p.y = y;
    p.z = z;
    p.idx = idx;
    p.phase = Math.random() * 6;
    return p;
  }

  spawnDecor(sprite, x, y, z) {
    const d = this.decor.obtain();
    d.sprite = sprite;
    d.x = x;
    d.y = y;
    d.z = z;
    return d;
  }

  addZone(start, end, kind) {
    for (const z of this.zones) {
      if (!z.active) {
        z.active = true;
        z.start = start;
        z.end = end;
        z.kind = kind;
        return z;
      }
    }
    return null;
  }

  zoneAt(pos) {
    for (const z of this.zones) if (z.active && pos >= z.start && pos < z.end) return z.kind;
    return 0;
  }

  /** Boss 弹幕：在"主角空间"里飞，不随地面移动 */
  spawnBullet(type, kind) {
    const h = this.hazards.obtain();
    resetHazard(h);
    h.type = type;
    h.kind = kind;
    h.sprite = type;
    h.anchored = false;
    return h;
  }

  // ------------------------------------------------------------
  // 更新：障碍 / 弹幕
  // ------------------------------------------------------------

  updateHazards(dt, speed) {
    const items = this.hazards.items;
    const p = this.player;
    for (let i = 0; i < items.length; i++) {
      const h = items[i];
      if (!h.active) continue;
      if (h.anchored) h.z -= speed * dt;
      if (h.fwdSpeed && !h.vz && h.z < h.fwdStart) h.vz = -h.fwdSpeed;
      if (h.vz) h.z -= h.vz * dt;

      switch (h.behavior) {
        case 'oscillate': {
          h.moveT += dt;
          const ph = (h.moveT / h.movePeriod) * Math.PI * 2;
          h.x = h.moveBase + h.moveDir * LANE_W * (0.5 - 0.5 * Math.cos(ph));
          break;
        }
        case 'cross': {
          if (!h.crossStarted && h.z / Math.max(1, speed) <= h.crossLead) h.crossStarted = true;
          if (h.crossStarted) h.x += h.moveDir * h.crossSpeed * dt;
          break;
        }
        case 'drop': {
          const tau = h.z / Math.max(1, speed);
          if (!h.locked && tau <= h.appear) {
            // 锁定落点：瞄准主角当前所在（目标）车道
            h.locked = true;
            h.lane = p.lane;
            h.x = h.lane * LANE_W;
            this.audio.play('throw', 1.3);
          }
          if (h.z <= 0) {
            this.landDrop(h);
            continue;
          }
          break;
        }
        case 'lob': {
          h.t += dt;
          if (h.t >= h.T) {
            if (h.landHit) {
              this.landDrop(h);
              if (h.bounces > 0) this.listener.onLobLand(h);
            } else {
              h.active = false;
              this.listener.onLobLand(h);
            }
            continue;
          }
          break;
        }
        case 'orbit': {
          // 绕圈的木马：横向位置随时间转动
          h.t += dt;
          h.x = h.orbitR * Math.sin(h.orbitP0 + h.orbitW * h.t);
          break;
        }
        case 'slide': {
          // 泳泳合拢：到达主角时刚好滑到目标位置
          h.t += dt;
          const k = Math.min(1, h.t / h.T);
          h.x = h.x0 + (h.x1 - h.x0) * k * (2 - k);
          break;
        }
        case 'fan': {
          h.age += dt;
          const k = Math.min(1, h.age / h.fanTime);
          h.halfW = h.baseHalfW + h.fan * LANE_W * k;
          break;
        }
        case 'return': {
          h.t += dt;
          if (h.t >= h.T) {
            h.active = false;
            this.listener.onReflectHit(h);
            continue;
          }
          break;
        }
      }

      if (!h.tipChecked && h.z < Math.max(18, speed * 2.4)) {
        h.tipChecked = true;
        this.maybeTip(h);
      }

      // 彩带直线弹 / 潮水：到达前 warnLead 秒提醒（潮水还让屏幕两侧泛蓝）
      if (h.warnLead && !h.warned) {
        const tau = this.timeToImpact(h);
        if (tau >= 0 && tau <= h.warnLead) {
          h.warned = true;
          const dur = tau + h.len / Math.max(1, speed + (h.vz || 0));
          // 红灯只留给跳不过（≥跳跃顶点 1.8m）也铲不过的障碍：小丑彩带 1.6m 可跳过 → 只响警示音
          if (h.kind === 'full' && h.height >= PLAYER.jumpHeight) {
            for (let l = 0; l < h.lanes; l++) {
              const li = h.lane + l + 1;
              if (li >= 0 && li < 3) this.laneWarn[li] = Math.max(this.laneWarn[li], dur);
            }
          }
          if (h.edgeWarn) {
            this.tideWarn = Math.max(this.tideWarn, dur);
            if (h.lane < 0) {
              this.audio.play('splash');
              this.hud.pop('涨潮了！站中间！', this.camera.cx, this.camera.feetY - 70, '#7fd8ea', 10, 1.2);
            }
          } else this.audio.play('warning');
        }
      }
      // 夜市喇叭：人冲出来之前先叫卖（声音 + 路边气泡）
      if (h.shoutLead && !h.shouted && h.z / Math.max(1, speed) <= h.shoutLead) {
        h.shouted = true;
        this.audio.play('hawk');
        if (SPRITES.shoutBubble) this.spawnDecor(SPRITES.shoutBubble, -h.moveDir * 4.6, 2.2, h.z);
      }

      if (h.kind !== 'none' && h.kind !== 'drop' && !h.done && !h.dodged && !p.dead) this.collide(h);

      if (!h.passed && h.z + h.len < -PLAYER.halfDepth) {
        h.passed = true;
        if (h.counterBullet && !h.reflected && !h.done) this.listener.onCounterMissed(h);
      }
      if (h.z + h.len < WORLD.despawnZ && h.behavior !== 'return') h.active = false;
    }
  }

  maybeTip(h) {
    const def = OBSTACLES[h.type];
    if (!def) return;
    const key = h.type + (h.variant ? ':' + h.variant : '');
    if (this.seenTips[key]) return;
    this.seenTips[key] = true;
    const v = h.variant && def.variants ? def.variants[h.variant] : null;
    const text = v && v.tip ? v.tip : def.tip;
    if (text) this.hud.tip(text, 3);
  }

  /** 弹道物落地（礼盒雨 / 香蕉 / 招牌 / 菠萝油）：落点同道即受击 */
  landDrop(h) {
    const p = this.player;
    h.active = false;
    const lz = h.behavior === 'lob' ? h.z1 : 0;
    if (this.camera.project(h.x, 0.3, lz)) {
      this.particles.burst(PK.CONFETTI, this.camera.px, this.camera.py - 4, 16, 60, 0.7, CONFETTI_COLORS, 120, 1, 30);
    }
    this.audio.play('giftLand');
    if (h.dodged || p.dead) return;
    if (Math.abs(p.x - h.x) < h.halfW + PLAYER.halfWidth) this.hitPlayer(h);
  }

  /** 碰撞判定：区分正面撞上（受击）和侧面擦碰（弹回原车道） */
  collide(h) {
    const p = this.player;
    const zOver = h.z < PLAYER.halfDepth && h.z + h.len > -PLAYER.halfDepth;
    const wasZ = h.zOver;
    h.zOver = zOver;
    if (!zOver) {
      h.xOver = false;
      return;
    }
    const xOver = Math.abs(p.x - h.x) < h.halfW + PLAYER.halfWidth;
    const wasX = h.xOver;
    h.xOver = xOver;
    if (!xOver) return;
    if (h.kind === 'slip' || h.kind === 'spring') {
      if (p.y > 0.35) return;
      h.done = true;
      if (h.kind === 'slip') this.onSlip(h);
      else this.onSpring(h);
      return;
    }
    if (h.stompable && p.y >= h.height - PLAYER.stepUpTolerance) {
      h.done = true;
      this.listener.onStomp(h);
      return;
    }
    let yHit = false;
    switch (h.kind) {
      case 'low':
        yHit = p.y < (h.walkable ? h.top - PLAYER.stepUpTolerance : h.height);
        break;
      case 'high':
        yHit = p.y + p.height > h.clearance && p.y < h.top;
        break;
      case 'full':
        yHit = p.y < h.height;
        break;
    }
    if (!yHit) return;
    if (wasZ && !wasX && !h.counterBullet) {
      // 变道时从侧面蹭上：弹回去，不扣心（手感宽容）
      h.xOver = false;
      p.bump(p.x < h.x ? -1 : 1);
      this.session.mistakes++;
      this.camera.shake(JUICE.shakeBump);
      this.audio.play('bump');
      this.hud.pop(TEXTS.bump, this.playerScreenX(), this.camera.feetY - 40, '#ffffff', 8, 0.5);
      return;
    }
    this.hitPlayer(h);
  }

  /** 动物便便：0.8s 内变道方向颠倒（喜剧障碍，不扣心） */
  onSlip(h) {
    const cfg = h.cfg || {};
    this.player.slip(cfg.slipTime || 0.8);
    this.session.mistakes++;
    this.audio.play('slip');
    this.camera.shake(1.5);
    this.hud.pop('打滑啦！方向颠倒', this.playerScreenX(), this.camera.feetY - 46, '#c98a3c', 8, 1);
  }

  /** 跳板 / 弹床：强制高弹跳（蟹老板的金色跳板同时触发踩跳还击） */
  onSpring(h) {
    const cfg = h.cfg || {};
    this.player.springLaunch(cfg.airTime || 1.2);
    this.audio.play('spring');
    const sx = this.playerScreenX();
    this.particles.ring(sx, this.camera.feetY, 16, 0.3, '#ffe066');
    this.particles.burst(PK.STAR, sx, this.camera.feetY - 4, 6, 50, 0.4, GOLD_COLORS);
    if (h.counterBullet) this.listener.onStomp(h);
  }

  /** 走在可站立障碍（购物车队）顶上时的地面高度 */
  groundHeight() {
    const p = this.player;
    let g = 0;
    const items = this.hazards.items;
    for (let i = 0; i < items.length; i++) {
      const h = items[i];
      if (!h.active || !h.walkable) continue;
      if (h.z < PLAYER.halfDepth && h.z + h.len > -PLAYER.halfDepth && Math.abs(p.x - h.x) < h.halfW + PLAYER.halfWidth * 0.5) {
        if (p.y >= h.top - PLAYER.stepUpTolerance && h.top > g) g = h.top;
      }
    }
    return g;
  }

  // ------------------------------------------------------------
  // 受击结算（8.2D 全局唯一顺序）：无敌帧 → 护盾（含 Boss 护罩）→ 守护换人 → 扣心
  // ------------------------------------------------------------

  hitPlayer(h) {
    const p = this.player;
    const s = this.session;
    h.done = true;
    const cam = this.camera;
    const sx = this.playerScreenX();
    const sy = this.playerScreenY() - 16;

    if (h.harmless) {
      // 还击教学物砸中：只会被砸懵，不扣心（硬直窗口是奖励时间，不惩罚）
      h.active = false;
      p.stagger(0.45);
      cam.shake(JUICE.shakeShield);
      this.audio.play('bump');
      this.particles.burst(PK.CONFETTI, sx, sy, 18, 70, 0.8, CONFETTI_COLORS, 120);
      this.listener.onCounterBonk(h);
      return;
    }
    if (p.invincible > 0) return;
    if (this.godMode) {
      this.hud.pop('无敌(调试)', sx, sy - 14, '#9fe3ff', 7);
      p.invincible = 0.5;
      return;
    }
    s.mistakes++;
    const bossShield = this.mode === 'boss' && s.bossShield > 0;
    if (bossShield || s.shield > 0) {
      if (bossShield) s.bossShield--;
      else s.shield--;
      p.invincible = COMBAT.invincibleTime;
      p.flash = 0.12;
      this.hitStop = COMBAT.shieldHitStop;
      cam.shake(JUICE.shakeShield);
      this.audio.play('shieldBreak');
      this.particles.burst(PK.SQUARE, sx, sy, 18, 90, 0.5, ['#8fd8ff', '#ffffff', '#4fb3ff'], 60, 2);
      this.particles.ring(sx, sy, 26, 0.35, '#8fd8ff');
      this.hud.pop(bossShield ? 'Boss护罩!' : TEXTS.shieldBreak, sx, sy - 18, '#9fe3ff', 10);
      return;
    }
    if (s.swapReady) {
      this.guardSwap();
      return;
    }
    s.hearts--;
    s.heartsLost++;
    if (this.mode === 'boss') s.bossHeartsLost++;
    this.flashRed = 0.6;
    cam.shake(JUICE.shakeHit);
    this.audio.play('hit');
    this.particles.burst(PK.SQUARE, sx, sy, 14, 80, 0.5, ['#ffffff', '#ff6fa5', '#3b1f3a'], 100, 2);
    if (s.hearts > 0) {
      p.invincible = COMBAT.invincibleTime;
      p.flash = 0.15;
      this.hitStop = COMBAT.hitStop;
      return;
    }
    this.hitStop = COMBAT.hitStop * 1.6;
    this.slowmo = COMBAT.deathSlowmo;
    p.die();
    const def = OBSTACLES[h.type];
    this.deathCause = def ? def.name : '';
    this.listener.onPlayerDeath(h);
  }

  /** 男友酱"守护换人"：本次伤害无效，两人击掌接力（0.1s 顿帧 + 0.25s 接力动画 + 0.8s 无敌） */
  guardSwap() {
    const s = this.session;
    const p = this.player;
    this.swapFrom = s.character;
    this.swapTo = s.doSwap();
    this.swapT = 0;
    this.swapDur = PARTNER.animTime;
    this.hitStop = PARTNER.hitStop;
    p.invincible = PARTNER.swapInvincible;
    p.flash = 0;
    p.locked = 0;
    this.camera.shake(2.5);
    this.audio.play('swap');
    this.audio.play('breath');
    const sx = this.playerScreenX();
    const sy = this.playerScreenY() - 18;
    this.particles.burst(PK.HEART, sx, sy, 16, 90, 0.8, PINK_COLORS, 20);
    this.particles.ring(sx, sy, 30, 0.35, '#ffffff');
    this.hud.pop(TEXTS.guard, sx, sy - 24, '#ffffff', 15, 1);
    if (s.fever) this.hud.pop('LOVE!', sx + 24, sy - 40, '#ff6fa5', 11, 1);
    const lines = CONFIG.memes.guardLines;
    if (lines && lines.length) {
      const who = this.swapTo === 'boy' ? '男友酱' : '女友酱';
      this.hud.tip(who + '：“' + lines[Math.floor(Math.random() * lines.length)] + '”', 1.8);
    }
  }

  /** 复活（复活机会 / 复活币）：原地以当前上限复活，清掉眼前的障碍 */
  revivePlayer() {
    const s = this.session;
    const p = this.player;
    s.hearts = s.maxHearts;
    s.revives--;
    s.revivesUsed++;
    p.revive();
    p.invincible = 2.2;
    this.slowmo = 0;
    this.hitStop = 0;
    const items = this.hazards.items;
    for (let i = 0; i < items.length; i++) {
      const h = items[i];
      if (h.active && h.behavior !== 'return' && h.z < 28) h.active = false;
    }
    const sx = this.playerScreenX();
    this.particles.burst(PK.HEART, sx, this.camera.feetY - 16, 24, 110, 1, PINK_COLORS, 10);
    this.particles.ring(sx, this.camera.feetY - 16, 40, 0.5, '#ffffff');
    this.flashWhite = 0.5;
    this.audio.play('shieldGet', 0.8);
    this.hud.pop('复活！', sx, this.camera.feetY - 50, '#ffffff', 14, 1.2);
  }

  setRain(on) {
    this.rain = on;
  }

  // ------------------------------------------------------------
  // 主角动作回调 & 完美闪避
  // ------------------------------------------------------------

  canDoubleJump() {
    return this.session.doubleJumps > 0 || this.session.powerups.springShoes > 0;
  }

  onCounter() {
    if (this.listener && this.listener.onCounter) this.listener.onCounter();
  }

  onEdgeBump(dir) {
    this.camera.shake(1.2);
    this.audio.play('bump', 1.3, 0.5);
  }

  /** 主角在缓冲上的屏幕坐标（飘字 / 粒子定位用） */
  playerScreenX() {
    const c = this.camera;
    return c.cx + ((this.player.x - c.x) * c.focal) / c.back;
  }

  playerScreenY() {
    const c = this.camera;
    return c.feetY - (this.player.y * c.focal) / c.back;
  }

  onPlayerAction(type) {
    const p = this.player;
    const sx = this.playerScreenX();
    const sy = this.playerScreenY();
    switch (type) {
      case 'jump':
      case 'coyoteJump':
        this.audio.play('jump');
        for (let i = 0; i < 4; i++) this.particles.spawn(PK.DUST, sx + (Math.random() - 0.5) * 10, sy - 1, (Math.random() - 0.5) * 30, -Math.random() * 12, 0.35, 2, DUST_COLORS[i % 3]);
        break;
      case 'doubleJump':
        this.audio.play('doubleJump');
        this.particles.ring(sx, sy, 12, 0.3, '#ffffff');
        this.particles.burst(PK.STAR_WHITE, sx, sy, 5, 40, 0.4, PINK_COLORS);
        // 弹跳鞋次数用完的瞬间提醒一次，避免"怎么突然跳不出来了"的困惑
        if (!this.session.doubleJumps && this.session.powerups.springShoes <= 0) {
          this.hud.tip('本局弹跳鞋的二段跳次数用完了', 1.8);
        }
        break;
      case 'slide':
      case 'slideLand':
      case 'fastFall':
        this.audio.play('slide');
        break;
      case 'lane':
        this.audio.play('lane');
        break;
    }
    if (type !== 'slideLand') this.checkPerfect(type);
  }

  onPlayerLand(impact) {
    const sx = this.playerScreenX();
    const sy = this.playerScreenY();
    this.audio.play('land', 1, Math.min(1, impact / 12));
    const n = JUICE.landDustCount + (impact > 14 ? 4 : 0);
    for (let i = 0; i < n; i++) {
      const dir = i & 1 ? 1 : -1;
      this.particles.spawn(PK.DUST, sx + dir * (2 + Math.random() * 6), sy - 1, dir * (20 + Math.random() * 30), -Math.random() * 14, 0.4, 2, DUST_COLORS[i % 3], 20, 3);
    }
    if (impact > 14) this.camera.shake(1.2);
  }

  /** 距离撞上还有多少秒（-1 = 不构成威胁） */
  timeToImpact(h) {
    if (h.kind === 'none' || h.kind === 'slip' || h.kind === 'spring') return -1;
    if (h.behavior === 'lob') return h.landHit ? h.T - h.t : -1;
    if (h.kind === 'drop') return h.locked ? h.z / Math.max(1, this.speedNow) : -1;
    const approach = (h.anchored ? this.speedNow : 0) + (h.vz || 0);
    if (approach <= 0) return -1;
    const gap = h.z - PLAYER.halfDepth;
    if (gap < 0) return -1;
    return gap / approach;
  }

  /** 某个状态（车道 x、脚底 y、是否滑铲）会不会被 h 撞到 */
  wouldHit(h, x, y, sliding, jumping) {
    if (Math.abs(x - h.x) >= h.halfW + PLAYER.halfWidth) return false;
    switch (h.kind) {
      case 'low':
        if (jumping) return false;
        return y < (h.walkable ? h.top - PLAYER.stepUpTolerance : h.height);
      case 'high':
        return !sliding;
      default:
        return true;
    }
  }

  /**
   * 完美闪避（3.3）：在障碍即将命中的 0.15s 内做出能躲开它的动作。
   * 判定 = 动作前的状态会被撞 && 动作后的状态不会被撞 → 本次闪避生效（该障碍不再判定碰撞）。
   * 反弹型还击物不在其列：躲开 = 错过反击机会，想弹回去要在金圈时刻按 J / 点击（完美反击）。
   */
  checkPerfect(type) {
    const p = this.player;
    // 男友酱在场时完美闪避窗口 +0.02s（"有他在，更稳"）
    const win = this.session.character === 'boy' ? COMBAT.perfectWindowWithPartner : COMBAT.perfectWindow;
    const postX = Player.laneX(p.lane);
    const postJump = type === 'jump' || type === 'coyoteJump' || type === 'doubleJump';
    const postSlide = type === 'slide' || type === 'fastFall' || (type === 'lane' && p.preSlide);
    let got = false;
    const items = this.hazards.items;
    for (let i = 0; i < items.length; i++) {
      const h = items[i];
      if (!h.active || h.dodged || h.done) continue;
      if (h.counterBullet) continue; // 还击物：只能拍击 / 踩 / 捡，闪避不产生额外奖励
      const tti = this.timeToImpact(h);
      if (tti < 0 || tti > win) continue;
      if (!this.wouldHit(h, p.preX, p.preY, p.preSlide, false)) continue;
      if (this.wouldHit(h, postX, p.y, postSlide, postJump)) continue;
      h.dodged = true;
      got = true;
    }
    if (got) this.triggerPerfect();
  }

  triggerPerfect() {
    const s = this.session;
    const p = this.player;
    s.perfects++;
    // 技能充能：+25%，完美连击每级再 +5%（封顶 +20%）
    const bonus = ENERGY.perfectStreakBonus * Math.min(ENERGY.perfectStreakMax, Math.max(0, this.perfectStreak));
    const before = s.energy;
    s.addEnergy(ENERGY.perfectGain + bonus);
    if (before < 0.999 && s.energy >= 0.999) {
      this.hud.flashEnergy();
      this.hud.tip(TEXTS.skillReady, 2.6);
    }
    this.perfectStreak++;
    this.perfectStreakTimer = 3;
    this.bulletTime = COMBAT.bulletTimeDuration;
    this.flashWhite = 0.45;
    this.audio.play('perfect', 1 + Math.min(4, this.perfectStreak - 1) * 0.06);
    const sx = this.playerScreenX();
    const sy = this.playerScreenY() - 16;
    this.hud.pop(this.perfectStreak > 1 ? TEXTS.perfect + ' ×' + this.perfectStreak : TEXTS.perfect, sx, sy - 22, '#ffe066', 13, 0.9);
    this.particles.ring(sx, sy, 34, 0.35, '#ffffff');
    this.particles.ring(sx, sy, 22, 0.28, '#ffe066');
    this.particles.burst(PK.STAR, sx, sy, 8, 70, 0.5, GOLD_COLORS);
    p.startGhosts(0.4);
    this.camera.shake(1);
  }

  /** 技能条是否已满（L / 双击屏幕释放） */
  get skillReady() {
    return this.session && this.session.energy >= 0.999;
  }

  /** 释放技能「回忆闪光」：清掉全场弹幕并转化为金币 + 短无敌；硬直窗口内释放会放宽下一次反击判定 */
  castSkill() {
    const s = this.session;
    if (!s || this.mode === 'demo' || s.energy < 0.999) {
      if (s && s.energy < 0.999 && this.mode !== 'demo') {
        this.hud.tip('技能还没满！完美闪避可以加快充能', 1.6);
      }
      return;
    }
    if (this.player.dead) return;
    s.energy = 0;
    // 清弹幕 → 每颗变成一枚金币（还击进行中的飞行物不动）
    const items = this.hazards.items;
    let cleared = 0;
    for (let i = 0; i < items.length; i++) {
      const h = items[i];
      if (!h.active || h.behavior === 'return' || h.harmless) continue;
      if (this.camera.project(h.x, Math.max(0.5, h.y), Math.max(0.5, h.z))) {
        this.particles.burst(PK.STAR, this.camera.px, this.camera.py, 6, 60, 0.5, GOLD_COLORS);
      }
      for (let k = 0; k < SKILL.coinsPerBullet; k++) this.spawnCoin(h.x, 0.8, Math.max(2, h.z));
      h.active = false;
      cleared++;
    }
    this.laneWarn.fill(0);
    // 在硬直窗口内释放：下一次反击判定放宽
    if (this.listener && this.listener.onSkillCast) this.listener.onSkillCast(cleared);
    this.skillBoostT = SKILL.boostTime;
    this.player.invincible = Math.max(this.player.invincible, SKILL.invincibleTime);
    this.player.skillInvT = this.player.invincible; // 技能无敌期间不闪烁（否则手机上频闪很难受）
    this.bulletTime = Math.max(this.bulletTime, SKILL.bulletTime);
    this.flashWhite = 0.35;
    this.camera.shake(JUICE.shakeBossHit);
    this.audio.play('fever');
    this.audio.play('perfect', 1.4);
    const sx = this.playerScreenX();
    const sy = this.playerScreenY() - 16;
    this.hud.center(TEXTS.skillCast, 1.2);
    this.hud.pop('+' + cleared + ' 金币', sx, sy - 26, '#ffe066', 10, 1);
    this.particles.ring(sx, sy, 60, 0.5, '#ffe066');
    this.particles.ring(sx, sy, 40, 0.4, '#ffffff');
    this.particles.burst(PK.HEART, sx, sy, 16, 110, 1.1, PINK_COLORS, 20);
    this.player.startGhosts(0.6);
  }

  // ------------------------------------------------------------
  // 金币 / 拾取物 / 装饰
  // ------------------------------------------------------------

  updateCoins(dt, speed) {
    const s = this.session;
    const p = this.player;
    const magnet = s.powerups.magnet > 0;
    const items = this.coins.items;
    const pyMid = p.y + 0.8;
    for (let i = 0; i < items.length; i++) {
      const c = items[i];
      if (!c.active) continue;
      c.phase += dt * 8;
      if (c.magnet) {
        const dx = p.x - c.x;
        const dy = pyMid - c.y;
        const dz = -c.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const step = COIN.magnetSpeed * dt;
        if (d <= step + 0.4) {
          this.collectCoin(c);
          continue;
        }
        c.x += (dx / d) * step;
        c.y += (dy / d) * step;
        c.z += (dz / d) * step;
        continue;
      }
      c.z -= speed * dt;
      if (magnet && !p.dead && c.z < COIN.magnetRange && c.z > -1) c.magnet = true;
      const rz = COIN.collectRadiusZ * s.pickupMul;
      if (!p.dead && c.z < rz && c.z > -rz && Math.abs(c.x - p.x) < COIN.collectRadiusX * s.pickupMul && c.y > p.y - 0.45 && c.y < p.y + p.height + 0.45) {
        this.collectCoin(c);
        continue;
      }
      if (c.z < WORLD.despawnZ) c.active = false;
    }
  }

  collectCoin(c) {
    const s = this.session;
    c.active = false;
    const mult = s.powerups.coinRain > 0 ? 2 : 1;
    const value = s.addCoins(ECONOMY.coinValue * mult);
    s.coinCombo++;
    s.comboTimer = ENERGY.comboWindow;
    if (s.coinCombo > s.bestCombo) s.bestCombo = s.coinCombo;
    if (s.coinCombo >= ENERGY.comboThreshold) {
      const before = s.energy;
      s.addEnergy(ENERGY.comboGainPerCoin);
      if (before < 0.999 && s.energy >= 0.999) this.hud.flashEnergy();
    }
    const step = s.coinCombo % 10;
    this.audio.play('coin', 1 + step * 0.045);
    if (this.camera.project(c.x, c.y, Math.max(c.z, 0))) {
      const x = this.camera.px;
      const y = this.camera.py;
      this.hud.coinFly(x, y, value);
      this.particles.spawn(PK.STAR, x, y, 0, -10, 0.25, 1, '#fff');
    } else {
      this.hud.coinFly(this.playerScreenX(), this.camera.feetY - 20, value);
    }
    if (s.coinCombo === ENERGY.comboThreshold) {
      this.hud.pop('连击 ' + ENERGY.comboThreshold + '! 能量UP', this.playerScreenX(), this.camera.feetY - 60, '#ffb3cf', 7, 0.9);
    }
  }

  updatePickups(dt, speed) {
    const p = this.player;
    const pm = this.session.pickupMul;
    const items = this.pickups.items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.active) continue;
      it.phase += dt * 4;
      it.z -= speed * dt;
      if (!p.dead && Math.abs(it.z) < 1.1 * pm && Math.abs(it.x - p.x) < 1.2 * pm && it.y > p.y - 0.6 && it.y < p.y + p.height + 0.6) {
        this.collectPickup(it);
        continue;
      }
      if (it.z < WORLD.despawnZ) {
        it.active = false;
        if (it.id === 'bun' && this.listener && this.listener.onBunMissed) this.listener.onBunMissed(it);
      }
    }
  }

  collectPickup(it) {
    const s = this.session;
    it.active = false;
    const def = PICKUPS[it.id];
    const sx = this.playerScreenX();
    const sy = this.camera.feetY - 40;
    let label = def.name;
    let color = '#ffffff';
    switch (it.id) {
      case 'magnet':
      case 'coinRain':
      case 'springShoes':
        s.powerups[it.id] = s.powerupDuration(def.duration);
        this.audio.play('pickup');
        break;
      case 'shield':
        s.shield = Math.min(2, s.shield + 1);
        this.audio.play('shieldGet');
        break;
      case 'heart':
        if (s.hearts < s.maxHearts) {
          s.hearts++;
          label = TEXTS.heartPlus;
        } else {
          // 生命已满：转为 1 层本关临时护盾（不叠加）
          if (s.shield < 1) s.shield = 1;
          label = TEXTS.heartShield;
        }
        this.audio.play('shieldGet', 1.2);
        break;
      case 'photo': {
        s.photosRun[it.idx] = true;
        let n = 0;
        for (let i = 0; i < 3; i++) if (s.photosRun[i] || (this.photosSaved && this.photosSaved[i])) n++;
        label = '照片碎片 ' + n + '/3 ！';
        color = '#ffe066';
        this.audio.play('photo');
        this.flashWhite = 0.35;
        this.particles.burst(PK.STAR, sx, sy + 10, 14, 90, 0.8, GOLD_COLORS);
        break;
      }
      case 'memory':
        s.ammo++;
        label = '回忆道具 +1（Boss 弹药）';
        this.audio.play('pickup', 1.2);
        break;
      case 'bun':
        this.audio.play('pickup', 1.4);
        this.listener.onAmmoPickup(it);
        break;
    }
    this.hud.pop(label, sx, sy, color, 9, 1.2);
    this.particles.burst(PK.HEART, sx, sy + 10, 8, 50, 0.6, PINK_COLORS);
    this.particles.ring(sx, sy + 10, 20, 0.3, '#ffffff');
  }

  updateDecor(dt, speed) {
    const items = this.decor.items;
    for (let i = 0; i < items.length; i++) {
      const d = items[i];
      if (!d.active) continue;
      d.z -= speed * dt;
      if (d.z < -4) d.active = false;
    }
  }

  // ------------------------------------------------------------
  // 渲染
  // ------------------------------------------------------------

  render(screen) {
    renderWorld(this, screen.bctx, screen.W, screen.H);
  }
}

function resetHazard(h) {
  h.variant = '';
  h.behavior = '';
  h.sprite = '';
  h.draw = 'lanes';
  h.fps = 4;
  h.deep = 1;
  h.anim = false;
  h.spanSprite = false;
  h.harmless = false;
  h.stompable = false;
  h.counterBullet = false;
  h.landHit = false;
  h.sideX = 0;
  h.crossStarted = false;
  h.vz = 0;
  h.fwdSpeed = 0;
  h.bob = 0;
  h.warnLead = 0;
  h.warned = false;
  h.edgeWarn = false;
  h.shoutLead = 0;
  h.shouted = false;
  h.bounces = 0;
  h.aimMiss = false;
  h.x = 0;
  h.halfW = 1;
  h.lanes = 1;
  h.lane = 0;
  h.z = 0;
  h.len = 1;
  h.height = 0;
  h.clearance = 0;
  h.top = 0;
  h.walkable = false;
  h.zOver = false;
  h.xOver = false;
  h.dodged = false;
  h.done = false;
  h.passed = false;
  h.reflectable = false;
  h.reflected = false;
  h.locked = false;
  h.t = 0;
  h.T = 1;
  h.age = 0;
  h.fan = 0;
  h.tipChecked = false;
  h.cfg = null;
  h.band = '';
  h.y = 0;
  h.anchored = true;
}
