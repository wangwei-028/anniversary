/**
 * 经济数值 —— 策划书 8.3 节。
 * M1 只接入"通关奖励"，星级 / 无伤 / 商店在 M2 接入。
 */
export const ECONOMY = {
  firstClear: 200, // 首通奖励 200/关
  repeatClear: 120, // 重复通关 120/关
  perStar: 50, // 星级奖励 50/星（M2）
  bossNoDamage: 80, // Boss 无伤 +80（M2）
  bossRushFirst: 500, // Boss Rush 首通（M3）
  bossRushRepeat: 200, // Boss Rush 重复通关（M3）
  coinValue: 1, // 每枚金币的面值
  bossDefeatCoins: 30, // 击败 Boss 时爆出的金币（决策：给击败演出一点"爆金币"的爽感）
  maxCoins: 99999, // 金币上限
};
