/**
 * 拾取物配置 —— 策划书 7.1 节。
 * duration 单位秒；M2 的"道具大师"加点会在这些时长上叠加。
 */
export const PICKUPS = {
  magnet: { name: '磁铁', duration: 8, sprite: 'magnet', desc: '8 秒内自动吸金币' },
  shield: { name: '护盾', sprite: 'shield', desc: '抵消 1 次受击' },
  coinRain: { name: '金币雨', duration: 8, coinMultiplier: 2, sprite: 'coinRain', desc: '8 秒双倍金币' },
  springShoes: { name: '弹跳鞋', duration: 8, sprite: 'springShoes', desc: '8 秒内可以二段跳' },
  heart: { name: '爱心', sprite: 'heart', desc: '回 1 心；满血时变成 1 层临时护盾（不叠加）' },
  photo: { name: '照片碎片', sprite: 'photo', desc: '每关 3 片，集齐点亮第 3 颗星，图鉴里可以看照片' },
  memory: { name: '回忆道具', sprite: 'memory', desc: '香港关：Boss 战投掷还击的备用弹药' },
  bun: { name: '菠萝油', sprite: 'bun', desc: '波哥掉的菠萝油：捡起来扔回去' },
};

/** 金币参数 */
export const COIN = {
  spacing: 1.6, // 一串金币的间距（米）
  height: 0.65, // 地面金币的高度
  collectRadiusX: 0.95,
  collectRadiusZ: 0.9,
  magnetRange: 16, // 磁铁吸附范围（前方米数）
  magnetSpeed: 34,
  pickupHeight: 0.9, // 道具悬浮高度
};
