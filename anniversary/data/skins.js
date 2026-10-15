/**
 * 皮肤（策划书 8.2C）：外观 + 微小加成。双人同款（女友酱 + 男友酱一起换装）。
 * unlock：shop 直接买 / afterL7 通关第 7 关后才能买 / rush Boss Rush 通关免费获得
 */
export const SKINS = [
  { id: 'default', name: '女友酱', desc: '默认形象', bonus: '无', price: 0, unlock: 'free' },
  { id: 'cat', name: '猫猫', desc: '猫耳 + 尾巴的双人猫猫装', bonus: '拾取范围 +10%', price: 800, unlock: 'shop', pickupMul: 1.1 },
  { id: 'wedding', name: '像素婚纱 & 西装', desc: '纯纪念皮肤', bonus: '金币 +10%', price: 2000, unlock: 'afterL7', coinBonus: 0.1 },
  { id: 'starlight', name: '星光礼服', desc: '星空配色双人礼服，奔跑带星尘拖尾（全游戏唯一动态特效）', bonus: '星尘拖尾', price: 0, unlock: 'rush', trail: 'stars' },
];

export function getSkin(id) {
  for (const s of SKINS) if (s.id === id) return s;
  return SKINS[0];
}
