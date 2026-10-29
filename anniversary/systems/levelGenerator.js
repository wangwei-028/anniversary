import { WORLD, SPEED, PLAYER } from '../data/constants.js';
import { OBSTACLES } from '../data/obstacles.js';
import { COIN } from '../data/pickups.js';
import { runInterval } from './difficulty.js';
import { Pool } from './pool.js';
import { SPRITES } from './sprites.js';

/**
 * 关卡生成器（跑酷段）：完全按 data/levels.js 的区段数据生成内容。
 * - 以"到达时间"规划：前方每一行内容属于它"到达主角时"所处的区段，所以区段横幅与内容同步
 * - 障碍间隔 ≥ 难度表最小间隔；组合（双连）组内恰好等于最小间隔，组间更宽松
 * - 同屏障碍数 ≤ 难度表上限；全高障碍最多堵 2 道，永远留活路
 * - 金币沿"安全路线"摆放，低障碍上方摆弧线、横幅下方摆低空金币，引导玩家做动作
 * - 照片碎片（7.2）：岔路型 / 技巧型 / 挑战型，存档里已收集的不再出现
 */
const LANE_W = WORLD.laneWidth;
const E_OBST = 1;
const E_COIN = 2;
const E_PICK = 3;
const E_SIGN = 4;
const E_DECOR = 5;

export class LevelGenerator {
  constructor(world, level, params, photosSaved) {
    this.world = world;
    this.level = level;
    this.params = params;
    this.sections = level.run.sections;
    this.photoCfg = level.photos || [];
    this.photosSaved = photosSaved || [false, false, false];
    this.photoPlaced = [false, false, false];
    this.starts = [];
    let t = 0;
    for (const sec of this.sections) {
      this.starts.push(t);
      t += sec.duration;
    }
    this.total = t;
    const last = this.sections[this.sections.length - 1];
    this.rampEnd = last.kind === 'sprint' ? t - last.duration : t;
    this.time = 0;
    this.sectionIndex = -1;
    this.plan = new Pool(() => ({ dist: 0, kind: 0, type: '', variant: '', lane: 0, lanes: 1, dir: 1, x: 0, y: 0, idx: 0, len: 0, ref: null }), 480);
    this.plannedUntil = 0;
    this.finished = false;
    this.scriptIndex = 0;
    this.heartDone = false;
    this.escDone = {};
    this.pickupsDone = {};
    this.nextSignDist = 0;
    this.signIndex = 0;
    this.signSide = 1;
    this.recent = new Float64Array(10).fill(-1e9);
    this.recentIdx = 0;
    this.comboLeft = 0;
    this.snakePhase = 0;
    this.arcLane = -1;
    this.arcStep = 0;
    this.onSection = null;
    const assets = SPRITES.levelAssets[level.id];
    this.signs = assets ? assets.signs : [];
    this.env = level.env || {};
    if (level.run.rampTime) this.rampEnd = level.run.rampTime;
    this.trampDone = {};
    this.trampEnd = -1;
    this.galleryDone = {};
    this.tideNext = {};
    // 无尽模式 Boss 客串时暂停生成障碍（只摆金币）
    this.hold = false;
  }

  start(trackPos, speed) {
    this.plannedUntil = trackPos + speed * 2.4;
    this.nextSignDist = trackPos + 26;
  }

  get progress() {
    return Math.min(1, this.time / this.total);
  }

  get done() {
    return this.time >= this.total;
  }

  sectionAt(t) {
    for (let i = this.starts.length - 1; i >= 0; i--) if (t >= this.starts[i]) return i;
    return 0;
  }

  /** 速度曲线（4.2）：基础 8 m/s 线性升到本关上限，冲刺段拉满 */
  targetSpeedAt(t) {
    const sec = this.sections[this.sectionAt(t)];
    if (sec.kind === 'sprint') return this.params.speedMax;
    const k = Math.max(0, Math.min(1, t / this.rampEnd));
    return SPEED.base + (this.params.speedMax - SPEED.base) * k;
  }

  update(dt, trackPos, speed) {
    this.time += dt;
    const idx = this.sectionAt(this.time);
    if (idx !== this.sectionIndex && this.time < this.total) {
      if (this.sectionIndex >= 0) this.onSectionEnd(this.sections[this.sectionIndex], trackPos);
      this.sectionIndex = idx;
      if (this.onSection) this.onSection(this.sections[idx], idx);
    }
    this.checkSkillPhoto(trackPos);
    const v = Math.max(1, speed);
    let guard = 0;
    while (!this.finished && this.plannedUntil < trackPos + WORLD.spawnZ + 6 && guard++ < 10) {
      this.planNext(trackPos, v);
    }
    // 路边装饰：商场的梗店名招牌 / 动物园的树和告示牌 / 香港的霓虹招牌（回忆走廊里让位给相框）
    if (!this.finished && this.signs.length && trackPos + WORLD.spawnZ >= this.nextSignDist) {
      if (this.world.zoneAt(this.nextSignDist) !== 4) {
        const sp = this.signs[this.signIndex % this.signs.length];
        this.signIndex++;
        this.world.spawnDecor(sp, this.signSide * (this.env.decorX || 5.5), this.env.decorY === undefined ? 3.6 : this.env.decorY, this.nextSignDist - trackPos);
        this.signSide = -this.signSide;
      }
      this.nextSignDist += 26 + Math.random() * 18;
    }
    const lim = trackPos + WORLD.spawnZ;
    const items = this.plan.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (e.active && e.dist <= lim) {
        this.instantiate(e, e.dist - trackPos);
        e.active = false;
      }
    }
  }

  push(dist, kind, type) {
    const e = this.plan.obtain();
    e.dist = dist;
    e.kind = kind;
    e.type = type || '';
    e.variant = '';
    e.lane = 0;
    e.lanes = 1;
    e.dir = 1;
    e.x = 0;
    e.y = 0;
    e.idx = 0;
    e.len = 0;
    e.ref = null;
    return e;
  }

  // ---------------- 照片碎片 ----------------

  photoAvailable(i) {
    return this.photoCfg[i] && !this.photosSaved[i] && !this.photoPlaced[i] && !this.world.session.photosRun[i];
  }

  pushPhoto(i, dist, lane, y) {
    this.photoPlaced[i] = true;
    const e = this.push(dist, E_PICK, 'photo');
    e.x = lane * LANE_W;
    e.y = y;
    e.idx = i;
  }

  /** 找一条在距离 z 附近没有障碍的车道（优先 preferred），都不行返回 null */
  clearLane(z, preferred) {
    const order = [preferred, 0, -1, 1];
    const items = this.world.hazards.items;
    for (const l of order) {
      let ok = true;
      for (let i = 0; i < items.length && ok; i++) {
        const h = items[i];
        if (!h.active || h.kind === 'none') continue;
        if (h.z < z + 4 && h.z + h.len > z - 4 && Math.abs(h.x - l * LANE_W) < h.halfW + 0.6) ok = false;
      }
      if (ok) return l;
    }
    return null;
  }

  /** 技巧型：指定区段之后连续完美闪避 N 次 → 前方高处出现（要跳起来拿） */
  checkSkillPhoto(trackPos) {
    for (let i = 0; i < this.photoCfg.length; i++) {
      const c = this.photoCfg[i];
      if (c.type !== 'skill' || !this.photoAvailable(i)) continue;
      const from = this.sections.findIndex((s) => s.id === c.from);
      if (from < 0 || this.time < this.starts[from] || this.time > this.total - 4) continue;
      if (this.world.perfectStreak >= c.streak) {
        const z = WORLD.spawnZ - 20;
        const lane = this.clearLane(z, this.world.player.lane);
        if (lane === null) continue;
        this.pushPhoto(i, trackPos + z, lane, 2.3);
        this.world.hud.tip('连续完美闪避！前方高处有照片碎片，跳起来拿！', 3);
      }
    }
  }

  /** 通过型：挺过指定区段 → 下一屏在路面刷出（不要求零失误，零失误判定太隐蔽难以达成） */
  onSectionEnd(sec, trackPos) {
    for (let i = 0; i < this.photoCfg.length; i++) {
      const c = this.photoCfg[i];
      if (c.type !== 'clear' || c.section !== sec.id || !this.photoAvailable(i)) continue;
      const z = WORLD.spawnZ - 25;
      const lane = this.clearLane(z, 0);
      this.pushPhoto(i, trackPos + z, lane === null ? 0 : lane, lane === null ? 2.3 : 0.9);
      this.world.hud.tip('挺过来了！前方出现了照片碎片！', 3);
    }
  }

  coin(dist, x, y) {
    const e = this.push(dist, E_COIN, '');
    e.x = x;
    e.y = y;
  }

  instantiate(e, z) {
    const w = this.world;
    switch (e.kind) {
      case E_OBST: {
        const h = w.spawnObstacle(e.type, e.variant, e.lane, e.lanes, z);
        if (h.type === 'tourists') {
          h.moveDir = e.dir;
        }
        if (e.len) h.len = e.len;
        break;
      }
      case E_COIN:
        w.spawnCoin(e.x, e.y, z);
        break;
      case E_PICK:
        w.spawnPickup(e.type, e.x, e.y, z, e.idx);
        break;
      case E_SIGN:
        w.spawnDecor(e.type === 'escUp' ? SPRITES.signEscUp : SPRITES.signEscDown, -5.5, 3.6, z);
        break;
      case E_DECOR:
        w.spawnDecor(e.ref, e.x, e.y, z);
        break;
    }
  }

  zoneMulAt(dist) {
    const k = this.world.zoneAt(dist);
    return k === 1 ? SPEED.escalatorUpMul : k === 2 ? SPEED.escalatorDownMul : k === 4 ? SPEED.galleryMul : 1;
  }

  recordObstacle(dist) {
    this.recent[this.recentIdx] = dist;
    this.recentIdx = (this.recentIdx + 1) % this.recent.length;
  }

  /** 同屏障碍上限：可见深度内障碍数达到上限就把这一行往后推 */
  enforceCap(D) {
    const cap = this.params.maxOnScreen;
    const depth = WORLD.onScreenDepth;
    for (let iter = 0; iter < 4; iter++) {
      let count = 0;
      let earliest = Infinity;
      for (let i = 0; i < this.recent.length; i++) {
        const d = this.recent[i];
        if (d > D - depth && d <= D) {
          count++;
          if (d < earliest) earliest = d;
        }
      }
      if (count < cap) return D;
      D = earliest + depth + 0.5;
    }
    return D;
  }

  planNext(trackPos, speed) {
    const D0 = this.plannedUntil;
    const tArr0 = this.time + (D0 - trackPos) / speed;
    if (tArr0 >= this.total) {
      this.finished = true;
      return;
    }
    const si = this.sectionAt(tArr0);
    const sec = this.sections[si];
    const vArr = Math.max(speed, this.targetSpeedAt(tArr0));

    // 扶梯区段：按到达时间开启
    if (sec.escalator && !this.escDone[si] && tArr0 >= this.starts[si] + sec.escalator.at) {
      this.escDone[si] = true;
      const kind = sec.escalator.kind === 'up' ? 1 : 2;
      const mul = kind === 1 ? SPEED.escalatorUpMul : SPEED.escalatorDownMul;
      this.world.addZone(D0, D0 + sec.escalator.duration * vArr * mul, kind);
      this.push(D0 - 5, E_SIGN, kind === 1 ? 'escUp' : 'escDown');
    }
    // 弹床区（游乐园）：区内只摆空中金币，落地即被弹起
    if (sec.trampoline && !this.trampDone[si] && tArr0 >= this.starts[si] + sec.trampoline.at) {
      this.trampDone[si] = true;
      const len = sec.trampoline.duration * vArr;
      this.world.addZone(D0 + 2, D0 + 2 + len, 3);
      this.world.trampAir = sec.trampoline.airTime;
      this.planTrampoline(sec, D0 + 2, len, vArr);
      return;
    }
    // 回忆走廊（家）：放慢 + 两侧挂满相框
    if (sec.kind === 'gallery' && !this.galleryDone[si]) {
      this.galleryDone[si] = true;
      this.planGallery(sec, D0, vArr);
      return;
    }
    const v = vArr * this.zoneMulAt(D0);

    if (sec.kind === 'breather' || sec.kind === 'gallery' || this.hold) {
      this.planBreather(sec, si, D0, v);
      return;
    }

    // 潮汐（海边）：按到达时间周期性涨潮
    if (sec.tide) {
      if (this.tideNext[si] === undefined) this.tideNext[si] = this.starts[si] + sec.tide.first;
      if (tArr0 >= this.tideNext[si] && tArr0 < this.starts[si] + sec.duration - sec.tide.duration - 1) {
        this.tideNext[si] = tArr0 + sec.tide.every;
        this.comboLeft = 0;
        this.planTide(sec, D0, v);
        return;
      }
    }

    // 组合（双连）：组内第 2 行恰好隔"最小间隔"，组与组之间按区段放宽倍率 × 1.25
    const comboN = sec.combo ? Math.max(1, Math.min(sec.combo, this.params.comboLength || sec.combo)) : 1;
    let D;
    if (this.comboLeft > 0) {
      this.comboLeft--;
      D = D0 + this.params.minInterval * v;
    } else {
      const interval = runInterval(this.params, sec.intervalMul);
      D = D0 + interval * v * (1 + Math.random() * 0.22) * (comboN > 1 ? 1.25 : 1);
      this.comboLeft = comboN - 1;
    }
    D = this.enforceCap(D);
    const tArr = this.time + (D - trackPos) / speed;
    const secAtRow = this.sections[this.sectionAt(Math.min(tArr, this.total - 0.001))];
    const quiet = sec.quietTail && tArr > this.total - sec.quietTail;
    if (tArr >= this.total || quiet || secAtRow.kind === 'breather' || secAtRow.kind === 'gallery') {
      this.comboLeft = 0;
      this.planCoinsGap(sec, D0, D, null);
      this.plannedUntil = D;
      return;
    }
    const spec = this.pickSpec(sec, si, tArr);
    if (!spec) {
      this.comboLeft = 0;
      this.planCoinsGap(sec, D0, D, null);
      this.plannedUntil = D;
      return;
    }
    if (spec.heartAir) {
      // 爱心挂在高空（弹床区里弹得够高才拿得到）
      const hp = this.push((D0 + D) / 2, E_PICK, 'heart');
      hp.x = (Math.floor(Math.random() * 3) - 1) * LANE_W;
      hp.y = spec.heartAir;
      this.planCoinsGap(sec, D0, D, null);
      this.plannedUntil = D;
      return;
    }
    const def = OBSTACLES[spec.type];
    const variant = spec.variant || '';
    const vdef = variant && def.variants ? def.variants[variant] : null;
    const len = vdef && vdef.length ? vdef.length : def.length;
    const nl = Math.min(spec.lanes || 1, def.maxLanes || 3);

    // 报刊亭 / 小吃摊车 S 型：两行各堵 2 道、缺口一左一右 → 必须连续变道
    if (spec.combo === 'S') {
      this.planSCombo(sec, def, spec.type, D0, D, len, v);
      return;
    }
    // 摩天轮：横梁（滑铲）后面紧跟立柱（变道）
    if (spec.combo === 'HF') {
      this.planHF(sec, spec.type, D0, D, len, v);
      return;
    }
    // 塑料凳阵：同一种低障碍连跳三下
    if (spec.combo === 'triple') {
      this.planTriple(sec, spec.type, nl, D0, D, len, v);
      return;
    }

    // 向前走的障碍（人力车）：靠近后才起步，到达时间推迟，金币 / 爱心按"实际到达位置"摆
    const extra = def.forward ? (def.forward.startZ * def.forward.speed) / Math.max(1, v - def.forward.speed) : 0;
    // 朝主角冲过来的（彩带）会提前到达：生成点往后挪，保证"到达时间"仍满足最小间隔
    if (extra < 0) D -= extra;
    const Dc = D + extra;

    let laneStart;
    let dir = 1;
    if (def.pattern === 'sides') {
      // 港铁闸机：左右两道同时堵住，只留中间
      for (const l of [-1, 1]) {
        const g = this.push(D, E_OBST, spec.type);
        g.lane = l;
        g.lanes = 1;
      }
      laneStart = -1;
    } else {
      laneStart = this.chooseLanes(nl, spec.lane === 'player');
      const e = this.push(D, E_OBST, spec.type);
      e.variant = variant;
      e.lane = laneStart;
      e.lanes = nl;
      if (def.moving) e.dir = laneStart >= 1 ? -1 : laneStart <= -1 ? 1 : Math.random() < 0.5 ? -1 : 1;
      dir = e.dir;
    }
    this.recordObstacle(Dc);

    if (spec.heart) {
      const hp = this.push(Dc + len * 0.55, E_PICK, 'heart');
      hp.x = laneStart * LANE_W;
      hp.y = ((vdef && vdef.walkTop) || def.walkTop || def.height || 1) + 0.85;
    }
    if (spec.photo !== undefined) {
      // 岔路型照片：藏在全高障碍正后方的那条道上（绕开后要马上切回来拿）
      const pl = laneStart + Math.floor(Math.random() * nl);
      for (let d = Dc + len + 1.2; d < Dc + len + 3.6; d += 1.2) this.coin(d, pl * LANE_W, COIN.height);
      this.pushPhoto(spec.photo, Dc + len + 4.2, pl, 0.9);
    }

    const row = def.pattern === 'sides' ? { def, variant, vdef, laneStart: -1, nl: 1, len, dir, guide: 0 } : { def, variant, vdef, laneStart, nl, len, dir, guide: 0 };
    row.guide = def.pattern === 'sides' ? 0 : this.chooseGuideLane(row);
    this.planCoinsGap(sec, D0, Dc, row);

    // 道具：放在金币路线之外的车道
    if (sec.pickupChance && sec.pickupPool && Math.random() < sec.pickupChance && D - D0 > 14) {
      const id = weighted(sec.pickupPool).id;
      let lane = Math.floor(Math.random() * 3) - 1;
      if (lane === row.guide) lane = lane === 1 ? -1 : lane + 1;
      const pk = this.push((D0 + D) / 2, E_PICK, id);
      pk.x = lane * LANE_W;
      pk.y = COIN.pickupHeight;
    }
    this.plannedUntil = Dc + len + (spec.photo !== undefined ? 5 : 0);
  }

  /** S 型双连：第 1 行堵 [s1, s1+1]，第 2 行堵另一侧，组内恰好隔"最小间隔" */
  planSCombo(sec, def, type, D0, D, len, v) {
    const s1 = Math.random() < 0.5 ? -1 : 0;
    const s2 = s1 === -1 ? 0 : -1;
    const D2 = D + len + this.params.minInterval * v;
    for (const [d, s] of [[D, s1], [D2, s2]]) {
      const e = this.push(d, E_OBST, type);
      e.lane = s;
      e.lanes = 2;
      this.recordObstacle(d);
    }
    const free1 = s1 === -1 ? 1 : -1;
    const free2 = s2 === -1 ? 1 : -1;
    if (Math.random() <= (sec.coinChance === undefined ? 0.8 : sec.coinChance)) {
      for (let d = D0 + 3; d < D - 3; d += COIN.spacing) this.coin(d, free1 * LANE_W, COIN.height);
      for (let d = D; d < D + len; d += COIN.spacing) this.coin(d, free1 * LANE_W, COIN.height);
      // 两行之间：一串斜着的金币指路
      const a = D + len + 0.5;
      const b = D2 - 0.5;
      for (let d = a; d < b; d += COIN.spacing) {
        const u = (d - a) / Math.max(0.1, b - a);
        this.coin(d, (free1 + (free2 - free1) * Math.min(1, u * 1.4)) * LANE_W, COIN.height);
      }
      for (let d = D2; d < D2 + len; d += COIN.spacing) this.coin(d, free2 * LANE_W, COIN.height);
    }
    this.comboLeft = 0;
    this.plannedUntil = D2 + len;
  }

  /** 摩天轮支架：横梁（三道，滑铲）后面 0.9 秒紧跟立柱（堵两道，变道） */
  planHF(sec, beamType, D0, D, len, v) {
    const beam = this.push(D, E_OBST, beamType);
    beam.lane = -1;
    beam.lanes = 3;
    this.recordObstacle(D);
    const pdef = OBSTACLES.ferrisPillar;
    const D2 = D + len + 0.9 * v;
    const s = Math.random() < 0.5 ? -1 : 0;
    const pil = this.push(D2, E_OBST, 'ferrisPillar');
    pil.lane = s;
    pil.lanes = 2;
    this.recordObstacle(D2);
    const free = s === -1 ? 1 : -1;
    // 横梁下方贴地金币 → 立柱的空道
    for (let d = D - 3; d < D + len + 1.5; d += 1.4) this.coin(d, free * LANE_W, 0.35);
    for (let d = D + len + 2; d < D2 + pdef.length; d += COIN.spacing) this.coin(d, free * LANE_W, COIN.height);
    this.planCoinsGap(sec, D0, D, null);
    this.comboLeft = 0;
    this.plannedUntil = D2 + pdef.length;
  }

  /** 塑料凳阵：同一种低障碍连跳三下（间隔不低于 1 秒） */
  planTriple(sec, type, nl, D0, D, len, v) {
    const gap = Math.max(1.0, this.params.minInterval * 0.7) * v;
    let d = D;
    const lane = nl >= 3 ? -1 : this.chooseLanes(nl, true);
    for (let i = 0; i < 3; i++) {
      const e = this.push(d, E_OBST, type);
      e.lane = lane;
      e.lanes = nl;
      this.recordObstacle(d);
      // 每个凳子上方一道跳跃弧线金币
      const gx = (lane + Math.floor(nl / 2)) * LANE_W;
      for (let k = 0; k < 5; k++) {
        const u = k / 4;
        this.coin(d - 3 + u * (len + 6), gx, COIN.height + 1.4 * 4 * u * (1 - u));
      }
      d += len + gap;
    }
    this.comboLeft = 0;
    this.plannedUntil = d - gap;
  }

  /** 弹床区：每次落地都被弹起；空中按弹跳弧线摆金币，每弹一次换一条道 */
  planTrampoline(sec, start, len, v) {
    const air = sec.trampoline.airTime;
    const hop = v * air;
    const apex = (PLAYER.jumpHeight * air * air) / (PLAYER.jumpAirTime * PLAYER.jumpAirTime);
    let lane = this.world.player.lane;
    const hops = Math.max(1, Math.floor((len - hop * 0.5) / hop));
    let k = 0;
    for (let d0 = start; d0 < start + len - hop * 0.5; d0 += hop, k++) {
      for (let u = 0.12; u < 0.9; u += 0.13) {
        this.coin(d0 + u * hop, lane * LANE_W, 0.6 + apex * 4 * u * (1 - u) * 0.85);
      }
      // 本关唯一的爱心：挂在中间那一跳的最高点
      if (sec.heart && sec.heart.air && !this.heartDone && k === Math.floor(hops / 2)) {
        this.heartDone = true;
        const hp = this.push(d0 + hop * 0.5, E_PICK, 'heart');
        hp.x = lane * LANE_W;
        hp.y = 0.6 + apex * 0.85 + 0.2;
      }
      const opts = [-1, 0, 1].filter((l) => Math.abs(l - lane) === 1);
      lane = opts[Math.floor(Math.random() * opts.length)];
    }
    this.comboLeft = 0;
    this.plannedUntil = start + len + 3;
  }

  /** 潮汐：左右两道被海水淹没 duration 秒（中间安全），潮退后两边铺满金币 */
  planTide(sec, D0, v) {
    const D = D0 + v * 0.6;
    const L = sec.tide.duration * v;
    for (const l of [-1, 1]) {
      const e = this.push(D, E_OBST, 'tide');
      e.lane = l;
      e.lanes = 1;
      e.len = L;
    }
    this.recordObstacle(D);
    for (let d = D - 4; d < D + L; d += COIN.spacing) this.coin(d, 0, COIN.height);
    const after = D + L + 2;
    for (let d = after; d < after + v * 1.6; d += COIN.spacing) {
      this.coin(d, -LANE_W, COIN.height);
      this.coin(d, LANE_W, COIN.height);
    }
    this.plannedUntil = after + v * 1.2;
  }

  /** 回忆走廊：速度放慢；两侧挂满 21 个相框（已收集 = 照片，未收集 = 模糊剪影） */
  planGallery(sec, D0, vArr) {
    const len = sec.duration * vArr * SPEED.galleryMul;
    this.world.addZone(D0, D0 + len, 4);
    const frames = SPRITES.memoryFrames || [];
    const n = frames.length;
    for (let i = 0; i < n; i++) {
      const e = this.push(D0 + 6 + ((len - 10) * i) / Math.max(1, n - 1), E_DECOR, '');
      e.ref = frames[i];
      e.x = (i % 2 === 0 ? -1 : 1) * 5.2;
      e.y = 1.1;
    }
    let ph = 0;
    for (let d = D0 + 2; d < D0 + len; d += COIN.spacing) {
      ph += COIN.spacing * 0.1;
      this.coin(d, Math.sin(ph) * LANE_W, COIN.height);
    }
    this.comboLeft = 0;
    this.plannedUntil = D0 + len + 2;
  }

  pickSpec(sec, si, tArr) {
    if (sec.script && this.scriptIndex < sec.script.length) return sec.script[this.scriptIndex++];
    const prog = (tArr - this.starts[si]) / sec.duration;
    if (sec.heart && !this.heartDone && prog >= sec.heart.at) {
      this.heartDone = true;
      if (sec.heart.air) return { heartAir: sec.heart.air };
      return { type: sec.heart.obstacle || 'cart', variant: sec.heart.variant || '', lanes: 1, heart: true };
    }
    for (let i = 0; i < this.photoCfg.length; i++) {
      const c = this.photoCfg[i];
      if (c.type === 'branch' && c.section === sec.id && prog >= c.at && this.photoAvailable(i)) {
        return { type: c.obstacle, lanes: 2, photo: i };
      }
    }
    if (!sec.pool) return null;
    return weighted(sec.pool);
  }

  /** 选障碍起始车道：60% 概率覆盖主角当前所在车道（制造"必须操作"） */
  chooseLanes(nl, mustCoverPlayer) {
    if (nl >= 3) return -1;
    const pl = this.world.player.lane;
    const maxStart = 2 - nl;
    if (mustCoverPlayer || Math.random() < 0.6) {
      const lo = Math.max(-1, pl - nl + 1);
      const hi = Math.min(maxStart, pl);
      return lo + Math.floor(Math.random() * (hi - lo + 1));
    }
    return -1 + Math.floor(Math.random() * (maxStart + 2));
  }

  /** 金币引导路线：低障碍 / 横幅 / 车顶有一半概率引导玩家"做动作"，全高障碍只走空道 */
  chooseGuideLane(row) {
    const { def, laneStart, nl } = row;
    const inRow = (l) => l >= laneStart && l < laneStart + nl;
    if (def.kind === 'drop') return Math.floor(Math.random() * 3) - 1;
    const free = [];
    for (let l = -1; l <= 1; l++) {
      if (inRow(l)) continue;
      if (def.moving && l === laneStart + row.dir) continue;
      free.push(l);
    }
    const actionable = def.kind === 'low' || def.kind === 'high';
    if (actionable && (free.length === 0 || Math.random() < (row.vdef && row.vdef.walkable ? 0.7 : 0.5))) {
      return laneStart + Math.floor(Math.random() * nl);
    }
    if (free.length === 0) return 0;
    return free[Math.floor(Math.random() * free.length)];
  }

  planCoinsGap(sec, D0, D, row) {
    const sp = COIN.spacing;
    if (sec.coinRain) {
      // 冲刺段金币雨：三道铺满
      for (let d = D0 + 2; d < D - 4; d += sp) {
        for (let l = -1; l <= 1; l++) this.coin(d, l * LANE_W, COIN.height + Math.sin(d * 0.5 + l) * 0.25);
      }
      if (row) this.planRowCoins(row, D, true);
      return;
    }
    if (Math.random() > (sec.coinChance === undefined ? 0.8 : sec.coinChance)) return;
    const g = row ? row.guide : Math.floor(Math.random() * 3) - 1;
    const end = row ? D - 5 : D - 1;
    for (let d = D0 + 3; d < end; d += sp) this.coin(d, g * LANE_W, COIN.height);
    if (row) this.planRowCoins(row, D, false);
  }

  /** 障碍所在行的金币：跳跃弧线 / 滑铲低空 / 车顶 */
  planRowCoins(row, D, allLanes) {
    const { def, laneStart, nl, len, vdef } = row;
    for (let l = laneStart; l < laneStart + nl; l++) {
      if (!allLanes && l !== row.guide) continue;
      const x = l * LANE_W;
      if (def.kind === 'low') {
        if (vdef && vdef.walkable) {
          // 起跳弧线 + 车顶一串
          for (let i = 0; i < 4; i++) this.coin(D - 4 + i * 1.3, x, COIN.height + i * 0.45);
          for (let d = D + 0.6; d < D + len - 0.4; d += COIN.spacing) this.coin(d, x, vdef.walkTop + 0.6);
        } else {
          const a = D - 4.5;
          const b = D + len + 4.5;
          const n = 7;
          for (let i = 0; i < n; i++) {
            const u = i / (n - 1);
            this.coin(a + (b - a) * u, x, COIN.height + 1.5 * 4 * u * (1 - u));
          }
        }
      } else if (def.kind === 'high') {
        for (let d = D - 3; d < D + len + 2.5; d += 1.4) this.coin(d, x, 0.35);
      }
    }
  }

  planBreather(sec, si, D0, v) {
    if (!this.pickupsDone[si] && sec.pickups) {
      this.pickupsDone[si] = true;
      for (let i = 0; i < sec.pickups.length; i++) {
        const pk = this.push(D0 + 5 + i * 5, E_PICK, sec.pickups[i]);
        pk.x = 0;
        pk.y = COIN.pickupHeight;
      }
    }
    if (sec.coinPattern === 'arcs') {
      // 弧线（跳着吃）+ 地面一小段，车道依次轮换
      const arcLen = v * 0.62;
      const groundLen = v * 0.45;
      const x = this.arcLane * LANE_W;
      const n = Math.max(5, Math.round(arcLen / 1.2));
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        this.coin(D0 + u * arcLen, x, COIN.height + 1.4 * 4 * u * (1 - u));
      }
      for (let d = D0 + arcLen + 1.2; d < D0 + arcLen + groundLen; d += COIN.spacing) this.coin(d, x, COIN.height);
      this.arcStep++;
      this.arcLane = (this.arcStep % 3) - 1;
      this.plannedUntil = D0 + arcLen + groundLen;
      return;
    }
    // snake：在三道之间平滑蛇形
    const chunk = v * 1.5;
    for (let d = D0; d < D0 + chunk; d += COIN.spacing) {
      this.snakePhase += COIN.spacing * 0.12;
      this.coin(d, Math.sin(this.snakePhase) * LANE_W, COIN.height);
    }
    this.plannedUntil = D0 + chunk;
  }
}

function weighted(pool) {
  let total = 0;
  for (const p of pool) total += p.w || 1;
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.w || 1;
    if (r <= 0) return p;
  }
  return pool[pool.length - 1];
}
