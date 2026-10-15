/**
 * 音效配方（Web Audio API 程序化合成，无任何音频文件，无版权问题）。
 * 每个音效由若干"声部"组成，字段：
 *   wave   振荡器波形：square / triangle / sine / sawtooth / pulse25 / pulse12（NES 风格脉冲波）/ noise（白噪声）
 *   f      [起始频率, 结束频率]（Hz）；噪声时表示滤波器截止频率
 *   dur    时长（秒）  vol 音量  delay 延迟  attack 起音时间
 *   curve  频率滑动曲线：exp（默认）/ lin
 *   filter 噪声滤波类型：lowpass / highpass / bandpass
 */
export const SFX = {
  jump: [{ wave: 'pulse25', f: [330, 720], dur: 0.14, vol: 0.2 }],
  doubleJump: [
    { wave: 'pulse25', f: [500, 1000], dur: 0.13, vol: 0.18 },
    { wave: 'triangle', f: [1400, 1900], dur: 0.09, vol: 0.12, delay: 0.05 },
  ],
  slide: [
    { wave: 'noise', f: [1800, 450], dur: 0.22, vol: 0.22, filter: 'lowpass' },
    { wave: 'triangle', f: [220, 120], dur: 0.14, vol: 0.12 },
  ],
  land: [
    { wave: 'noise', f: [900, 200], dur: 0.08, vol: 0.14, filter: 'lowpass' },
    { wave: 'sine', f: [150, 70], dur: 0.08, vol: 0.2 },
  ],
  lane: [{ wave: 'noise', f: [1100, 2800], dur: 0.08, vol: 0.09, filter: 'bandpass' }],
  bump: [
    { wave: 'square', f: [170, 90], dur: 0.12, vol: 0.2 },
    { wave: 'noise', f: [600, 200], dur: 0.08, vol: 0.15, filter: 'lowpass' },
  ],
  coin: [
    { wave: 'pulse25', f: [988, 988], dur: 0.05, vol: 0.11 },
    { wave: 'pulse25', f: [1319, 1319], dur: 0.12, vol: 0.11, delay: 0.05 },
  ],
  pickup: [
    { wave: 'pulse12', f: [523, 523], dur: 0.07, vol: 0.14 },
    { wave: 'pulse12', f: [659, 659], dur: 0.07, vol: 0.14, delay: 0.05 },
    { wave: 'pulse12', f: [784, 784], dur: 0.07, vol: 0.14, delay: 0.1 },
    { wave: 'pulse12', f: [1047, 1047], dur: 0.14, vol: 0.14, delay: 0.15 },
  ],
  shieldGet: [
    { wave: 'triangle', f: [600, 1200], dur: 0.2, vol: 0.2 },
    { wave: 'sine', f: [1200, 1700], dur: 0.2, vol: 0.12, delay: 0.08 },
  ],
  shieldBreak: [
    { wave: 'noise', f: [2400, 1200], dur: 0.25, vol: 0.25, filter: 'highpass' },
    { wave: 'square', f: [900, 280], dur: 0.2, vol: 0.16 },
  ],
  hit: [
    { wave: 'square', f: [240, 55], dur: 0.38, vol: 0.28 },
    { wave: 'noise', f: [1400, 180], dur: 0.32, vol: 0.28, filter: 'lowpass' },
  ],
  // 完美闪避"叮"：清脆的铃音
  perfect: [
    { wave: 'sine', f: [1760, 1760], dur: 0.55, vol: 0.28, attack: 0.002 },
    { wave: 'sine', f: [2637, 2637], dur: 0.35, vol: 0.12, attack: 0.002 },
    { wave: 'triangle', f: [3520, 3520], dur: 0.18, vol: 0.05, attack: 0.002 },
  ],
  reflect: [
    { wave: 'square', f: [300, 1700], dur: 0.22, vol: 0.18, curve: 'lin' },
    { wave: 'noise', f: [2000, 5200], dur: 0.2, vol: 0.12, filter: 'bandpass' },
  ],
  bossHit: [
    { wave: 'square', f: [220, 60], dur: 0.32, vol: 0.28 },
    { wave: 'noise', f: [2500, 300], dur: 0.3, vol: 0.25, filter: 'lowpass' },
    { wave: 'triangle', f: [880, 440], dur: 0.25, vol: 0.18, delay: 0.06 },
  ],
  bossAppear: [
    { wave: 'sawtooth', f: [70, 180], dur: 0.6, vol: 0.14, curve: 'lin' },
    { wave: 'noise', f: [500, 150], dur: 0.7, vol: 0.2, filter: 'lowpass' },
    { wave: 'square', f: [110, 110], dur: 0.35, vol: 0.12, delay: 0.45 },
    { wave: 'square', f: [165, 165], dur: 0.45, vol: 0.12, delay: 0.62 },
  ],
  bossLand: [
    { wave: 'sine', f: [130, 38], dur: 0.45, vol: 0.4 },
    { wave: 'noise', f: [600, 90], dur: 0.38, vol: 0.28, filter: 'lowpass' },
  ],
  heartbeat: [
    { wave: 'sine', f: [75, 48], dur: 0.13, vol: 0.5 },
    { wave: 'sine', f: [68, 44], dur: 0.15, vol: 0.4, delay: 0.17 },
  ],
  fever: [
    { wave: 'pulse25', f: [523, 523], dur: 0.06, vol: 0.13 },
    { wave: 'pulse25', f: [659, 659], dur: 0.06, vol: 0.13, delay: 0.05 },
    { wave: 'pulse25', f: [784, 784], dur: 0.06, vol: 0.13, delay: 0.1 },
    { wave: 'pulse25', f: [1047, 1047], dur: 0.06, vol: 0.13, delay: 0.15 },
    { wave: 'pulse25', f: [1319, 1319], dur: 0.3, vol: 0.13, delay: 0.2 },
    { wave: 'triangle', f: [2093, 2637], dur: 0.35, vol: 0.06, delay: 0.2 },
  ],
  warning: [
    { wave: 'square', f: [880, 880], dur: 0.05, vol: 0.08 },
    { wave: 'square', f: [880, 880], dur: 0.05, vol: 0.08, delay: 0.09 },
  ],
  throw: [{ wave: 'noise', f: [700, 2200], dur: 0.15, vol: 0.1, filter: 'bandpass' }],
  giftLand: [
    { wave: 'noise', f: [1500, 300], dur: 0.15, vol: 0.2, filter: 'lowpass' },
    { wave: 'triangle', f: [320, 150], dur: 0.1, vol: 0.15 },
    { wave: 'pulse12', f: [1200, 1600], dur: 0.05, vol: 0.08, delay: 0.04 },
  ],
  stun: [
    { wave: 'triangle', f: [1500, 1500], dur: 0.08, vol: 0.1 },
    { wave: 'triangle', f: [2000, 2000], dur: 0.08, vol: 0.1, delay: 0.1 },
    { wave: 'triangle', f: [1700, 1700], dur: 0.1, vol: 0.1, delay: 0.2 },
  ],
  victory: [
    { wave: 'pulse25', f: [523, 523], dur: 0.1, vol: 0.16 },
    { wave: 'pulse25', f: [659, 659], dur: 0.1, vol: 0.16, delay: 0.1 },
    { wave: 'pulse25', f: [784, 784], dur: 0.1, vol: 0.16, delay: 0.2 },
    { wave: 'pulse25', f: [1047, 1047], dur: 0.16, vol: 0.16, delay: 0.3 },
    { wave: 'pulse25', f: [1319, 1319], dur: 0.12, vol: 0.16, delay: 0.5 },
    { wave: 'pulse25', f: [1568, 1568], dur: 0.55, vol: 0.16, delay: 0.62 },
    { wave: 'triangle', f: [262, 262], dur: 0.3, vol: 0.2, delay: 0.3 },
    { wave: 'triangle', f: [392, 392], dur: 0.6, vol: 0.2, delay: 0.62 },
  ],
  fail: [
    { wave: 'triangle', f: [392, 392], dur: 0.18, vol: 0.2 },
    { wave: 'triangle', f: [370, 370], dur: 0.18, vol: 0.2, delay: 0.2 },
    { wave: 'triangle', f: [349, 349], dur: 0.18, vol: 0.2, delay: 0.4 },
    { wave: 'triangle', f: [330, 300], dur: 0.6, vol: 0.2, delay: 0.6 },
  ],
  click: [{ wave: 'pulse25', f: [1000, 1000], dur: 0.04, vol: 0.1 }],
  deflate: [
    { wave: 'sawtooth', f: [900, 110], dur: 1.3, vol: 0.1, curve: 'lin' },
    { wave: 'noise', f: [1600, 800], dur: 1.3, vol: 0.09, filter: 'bandpass' },
  ],
  countdown: [{ wave: 'square', f: [660, 660], dur: 0.08, vol: 0.1 }],
  go: [{ wave: 'square', f: [990, 990], dur: 0.16, vol: 0.12 }],

  // ---------------- M2 ----------------
  // 守护换人：心跳两下 + 击掌"叮"
  swap: [
    { wave: 'sine', f: [95, 55], dur: 0.12, vol: 0.4 },
    { wave: 'sine', f: [95, 55], dur: 0.14, vol: 0.32, delay: 0.16 },
    { wave: 'noise', f: [3000, 6000], dur: 0.06, vol: 0.16, filter: 'highpass', delay: 0.02 },
    { wave: 'sine', f: [1568, 1568], dur: 0.45, vol: 0.2, delay: 0.08, attack: 0.002 },
    { wave: 'sine', f: [2349, 2349], dur: 0.3, vol: 0.1, delay: 0.14, attack: 0.002 },
  ],
  // 轻轻的呼气声
  breath: [{ wave: 'noise', f: [900, 500], dur: 0.35, vol: 0.07, filter: 'bandpass', attack: 0.06, delay: 0.1 }],
  // 踩到便便：滑稽的下滑音
  slip: [
    { wave: 'triangle', f: [700, 180], dur: 0.35, vol: 0.22, curve: 'lin' },
    { wave: 'noise', f: [1200, 400], dur: 0.2, vol: 0.12, filter: 'lowpass' },
  ],
  // 跳板 / 踩跳：弹簧"嘣～"
  spring: [
    { wave: 'square', f: [180, 720], dur: 0.18, vol: 0.18, curve: 'lin' },
    { wave: 'triangle', f: [360, 1440], dur: 0.25, vol: 0.12, delay: 0.04 },
  ],
  // 照片碎片：相机快门 + 闪亮琶音
  photo: [
    { wave: 'noise', f: [4000, 2000], dur: 0.05, vol: 0.2, filter: 'highpass' },
    { wave: 'noise', f: [3000, 1500], dur: 0.04, vol: 0.14, filter: 'highpass', delay: 0.07 },
    { wave: 'pulse12', f: [784, 784], dur: 0.08, vol: 0.12, delay: 0.12 },
    { wave: 'pulse12', f: [988, 988], dur: 0.08, vol: 0.12, delay: 0.18 },
    { wave: 'pulse12', f: [1319, 1319], dur: 0.2, vol: 0.12, delay: 0.24 },
  ],

  // ---------------- M3 ----------------
  // 冲刺型还击："咻——"
  dash: [
    { wave: 'noise', f: [800, 4000], dur: 0.3, vol: 0.18, filter: 'bandpass' },
    { wave: 'square', f: [220, 880], dur: 0.25, vol: 0.14, curve: 'lin' },
  ],
  // 木鱼敲击波："咚"
  tock: [
    { wave: 'sine', f: [680, 520], dur: 0.12, vol: 0.3, attack: 0.002 },
    { wave: 'noise', f: [2000, 1200], dur: 0.03, vol: 0.12, filter: 'bandpass' },
  ],
  // 夜市喇叭叫卖：两声短促的"来喽"
  hawk: [
    { wave: 'square', f: [520, 640], dur: 0.16, vol: 0.12 },
    { wave: 'square', f: [640, 480], dur: 0.22, vol: 0.12, delay: 0.2 },
    { wave: 'noise', f: [1800, 1800], dur: 0.4, vol: 0.04, filter: 'bandpass' },
  ],
  // 涨潮
  splash: [
    { wave: 'noise', f: [600, 2400], dur: 0.6, vol: 0.2, filter: 'lowpass', attack: 0.08 },
    { wave: 'noise', f: [3000, 800], dur: 0.5, vol: 0.1, filter: 'highpass', delay: 0.25 },
  ],
  // 章鱼烧弹地
  bounce: [{ wave: 'triangle', f: [300, 600], dur: 0.12, vol: 0.18, curve: 'lin' }],
  // 泡泡
  bubble: [
    { wave: 'sine', f: [400, 900], dur: 0.1, vol: 0.16 },
    { wave: 'sine', f: [500, 1100], dur: 0.08, vol: 0.12, delay: 0.07 },
  ],
  // 烟花
  firework: [
    { wave: 'noise', f: [400, 2600], dur: 0.35, vol: 0.12, filter: 'bandpass' },
    { wave: 'noise', f: [3000, 600], dur: 0.6, vol: 0.18, filter: 'lowpass', delay: 0.35 },
    { wave: 'sine', f: [90, 50], dur: 0.3, vol: 0.25, delay: 0.35 },
  ],
  // 拍立得快门
  shutter: [
    { wave: 'noise', f: [5000, 2500], dur: 0.05, vol: 0.25, filter: 'highpass' },
    { wave: 'noise', f: [4000, 2000], dur: 0.08, vol: 0.18, filter: 'highpass', delay: 0.09 },
    { wave: 'square', f: [1200, 1200], dur: 0.03, vol: 0.06, delay: 0.2 },
  ],
  // 门被撞开
  door: [
    { wave: 'sine', f: [120, 50], dur: 0.4, vol: 0.4 },
    { wave: 'noise', f: [1200, 200], dur: 0.35, vol: 0.25, filter: 'lowpass' },
  ],
  // 光点飞回家 / 发光的门
  sparkle: [
    { wave: 'sine', f: [1568, 1568], dur: 0.25, vol: 0.12, attack: 0.002 },
    { wave: 'sine', f: [2093, 2093], dur: 0.25, vol: 0.1, delay: 0.08, attack: 0.002 },
    { wave: 'sine', f: [2637, 2637], dur: 0.35, vol: 0.08, delay: 0.16, attack: 0.002 },
  ],
};
