/**
 * 全局手感 / 物理 / 镜头参数。
 * 标注【附录】的数值来自策划书第 12 章数值附录，是唯一依据，不要随意改。
 * 其余为实现层参数（策划书未覆盖），决策记录见 README「开发决策记录」。
 */

/** 画面布局：低分辨率像素缓冲的宽高范围（竖屏），按整数倍放大到屏幕 */
export const SCREEN = {
  minW: 170,
  maxW: 200,
  minH: 300,
  maxH: 420,
  maxDpr: 3,
};

/** 世界尺寸（单位：米） */
export const WORLD = {
  laneWidth: 2.4,
  laneCount: 3,
  roadHalfWidth: 3.6, // 三条车道总宽的一半
  wallX: 7.2, // 两侧店铺墙面的横向位置
  ceilingHeight: 12,
  spawnZ: 80, // 物体在前方多远处生成
  despawnZ: -9, // 物体跑到身后多远时回收
  onScreenDepth: 55, // "同屏障碍上限"统计的可见深度
  fogStart: 30,
  fogEnd: 78,
  spritePxPerMeter: 16, // 像素素材的密度：16 像素 = 1 米
};

/** 主角动作参数 */
export const PLAYER = {
  jumpAirTime: 0.6, // 【附录】跳跃滞空 0.6s
  jumpHeight: 1.8, // 跳跃顶点高度（米）——滞空固定 0.6s 时，顶点越高"安全离地"的时间越长
  doubleJumpRatio: 0.85, // 二段跳初速度比例（弹跳鞋）
  fastFallSpeed: 24, // 空中下滑 = 急降速度（米/秒）
  slideDuration: 0.5, // 【附录】滑铲时长 0.5s
  laneChangeTime: 0.18, // 【附录】变道耗时 0.18s
  coyoteTime: 0.1, // 郊狼时间：离开地面后 0.1s 内仍可起跳
  inputBuffer: 0.15, // 输入缓冲：提前 0.15s 按下的操作会在可执行时自动执行
  standHeight: 1.6, // 站立碰撞高度
  slideHeight: 0.8, // 滑铲碰撞高度
  halfWidth: 0.35, // 碰撞半宽
  halfDepth: 0.3, // 碰撞半深（薄一点，跳过低障碍更宽容）
  stepUpTolerance: 0.3, // 踩上可站立障碍（购物车队）的容差
  sideBumpTime: 0.22, // 侧面擦碰被弹回的硬直
  defaultHearts: 1, // 【附录】默认 1 心
};

/** 战斗与判定 */
export const COMBAT = {
  perfectWindow: 0.15, // 【附录】完美闪避窗口 0.15s（全程恒定）
  perfectWindowWithPartner: 0.17, // 【附录】男友酱在场时 0.17s（M2 启用）
  bulletTimeDuration: 0.3, // 【策划书 3.3】完美闪避触发 0.3s 子弹时间（真实时间）
  bulletTimeScale: 0.25, // 子弹时间期间的时间流速
  invincibleTime: 1.5, // 【附录】受击无敌帧 1.5s
  hitStop: 0.11, // 受击顿帧（真实时间）
  shieldHitStop: 0.08, // 护盾被打破时的顿帧
  deathSlowmo: 0.7, // 倒下后的慢动作时长（真实时间）
};

/** 技能条「回忆闪光」（策划书 6.3 能量条改造：完美闪避积攒，双击屏幕 / L 键释放） */
export const ENERGY = {
  perfectGain: 0.25, // 完美闪避 +25%
  perfectStreakBonus: 0.05, // 完美连击每级额外 +5%
  perfectStreakMax: 4, // 连击加成封顶 4 级（+20%）
  comboThreshold: 20, // 金币连击 ≥20 开始积攒能量
  comboGainPerCoin: 0.01, // 连击 ≥20 后每枚金币 +1%
  comboWindow: 0.9, // 两枚金币间隔超过这个时间，连击中断
};

/** 回忆闪光（技能）释放参数 */
export const SKILL = {
  name: '回忆闪光',
  invincibleTime: 1.5, // 释放后无敌时长
  bulletTime: 0.3, // 释放瞬间的子弹时间演出
  coinsPerBullet: 1, // 每颗被清掉的弹幕转化几枚金币
  boostTime: 5, // 在硬直窗口内释放时，下一次反击判定放宽的持续时间
  throwZoneBonus: 0.5, // 投掷红区加宽 50%
  counterWindowBonus: 0.1, // 完美反击金圈窗口 +0.1s
};

/** 速度（策划书 4.2） */
export const SPEED = {
  base: 8, // 基础速度 8 m/s
  boss: 12, // Boss 战锁定 12 m/s
  escalatorUpMul: 1.2, // 上扶梯 +20%
  escalatorDownMul: 0.8, // 下扶梯 -20%
  galleryMul: 0.7, // 第 7 关回忆走廊：放慢 30%
  endlessMax: 22, // 无尽模式速度上限
  endlessRamp: 240, // 无尽模式用多少秒从基础速度升到上限
  changeRate: 6, // 速度变化的平滑度（越大越快贴近目标速度）
};

/** 镜头（伪 3D 透视） */
export const CAMERA = {
  height: 8, // 镜头离地高度
  back: 7.5, // 镜头在主角身后多远
  focal: 150, // 焦距（主角所在深度：150/7.5 = 20 像素/米 → 主角 32px ≈ 1.6m，障碍略大一圈更好读）
  feetFromBottom: 60, // 主角脚底离画面底部多少像素
  followX: 0.55, // 镜头横向跟随主角的比例
  followSpeed: 9,
  escalatorUpHeight: 9.8, // 上扶梯镜头抬高
  escalatorDownHeight: 6.6, // 下扶梯镜头降低
  heightLerp: 2.2,
};

/** 打击感 / 反馈 */
export const JUICE = {
  shakeHit: 5,
  shakeShield: 3.5,
  shakeBump: 2,
  shakeBossLand: 5,
  shakeBossHit: 6,
  shakeDecay: 9,
  coinFlyTime: 0.42,
  landDustCount: 6,
  speedLineMinSpeed: 12.5, // 超过这个速度开始出现速度线
};

/** 触控手势 */
export const TOUCH = {
  swipeThreshold: 22, // CSS 像素：滑动超过这个距离立即触发（不用等松手）
  tapMaxMove: 12,
  tapMaxTime: 0.28,
  doubleTapTime: 0.25, // 双击判定：两次点击间隔不超过这个时间 → 释放技能
};
