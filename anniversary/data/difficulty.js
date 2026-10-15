/**
 * 难度递进表 —— 策划书 4.4 节（唯一依据）+ 8.5 节难度选择。
 * 关卡逻辑只从这里读数，不在代码里写死。
 */

/** 4.4 节：跨关卡难度递进（标准难度 / 热恋） */
export const DIFFICULTY_TABLE = [
  // level: 关卡号；speedMax: 速度上限 m/s；minInterval: 障碍最小间隔(反应时间) s；
  // maxOnScreen: 同屏障碍上限；comboLength: 组合障碍长度（1=单个 2=双连 3=三连 4=四连 0=混编）；
  // typesPerWave: 每波障碍种类数 [最少, 最多]；warning: 弹道预警时间 s；
  // bossBulletSpeed: Boss 弹幕速度系数；stunWindow: Boss 硬直窗口 s
  { level: 1, speedMax: 14, minInterval: 2.2, maxOnScreen: 2, comboLength: 1, typesPerWave: [1, 2], warning: 0.6, bossBulletSpeed: 1.0, stunWindow: 6.0 },
  { level: 2, speedMax: 15, minInterval: 2.0, maxOnScreen: 2, comboLength: 2, typesPerWave: [2, 2], warning: 0.55, bossBulletSpeed: 1.05, stunWindow: 6.0 },
  { level: 3, speedMax: 16, minInterval: 1.8, maxOnScreen: 3, comboLength: 2, typesPerWave: [2, 3], warning: 0.5, bossBulletSpeed: 1.1, stunWindow: 6.0 },
  // 第 4 关起快速加难（试玩反馈：原 4.4 表后半程太平）
  { level: 4, speedMax: 18, minInterval: 1.45, maxOnScreen: 3, comboLength: 3, typesPerWave: [3, 3], warning: 0.45, bossBulletSpeed: 1.25, stunWindow: 5.4 },
  { level: 5, speedMax: 20, minInterval: 1.3, maxOnScreen: 4, comboLength: 3, typesPerWave: [3, 3], warning: 0.4, bossBulletSpeed: 1.4, stunWindow: 4.8 },
  { level: 6, speedMax: 22, minInterval: 1.15, maxOnScreen: 5, comboLength: 4, typesPerWave: [3, 4], warning: 0.38, bossBulletSpeed: 1.55, stunWindow: 4.3 },
  { level: 7, speedMax: 24, minInterval: 1.0, maxOnScreen: 6, comboLength: 0, typesPerWave: [99, 99], warning: 0.35, bossBulletSpeed: 1.7, stunWindow: 3.8 },
];

/** 公平性底线（4.4 递进设计守则）：任何难度、任何模式都不突破 */
export const FAIRNESS = {
  minIntervalFloor: 1.0, // 低于 1.0s 判定为不公平，全游戏不出现
  warningFloor: 0.35, // 预警最短 0.35s
};

/**
 * 8.5 节难度选择 + 4.4 节甜蜜模式全局修正。
 * M1 固定使用 standard（热恋），难度切换在 M2 的关卡准备页开放。
 */
export const DIFFICULTY_MODES = {
  sweet: {
    id: 'sweet',
    name: '甜蜜',
    desc: '为她设计',
    hearts: 3,
    intervalAdd: 0.4, // 间隔 +0.4s
    warningAdd: 0.15, // 预警 +0.15s
    bulletSpeedMul: 0.85, // 弹幕速度 -15%
    coinMul: 1.0,
  },
  standard: {
    id: 'standard',
    name: '热恋',
    desc: '标准',
    hearts: 1,
    intervalAdd: 0,
    warningAdd: 0,
    bulletSpeedMul: 1.0,
    coinMul: 1.0,
  },
  crazy: {
    id: 'crazy',
    name: '疯狂',
    desc: '高手向',
    hearts: 1,
    intervalAdd: 0,
    warningAdd: 0,
    bulletSpeedMul: 1.15,
    coinMul: 1.3,
    // 第 4 关起每关再叠加：间隔 -0.1s、预警 -0.02s、弹幕 +8%（仍受 FAIRNESS 底线限制）
    // Boss 战更密：同种弹幕最短间隔 0.85s、不同弹幕错开 0.5s（已用可解性机器人验证不会无解）
    lateRamp: { fromLevel: 4, intervalAdd: -0.1, warningAdd: -0.02, bulletSpeedAdd: 0.08, bossFloor: 0.85, mixedGap: 0.5 },
  },
};

/**
 * 隐藏关 Boss Rush「回忆风暴」（5.8）：每只 Boss 用它所在关卡的【疯狂】参数，再加压。
 * 甜蜜难度的玩家改用【热恋】参数 -10%（不加压）。
 */
export const BOSS_RUSH = {
  baseMode: 'crazy',
  bulletMul: 1.1, // 弹幕速度再 +10%
  densityBase: 1.2, // 密度 ×1.2 起步
  densityStep: 0.06, // 每打败一只，下一只再 +6%
  waveGapAdd: -0.6, // 波与波之间的喘息 -0.6s
  stunWindow: 5.0, // 硬直窗口固定 5s
  skipWaves: 1, // 每个阶段跳过最温和的第 1 波（更紧凑，全程约 9 分钟）
  bossFloor: 0.8, // 同种弹幕最短间隔
  mixedGap: 0.45, // 不同种弹幕"打到主角"的时刻至少错开
  sweetMul: 0.9, // 甜蜜玩家：热恋参数 -10%
};

/** Boss 战通用规则（策划书 6.1 + 第 12 章；P1 加压后的数值） */
export const BOSS_RULES = {
  hp: 3, // Boss HP = 3
  phaseSpeedUp: 0.22, // 每阶段弹幕提速 +22%（原 15%，P1 难度上调）
  phaseDensityUp: 0.28, // 每阶段密度 +28%（原 20%）
  retriesPerLevel: 2, // 【附录】每关 2 次重开（即最多挑战 3 次）
  introDuration: 3, // 登场演出 3s
  retryIntroDuration: 1.6, // 重开时的简短登场（决策：重开不必再看完整名条）
  defeatDuration: 5, // 击败演出 5s
  // 不同种类的弹幕"打到主角的时刻"至少错开这么多秒（组合技 combo 的成员不受此限制——它们是设计好的可解叠加）
  mixedGap: 0.6,
};
