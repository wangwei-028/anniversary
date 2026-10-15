/**
 * 商店配置 —— 策划书 8.2 节（A 能力加点 / B 出战道具 / D 伙伴能力）。
 * 皮肤（C）在 M3 接入。
 * 能力加点价格 = 基础价 × 要购买的级数（买第 1 级 = 基础价，第 2 级 = 2 倍 …）。
 */
export const UPGRADES = [
  { id: 'coinSense', name: '金币嗅觉', desc: '金币获取 +10%/级', base: 450, max: 5, perLevel: 0.1 },
  { id: 'vitalShield', name: '元气护盾', desc: '开局带 1 层护盾（2 级带 2 层）', base: 600, max: 2 },
  { id: 'focus', name: '专注', desc: '还击能量获取 +15%/级', base: 450, max: 5, perLevel: 0.15 },
  { id: 'itemMaster', name: '道具大师', desc: '拾取道具时长 +2 秒/级', base: 375, max: 5, perLevel: 2 },
  { id: 'sweetheart', name: '甜心', desc: '生命上限 +1（一次性，1 心制下等于生命翻倍）', base: 2250, max: 1 },
  { id: 'bootsUpgrade', name: '弹跳鞋', desc: '解锁常驻二段跳（一次性）', base: 1800, max: 1 },
  { id: 'reviveChance', name: '复活机会', desc: '每关可原地复活 1 次（一次性解锁）', base: 2250, max: 1 },
  { id: 'bond', name: '守护羁绊', desc: '男友酱换人 CD -6 秒/级（需先解锁男友酱）', base: 525, max: 5, perLevel: 6, requires: 'partner' },
];

/** 出战道具：单次消耗，每关最多带 2 个进关（进关时扣除） */
export const ITEMS = [
  { id: 'startShield', name: '出发护盾', desc: '开局带 1 层护盾', price: 240 },
  { id: 'startMagnet', name: '出发磁铁', desc: '开局 10 秒磁铁', price: 160, magnetTime: 10 },
  { id: 'bossShield', name: 'Boss护罩', desc: 'Boss 战中抵消 1 次受击', price: 500 },
  { id: 'reviveCoin', name: '复活币', desc: '失败后原地复活 1 次', price: 600 },
];

export const LOADOUT_MAX = 2;

/** 伙伴能力 · 男友酱「守护换人」（8.2D + 6.4 + 第 12 章） */
export const PARTNER = {
  name: '男友酱',
  price: 2400,
  cdRun: 60, // 跑段基础 CD
  cdPerBond: 6, // 守护羁绊每级 -6s
  cdMin: 30, // 满级 30s
  feverMul: 0.5, // LOVE FEVER（Boss 战）期间 CD 减半
  swapInvincible: 0.8, // 换人瞬间 0.8s 无敌
  hitStop: 0.1, // 换人顿帧
  animTime: 0.25, // 接力动画
};

export function getUpgrade(id) {
  for (const u of UPGRADES) if (u.id === id) return u;
  return null;
}

export function getItem(id) {
  for (const it of ITEMS) if (it.id === id) return it;
  return null;
}

/** 买下一级的价格 */
export function upgradePrice(def, currentLevel) {
  return def.base * (currentLevel + 1);
}
