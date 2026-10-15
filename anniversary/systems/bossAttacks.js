import { WORLD } from '../data/constants.js';

/**
 * M3 新增的 Boss 弹幕（木木 / 章章 / 蟹老板 / 吞吞复刻），以"注册表"形式挂到 BossDirector 上：
 *   ATTACKS[type] = { fire(director, spec, spawner), threat(director) → [开始, 结束] 秒（用于错开不同弹幕）}
 *   PENDING[type] = (director, pendingEntry) → 延时生成
 * 参数都在 data/bosses.js 的 bullets 里。
 */
const LANE_W = WORLD.laneWidth;

/** 通用抛物线弹幕（连抛 / 泡泡雨 / 记忆洪流）的默认弹道参数 */
const LOB_DEFAULT = { flightTime: 0.9, arcHeight: 4.5 };

function travel(d, c) {
  return (d.data.z - 1) / (c.speed * d.speedMul());
}

function lobT(d, c) {
  return Math.max(d.params.warning + 0.3, c.flightTime / d.speedMul());
}

/** 选一条空道（尽量不和上次一样，逼玩家移动；避开被封锁的道） */
function pickFree(d) {
  return d.pickFreeLane();
}

/** 多个红圈同时落下，只留 free 这一条道 */
function multiLob(d, sprite, c) {
  const free = pickFree(d);
  let n = 0;
  for (let l = -1; l <= 1 && n < (c.count || 2); l++) {
    if (l === free) continue;
    d.fireLob(sprite, l, c);
    n++;
  }
  d.boss.targetX = free * LANE_W * 0.5;
}

export const ATTACKS = {
  // ---------------- 木木 ----------------
  /** 两匹木马绕着转圈冲过来：到面前时要么占左右两道（中间安全），要么都在中间（两边安全） */
  horses: {
    fire(d) {
      const c = d.data.bullets.horse;
      const m = d.speedMul();
      const T = travel(d, c);
      d.flags.horseOuter = !d.flags.horseOuter;
      let outer = d.flags.horseOuter;
      // 车道封锁期间：安全道不能是被锁的中间道 → 翻转成两边安全
      if (outer && d.lockLane === 0) {
        outer = false;
        d.flags.horseOuter = false;
      }
      const w = (Math.PI * 2) / c.period;
      const target = outer ? Math.PI / 2 : 0;
      for (const off of [0, Math.PI]) {
        const h = d.world.spawnBullet('horse', 'full');
        h.draw = 'center';
        h.behavior = 'orbit';
        h.fps = 6;
        h.orbitR = LANE_W;
        h.orbitW = w;
        h.orbitP0 = target - w * T + off;
        h.t = 0;
        h.x = h.orbitR * Math.sin(h.orbitP0);
        h.z = d.data.z - 1;
        h.len = c.length;
        h.height = c.height;
        h.halfW = LANE_W / 2 - 0.35;
        h.vz = c.speed * m;
      }
      const lw = d.world.laneWarn;
      if (outer) {
        lw[0] = Math.max(lw[0], T + 0.2);
        lw[2] = Math.max(lw[2], T + 0.2);
      } else {
        lw[1] = Math.max(lw[1], T + 0.2);
      }
      d.audio.play('throw', 0.7);
    },
    threat(d) {
      const t = travel(d, d.data.bullets.horse);
      return [t - 0.25, t + 0.3];
    },
  },

  /** 彩环：同时砸两条道，只留一条空道 */
  ringLob: {
    fire(d) {
      multiLob(d, 'ring', d.data.bullets.ringLob);
    },
    threat(d) {
      const T = lobT(d, d.data.bullets.ringLob);
      return [T - 0.2, T + 0.2];
    },
  },

  /** 转盘冲刺：横扫全场的高转盘，只能踩它吐出的弹床飞过去 */
  spinSweep: {
    fire(d) {
      d.fireCarpet('spinSweep');
    },
    threat(d) {
      const c = d.data.bullets.spinSweep;
      const m = d.speedMul();
      const t = d.params.warning + c.telegraphExtra + travel(d, c);
      return [t - 0.3, t + Math.max(c.springAir, (c.springAhead + c.length) / (c.speed * m)) + 0.1];
    },
  },

  // ---------------- 章章 ----------------
  /** 章鱼烧弹珠：落地后弹到旁边的道再落一次（红圈连环） */
  ballBounce: {
    fire(d) {
      const c = d.data.bullets.ballBounce;
      const h = d.fireLob('takoBall', d.world.player.lane, c);
      h.bounces = c.bounces;
    },
    /** 落地（已判定过伤害）→ 从落点弹向另一条道 */
    bounce(d, h) {
      const c = d.data.bullets.ballBounce;
      const lane = Math.round(h.x1 / LANE_W);
      const opts = [-1, 0, 1].filter((l) => l !== lane);
      const next = opts[Math.floor(Math.random() * opts.length)];
      const b = d.world.spawnBullet('takoBall', 'drop');
      b.behavior = 'lob';
      b.landHit = true;
      b.x0 = h.x1;
      b.y0 = 0.3;
      b.z0 = h.z1;
      b.x1 = next * LANE_W;
      b.z1 = h.z1;
      b.x = b.x1;
      b.z = b.z1;
      b.len = 0.1;
      b.halfW = LANE_W / 2 - 0.4;
      b.T = Math.max(d.params.warning + 0.25, c.bounceTime / d.speedMul());
      b.arcH = 2.6;
      b.bounces = h.bounces - 1;
      d.audio.play('bounce', 1 + Math.random() * 0.2);
    },
    threat(d) {
      const c = d.data.bullets.ballBounce;
      const T = lobT(d, c);
      const bt = Math.max(d.params.warning + 0.25, c.bounceTime / d.speedMul());
      return [T - 0.2, T + c.bounces * bt + 0.2];
    },
  },

  /** 章鱼烧暴雨：两颗同时砸，留一条空道 */
  takoRain: {
    fire(d) {
      multiLob(d, 'takoBall', d.data.bullets.takoRain);
    },
    threat(d) {
      const T = lobT(d, d.data.bullets.takoRain);
      return [T - 0.2, T + 0.2];
    },
  },

  /** 木鱼敲击波："咚、咚、咚"三道等间隔地波，跟着节拍跳 */
  beatWave: {
    fire(d) {
      const c = d.data.bullets.beatWave;
      const m = d.speedMul();
      for (let i = 0; i < c.count; i++) d.schedule(i * c.beat, 'beat', 0, 3, m);
    },
    threat(d) {
      const c = d.data.bullets.beatWave;
      const t = travel(d, c);
      return [t - 0.2, t + (c.count - 1) * c.beat + 0.25];
    },
  },

  // ---------------- 蟹老板 ----------------
  /** 泡泡：center = 两边的泡泡往中间合拢（两边安全）；sides = 占住左右两道（中间安全） */
  bubbles: {
    fire(d, spec, sp) {
      const c = d.data.bullets.bubbles;
      const seq = spec.sequence || ['center'];
      let mode = seq[(sp ? sp.seq++ : 0) % seq.length];
      // 车道封锁期间：安全道不能是被锁的中间道 → 翻转成两边安全
      if (mode !== 'center' && d.lockLane === 0) mode = 'center';
      const m = d.speedMul();
      const T = travel(d, c);
      for (const s of [-1, 1]) {
        const h = d.world.spawnBullet('seaBubble', 'full');
        h.draw = 'center';
        h.behavior = 'slide';
        h.bob = 0.3;
        h.t = 0;
        h.T = T;
        h.x0 = s * LANE_W * (mode === 'center' ? 1.4 : 0.35);
        h.x1 = mode === 'center' ? 0 : s * LANE_W;
        h.x = h.x0;
        h.z = d.data.z - 1;
        h.len = c.length;
        h.height = c.height;
        h.halfW = LANE_W / 2 - 0.4;
        h.vz = c.speed * m;
      }
      const lw = d.world.laneWarn;
      if (mode === 'center') lw[1] = Math.max(lw[1], T + 0.2);
      else {
        lw[0] = Math.max(lw[0], T + 0.2);
        lw[2] = Math.max(lw[2], T + 0.2);
      }
      d.audio.play('bubble');
    },
    threat(d) {
      const t = travel(d, d.data.bullets.bubbles);
      return [t - 0.25, t + 0.35];
    },
  },

  /** 巨钳横扫：左钳右钳交替扫过全场（贴地），跳过去 */
  clawSweep: {
    fire(d, spec, sp) {
      const c = d.data.bullets.clawSweep;
      const left = sp ? sp.seq++ % 2 === 0 : true;
      const h = d.world.spawnBullet(left ? 'clawL' : 'clawR', 'low');
      h.draw = 'stretch';
      h.x = 0;
      h.halfW = 1.5 * LANE_W - 0.2;
      h.z = d.data.z - 1;
      h.len = c.length;
      h.height = c.height;
      h.vz = c.speed * d.speedMul();
      d.boss.targetX = (left ? -1 : 1) * LANE_W * 0.6;
      d.boss.sx = 1.25;
      d.audio.play('throw', 0.6);
    },
    threat(d) {
      const t = travel(d, d.data.bullets.clawSweep);
      return [t - 0.2, t + 0.3];
    },
  },

  // ---------------- 金刚 · 藤蔓双荡（P2 新） ----------------
  /** 藤蔓秋千：影子按 左→中→右 逐道扫过；低荡扫腿（跳）、高荡扫头顶（铲），且要跟着扫动方向让道 */
  vineSweep: {
    fire(d, spec, sp) {
      const c = d.data.bullets.vineSweep;
      const m = d.speedMul();
      const dir = spec.dir || (Math.random() < 0.5 ? 1 : -1);
      const idx = sp ? sp.seq++ : 0;
      const form = spec.form || (idx % 2 === 0 ? 'low' : 'high');
      const lanes = dir > 0 ? [-1, 0, 1] : [1, 0, -1];
      for (let i = 0; i < lanes.length; i++) d.schedule(i * c.beat, 'vine', lanes[i], 1, m, form);
      d.boss.targetX = (dir > 0 ? -1 : 1) * LANE_W;
      d.audio.play('throw', 0.7);
    },
    threat(d) {
      const c = d.data.bullets.vineSweep;
      const t = travel(d, c);
      return [t - 0.2, t + 2 * c.beat + 0.3];
    },
  },

  /** 跑道塌陷（金刚）/ 触手按道（章章）：一条道被堵死一段时间，期间其他攻击避开它 */
  laneLock: {
    fire(d, spec) {
      const key = spec.bullet || spec.type;
      const c = d.data.bullets[key];
      const m = d.speedMul();
      let lane = Math.floor(Math.random() * 3) - 1;
      if (lane === d.world.player.lane && Math.random() < 0.6) lane = ((lane + 2 + Math.floor(Math.random() * 2)) % 3) - 1;
      d.lockLane = lane;
      d.lockLaneT = c.lockTime;
      const telegraph = d.params.warning + (c.telegraphExtra || 0.3);
      const t = telegraph + travel(d, c);
      d.world.laneWarn[lane + 1] = t + 0.3;
      d.boss.targetX = lane * LANE_W * 0.6;
      d.schedule(telegraph, 'laneLock', lane, 1, m, key);
      if (key === 'tentacle' && c.reSlam) {
        // 触手会在同一道再拍一次，封锁感更足
        d.schedule(telegraph + c.reSlam, 'laneLock', lane, 1, m, key);
      }
      d.audio.play('warning');
    },
    threat(d, spec) {
      const c = d.data.bullets[spec.bullet || spec.type];
      const t = d.params.warning + (c.telegraphExtra || 0.3) + travel(d, c);
      return [t - 0.3, t + 0.6];
    },
  },

  // ---------------- 木木 · 追逐链 / 摩天轮（P2 新） ----------------
  /** 追逐链：红道像波浪一样按节拍依次转移，安全道一直在漂移 → 全程连续换道跟随 */
  chaseChain: {
    fire(d, spec, sp) {
      const c = d.data.bullets.chaseChain;
      const m = d.speedMul();
      let dir = Math.random() < 0.5 ? 1 : -1;
      let lane = Math.floor(Math.random() * 3) - 1;
      if (sp) sp.seq++;
      const mid = Math.floor(c.count / 2);
      for (let i = 0; i < c.count; i++) {
        d.schedule(i * c.beat, 'chainHit', lane, 1, m, '');
        if (spec.reverse && i + 1 === mid) dir = -dir; // 进阶：链到一半反向
        lane += dir;
        if (lane > 1) lane = -1;
        else if (lane < -1) lane = 1;
      }
      d.audio.play('warning');
    },
    threat(d) {
      const c = d.data.bullets.chaseChain;
      const t = travel(d, c);
      return [t - 0.25, t + (c.count - 1) * c.beat + 0.3];
    },
  },

  /** 摩天轮：两道宽的巨梁滚来，紧接着第二根错开换两条道 → 唯一安全道换了一次，需要两段换道 */
  ferrisWheel: {
    fire(d, spec) {
      const c = d.data.bullets.ferrisWheel;
      const m = d.speedMul();
      const leftFirst = Math.random() < 0.5;
      const t1 = d.params.warning + c.telegraphExtra;
      d.schedule(t1, 'wheel', leftFirst ? -1 : 0, 2, m, '');
      d.schedule(t1 + c.secondDelay, 'wheel', leftFirst ? 0 : -1, 2, m, '');
      d.boss.sy = 0.8;
      d.audio.play('warning');
    },
    threat(d) {
      const c = d.data.bullets.ferrisWheel;
      const t = d.params.warning + c.telegraphExtra + travel(d, c);
      return [t - 0.3, t + c.secondDelay + 0.4];
    },
  },

  // ---------------- 蟹老板 · 沙墙（P2 新） ----------------
  /** 沙墙推进：慢速全宽沙墙带一个洞（金光柱），洞里还有低沙坎 → 提前站位 + 到点跳 */
  sandWall: {
    fire(d) {
      const c = d.data.bullets.sandWall;
      const m = d.speedMul();
      const hole = pickFree(d);
      for (let l = -1; l <= 1; l++) {
        if (l === hole) continue;
        d.world.laneWarn[l + 1] = travel(d, c) + 0.5;
        d.schedule(0, 'sand', l, 1, m, '');
      }
      d.schedule(0, 'sandRidge', hole, 1, m, '');
      d.boss.sy = 0.75;
      d.audio.play('bossLand', 1.2, 0.5);
    },
    threat(d) {
      const c = d.data.bullets.sandWall;
      const t = travel(d, c);
      return [t - 0.3, t + 0.6];
    },
  },

  /** 泡沫阵雨：随机道的红圈泡泡雨（轻量填充） */
  bubbleRain: {
    fire(d, spec, sp) {
      const c = d.data.bullets.bubbleRain;
      const m = d.speedMul();
      if (sp) sp.seq++;
      for (let i = 0; i < c.count; i++) {
        const lane = d.pickLane('random');
        d.schedule(i * c.interval, 'lobAt', lane, 1, m, c.sprite);
      }
      d.audio.play('bubble');
    },
    threat(d) {
      const c = d.data.bullets.bubbleRain;
      const T = lobT(d, LOB_DEFAULT);
      return [T - 0.2, T + (c.count - 1) * c.interval + 0.2];
    },
  },

  // ---------------- 章章 · 双手连抛（P2 新） ----------------
  /** 双手连抛：左右手按节拍交替把章鱼烧抛向玩家当前道（节奏红圈连躲） */
  dualLob: {
    fire(d, spec, sp) {
      const c = d.data.bullets.dualLob;
      const m = d.speedMul();
      if (sp) sp.seq++;
      for (let i = 0; i < c.count; i++) d.schedule(i * c.interval, 'duallob', 0, 1, m, i % 2 ? 'L' : 'R');
      d.audio.play('throw', 1.1);
    },
    threat(d) {
      const c = d.data.bullets.dualLob;
      const T = lobT(d, LOB_DEFAULT);
      return [T - 0.2, T + (c.count - 1) * c.interval + 0.2];
    },
  },

  // ---------------- 吞吞 · 遗忘之墨 / 记忆洪流（P2 新） ----------------
  /** 遗忘之墨：3 秒左右颠倒（复用主角的打滑机制），屏幕蒙上墨色 */
  ink: {
    fire(d) {
      d.world.player.slip(3.2);
      d.world.inkT = 3.2;
      d.hud.tip('遗忘之墨！3 秒内 ←→ 颠倒！', 2.4);
      d.hud.pop('←→ 颠倒!', d.world.camera.cx, d.world.camera.H * 0.4, '#b39ddb', 11, 1.2);
      d.audio.play('slip');
      d.boss.sy = 0.8;
    },
    threat() {
      return null; // 纯干扰，不占威胁窗
    },
  },

  /** 记忆洪流（终结技）：三道连环红圈滚动推进，唯一空档匀速移动 → 全程跟档连续换道 */
  flood: {
    fire(d, spec, sp) {
      const c = d.data.bullets.flood;
      const m = d.speedMul();
      if (sp) sp.seq++;
      let free = Math.floor(Math.random() * 3) - 1;
      const dir = Math.random() < 0.5 ? 1 : -1;
      for (let i = 0; i < c.count; i++) {
        for (let l = -1; l <= 1; l++) if (l !== free) d.schedule(i * c.beat, 'lobAt', l, 1, m, c.sprite);
        free += dir;
        if (free > 1) free = -1;
        else if (free < -1) free = 1;
      }
      d.audio.play('fever', 0.8);
    },
    threat(d) {
      const c = d.data.bullets.flood;
      const T = lobT(d, LOB_DEFAULT);
      return [T - 0.2, T + (c.count - 1) * c.beat + 0.2];
    },
  },
};

export const PENDING = {
  beat(d, p) {
    const c = d.data.bullets.beatWave;
    const h = d.world.spawnBullet('beatWave', 'low');
    h.draw = 'stretch';
    h.fps = 10;
    h.x = 0;
    h.halfW = 1.5 * LANE_W - 0.2;
    h.z = d.data.z - 1;
    h.len = c.length;
    h.height = c.height;
    h.vz = c.speed * p.speedMul;
    d.boss.sy = 0.75;
    d.audio.play('tock');
  },

  /** 藤蔓秋千的一道摆击：low = 扫腿（跳）/ high = 扫头顶（铲） */
  vine(d, p) {
    const c = d.data.bullets.vineSweep;
    const low = p.key !== 'high';
    const h = d.world.spawnBullet(low ? 'vineLow' : 'vineHigh', low ? 'low' : 'high');
    h.sprite = low ? c.spriteLow : c.spriteHigh;
    h.draw = 'center';
    h.fps = 8;
    h.spanSprite = !low; // banner 素材是按道数的版本
    h.lane = p.lane;
    h.x = p.lane * LANE_W;
    h.halfW = LANE_W / 2 - 0.3;
    h.z = d.data.z - 1;
    h.len = c.length;
    if (low) h.height = c.lowHeight;
    else {
      h.clearance = c.highClearance;
      h.top = c.highTop;
    }
    h.vz = c.speed * p.speedMul;
    d.world.laneWarn[p.lane + 1] = c.beat + travel(d, c) + 0.2;
    d.audio.play(low ? 'throw' : 'bubble', 0.8);
  },

  /** 车道封锁（塌陷 / 触手）：一堵跳不过去的墙占住这条道 */
  laneLock(d, p) {
    const c = d.data.bullets[p.key];
    const h = d.world.spawnBullet(p.key, 'full');
    h.sprite = c.sprite;
    h.draw = c.draw || 'center';
    h.fps = c.fps || 6;
    h.anim = !!c.anim;
    h.lane = p.lane;
    h.x = p.lane * LANE_W;
    h.halfW = LANE_W / 2 - 0.35;
    h.z = d.data.z - 1;
    h.len = c.length;
    h.height = c.height; // 3m+：跳不过去，只能换道
    h.vz = c.speed * p.speedMul;
    d.audio.play(p.key === 'pit' ? 'bossLand' : 'bubble', 1.2, 0.5);
  },

  /** 追逐链的一拍：目标道冒出一堵快速的能量墙（红道已提前亮） */
  chainHit(d, p) {
    const c = d.data.bullets.chaseChain;
    const h = d.world.spawnBullet('chainBlock', 'full');
    h.sprite = c.sprite;
    h.draw = 'center';
    h.fps = 10;
    h.anim = true;
    h.lane = p.lane;
    h.x = p.lane * LANE_W;
    h.halfW = LANE_W / 2 - 0.3;
    h.z = d.data.z - 1;
    h.len = c.length;
    h.height = c.height;
    h.vz = c.speed * p.speedMul;
    d.world.laneWarn[p.lane + 1] = c.beat + travel(d, c) + 0.15;
    d.audio.play('tock', 1.15);
  },

  /** 摩天轮的一根梁：占两条道 */
  wheel(d, p) {
    const c = d.data.bullets.ferrisWheel;
    const h = d.world.spawnBullet('ferrisWheel', 'full');
    h.sprite = 'ferrisBeam';
    h.spanSprite = true; // ferrisBeam = [null, 1道, 2道, 3道]
    h.draw = 'lanes';
    h.lanes = p.lanes;
    h.lane = p.lane;
    h.x = (p.lane + (p.lanes - 1) / 2) * LANE_W;
    h.halfW = (p.lanes * LANE_W) / 2 - 0.3;
    h.z = d.data.z - 1;
    h.len = c.length;
    h.height = c.height;
    h.vz = c.speed * p.speedMul;
    for (let l = 0; l < p.lanes; l++) d.world.laneWarn[p.lane + l + 1] = travel(d, c) + 0.3;
    d.audio.play('throw', 0.7);
  },

  /** 沙墙的一堵（占一条道，跳不过去） */
  sand(d, p) {
    const c = d.data.bullets.sandWall;
    const h = d.world.spawnBullet('sandWall', 'full');
    h.sprite = 'sandWall';
    h.draw = 'center';
    h.lane = p.lane;
    h.x = p.lane * LANE_W;
    h.halfW = LANE_W / 2 - 0.25;
    h.z = d.data.z - 1;
    h.len = c.length;
    h.height = c.height;
    h.vz = c.speed * p.speedMul;
  },

  /** 沙墙洞里的低沙坎（要跳）+ 洞口的金色光圈提示 */
  sandRidge(d, p) {
    const c = d.data.bullets.sandWall;
    const h = d.world.spawnBullet('sandRidge', 'low');
    h.sprite = 'sandRidge';
    h.draw = 'stretch';
    h.lane = p.lane;
    h.x = p.lane * LANE_W;
    h.halfW = LANE_W / 2 - 0.3;
    h.z = d.data.z - 1;
    h.len = c.ridgeLength;
    h.height = c.ridgeHeight;
    h.vz = c.speed * p.speedMul;
    const g = d.world.spawnBullet('holeGlow', 'none');
    g.sprite = 'ringGold';
    g.draw = 'decal';
    g.harmless = true;
    g.x = p.lane * LANE_W;
    g.halfW = LANE_W / 2;
    g.z = d.data.z - 1;
    g.len = c.ridgeLength;
    g.vz = c.speed * p.speedMul;
  },

  /** 通用延时抛物线：key = 精灵名，落点是排程时定好的道 */
  lobAt(d, p) {
    const c = d.data.bullets.lob || LOB_DEFAULT;
    d.fireLob(p.key, p.lane, c);
  },

  /** 双手连抛的一发：落地前一刻才锁定玩家当前道（节奏连躲） */
  duallob(d, p) {
    const c = d.data.bullets.dualLob;
    const lane = d.lockLane !== null && d.world.player.lane === d.lockLane ? d.pickLane('others') : d.world.player.lane;
    const h = d.fireLob(c.sprite, lane, d.data.bullets.lob || LOB_DEFAULT);
    if (h) {
      h.x0 = (p.key === 'L' ? -1 : 1) * LANE_W * 1.2;
      h.y0 = 2.4;
    }
  },
};
