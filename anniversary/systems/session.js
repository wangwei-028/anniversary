import { getLevel } from '../data/levels.js';
import { getDifficultyParams } from './difficulty.js';
import { BOSS_RULES } from '../data/difficulty.js';
import { SPEED } from '../data/constants.js';
import { getUpgrade, getItem, PARTNER } from '../data/shop.js';
import { getSkin } from '../data/skins.js';

/**
 * 一局游戏的状态（跑酷段与 Boss 战共享）：生命、护盾、金币、能量、道具计时、
 * 商店加点与出战道具的效果、男友酱守护换人 CD、复活次数、Boss 重开次数、本局拿到的照片碎片。
 */
export class GameSession {
  /**
   * @param save    SaveSystem（读取加点 / 伙伴解锁；菜单演示时可为 null）
   * @param loadout 本局携带的出战道具 id 数组（已在进关时扣除库存）
   */
  constructor(levelId, modeId = 'standard', save = null, loadout = []) {
    this.levelId = levelId;
    this.level = getLevel(levelId);
    this.params = getDifficultyParams(levelId, modeId);
    const up = (id) => (save ? save.upgradeLevel(id) : 0);
    this.loadout = loadout.slice();

    // 能力加点（8.2A）
    this.maxHearts = this.params.hearts + (up('sweetheart') ? 1 : 0);
    this.hearts = this.maxHearts;
    this.shield = up('vitalShield') + (loadout.includes('startShield') ? 1 : 0);
    this.coinBonus = 1 + up('coinSense') * getUpgrade('coinSense').perLevel;
    this.energyMul = 1 + up('focus') * getUpgrade('focus').perLevel;
    this.itemBonus = up('itemMaster') * getUpgrade('itemMaster').perLevel;
    this.doubleJumps = up('bootsUpgrade') ? getUpgrade('bootsUpgrade').charges || 3 : 0; // 弹跳鞋：每局固定次数的二段跳
    this.revives = (up('reviveChance') ? 1 : 0) + loadout.filter((id) => id === 'reviveCoin').length;
    this.revivesUsed = 0;
    this.bossShieldItem = loadout.includes('bossShield');
    this.bossShield = 0;

    // 皮肤加成（8.2C）
    const skin = getSkin(save && save.data.skins ? save.data.skins.equipped : 'default');
    this.skin = skin.id;
    this.pickupMul = skin.pickupMul || 1;
    this.coinBonus += skin.coinBonus || 0;
    this.trail = skin.trail || '';

    // 伙伴能力 · 男友酱（8.2D）：开局 CD 就绪
    this.partner = !!(save && save.data.partner.unlocked);
    this.swapCdBase = Math.max(PARTNER.cdMin, PARTNER.cdRun - up('bond') * PARTNER.cdPerBond);
    this.swapCd = 0;
    this.character = 'girl';
    this.guardSwaps = 0;
    this.fever = false;

    this.coins = 0;
    this.coinFrac = 0;
    this.coinCombo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.energy = 0; // 还击能量 0~1
    this.perfects = 0;
    this.heartsLost = 0;
    this.bossHeartsLost = 0;
    this.mistakes = 0; // 受击 / 擦碰 / 护盾被打破次数（仅统计记录）
    this.powerups = { magnet: 0, coinRain: 0, springShoes: 0 };
    if (loadout.includes('startMagnet')) this.powerups.magnet = getItem('startMagnet').magnetTime;
    this.ammo = 0; // 投掷型还击的备用弹药（回忆道具）
    this.photosRun = [false, false, false];
    this.speed = SPEED.base;
    this.trackPos = 0; // 已经跑过的距离（米）
    this.phase = 'run';
    this.bossAttempt = 0; // 第几次挑战 Boss（1~3）
    this.bossRetriesLeft = BOSS_RULES.retriesPerLevel;
    this.bossSnapshot = null;
    this.runTime = 0;
  }

  /** 进入 Boss 战时存档：重开时恢复到这个状态（金币不回滚 —— 金币永不损失） */
  snapshotForBoss() {
    this.bossSnapshot = {
      hearts: this.hearts,
      shield: this.shield,
      energy: this.energy,
      character: this.character,
      ammo: this.ammo,
      doubleJumps: this.doubleJumps,
    };
    // LOVE FEVER：进入 Boss 战瞬间，当前剩余 CD 也一并减半
    if (this.swapCd > 0) this.swapCd *= PARTNER.feverMul;
    if (this.bossShieldItem) this.bossShield = 1;
  }

  restoreBossSnapshot() {
    const s = this.bossSnapshot;
    if (!s) return;
    this.hearts = s.hearts;
    this.shield = s.shield;
    this.energy = s.energy;
    this.character = s.character;
    this.ammo = s.ammo;
    this.doubleJumps = s.doubleJumps;
    this.coinCombo = 0;
    this.powerups.magnet = 0;
    this.powerups.coinRain = 0;
    this.powerups.springShoes = 0;
  }

  /** 消耗一次弹跳鞋二段跳（局内 8 秒弹跳鞋道具生效期内不消耗次数） */
  spendDoubleJump() {
    if (this.powerups.springShoes <= 0 && this.doubleJumps > 0) this.doubleJumps--;
  }

  addEnergy(v) {
    this.energy = Math.min(1, this.energy + v * this.energyMul);
  }

  /** 金币加成会累计小数部分，返回本次实际入账的整数金币 */
  addCoins(base) {
    this.coinFrac += base * this.coinBonus * this.params.coinMul;
    const whole = Math.floor(this.coinFrac + 1e-9);
    this.coinFrac -= whole;
    this.coins += whole;
    return whole;
  }

  powerupDuration(base) {
    return base + this.itemBonus;
  }

  // ---------------- 男友酱守护换人 ----------------

  get swapReady() {
    return this.partner && this.swapCd <= 0;
  }

  get swapCdMax() {
    return this.swapCdBase * (this.fever ? PARTNER.feverMul : 1);
  }

  updatePartner(dt) {
    if (this.partner && this.swapCd > 0) this.swapCd -= dt;
  }

  /** 换人：返回换入场的角色 */
  doSwap() {
    this.character = this.character === 'girl' ? 'boy' : 'girl';
    this.swapCd = this.swapCdMax;
    this.guardSwaps++;
    return this.character;
  }
}
