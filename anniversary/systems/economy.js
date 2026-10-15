import { ECONOMY } from '../data/economy.js';
import { getUpgrade, getItem, upgradePrice, PARTNER } from '../data/shop.js';

/**
 * 经济系统（8.3）：
 * - 结算：本局金币（失败也全额入账）+ 通关奖励（首通 200 / 重复 120）+ 新星奖励（每颗 50，只发一次）
 *         + Boss 无伤 +80；照片碎片无论成败都记入存档（错过可重刷）
 * - 三星（8.4）：★ 通关 ★ 全程无受击（= 没有损失爱心；护盾 / 守护换人挡下的不算）★ 集齐本关 3 片照片碎片
 * - 商店：能力加点 / 出战道具 / 伙伴能力的购买
 */
export function settleLevel(save, session, cleared) {
  const lv = save.getLevel(session.levelId);
  lv.plays++;
  const runCoins = session.coins;
  let clearReward = 0;
  let firstClear = false;
  if (cleared) {
    firstClear = !lv.cleared;
    clearReward = firstClear ? ECONOMY.firstClear : ECONOMY.repeatClear;
    lv.cleared = true;
    lv.clears++;
  }

  // 照片碎片（累计）
  let newPhotos = 0;
  for (let i = 0; i < 3; i++) {
    if (session.photosRun[i] && !lv.photos[i]) {
      lv.photos[i] = true;
      newPhotos++;
    }
  }
  const photosAll = lv.photos[0] && lv.photos[1] && lv.photos[2];

  // 三星（累计取最好）：新拿到的星才发奖励
  const runStars = [cleared, cleared && session.heartsLost === 0, photosAll && (cleared || lv.cleared)];
  const starsBefore = lv.stars.slice();
  let newStars = 0;
  for (let i = 0; i < 3; i++) {
    if (runStars[i] && !lv.stars[i]) {
      lv.stars[i] = true;
      newStars++;
    }
  }
  const starReward = newStars * ECONOMY.perStar;
  const bossBonus = cleared && session.bossHeartsLost === 0 ? ECONOMY.bossNoDamage : 0;

  const total = runCoins + clearReward + starReward + bossBonus;
  save.data.coins = Math.min(ECONOMY.maxCoins, save.data.coins + total);
  lv.bestCoins = Math.max(lv.bestCoins, runCoins);
  lv.bestPerfects = Math.max(lv.bestPerfects, session.perfects);
  const st = save.data.stats;
  st.totalRuns++;
  st.totalPerfects += session.perfects;
  st.totalCoins += total;
  st.guardSwaps = (st.guardSwaps || 0) + session.guardSwaps;
  if (cleared) st.bossDefeats++;
  save.save();
  return {
    cleared,
    runCoins,
    clearReward,
    firstClear,
    starReward,
    newStars,
    runStars,
    starsBefore,
    stars: lv.stars.slice(),
    bossBonus,
    newPhotos,
    photos: lv.photos.slice(),
    total,
    balance: save.data.coins,
    perfects: session.perfects,
    bestCombo: session.bestCombo,
    guardSwaps: session.guardSwaps,
  };
}

// ---------------- 商店 ----------------

/** 购买能力加点的下一级：返回 { ok, msg } */
export function buyUpgrade(save, id) {
  const def = getUpgrade(id);
  const lvl = save.upgradeLevel(id);
  if (lvl >= def.max) return { ok: false, msg: '已经满级啦' };
  if (def.requires === 'partner' && !save.data.partner.unlocked) return { ok: false, msg: '需要先解锁男友酱' };
  const price = upgradePrice(def, lvl);
  if (save.data.coins < price) return { ok: false, msg: '金币不够哦' };
  save.data.coins -= price;
  save.data.upgrades[id] = lvl + 1;
  save.save();
  return { ok: true, msg: def.name + ' 升到 ' + (lvl + 1) + ' 级！' };
}

export function buyItem(save, id) {
  const def = getItem(id);
  if (save.data.coins < def.price) return { ok: false, msg: '金币不够哦' };
  save.data.coins -= def.price;
  save.data.items[id] = save.itemCount(id) + 1;
  save.save();
  return { ok: true, msg: '买到了 ' + def.name + '！（库存 ' + save.data.items[id] + '）' };
}

export function buyPartner(save) {
  if (save.data.partner.unlocked) return { ok: false, msg: '男友酱已经在你身边啦' };
  if (save.data.coins < PARTNER.price) return { ok: false, msg: '金币不够哦' };
  save.data.coins -= PARTNER.price;
  save.data.partner.unlocked = true;
  save.save();
  return { ok: true, msg: '男友酱加入！受击时会自动换上来替你挡伤' };
}

/** 进关时扣除携带的出战道具，返回实际带上的道具列表 */
export function consumeLoadout(save, loadout) {
  const used = [];
  for (const id of loadout) {
    if (save.itemCount(id) > 0) {
      save.data.items[id]--;
      used.push(id);
    }
  }
  save.data.loadout = loadout.slice();
  save.save();
  return used;
}

// ---------------- 皮肤 ----------------

/** 皮肤能不能买 / 用：返回 { owned, canBuy, lockText } */
export function skinStatus(save, skin) {
  const owned = save.data.skins.owned.includes(skin.id);
  if (owned) return { owned: true, canBuy: false, lockText: '' };
  if (skin.unlock === 'rush') return { owned: false, canBuy: false, lockText: 'Boss Rush「回忆风暴」通关后免费获得' };
  if (skin.unlock === 'afterL7' && !save.peekLevel(7).cleared && !save.dev) return { owned: false, canBuy: false, lockText: '通关第 7 关「家」后解锁购买' };
  return { owned: false, canBuy: true, lockText: '' };
}

export function buySkin(save, skin) {
  const st = skinStatus(save, skin);
  if (st.owned) return { ok: false, msg: '已经拥有啦' };
  if (!st.canBuy) return { ok: false, msg: st.lockText };
  if (save.data.coins < skin.price) return { ok: false, msg: '金币不够哦' };
  save.data.coins -= skin.price;
  save.data.skins.owned.push(skin.id);
  save.data.skins.equipped = skin.id;
  save.save();
  return { ok: true, msg: '换上「' + skin.name + '」啦！' };
}

export function equipSkin(save, id) {
  if (!save.data.skins.owned.includes(id)) return false;
  save.data.skins.equipped = id;
  save.save();
  return true;
}

// ---------------- 无尽模式 / Boss Rush ----------------

/** 无尽模式结算：金币全额入账 + 每张地图记录最高分 */
export function settleEndless(save, session, score) {
  const total = session.coins;
  save.data.coins = Math.min(ECONOMY.maxCoins, save.data.coins + total);
  const e = save.data.endless;
  e.plays++;
  const key = String(session.mapId);
  const prev = e.best[key] || 0;
  const isBest = score > prev;
  if (isBest) e.best[key] = score;
  const st = save.data.stats;
  st.totalRuns++;
  st.totalPerfects += session.perfects;
  st.totalCoins += total;
  st.guardSwaps = (st.guardSwaps || 0) + session.guardSwaps;
  save.save();
  return { total, score, best: Math.max(prev, score), isBest, balance: save.data.coins, perfects: session.perfects, guardSwaps: session.guardSwaps };
}

/**
 * Boss Rush 结算：金币全额入账；通关首次 500 / 重复 200；
 * 首通解锁白金奖章 + 星光礼服 + 回忆放映厅第 22 张照片（群星之夜）
 */
export function settleRush(save, session, cleared, stats) {
  const r = save.data.rush;
  r.attempts++;
  let reward = 0;
  let first = false;
  if (cleared) {
    first = !r.cleared;
    reward = first ? ECONOMY.bossRushFirst : ECONOMY.bossRushRepeat;
    r.cleared = true;
    r.clears++;
    if (!r.bestTime || stats.time < r.bestTime) r.bestTime = stats.time;
    r.bestNoDamage = Math.max(r.bestNoDamage, stats.noDamage);
    if (!save.data.skins.owned.includes('starlight')) save.data.skins.owned.push('starlight');
  }
  const total = session.coins + reward;
  save.data.coins = Math.min(ECONOMY.maxCoins, save.data.coins + total);
  const st = save.data.stats;
  st.totalRuns++;
  st.totalPerfects += session.perfects;
  st.totalCoins += total;
  st.guardSwaps = (st.guardSwaps || 0) + session.guardSwaps;
  if (cleared) st.bossDefeats += 7;
  save.save();
  return { cleared, first, reward, runCoins: session.coins, total, balance: save.data.coins, perfects: session.perfects, guardSwaps: session.guardSwaps, ...stats };
}
