import { PlayScene } from './PlayScene.js';
import { GameSession } from '../systems/session.js';
import { LevelGenerator } from '../systems/levelGenerator.js';
import { BossDirector } from '../systems/bossDirector.js';
import { getDifficultyParams } from '../systems/difficulty.js';
import { settleEndless } from '../systems/economy.js';
import { LEVELS, getLevel } from '../data/levels.js';
import { BOSSES } from '../data/bosses.js';
import { SPEED } from '../data/constants.js';
import { SPRITES } from '../systems/sprites.js';

/**
 * 无尽模式（8.6）：通关全部 7 关后解锁，任选地图跑无尽。
 * - 障碍：前 6 关的障碍随机混编，一波比一波紧（区段放宽倍率逐渐收到 1.0）
 * - Boss 弹幕随机客串：每 40 秒左右，一只 Boss 在画面外扔 7 秒招牌弹幕（期间不生成障碍）
 * - 分数 = 距离 + 金币 × 5 + 完美闪避 × 20；本地记录每张地图的最高分；金币全额入账
 */
const CAMEO_BOSSES = ['meow', 'kong', 'bo', 'mumu', 'zhang', 'crab'];
const CAMEO_FIRST = 35;
const CAMEO_EVERY = 40;
const CAMEO_TIME = 7;

/** 把前 6 关所有波次的障碍池合在一起（去掉需要区段配合的潮汐） */
function mixedPool() {
  const pool = [];
  for (const lv of LEVELS) {
    if (!lv.run || lv.id > 6) continue;
    for (const sec of lv.run.sections) {
      if (!sec.pool || sec.kind !== 'wave') continue;
      for (const p of sec.pool) if (p.type !== 'tide') pool.push(p);
    }
  }
  return pool;
}

function pickSome(pool, n) {
  const out = [];
  const used = new Set();
  let guard = 0;
  while (out.length < n && guard++ < 50) {
    const p = pool[Math.floor(Math.random() * pool.length)];
    if (used.has(p.type)) continue;
    used.add(p.type);
    out.push(p);
  }
  return out;
}

/** 按选中的地图生成一份"无尽"关卡数据（约 36 分钟，实际上跑不完） */
export function makeEndlessLevel(base) {
  const pool = mixedPool();
  const sections = [
    {
      id: 'warmup',
      kind: 'warmup',
      title: '无尽模式',
      subtitle: base.name + ' · 跑到哪算哪',
      duration: 8,
      intervalMul: 1.5,
      pool: pickSome(pool, 3),
      coinChance: 1,
      pickupChance: 0.1,
      pickupPool: [{ id: 'magnet', w: 1 }],
    },
  ];
  const pickups = [
    { id: 'magnet', w: 2 },
    { id: 'coinRain', w: 2 },
    { id: 'shield', w: 1 },
    { id: 'springShoes', w: 1 },
  ];
  for (let c = 0; c < 80; c++) {
    sections.push({
      id: 'w' + c,
      kind: 'wave',
      title: '第 ' + (c + 1) + ' 波',
      subtitle: c < 3 ? '热热身' : c < 8 ? '越来越快了' : '还能坚持吗？',
      duration: 22,
      intervalMul: Math.max(1.0, 1.5 - c * 0.07),
      combo: c >= 3 ? 2 : 0,
      pool: pickSome(pool, 4),
      coinChance: 0.85,
      pickupChance: 0.15,
      pickupPool: pickups,
    });
    sections.push({ id: 'r' + c, kind: 'breather', title: '喘口气~', subtitle: '金币时间', duration: 5, coinPattern: c % 2 ? 'arcs' : 'snake' });
  }
  return { ...base, photos: [], introObstacles: [], run: { sections, rampTime: SPEED.endlessRamp } };
}

export class EndlessScene extends PlayScene {
  enter(params) {
    const g = this.game;
    const mapId = params.mapId || 1;
    this.mapId = mapId;
    this.mode = params.mode || g.save.data.settings.difficulty;
    const base = getLevel(mapId);
    const level = makeEndlessLevel(base);
    const s = new GameSession(mapId, this.mode, g.save, params.loadout || []);
    s.level = level;
    s.mapId = mapId;
    s.params = getDifficultyParams(4, this.mode);
    s.params.speedMax = SPEED.endlessMax;
    this.session = s;
    this.banked = false;
    this.best = g.save.data.endless.best[String(mapId)] || 0;
    const w = g.world;
    g.useLevel(mapId);
    w.begin(s, this, 'run');
    w.hidePlayer = false;
    w.targetSpeed = SPEED.base;
    w.photosSaved = [true, true, true];
    this.gen = new LevelGenerator(w, level, s.params, [true, true, true]);
    this.gen.start(s.trackPos, s.speed);
    this.gen.onSection = (sec, idx) => {
      if (idx === 0) w.hud.banner('无尽模式', base.name + ' · 最高 ' + this.best, 1.8);
      else if (sec.kind === 'wave') w.hud.banner(sec.title, sec.subtitle, 1.4);
    };
    this.nextCameo = CAMEO_FIRST;
    this.cameo = null;
    this.state = 'play';
    this.paused = false;
    this.deathT = 0;
    g.audio.stopMusic();
    g.audio.playMusic(base.music || 'mall');
    this.buildHud();
  }

  get score() {
    const s = this.session;
    return Math.floor(s.trackPos) + s.coins * 5 + s.perfects * 20;
  }

  /** Boss 客串：一只 Boss 在画面外扔几轮招牌弹幕 */
  startCameo() {
    const w = this.world;
    const id = CAMEO_BOSSES[Math.floor(Math.random() * CAMEO_BOSSES.length)];
    const data = BOSSES[id];
    const ph = data.phases[Math.floor(Math.random() * data.phases.length)];
    const spec = ph.waves[0].spawns[0];
    const d = new BossDirector(w, data, this.session.params, { onDefeated() {} });
    d.state = 'cameo';
    d.boss.visible = false;
    this.cameo = { d, spec, sp: { seq: 0 }, t: 0, next: 0.8, every: Math.max(1.8, spec.every), name: data.name };
    this.gen.hold = true;
    w.hud.banner('Boss 客串！', data.title + '「' + data.name + '」的' + ph.name, 1.8);
    this.game.audio.play('bossAppear', 1.2, 0.5);
  }

  updateCameo(dt) {
    const c = this.cameo;
    c.t += dt;
    c.d.time += dt;
    c.d.updatePending(dt);
    if (c.t < CAMEO_TIME && c.t >= c.next) {
      c.d.fire({ spec: c.spec, seq: c.sp.seq++ });
      c.next += c.every;
    }
    if (c.t >= CAMEO_TIME + 2.5) {
      this.cameo = null;
      this.gen.hold = false;
      this.nextCameo = this.gen.time + CAMEO_EVERY;
    }
  }

  update(dtReal) {
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
        if (this.cameo) this.updateCameo(dt);
        else if (this.gen.time >= this.nextCameo) this.startCameo();
      }
    } else if (this.state === 'dying') {
      this.updateDying(dtReal);
      if (this.state === 'dead') return;
    }
    w.update(dt);
    w.hud.update(dtReal);
  }

  onDeathFinal() {
    const g = this.game;
    if (this.banked) return;
    this.banked = true;
    this.world.hud.flushCoins(this.session.coins);
    const res = settleEndless(g.save, this.session, this.score);
    g.switchScene('result', { endless: res, session: this.session });
  }

  /** 中途退出也结算 */
  bankCoins() {
    if (this.banked) return;
    this.banked = true;
    settleEndless(this.game.save, this.session, this.score);
  }

  restart() {
    this.game.switchScene('endless', { mapId: this.mapId, mode: this.mode });
  }

  /** 客串 Boss 的盲盒落地 / 章鱼烧弹跳 */
  onLobLand(h) {
    if (this.cameo) this.cameo.d.onLobLand(h);
  }

  render() {
    const sc = this.score;
    this.renderCommon({
      mode: 'endless',
      score: sc,
      best: Math.max(this.best, sc),
      cameo: this.cameo ? this.cameo.name + '客串中' : '',
      bossIcon: SPRITES.bossIcons.meow,
    });
  }

  debugSkip() {
    this.nextCameo = this.gen.time;
  }
}
