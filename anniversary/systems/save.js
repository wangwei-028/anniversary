/**
 * 存档系统（localStorage）。
 * - 数据结构带 version 字段；读档时按 MIGRATIONS 逐版本升级，再与默认结构深合并补齐新字段 → 改版不丢档
 * - 存档损坏时把原始字符串备份到 KEY + '.corrupt'，不直接覆盖
 * - localStorage 不可用（隐私模式等）时退化为内存存档，游戏照常运行
 * - 开发者模式（config.devMode）：使用独立存档 KEY + '.dev'，每次启动金币拉满、关卡全解锁
 */
import { ECONOMY } from '../data/economy.js';

const KEY = 'benxiangni.save';
export const SAVE_VERSION = 3;

function defaultLevelRecord() {
  return { cleared: false, clears: 0, plays: 0, bestCoins: 0, bestPerfects: 0, stars: [false, false, false], photos: [false, false, false] };
}

/** 版本迁移表：MIGRATIONS[n] 负责把 n-1 版升级到 n 版（以后改结构时在这里加） */
const MIGRATIONS = {
  1: (data) => data,
  // v2（M2）：每关增加星级 / 照片碎片记录；M1 已通关的关卡补上“通关”那颗星（不补发金币）
  2: (data) => {
    const levels = data.levels || {};
    for (const k of Object.keys(levels)) {
      const lv = levels[k];
      if (!Array.isArray(lv.stars)) lv.stars = [!!lv.cleared, false, false];
      if (!Array.isArray(lv.photos)) lv.photos = [false, false, false];
    }
    data.levels = levels;
    return data;
  },
  // v3（M3）：皮肤 / 无尽模式 / Boss Rush / 放映厅——新字段由默认结构自动补齐
  3: (data) => data,
};

function defaultSave() {
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    coins: 0,
    // 每关记录：见 defaultLevelRecord()
    levels: {},
    // 能力加点等级 { coinSense: 0, ... }
    upgrades: {},
    // 出战道具库存 { startShield: 0, ... }
    items: {},
    partner: { unlocked: false },
    // 皮肤：已拥有 / 当前穿着
    skins: { owned: ['default'], equipped: 'default' },
    // 无尽模式：每张地图的最高分
    endless: { best: {}, plays: 0 },
    // Boss Rush「回忆风暴」：白金奖章战绩
    rush: { cleared: false, clears: 0, bestTime: 0, bestNoDamage: 0, attempts: 0 },
    // 回忆放映厅是否看过
    theaterSeen: false,
    // 上次进关携带的道具（关卡准备页默认勾选）
    loadout: [],
    settings: {
      muted: false,
      musicVolume: 0.7,
      sfxVolume: 0.9,
      difficulty: 'standard',
    },
    stats: {
      totalRuns: 0,
      totalPerfects: 0,
      totalCoins: 0,
      bossDefeats: 0,
      guardSwaps: 0,
    },
  };
}

function deepMerge(base, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return base;
  for (const k of Object.keys(data)) {
    const bv = base[k];
    const dv = data[k];
    if (bv && typeof bv === 'object' && !Array.isArray(bv) && dv && typeof dv === 'object' && !Array.isArray(dv)) {
      base[k] = deepMerge(bv, dv);
    } else if (dv !== undefined) {
      base[k] = dv;
    }
  }
  return base;
}

export class SaveSystem {
  constructor(dev = false) {
    this.dev = !!dev;
    this.key = this.dev ? KEY + '.dev' : KEY;
    this.available = this.checkAvailable();
    this.data = this.load();
    if (this.dev) this.applyDev();
  }

  applyDev() {
    this.data.coins = ECONOMY.maxCoins;
    this.save();
  }

  checkAvailable() {
    try {
      const k = KEY + '.probe';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  load() {
    if (!this.available) return defaultSave();
    let raw = null;
    try {
      raw = window.localStorage.getItem(this.key);
      // 第一次打开开发者模式：从正式存档复制一份进度
      if (!raw && this.dev) raw = window.localStorage.getItem(KEY);
    } catch (e) {
      return defaultSave();
    }
    if (!raw) return defaultSave();
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      try {
        window.localStorage.setItem(this.key + '.corrupt', raw);
      } catch (e2) {
        /* 备份失败也不影响游戏 */
      }
      return defaultSave();
    }
    let v = typeof data.version === 'number' ? data.version : 0;
    while (v < SAVE_VERSION) {
      v++;
      const migrate = MIGRATIONS[v];
      if (migrate) data = migrate(data);
      data.version = v;
    }
    return deepMerge(defaultSave(), data);
  }

  save() {
    if (!this.available) return;
    try {
      window.localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch (e) {
      /* 存储满了等极端情况：静默失败，不打断游戏 */
    }
  }

  getLevel(id) {
    const key = String(id);
    if (!this.data.levels[key]) {
      this.data.levels[key] = defaultLevelRecord();
    }
    return this.data.levels[key];
  }

  /** 读取关卡记录（不存在时返回空记录，但不写入存档） */
  peekLevel(id) {
    return this.data.levels[String(id)] || defaultLevelRecord();
  }

  upgradeLevel(id) {
    return this.data.upgrades[id] || 0;
  }

  itemCount(id) {
    return this.data.items[id] || 0;
  }

  totalStars() {
    let n = 0;
    for (const k of Object.keys(this.data.levels)) {
      const st = this.data.levels[k].stars;
      if (st) for (const s of st) if (s) n++;
    }
    return n;
  }

  /** 已收集的照片碎片总数 */
  totalPhotos() {
    let n = 0;
    for (const k of Object.keys(this.data.levels)) {
      const ph = this.data.levels[k].photos;
      if (ph) for (const p of ph) if (p) n++;
    }
    return n;
  }

  isLevelUnlocked(id) {
    if (id === 1 || this.dev) return true;
    if (id === 8) return this.isRushUnlocked();
    const prev = this.data.levels[String(id - 1)];
    return !!(prev && prev.cleared);
  }

  /** 隐藏关 Boss Rush：照片碎片 21/21 */
  isRushUnlocked() {
    return this.dev || this.totalPhotos() >= 21;
  }

  /** 第 1~7 关全部通关（无尽模式解锁） */
  allCleared() {
    if (this.dev) return true;
    for (let i = 1; i <= 7; i++) if (!this.peekLevel(i).cleared) return false;
    return true;
  }

  /** 调试用：清空存档 */
  reset() {
    this.data = defaultSave();
    if (this.dev) this.applyDev();
    else this.save();
  }
}
