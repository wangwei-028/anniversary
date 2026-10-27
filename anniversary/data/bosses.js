/**
 * Boss 配置 —— 策划书 5.1~5.7 节 + 第 6 章 Boss 战通用规则。
 * 结构（6.1）：登场演出 3s → [弹幕波(6s)×3 → 硬直窗口 → 还击机会] × 3 阶段 → 击败演出 5s
 * 速度/密度修正：每阶段弹幕速度 +22%、密度 +28%（data/difficulty.js 的 BOSS_RULES），
 * 再乘以难度表的"Boss 弹幕速度系数"；所有间隔都不低于公平底线 1.0s。
 *
 * P1 组合技：wave.spawns 里可写 { combo: [子攻击, …], every } —— 组内弹幕故意同时到达，
 *   冲突检查不在组内避让。只有"正交"的组合才允许同刻（换道+跳 / 换道+铲 / 全宽跳+红道），
 *   "低空(跳)+高空(铲)"这类同刻无解对严禁出现；同类动作冲突用 delay 做成节拍链（≥0.5s）。
 * P2 招牌机制：每个 Boss 只保留 1 个旧机制做辨识度，其余换成新机制（详见各 Boss 注释）。
 * P3 完美反击：reflect 型还击 = 礼盒飞来时按 J / 点击屏幕拍回去（hitWindow = 金圈时机窗口）。
 *
 * spawns 字段说明：
 *   type   弹幕类型（内置类型见 bullets / 注册表类型见 systems/bossAttacks.js）
 *   every  发射间隔（秒，阶段 1 的基准值；后续阶段按密度 +28% 自动缩短）
 *   offset 本波开始后多久发射第一发
 *   combo  组合技：组内子攻击同发；子攻击的 delay = 延后多少秒发（节拍链）
 *   lane   'player' 瞄准玩家当前车道 / 'random' 随机车道 / 'others' 玩家以外的车道
 *   fan    盲盒彩纸扇形展开的宽度（车道数）
 *   sequence  带状弹幕（band）的节奏序列：low = 低空（跳）/ high = 高空（滑铲）
 */
export const BOSSES = {
  meow: {
    id: 'meow',
    name: '喵喵',
    title: '促销气球吉祥物',
    sprite: 'meow',
    defeatText: '漏气飞走啦~',
    z: 26, // 悬停在玩家前方多远（米）
    hoverY: 9, // 悬停高度（米，矮屏幕上会自动压低，避免挡住顶部 HUD）
    moveSpeed: 7, // 横向移动速度（米/秒）
    waveDuration: 6,
    waveGap: 0.6,
    stunRecoverTime: 1.4, // 硬直窗口结束没打中时，Boss 缓过来的演出时间
    hurtTime: 1.5, // 被还击命中后的受伤演出
    phases: [
      {
        // 教学：盲盒(跳) / 气球幕墙(铲) / 购物车(站空道)
        name: '开工彩排',
        hint: '盲盒 → 跳！气球墙 → 滑铲！',
        expression: 'normal',
        waves: [
          { spawns: [{ type: 'blindBox', every: 2.2, offset: 0.4, lane: 'player', fan: 1 }] },
          { spawns: [{ type: 'band', bullet: 'balloonWall', band: 'high', every: 2.6, offset: 0.5 }] },
          {
            spawns: [
              { type: 'blindBox', every: 2.4, offset: 0.4, lane: 'random', fan: 1 },
              { type: 'band', bullet: 'balloonWall', band: 'high', every: 3.6, offset: 1.8 },
            ],
          },
        ],
      },
      {
        // 组合技：红毯迎宾（站空道+铲）/ 地毯变奏（跳→铲→跳节拍链）
        name: '红毯迎宾',
        hint: '红道站空道，横梁马上滑铲！',
        expression: 'angry',
        waves: [
          {
            spawns: [
              { combo: [{ type: 'cartSweep', lanes: 2 }, { type: 'band', bullet: 'ribbonBeam', band: 'high' }], every: 3.0, offset: 0.5 },
            ],
          },
          {
            spawns: [
              {
                combo: [
                  { type: 'couponWall', sequence: ['low'] },
                  { type: 'band', bullet: 'balloonWall', band: 'high', delay: 0.55 },
                  { type: 'couponWall', sequence: ['low'], delay: 1.1 },
                ],
                every: 3.4,
                offset: 0.5,
              },
            ],
          },
          {
            spawns: [
              { combo: [{ type: 'cartSweep', lanes: 2 }, { type: 'band', bullet: 'ribbonBeam', band: 'high' }], every: 3.2, offset: 0.4 },
              { type: 'blindBox', every: 4.4, offset: 2.4, lane: 'random', fan: 0 },
            ],
          },
        ],
      },
      {
        // 考核：券墙高低交替 + 双盒错落 + 组合提速
        name: '促销风暴',
        hint: '低券跳、高券铲；双盲盒连跳或换道！',
        expression: 'angry',
        waves: [
          {
            spawns: [
              { combo: [{ type: 'blindBox', lane: 'player', fan: 0 }, { type: 'blindBox', lane: 'others', fan: 0, delay: 0.45 }], every: 2.8, offset: 0.5 },
            ],
          },
          {
            spawns: [
              { type: 'couponWall', every: 1.5, offset: 0.3, sequence: ['low', 'high', 'low', 'high'] },
              { combo: [{ type: 'cartSweep', lanes: 2 }, { type: 'band', bullet: 'ribbonBeam', band: 'high' }], every: 3.6, offset: 1.9 },
            ],
          },
          {
            spawns: [
              { type: 'couponWall', every: 1.4, offset: 0.3, sequence: ['high', 'low', 'low', 'high'] },
              { combo: [{ type: 'blindBox', lane: 'player', fan: 1 }, { type: 'band', bullet: 'balloonWall', band: 'high', delay: 0.55 }], every: 3.4, offset: 2.0 },
            ],
          },
        ],
      },
    ],
    // 还击（6.2 反弹型 · P3 完美反击）：硬直窗口内喵喵丢巨型礼盒 → 金圈时刻按 J / 点击拍回去
    counter: {
      type: 'reflect',
      name: '完美反击',
      bullet: 'giantGift',
      firstDelay: 1.0, // 进入硬直窗口后多久丢第一个
      interval: 1.5, // 没拍中时，再丢下一个的间隔
      hitWindow: 0.3, // 礼盒到达前的"金圈"判定窗口（秒）——触屏点击有固有延迟，窗口要足够宽
      returnTime: 0.5, // 拍回去飞行时间
      hint: '金圈亮起的瞬间按 J / 点屏幕，拍回去！',
      hintAgain: '拍早了！等金圈亮起再按！',
      hintBonk: '被砸懵了也不扣心，再来！',
    },
    bullets: {
      blindBox: {
        flightTime: 0.95, // 抛物线飞行时间（至少等于难度表的预警时间）
        landZ: 16, // 落在玩家前方多远
        arcHeight: 5,
        confettiSpeed: 11, // 彩纸地波的逼近速度（米/秒）
        confettiHeight: 0.45,
        confettiLength: 0.8, // 地波很"薄"：起跳时机宽容
        fanTime: 0.35, // 彩纸扇形完全展开所需时间
      },
      cartSweep: {
        speed: 13,
        telegraphExtra: 0.4, // 在难度表预警时间之外，额外提前多久亮红道
        height: 1.3,
        length: 1.5,
      },
      couponWall: {
        speed: 12,
        lowHeight: 0.8, // 低空券：顶部 0.8m（跳过）
        highClearance: 1.35, // 高空券：底部 1.35m（滑铲钻过，抬高让空间一眼可见）
        highTop: 2.85,
        length: 0.7,
      },
      // 气球幕墙（新）：整排气球从天上吊下来，滑铲钻过（hang = 渲染层画吊线）
      balloonWall: { speed: 12, length: 0.7, lowHeight: 0.8, highClearance: 1.35, highTop: 2.6, spriteLow: 'balloons', spriteHigh: 'balloons', draw: 'lanes', hang: true },
      // 彩带横梁（新）：挂在头顶的促销彩带，滑铲
      ribbonBeam: { speed: 11.5, length: 0.7, lowHeight: 0.8, highClearance: 1.35, highTop: 2.6, spriteLow: 'ribbon', spriteHigh: 'ribbon', draw: 'lanes', hang: true, anim: true, fps: 8 },
      giantGift: {
        speed: 11,
        height: 1.5,
        size: 1.7,
      },
    },
  },

  // ================= 第 2 关 · 越狱大猩猩「金刚」（5.2，踩跳型还击） =================
  kong: {
    id: 'kong',
    name: '金刚',
    title: '越狱大猩猩',
    sprite: 'kong',
    defeatText: '被踩晕啦，灰溜溜跑回笼子~',
    z: 22,
    grounded: true, // 在前面跑，边跑边往后扔东西
    hoverY: 0,
    moveSpeed: 6,
    waveDuration: 6,
    waveGap: 0.6,
    stunRecoverTime: 1.4,
    hurtTime: 1.5,
    phases: [
      {
        // 教学：滚桶(跳) / 藤蔓双荡(低荡跳、高荡铲 + 跟着让道)
        name: '热身荡跃',
        hint: '滚桶 → 跳！藤蔓低荡跳、高荡铲！',
        expression: 'normal',
        waves: [
          { spawns: [{ type: 'barrel', every: 1.9, offset: 0.4, lane: 'player' }] },
          { spawns: [{ type: 'vineSweep', every: 3.2, offset: 0.5 }] },
          {
            spawns: [
              { type: 'barrel', every: 2.0, offset: 0.4, lane: 'random' },
              { type: 'vineSweep', every: 3.8, offset: 1.8 },
            ],
          },
        ],
      },
      {
        // 组合技：困兽之斗（塌陷锁道 + 桶打剩下两道）/ 荡+桶（影子扫完的道紧接着来桶）
        name: '困兽之斗',
        hint: '跑道塌了只剩两道：滚桶只能跳！',
        expression: 'angry',
        waves: [
          {
            spawns: [
              { type: 'laneLock', bullet: 'pit', every: 4.4, offset: 0.5 },
              { type: 'barrel', every: 1.3, offset: 1.8, lane: 'random' },
            ],
          },
          {
            spawns: [
              { combo: [{ type: 'vineSweep', form: 'low' }, { type: 'barrel', lane: 'random', delay: 0.9 }], every: 3.4, offset: 0.5 },
            ],
          },
          {
            spawns: [
              { type: 'laneLock', bullet: 'pit', every: 5.0, offset: 0.5 },
              { combo: [{ type: 'vineSweep' }, { type: 'barrel', lane: 'random', delay: 0.9 }], every: 3.8, offset: 2.2 },
            ],
          },
        ],
      },
      {
        // 考核：连续双荡 + 绝地跳板（跳板道在坑对面）
        name: '疯狂马戏',
        hint: '香蕉地毯 → 抢跳板道飞过去！',
        expression: 'angry',
        waves: [
          {
            spawns: [
              { type: 'vineSweep', every: 2.6, offset: 0.4 },
              { type: 'barrel', every: 2.6, offset: 1.4, lane: 'player' },
            ],
          },
          {
            spawns: [
              { type: 'bananaCarpet', every: 5.2, offset: 0.5 },
              { type: 'barrel', every: 2.4, offset: 1.8, lane: 'random' },
            ],
          },
          {
            spawns: [
              { type: 'laneLock', bullet: 'pit', every: 5.5, offset: 0.4 },
              { combo: [{ type: 'vineSweep' }, { type: 'barrel', lane: 'random', delay: 0.9 }], every: 3.2, offset: 2.4 },
            ],
          },
        ],
      },
    ],
    // 还击（6.2 踩跳型）：金刚累得喘气，扔来的滚桶发金光变成"可踩" → 跳上桶弹起、落到金刚头上踩一下
    counter: {
      type: 'stomp',
      name: '踩跳',
      firstDelay: 1.0,
      interval: 1.4,
      hint: '跳上金色滚桶，踩金刚的头！',
      hintAgain: '跳到金色滚桶上面！',
      hintBonk: '被桶撞了也不扣心，再来！',
      dashTime: 0.45, // 被踩前金刚冲到脚下的时间
    },
    bullets: {
      barrel: { speed: 13, height: 1.0, length: 1.0 },
      goldBarrel: { speed: 10, height: 1.0, length: 1.0 },
      // 藤蔓双荡（新）：影子逐道扫，低荡扫腿(跳)、高荡扫头顶(铲)
      vineSweep: { speed: 12, beat: 0.45, length: 1.2, lowHeight: 1.0, highClearance: 1.35, highTop: 2.85, spriteLow: 'barrel', spriteHigh: 'banner' },
      // 跑道塌陷（新）：一条道整个塌成坑，锁 2.2 秒
      pit: { speed: 11, length: 8, height: 2.5, lockTime: 2.2, telegraphExtra: 0.35, sprite: 'pit', draw: 'strip' },
      bananaCarpet: { speed: 12, length: 8, height: 0.3, springAhead: 5, springAir: 1.25, telegraphExtra: 0.4 },
      bananaLob: { flightTime: 1.0, arcHeight: 4 },
    },
  },

  // ================= 第 3 关 · 茶餐厅老板「波哥」（5.3，投掷型还击） =================
  bo: {
    id: 'bo',
    name: '波哥',
    title: '茶餐厅老板',
    sprite: 'bo',
    defeatText: '收摊回茶餐厅啦~',
    z: 22,
    grounded: true,
    hoverY: 0,
    moveSpeed: 6,
    waveDuration: 6,
    waveGap: 0.6,
    stunRecoverTime: 1.4,
    hurtTime: 1.5,
    phases: [
      {
        // 教学：奶茶(站空道) / 餐盘链(按节拍跳/铲)
        name: '开档',
        hint: '奶茶 → 站空道！餐盘低跳高铲！',
        expression: 'normal',
        waves: [
          { spawns: [{ type: 'milkTea', every: 2.2, offset: 0.4 }] },
          { spawns: [{ type: 'band', bullet: 'trayWall', sequence: ['low', 'high', 'low', 'high'], every: 1.5, offset: 0.5 }] },
          {
            spawns: [
              { type: 'milkTea', every: 2.4, offset: 0.4 },
              { type: 'band', bullet: 'trayWall', sequence: ['low', 'low', 'high', 'high'], every: 1.5, offset: 2.0 },
            ],
          },
        ],
      },
      {
        // 组合技：鸳鸯双拼（奶茶占两道 + 全场地波 → 站空道+跳）/ 加料奶茶（餐盘链中途插红道）
        name: '鸳鸯双拼',
        hint: '站进空道，原地跳过地波！',
        expression: 'angry',
        waves: [
          { spawns: [{ combo: [{ type: 'milkTea' }, { type: 'wokWave' }], every: 3.0, offset: 0.5 }] },
          {
            spawns: [
              { combo: [{ type: 'band', bullet: 'trayWall', sequence: ['low', 'low', 'high'] }, { type: 'milkTea', delay: 0.6 }], every: 3.4, offset: 0.5 },
            ],
          },
          {
            spawns: [
              { combo: [{ type: 'milkTea' }, { type: 'wokWave' }], every: 3.0, offset: 0.4 },
              { type: 'band', bullet: 'trayWall', sequence: ['high', 'low', 'high'], every: 1.5, offset: 2.4 },
            ],
          },
        ],
      },
      {
        // 考核：6 连餐盘链 + 三连地波 + 双拼
        name: '打烊冲刺',
        hint: '餐盘跟节拍跳铲！红圈 + 地波一起躲！',
        expression: 'angry',
        waves: [
          { spawns: [{ type: 'band', bullet: 'trayWall', sequence: ['low', 'high', 'low', 'high', 'low', 'high'], every: 1.25, offset: 0.4 }] },
          { spawns: [{ combo: [{ type: 'bunTriple' }, { type: 'wokWave', delay: 0.8 }], every: 2.9, offset: 0.5 }] },
          {
            spawns: [
              { combo: [{ type: 'milkTea' }, { type: 'wokWave' }], every: 3.0, offset: 0.4 },
              { type: 'band', bullet: 'trayWall', sequence: ['low', 'high', 'low', 'high'], every: 1.3, offset: 2.6 },
            ],
          },
        ],
      },
    ],
    // 还击（6.2 投掷型）：波哥累了会掉发光的菠萝油 → 捡起后底部出现蓄力条，指针摆到红区时按反击键扔回去
    counter: {
      type: 'throw',
      name: '投掷',
      firstDelay: 0.6,
      interval: 1.6,
      hint: '捡起菠萝油，指针进红区按 J / 点屏幕扔回去！',
      hintAmmo: '有回忆道具！按 J / 点屏幕直接开始投掷',
      hintMiss: '扔偏了！再捡一个试试',
      barPeriod: 1.6, // 指针来回一次的时间（放慢一点，红区停留更久）
      zoneStart: 0.6, // 红区位置（0~1）
      zoneWidth: 0.26, // 红区宽度（触屏点击有延迟，判定从宽）
      barTimeout: 4, // 一直不按会自动扔出（大概率扔偏）
      returnTime: 0.5,
    },
    bullets: {
      milkTea: { speed: 13, height: 2.2, length: 0.8, telegraphExtra: 0.3 },
      bunTriple: { flightTime: 1.0, arcHeight: 5, gap: 0.45, count: 3 },
      wokWave: { speed: 12, height: 0.5, length: 0.6 },
      // 餐盘节奏链（新）：一排排餐盘，低空(跳)/吊着(铲)交替
      trayWall: { speed: 11.5, length: 0.7, lowHeight: 0.85, highClearance: 1.35, highTop: 2.85, spriteLow: 'trayLow', spriteHigh: 'trayHigh', draw: 'stretch' },
    },
  },

  // ================= 第 4 关 · 失控旋转木马「木木」（5.4，冲刺型还击） =================
  mumu: {
    id: 'mumu',
    name: '木木',
    title: '失控旋转木马',
    sprite: 'mumu',
    defeatText: '转晕了，被拖回维修车间~',
    z: 22,
    grounded: true,
    hoverY: 0,
    moveSpeed: 6,
    waveDuration: 6,
    waveGap: 0.6,
    stunRecoverTime: 1.4,
    hurtTime: 1.5,
    phases: [
      {
        // 教学：木马环绕(站空档) / 摩天轮(两道宽巨梁，安全道换一次)
        name: '木马归位',
        hint: '木马 → 看红道！摩天轮第二根会换道！',
        expression: 'normal',
        waves: [
          { spawns: [{ type: 'horses', every: 2.2, offset: 0.4 }] },
          { spawns: [{ type: 'ferrisWheel', every: 3.6, offset: 0.5 }] },
          {
            spawns: [
              { type: 'horses', every: 2.4, offset: 0.4 },
              { type: 'ferrisWheel', every: 4.2, offset: 1.9 },
            ],
          },
        ],
      },
      {
        // 组合技：追逐链(安全道漂移，连续换道) + 链上开花(链中途全宽地波 → 跟链同时跳)
        name: '安全漂移',
        hint: '跟着安全道连续变道！地波原地跳！',
        expression: 'angry',
        waves: [
          { spawns: [{ type: 'chaseChain', every: 3.8, offset: 0.5 }] },
          { spawns: [{ combo: [{ type: 'chaseChain' }, { type: 'beatWave', delay: 1.3 }], every: 4.2, offset: 0.5 }] },
          {
            spawns: [
              { type: 'chaseChain', every: 4.0, offset: 0.4 },
              { type: 'ringLob', every: 4.6, offset: 2.4 },
            ],
          },
        ],
      },
      {
        // 考核：极速追逐(中途反向) + 轮马双读
        name: '极速旋转',
        hint: '追逐链会中途反向！轮 + 马同时要看！',
        expression: 'angry',
        waves: [
          { spawns: [{ type: 'chaseChain', every: 3.4, offset: 0.4, reverse: true }] },
          { spawns: [{ combo: [{ type: 'chaseChain' }, { type: 'beatWave', delay: 1.3 }], every: 4.0, offset: 0.5 }] },
          {
            spawns: [
              { type: 'chaseChain', every: 3.2, offset: 0.4, reverse: true },
              { type: 'ferrisWheel', every: 4.4, offset: 2.4 },
            ],
          },
        ],
      },
    ],
    // 还击（6.2 冲刺型）：木木转晕跪地，地面出现绿箭头 → 站到那条道，连按两次方向键冲刺撞它
    counter: {
      type: 'dash',
      name: '冲刺',
      firstDelay: 0.6,
      interval: 1.0,
      kneelZ: 8, // 跪在前方多远
      dashTime: 0.3,
      hint: '站上绿箭头那条道，连按两次方向键（或按 J / 点屏幕）冲刺撞它！',
      hintAgain: '先站到绿箭头那条道上，再连按两次！',
      hintBonk: '',
    },
    bullets: {
      horse: { speed: 11, height: 2.0, length: 1.0, period: 1.6 },
      ringLob: { flightTime: 1.0, arcHeight: 5, count: 2 },
      // 追逐链（新）：红道按节拍依次转移，安全道一直漂移
      chaseChain: { speed: 14, beat: 0.7, count: 6, length: 1.2, height: 2.2, sprite: 'ribbon' },
      // 摩天轮（新）：两道宽巨梁 ×2，第二根错开换道 → 安全道换一次
      ferrisWheel: { speed: 11, telegraphExtra: 0.4, secondDelay: 0.75, length: 1.4, height: 2.6 },
      beatWave: { speed: 12, height: 0.5, length: 0.6, beat: 0.75, count: 3 },
    },
  },

  // ================= 第 5 关 · 章鱼烧老板「章章」（5.5，完美反击·选落点） =================
  zhang: {
    id: 'zhang',
    name: '章章',
    title: '章鱼烧老板',
    sprite: 'zhang',
    defeatText: '收摊回家翻章鱼烧去啦~',
    z: 22,
    grounded: true,
    hoverY: 0,
    moveSpeed: 7,
    waveDuration: 6,
    waveGap: 0.6,
    stunRecoverTime: 1.4,
    hurtTime: 1.5,
    phases: [
      {
        // 教学：弹珠(预判弹道) / 木鱼三连(节拍跳)
        name: '弹珠开场',
        hint: '章鱼烧落地会弹道，跟着红圈连躲！',
        expression: 'normal',
        waves: [
          { spawns: [{ type: 'ballBounce', every: 2.4, offset: 0.4 }] },
          { spawns: [{ type: 'beatWave', every: 3.2, offset: 0.5 }] },
          {
            spawns: [
              { type: 'ballBounce', every: 2.6, offset: 0.4 },
              { type: 'beatWave', every: 3.8, offset: 2.0 },
            ],
          },
        ],
      },
      {
        // 组合技：触手封锁(一条道被按住) + 弹珠只在两道间弹 / 窄巷节拍
        name: '瓮中之鳖',
        hint: '触手按住一道，只剩两条可走！',
        expression: 'angry',
        waves: [
          {
            spawns: [
              { type: 'laneLock', bullet: 'tentacle', every: 6.5, offset: 0.5 },
              { type: 'ballBounce', every: 2.6, offset: 2.4 },
            ],
          },
          {
            spawns: [
              { type: 'laneLock', bullet: 'tentacle', every: 6.5, offset: 0.5 },
              { type: 'beatWave', every: 3.4, offset: 2.6 },
            ],
          },
          {
            spawns: [
              { type: 'laneLock', bullet: 'tentacle', every: 6.0, offset: 0.5 },
              { combo: [{ type: 'dualLob' }, { type: 'beatWave', delay: 1.4 }], every: 4.0, offset: 2.6 },
            ],
          },
        ],
      },
      {
        // 考核：双手连抛(节奏红圈) + 双节奏 + 封锁常驻
        name: '章鱼烧暴雨',
        hint: '双手连抛 + 地波，两组节拍都接住！',
        expression: 'angry',
        waves: [
          {
            spawns: [
              { type: 'dualLob', every: 3.6, offset: 0.4 },
              { type: 'beatWave', every: 4.6, offset: 2.2 },
            ],
          },
          {
            spawns: [
              { type: 'laneLock', bullet: 'tentacle', every: 6.0, offset: 0.5 },
              { type: 'ballBounce', every: 2.8, offset: 2.4 },
              { type: 'beatWave', every: 5.0, offset: 3.6 },
            ],
          },
          {
            spawns: [
              { combo: [{ type: 'dualLob' }, { type: 'beatWave', delay: 1.2 }], every: 3.8, offset: 0.5 },
              { type: 'laneLock', bullet: 'tentacle', every: 6.5, offset: 3.0 },
            ],
          },
        ],
      },
    ],
    // 还击（6.2 反弹型·进阶 · P3 完美反击）：金光巨章鱼烧 → 金圈时刻按 J 拍回去 → 再按方向键选落点砸章章
    counter: {
      type: 'reflect',
      aim: true,
      name: '完美反击（选落点）',
      bullet: 'giantTako',
      firstDelay: 0.8,
      interval: 1.4,
      hitWindow: 0.3,
      returnTime: 0.55,
      aimTime: 0.65, // 选落点的时间（慢动作中，约 2 秒）
      hint: '金圈亮起按 J / 点屏幕拍回去，再选落点砸章章！',
      hintAim: '选落点！章章在哪条道就按哪边：← 左 / ↑ 中 / → 右',
      hintMissAim: '砸偏了！看准章章站在哪条道',
      hintAgain: '拍早了！等金圈亮起再按！',
      hintBonk: '被砸懵了也不扣心，再来！',
    },
    bullets: {
      ballBounce: { flightTime: 1.0, arcHeight: 4.5, bounceTime: 0.7, bounces: 2 },
      beatWave: { speed: 12, height: 0.5, length: 0.6, beat: 0.75, count: 3 },
      takoRain: { flightTime: 1.0, arcHeight: 6, count: 2 },
      // 触手封锁（新）：按住一条道 3 秒，还会再拍一次
      tentacle: { speed: 10.5, length: 2.4, height: 3.2, lockTime: 3.0, telegraphExtra: 0.35, reSlam: 1.3, sprite: 'tentacle', draw: 'center', fps: 6 },
      // 双手连抛（新）：左右手按节拍交替抛向玩家当前道
      dualLob: { count: 5, interval: 0.55, sprite: 'takoBall' },
      lob: { flightTime: 0.95, arcHeight: 4.2 },
      giantTako: { speed: 11, height: 1.5 },
    },
  },

  // ================= 第 6 关 · 巨型螃蟹「蟹老板」（5.6，踩跳型·进阶） =================
  crab: {
    id: 'crab',
    name: '蟹老板',
    title: '巨型螃蟹',
    sprite: 'crab',
    defeatText: '横着溜回海里了~',
    z: 22,
    grounded: true,
    hoverY: 0,
    moveSpeed: 6,
    waveDuration: 6,
    waveGap: 0.6,
    stunRecoverTime: 1.4,
    hurtTime: 1.5,
    phases: [
      {
        // 教学：泡泡合拢 / 巨钳横扫
        name: '潮起',
        hint: '泡泡 → 站空侧！巨钳 → 跳！',
        expression: 'normal',
        waves: [
          { spawns: [{ type: 'bubbles', every: 2.2, offset: 0.4, sequence: ['center', 'sides'] }] },
          { spawns: [{ type: 'clawSweep', every: 1.6, offset: 0.4 }] },
          {
            spawns: [
              { type: 'bubbles', every: 2.4, offset: 0.4, sequence: ['sides', 'center'] },
              { type: 'clawSweep', every: 2.2, offset: 2.0 },
            ],
          },
        ],
      },
      {
        // 组合技：沙墙推进(慢墙带洞，洞里还有坎) / 墙后偷袭(等墙时巨钳到 → 洞道内原地跳)
        name: '沙墙推进',
        hint: '提前站进金光洞道，洞里还要跳一下！',
        expression: 'angry',
        waves: [
          { spawns: [{ type: 'sandWall', every: 4.6, offset: 0.5 }] },
          { spawns: [{ combo: [{ type: 'sandWall' }, { type: 'clawSweep', delay: 2.2 }], every: 5.0, offset: 0.5 }] },
          {
            spawns: [
              { type: 'sandWall', every: 5.2, offset: 0.5 },
              { type: 'bubbleRain', every: 3.6, offset: 2.6 },
            ],
          },
        ],
      },
      {
        // 考核：风沙视野 + 墙钳连环 + 双钳快拍
        name: '沙暴怒涛',
        sand: true, // 风沙遮挡视野（纯视觉）
        hint: '风沙只是遮挡，盯住金光洞道和钳子！',
        expression: 'angry',
        waves: [
          {
            spawns: [
              { type: 'sandWall', every: 5.4, offset: 0.5 },
              { type: 'bubbleRain', every: 3.2, offset: 2.8 },
              { type: 'clawSweep', every: 2.6, offset: 1.8 },
            ],
          },
          { spawns: [{ type: 'clawSweep', every: 1.15, offset: 0.4 }] },
          {
            spawns: [
              { combo: [{ type: 'sandWall' }, { type: 'clawSweep', delay: 2.2 }], every: 5.6, offset: 0.4 },
              { type: 'bubbles', every: 4.0, offset: 3.0, sequence: ['center', 'sides'] },
            ],
          },
        ],
      },
    ],
    // 还击（6.2 踩跳型·进阶）：壳张开露出发光弱点 → 踩上它推来的金色跳板，跃起踩弱点
    counter: {
      type: 'stomp',
      object: 'spring',
      name: '踩跳（跳板）',
      firstDelay: 0.8,
      interval: 1.4,
      springAir: 1.1,
      dashTime: 0.5,
      hint: '踩上金色跳板，踩它壳里发光的弱点！',
      hintAgain: '没踩到跳板！站到跳板那条道',
      hintBonk: '',
    },
    bullets: {
      bubbles: { speed: 8, height: 2.0, length: 1.2 },
      clawSweep: { speed: 12, height: 0.7, length: 0.8 },
      springGold: { speed: 10 },
      // 沙墙（新）：慢速全宽墙带一个洞，洞里有低沙坎（要跳）
      sandWall: { speed: 5.5, length: 1.8, height: 3.4, ridgeLength: 1.0, ridgeHeight: 0.5 },
      // 泡沫阵雨（新）：随机道红圈泡泡雨
      bubbleRain: { count: 3, interval: 0.45, sprite: 'seaBubble' },
      lob: { flightTime: 0.9, arcHeight: 3.8 },
    },
  },

  // ================= 第 7 关 · 忘却兽「吞吞」（5.7，最终 Boss，混合还击） =================
  tuntun: {
    id: 'tuntun',
    name: '吞吞',
    title: '忘却兽',
    sprite: 'tuntun',
    defeatText: '把吞掉的回忆都吐出来啦！',
    finale: true,
    z: 26,
    hoverY: 8,
    moveSpeed: 7,
    waveDuration: 6,
    waveGap: 0.6,
    stunRecoverTime: 1.4,
    hurtTime: 1.6,
    phases: [
      {
        // 混合考卷 · 上半场：商场 & 动物园的招牌机制组合
        name: '回忆 · 商场 & 动物园',
        hint: '气球墙 → 铲！藤蔓 → 跟着让道跳！',
        expression: 'normal',
        waves: [
          {
            spawns: [
              { combo: [{ type: 'band', bullet: 'balloonWall', band: 'high' }, { type: 'blindBox', lane: 'player', fan: 0 }], every: 2.9, offset: 0.5 },
            ],
          },
          {
            spawns: [
              { combo: [{ type: 'vineSweep', form: 'low' }, { type: 'barrel', lane: 'random', delay: 0.9 }], every: 3.4, offset: 0.5 },
            ],
          },
          {
            spawns: [
              { combo: [{ type: 'band', bullet: 'ribbonBeam', band: 'high' }, { type: 'band', bullet: 'trayWall', band: 'low', delay: 0.55 }], every: 3.0, offset: 0.5 },
            ],
          },
        ],
      },
      {
        // 混合考卷 · 下半场：游乐园 & 夜市 & 海边的招牌机制 + 遗忘之墨
        name: '回忆 · 游乐园 & 夜市 & 海边',
        hint: '追逐链、触手、沙墙！墨水会挡住视线！',
        expression: 'angry',
        waves: [
          { spawns: [{ combo: [{ type: 'chaseChain' }, { type: 'beatWave', delay: 1.3 }], every: 4.2, offset: 0.5 }] },
          {
            spawns: [
              { type: 'laneLock', bullet: 'tentacle', every: 6.5, offset: 0.5 },
              { type: 'dualLob', every: 3.8, offset: 2.6 },
              { type: 'ink', every: 11, offset: 5.0 },
            ],
          },
          {
            spawns: [
              { type: 'sandWall', every: 5.4, offset: 0.5 },
              { combo: [{ type: 'dualLob' }, { type: 'beatWave', delay: 1.2 }], every: 4.2, offset: 2.8 },
            ],
          },
        ],
      },
      {
        // 终局：记忆洪流（成对红圈投掷与成对占道墙交替，空档匀速移动）+ 各机制收尾
        name: '记忆洪流',
        hint: '红圈与高墙交替推进，唯一空档一直在走 → 跟上它！',
        expression: 'angry',
        waves: [
          {
            spawns: [
              { type: 'flood', every: 4.6, offset: 0.6 },
              { type: 'ink', every: 12, offset: 6.0 },
            ],
          },
          { spawns: [{ combo: [{ type: 'flood' }, { type: 'beatWave', delay: 1.6 }], every: 5.2, offset: 0.6 }] },
          {
            spawns: [
              { type: 'flood', every: 4.2, offset: 0.5 },
              { combo: [{ type: 'chaseChain' }, { type: 'beatWave', delay: 1.3 }], every: 4.6, offset: 2.6 },
            ],
          },
        ],
      },
    ],
    // 还击（混合型·终局）：每个阶段随机考一种（完美反击 / 踩跳 / 投掷 / 冲刺），三个阶段不重复
    counter: {
      type: 'mixed',
      name: '混合',
      variants: {
        reflect: {
          type: 'reflect',
          name: '完美反击',
          bullet: 'giantGift',
          firstDelay: 0.8,
          interval: 1.5,
          hitWindow: 0.3,
          returnTime: 0.5,
          hint: '这次是完美反击！金圈亮起的瞬间按 J / 点屏幕拍回去！',
          hintAgain: '拍早了！等金圈亮起再按！',
          hintBonk: '被砸懵了也不扣心，再来！',
        },
        stomp: {
          type: 'stomp',
          name: '踩跳',
          firstDelay: 0.8,
          interval: 1.4,
          dashTime: 0.45,
          hint: '这次是踩跳！跳上金色滚桶，弹起来踩它！',
          hintAgain: '跳到金色滚桶上面！',
          hintBonk: '被桶撞了也不扣心，再来！',
        },
        throw: {
          type: 'throw',
          name: '投掷',
          firstDelay: 0.6,
          interval: 1.6,
          barPeriod: 1.6,
          zoneStart: 0.6,
          zoneWidth: 0.26,
          barTimeout: 4,
          returnTime: 0.5,
          hint: '这次是投掷！捡起菠萝油，指针进红区按 J / 点屏幕！',
          hintAmmo: '有回忆道具！按 J / 点屏幕直接开始投掷',
          hintMiss: '扔偏了！再捡一个试试',
        },
        dash: {
          type: 'dash',
          name: '冲刺',
          firstDelay: 0.6,
          interval: 1.0,
          kneelZ: 9,
          dashTime: 0.3,
          hint: '这次是冲刺！站上绿箭头那条道，连按两次方向键（或按 J）冲过去！',
          hintAgain: '先站到绿箭头那条道上，再连按两次！',
          hintBonk: '',
        },
      },
    },
    bullets: {
      blindBox: { flightTime: 1.1, landZ: 16, arcHeight: 5, confettiSpeed: 9.5, confettiHeight: 0.45, confettiLength: 0.8, fanTime: 0.35 },
      barrel: { speed: 12, height: 1.0, length: 1.0 },
      goldBarrel: { speed: 10, height: 1.0, length: 1.0 },
      balloonWall: { speed: 12, length: 0.7, lowHeight: 0.8, highClearance: 1.35, highTop: 2.6, spriteLow: 'balloons', spriteHigh: 'balloons', draw: 'lanes', hang: true },
      ribbonBeam: { speed: 11.5, length: 0.7, lowHeight: 0.8, highClearance: 1.35, highTop: 2.6, spriteLow: 'ribbon', spriteHigh: 'ribbon', draw: 'lanes', hang: true, anim: true, fps: 8 },
      trayWall: { speed: 11.5, length: 0.7, lowHeight: 0.85, highClearance: 1.35, highTop: 2.85, spriteLow: 'trayLow', spriteHigh: 'trayHigh', draw: 'stretch' },
      vineSweep: { speed: 12, beat: 0.45, length: 1.2, lowHeight: 1.0, highClearance: 1.35, highTop: 2.85, spriteLow: 'barrel', spriteHigh: 'banner' },
      chaseChain: { speed: 14, beat: 0.7, count: 6, length: 1.2, height: 2.2, sprite: 'ribbon' },
      tentacle: { speed: 10.5, length: 2.4, height: 3.2, lockTime: 3.0, telegraphExtra: 0.35, reSlam: 1.3, sprite: 'tentacle', draw: 'center', fps: 6 },
      dualLob: { count: 5, interval: 0.55, sprite: 'takoBall' },
      sandWall: { speed: 5.5, length: 1.8, height: 3.4, ridgeLength: 1.0, ridgeHeight: 0.5 },
      beatWave: { speed: 11, height: 0.5, length: 0.6, beat: 0.75, count: 3 },
      // 记忆洪流：wallSpeed = 占道墙的推进速度（墙与投掷物校正到同一节拍到达）
      flood: { beat: 0.55, count: 8, sprite: 'takoBall', wallSpeed: 12 },
      lob: { flightTime: 0.95, arcHeight: 4.2 },
      giantGift: { speed: 11, height: 1.5, size: 1.7 },
    },
  },
};
