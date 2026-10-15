import { DIFFICULTY_TABLE, DIFFICULTY_MODES, FAIRNESS, BOSS_RULES, BOSS_RUSH } from '../data/difficulty.js';

/**
 * 难度系统：把"难度递进表（4.4）× 难度模式（8.5）"合成为本关实际使用的参数，并保证公平性底线。
 */
export function getDifficultyParams(levelId, modeId = 'standard') {
  const row = DIFFICULTY_TABLE[Math.max(0, Math.min(DIFFICULTY_TABLE.length - 1, levelId - 1))];
  const mode = DIFFICULTY_MODES[modeId] || DIFFICULTY_MODES.standard;
  const lr = mode.lateRamp;
  const n = lr && row.level >= lr.fromLevel ? row.level - lr.fromLevel + 1 : 0;
  const intervalAdd = mode.intervalAdd + (n ? n * lr.intervalAdd : 0);
  return {
    level: row.level,
    mode: mode.id,
    modeName: mode.name,
    speedMax: row.speedMax,
    minInterval: Math.max(FAIRNESS.minIntervalFloor, row.minInterval + intervalAdd),
    intervalAdd,
    maxOnScreen: row.maxOnScreen,
    comboLength: row.comboLength,
    typesPerWave: row.typesPerWave,
    warning: Math.max(FAIRNESS.warningFloor, row.warning + mode.warningAdd + (n ? n * lr.warningAdd : 0)),
    bossBulletSpeed: row.bossBulletSpeed * (mode.bulletSpeedMul + (n ? n * lr.bulletSpeedAdd : 0)),
    stunWindow: row.stunWindow,
    hearts: mode.hearts,
    coinMul: mode.coinMul,
    bossFloor: n ? lr.bossFloor : 0,
    mixedGap: n ? lr.mixedGap : 0,
  };
}

/** Boss 某阶段的弹幕速度倍率 = 关卡系数 × (1 + 15% × 阶段序号) */
export function bossSpeedMul(params, phaseIndex) {
  return params.bossBulletSpeed * (1 + BOSS_RULES.phaseSpeedUp * phaseIndex);
}

/** Boss Rush 第 k 只（0 起）的参数（见 data/difficulty.js 的 BOSS_RUSH） */
export function getRushParams(levelId, k, sweet) {
  const R = BOSS_RUSH;
  if (sweet) {
    const p = getDifficultyParams(levelId, 'standard');
    p.bossBulletSpeed *= R.sweetMul;
    p.densityMul = R.sweetMul;
    p.stunWindow = R.stunWindow;
    return p;
  }
  const p = getDifficultyParams(levelId, R.baseMode);
  p.bossBulletSpeed *= R.bulletMul;
  p.densityMul = R.densityBase + R.densityStep * k;
  p.waveGapAdd = R.waveGapAdd;
  p.stunWindow = R.stunWindow;
  p.skipWaves = R.skipWaves;
  p.bossFloor = R.bossFloor;
  p.mixedGap = R.mixedGap;
  return p;
}

/** Boss 某阶段的发射间隔：密度 +20%/阶段（Boss Rush 再乘 densityMul），甜蜜模式 +0.4s，且不低于底线（疯狂 / Boss Rush 的底线更低，已用可解性机器人验证） */
export function bossInterval(params, baseEvery, phaseIndex) {
  const v = baseEvery / (1 + BOSS_RULES.phaseDensityUp * phaseIndex) / (params.densityMul || 1) + params.intervalAdd;
  return Math.max(params.bossFloor || FAIRNESS.minIntervalFloor, v);
}

/** 跑酷段障碍间隔：难度表最小间隔 × 区段放宽倍率（只会更宽松） */
export function runInterval(params, sectionMul) {
  return Math.max(FAIRNESS.minIntervalFloor, params.minInterval * Math.max(1, sectionMul || 1));
}
