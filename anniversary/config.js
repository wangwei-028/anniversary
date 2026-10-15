/**
 * ============================================================
 *  个性化内容配置（config.js）
 *  —— 所有"只属于你们俩"的内容都集中在这个文件里。
 *  —— 标注了 `TODO: 替换为真实内容` 的地方，交付前请逐一替换。
 *  —— 替换清单也写在 README.md 的「占位内容替换清单」里。
 * ============================================================
 */

export const CONFIG = {
  // 开发者模式：true = 每次打开金币都是 99999（上限）、关卡全解锁。
  // 用独立的存档，不会弄乱正式存档；交付前务必改回 false！
  devMode: true,
  // TODO: 替换为真实内容 —— 你们在一起的日期（格式 YYYY-MM-DD）
  anniversaryDate: '2025-10-01',

  // 在一起的当天算"第 1 天"（true）还是"第 0 天"（false）。
  // 默认 false：在一起满一年的那天正好显示"第 365 天"，和游戏副标题呼应。
  countStartDayAsOne: false,

  // TODO: 替换为真实内容 —— 标题画面"今天是和 TA 在一起的第 N 天"里的称呼（比如你的昵称）
  partnerCallName: 'TA',

  // TODO: 替换为真实内容 —— 你的名字（M3 制作名单、信件落款用）
  makerName: '你的名字',

  // TODO: 替换为真实内容 —— 21 张照片（每关 3 张）+ 每张配一句话。
  // src 可以是相对路径（推荐把照片放进 assets/photos/ 再写 'assets/photos/1-1.jpg'），
  // 目前用 picsum 随机风景图占位（需要联网才能显示）。M2 图鉴页 / M3 回忆放映厅会用到。
  photos: [
    { level: 1, src: 'https://picsum.photos/seed/anniv-1-1/600/800', caption: '第一次一起逛商场，你在橱窗前站了好久。' }, // TODO: 替换为真实内容
    { level: 1, src: 'https://picsum.photos/seed/anniv-1-2/600/800', caption: '抓娃娃机前，我们输光了一整袋硬币。' }, // TODO: 替换为真实内容
    { level: 1, src: 'https://picsum.photos/seed/anniv-1-3/600/800', caption: '那天的奶茶，第二杯半价，第一杯是你。' }, // TODO: 替换为真实内容
    { level: 2, src: 'https://picsum.photos/seed/anniv-2-1/600/800', caption: '动物园的长颈鹿，比你还爱吃。' }, // TODO: 替换为真实内容
    { level: 2, src: 'https://picsum.photos/seed/anniv-2-2/600/800', caption: '你说企鹅走路像我。' }, // TODO: 替换为真实内容
    { level: 2, src: 'https://picsum.photos/seed/anniv-2-3/600/800', caption: '猴子抢走了你的香蕉，你抢走了我的心。' }, // TODO: 替换为真实内容
    { level: 3, src: 'https://picsum.photos/seed/anniv-3-1/600/800', caption: '香港的霓虹灯下，你比招牌还亮。' }, // TODO: 替换为真实内容
    { level: 3, src: 'https://picsum.photos/seed/anniv-3-2/600/800', caption: '茶餐厅的菠萝油，你分了我一半。' }, // TODO: 替换为真实内容
    { level: 3, src: 'https://picsum.photos/seed/anniv-3-3/600/800', caption: '叮叮车上，我们看了一整晚夜景。' }, // TODO: 替换为真实内容
    { level: 4, src: 'https://picsum.photos/seed/anniv-4-1/600/800', caption: '旋转木马转了三圈，你笑了三圈。' }, // TODO: 替换为真实内容
    { level: 4, src: 'https://picsum.photos/seed/anniv-4-2/600/800', caption: '过山车上你抓着我的手没放开。' }, // TODO: 替换为真实内容
    { level: 4, src: 'https://picsum.photos/seed/anniv-4-3/600/800', caption: '烟花开始的时候，我在看你。' }, // TODO: 替换为真实内容
    { level: 5, src: 'https://picsum.photos/seed/anniv-5-1/600/800', caption: '夜市的章鱼烧，烫到你直跺脚。' }, // TODO: 替换为真实内容
    { level: 5, src: 'https://picsum.photos/seed/anniv-5-2/600/800', caption: '你说这串最好吃，因为是我递的。' }, // TODO: 替换为真实内容
    { level: 5, src: 'https://picsum.photos/seed/anniv-5-3/600/800', caption: '人很多，但我只看得见你。' }, // TODO: 替换为真实内容
    { level: 6, src: 'https://picsum.photos/seed/anniv-6-1/600/800', caption: '海边的风把你的头发吹乱了。' }, // TODO: 替换为真实内容
    { level: 6, src: 'https://picsum.photos/seed/anniv-6-2/600/800', caption: '沙滩上写的名字，被浪带走了，没关系。' }, // TODO: 替换为真实内容
    { level: 6, src: 'https://picsum.photos/seed/anniv-6-3/600/800', caption: '日落的时候，你说想一直这样。' }, // TODO: 替换为真实内容
    { level: 7, src: 'https://picsum.photos/seed/anniv-7-1/600/800', caption: '回家的路上，路灯一盏一盏亮起来。' }, // TODO: 替换为真实内容
    { level: 7, src: 'https://picsum.photos/seed/anniv-7-2/600/800', caption: '一起做的第一顿饭，有点糊。' }, // TODO: 替换为真实内容
    { level: 7, src: 'https://picsum.photos/seed/anniv-7-3/600/800', caption: '在一起的第 365 天，还想要很多个 365 天。' }, // TODO: 替换为真实内容
  ],

  // TODO: 替换为真实内容 —— 隐藏结局《回忆放映厅》最后那封信（M3 使用）。交付前一定要换成你自己写的！
  letter: {
    title: '给你的一封信',
    paragraphs: [
      '亲爱的你：',
      '这是一封示例信。等你看到这里的时候，你已经跑过了我们这一年去过的每一个地方。',
      '商场、动物园、香港的街头、游乐园、夜市、海边，最后是家。',
      '谢谢你这一年里每一次的耐心、每一次的笑、每一次"没关系，有我"。',
      '下一年，下一关，我们一起玩。',
    ],
    signature: '—— 永远站在你这边的我',
  },

  memes: {
    // TODO: 替换为真实内容 —— 结算页随机出现的"恋爱冷知识"（你们的梗）
    loveFacts: [
      '和喜欢的人一起跑步，心率会比平时快 20%。（数据来源：我）',
      '据不完全统计，牵手走路比单独走路慢 30%，但开心 300%。',
      '奶茶第二杯半价的意义，就是为了第二杯能给你。',
      '研究表明：被夸"今天好可爱"之后，跑酷成绩会提升（未经证实）。',
      '一起吃过的东西都会自动变好吃，这是恋爱的物理定律。',
      '在一起一年 ≈ 525600 分钟，其中想你的时间约等于 525600 分钟。',
    ],
    // TODO: 替换为真实内容 —— 商场关的商铺招牌（你们的梗店名），建议每个 2~7 个字
    shopNames: [
      '小猪奶茶铺',
      '第二杯半价',
      '想你便利店',
      '抓娃娃专门店',
      '贴贴服饰',
      '干饭研究所',
      '宝宝甜品屋',
      '拍照打卡点',
    ],
    // TODO: 替换为真实内容 —— 动物园关路边的指路牌（可以写你们那天看过的动物 / 梗），建议每个 2~6 个字
    zooSigns: ['熊猫馆 →', '← 长颈鹿', '企鹅馆', '猴山 →', '请勿投喂', '小心便便'],
    // TODO: 替换为真实内容 —— 香港关两侧的竖排霓虹招牌（你们去过的店名），建议每个 2~4 个字
    hkSigns: ['茶餐厅', '冰室', '金铺', '大押', '糖水铺', '车仔面', '士多', '叮叮车'],
    // TODO: 替换为真实内容 —— 男友酱"守护换人"挡下攻击时随机弹出的短情话（M2 使用）
    guardLines: [
      '没事，有我',
      '换你了，别怕',
      '这下我来',
      '我在呢',
    ],
    // TODO: 替换为真实内容 —— 游乐园关路边的指路牌（你们一起玩过的项目），建议每个 2~6 个字
    parkSigns: ['旋转木马 →', '← 过山车', '摩天轮', '棉花糖', '碰碰车 →', '鬼屋（别去）'],
    // TODO: 替换为真实内容 —— 夜市关的摊位招牌（你们一起吃过的小吃），建议每个 2~5 个字
    marketSigns: ['章鱼烧', '烤鱿鱼', '臭豆腐', '糖葫芦', '烤冷面', '珍珠奶茶', '铁板烧'],
  },

  // TODO: 可选 —— 金币中间的图案（彩蛋）：留空 = 小爱心；写一个字 / 符号（如 '宝'、'L'）= 你们的暗号；
  // 或者写一张图片路径（如 'assets/coin.png'，建议正方形头像）= 她的小头像
  coinMark: '',

  // TODO: 可选 —— 群星之夜制作名单里的额外致谢（每行一句）
  creditsThanks: ['谢谢这一年里陪我去过的每一个地方', '也谢谢所有被我们打败的 Boss'],
};
