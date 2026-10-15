/**
 * BGM 曲谱 —— 程序化 chiptune（Web Audio 实时合成），全部为本项目原创旋律，可自由使用（等同 CC0）。
 * 记谱法：每个记号是一"步"（stepsPerBeat=2 表示一步 = 八分音符）。
 *   C5 / F#4 / Bb3  音符；  -  延长上一个音；  .  休止；  |  小节线（仅为可读性，会被忽略）
 * 鼓轨：k 底鼓  s 军鼓  h 闭镲  o 开镲  K 底鼓+镲  S 军鼓+镲  . 休止
 */
export const SONGS = {
  // 标题画面：温柔、慢一点
  title: {
    bpm: 100,
    stepsPerBeat: 2,
    tracks: [
      {
        wave: 'triangle',
        vol: 0.16,
        gate: 0.92,
        notes:
          '| G4 - C5 - E5 - D5 C5 | D5 - - - B4 - G4 - | C5 - E5 - A5 - G5 E5 | F5 - - - E5 - D5 - |' +
          '| G4 - C5 - E5 - G5 - | A5 - G5 - D5 - E5 F5 | E5 - C5 - A4 - C5 D5 | C5 - - - - - . . |',
      },
      {
        wave: 'pulse12',
        vol: 0.035,
        gate: 0.6,
        notes:
          '| C4 E4 G4 E4 C4 E4 G4 E4 | B3 D4 G4 D4 B3 D4 G4 D4 | A3 C4 E4 C4 A3 C4 E4 C4 | A3 C4 F4 C4 A3 C4 F4 C4 |' +
          '| C4 E4 G4 E4 C4 E4 G4 E4 | B3 D4 G4 D4 B3 D4 G4 D4 | A3 C4 E4 C4 A3 C4 F4 C4 | C4 E4 G4 E4 C4 E4 G4 C5 |',
      },
      {
        wave: 'triangle',
        vol: 0.14,
        gate: 0.95,
        notes:
          '| C3 - - - G2 - - - | G2 - - - D3 - - - | A2 - - - E3 - - - | F2 - - - C3 - - - |' +
          '| C3 - - - G2 - - - | G2 - - - D3 - - - | A2 - - - F2 - - - | C3 - - - G2 - - - |',
      },
      {
        drums: true,
        vol: 0.07,
        notes: '| k . h . s . h . | k . h . s . h h | k . h . s . h . | k . h . s . h o |'.repeat(2),
      },
    ],
  },

  // 第 1 关 · 商场：明快、蹦蹦跳跳
  mall: {
    bpm: 148,
    stepsPerBeat: 2,
    tracks: [
      {
        wave: 'pulse25',
        vol: 0.065,
        gate: 0.85,
        notes:
          '| E5 G5 C6 G5 E5 G5 A5 G5 | E5 - C5 E5 A5 - G5 E5 | F5 A5 C6 A5 F5 A5 C6 D6 | D6 - B5 G5 D5 G5 B5 - |' +
          '| E5 G5 C6 G5 E6 - D6 C6 | A5 - E5 A5 C6 - B5 A5 | F5 A5 C6 A5 G5 B5 D6 B5 | C6 - G5 E5 C5 - . . |' +
          '| A5 - - C6 B5 - A5 G5 | F5 - - A5 G5 - F5 E5 | E5 G5 C6 - B5 - G5 - | D5 - G5 - B5 - D6 - |' +
          '| A5 - - C6 B5 - A5 G5 | F5 - A5 C6 F6 - E6 D6 | E6 - C6 - G5 - E5 G5 | D6 - - - B5 - G5 - |',
      },
      {
        wave: 'triangle',
        vol: 0.15,
        gate: 0.8,
        notes:
          '| C3 . G3 . C3 . G3 . | A2 . E3 . A2 . E3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . D3 . |' +
          '| C3 . G3 . C3 . G3 . | A2 . E3 . A2 . E3 . | F2 . C3 . G2 . D3 . | C3 . G2 . C3 . . . |' +
          '| A2 . A3 . A2 . A3 . | F2 . F3 . F2 . F3 . | C3 . C4 . C3 . C4 . | G2 . G3 . G2 . G3 . |' +
          '| A2 . A3 . A2 . A3 . | F2 . F3 . F2 . F3 . | C3 . C4 . C3 . C4 . | G2 . G3 . G2 . B2 . |',
      },
      {
        drums: true,
        vol: 0.09,
        notes: '| K h S h k K S h | K h S h k K S o |'.repeat(8),
      },
    ],
  },

  // Boss 战：小调、紧张、更快
  boss: {
    bpm: 168,
    stepsPerBeat: 2,
    tracks: [
      {
        wave: 'pulse25',
        vol: 0.065,
        gate: 0.8,
        notes:
          '| A5 . A5 C6 E6 . D6 C6 | C6 . A5 . F5 A5 C6 . | B5 . G5 B5 D6 . C6 B5 | G#5 . B5 . E6 . D6 B5 |' +
          '| A5 C6 E6 A6 G6 E6 C6 E6 | F6 E6 C6 A5 C6 . A5 . | G5 B5 D6 G6 F6 D6 B5 D6 | E6 . B5 . G#5 . E5 . |',
      },
      {
        wave: 'triangle',
        vol: 0.16,
        gate: 0.7,
        notes:
          '| A2 A2 A3 A2 A2 A2 A3 A2 | F2 F2 F3 F2 F2 F2 F3 F2 | G2 G2 G3 G2 G2 G2 G3 G2 | E2 E2 E3 E2 E2 E2 E3 E2 |'.repeat(2),
      },
      {
        wave: 'pulse12',
        vol: 0.03,
        gate: 0.5,
        notes:
          '| A4 C5 E5 C5 A4 C5 E5 C5 | F4 A4 C5 A4 F4 A4 C5 A4 | G4 B4 D5 B4 G4 B4 D5 B4 | E4 G#4 B4 G#4 E4 G#4 B4 G#4 |'.repeat(2),
      },
      {
        drums: true,
        vol: 0.1,
        notes: '| K h S h K K S h | K h S h K h S S |'.repeat(4),
      },
    ],
  },

  // 第 2 关 · 动物园：F 大调、蹦蹦跳跳的"嘣嚓嘣嚓"
  zoo: {
    bpm: 138,
    stepsPerBeat: 2,
    tracks: [
      {
        wave: 'pulse25',
        vol: 0.06,
        gate: 0.8,
        notes:
          '| F5 . A5 . C6 A5 F5 . | G5 . E5 . C5 E5 G5 . | A5 - F5 D5 F5 A5 D6 - | C6 - Bb5 A5 G5 - F5 G5 |' +
          '| A5 . C6 . F6 - E6 D6 | E6 - C6 - G5 - E5 G5 | F5 G5 A5 Bb5 C6 - E5 - | F5 - - - . . C5 . |',
      },
      {
        wave: 'pulse12',
        vol: 0.03,
        gate: 0.55,
        notes:
          '| F4 A4 C5 A4 F4 A4 C5 A4 | E4 G4 C5 G4 E4 G4 C5 G4 | D4 F4 A4 F4 D4 F4 A4 F4 | D4 F4 Bb4 F4 D4 F4 Bb4 F4 |' +
          '| F4 A4 C5 A4 F4 A4 C5 A4 | E4 G4 C5 G4 E4 G4 C5 G4 | D4 F4 Bb4 F4 E4 G4 C5 G4 | F4 A4 C5 A4 F4 . . . |',
      },
      {
        wave: 'triangle',
        vol: 0.16,
        gate: 0.6,
        notes:
          '| F2 . C3 . F2 . C3 . | C3 . G2 . C3 . G2 . | D3 . A2 . D3 . A2 . | Bb2 . F2 . Bb2 . F2 . |' +
          '| F2 . C3 . F2 . C3 . | C3 . G2 . C3 . G2 . | Bb2 . F2 . C3 . G2 . | F2 . C3 . F2 . . . |',
      },
      {
        drums: true,
        vol: 0.08,
        notes: '| k . h . s . h . | k . h k s . h o |'.repeat(4),
      },
    ],
  },

  // 第 3 关 · 香港街头：City Pop 风格的夜晚（Fmaj7 - Em7 - Dm7 - G7）
  hk: {
    bpm: 116,
    stepsPerBeat: 2,
    tracks: [
      {
        wave: 'pulse25',
        vol: 0.06,
        gate: 0.9,
        notes:
          '| A5 - G5 E5 - C5 E5 - | G5 - - - D5 - B4 D5 | F5 - E5 D5 - A4 C5 D5 | B4 - - - . G5 F5 D5 |' +
          '| E5 - A5 - C6 - B5 A5 | G5 - E5 - C#5 - E5 G5 | F5 - A5 - G5 - F5 D5 | E5 - - - . . . . |',
      },
      {
        wave: 'pulse12',
        vol: 0.028,
        gate: 0.5,
        notes:
          '| A4 C5 E5 C5 A4 C5 E5 C5 | G4 B4 D5 B4 G4 B4 D5 B4 | F4 A4 C5 A4 F4 A4 C5 A4 | F4 G4 B4 D5 B4 G4 F4 D4 |' +
          '| A4 C5 E5 C5 A4 C5 E5 C5 | G4 B4 D5 B4 G4 C#5 E5 C#5 | F4 A4 C5 A4 F4 G4 B4 G4 | E4 G4 B4 G4 E4 G4 B4 C5 |',
      },
      {
        wave: 'triangle',
        vol: 0.17,
        gate: 0.7,
        notes:
          '| F2 . F3 F2 . C3 F2 . | E2 . E3 E2 . B2 E2 . | D2 . D3 D2 . A2 D2 . | G2 . G3 G2 . D3 F2 G2 |' +
          '| F2 . F3 F2 . C3 F2 . | E2 . E3 . A2 . A3 . | D2 . D3 . G2 . G3 . | C3 . G2 . C3 . E3 G3 |',
      },
      {
        drums: true,
        vol: 0.08,
        notes: '| k . h k s . h . | . k h . s . h o |'.repeat(4),
      },
    ],
  },

  // 第 4 关 · 游乐园：C 大调、嘉年华式的蹦跳
  park: {
    bpm: 150,
    stepsPerBeat: 2,
    tracks: [
      {
        wave: 'pulse25',
        vol: 0.06,
        gate: 0.8,
        notes:
          '| C5 E5 G5 C6 B5 G5 E5 G5 | A5 - F5 - C6 - A5 - | G5 E5 C5 E5 G5 - E5 G5 | D5 - - - G4 - - - |' +
          '| C5 E5 G5 C6 E6 - D6 C6 | B5 - G5 - D6 - B5 - | C6 - G5 - E5 - D5 E5 | C5 - - - . . . . |',
      },
      {
        wave: 'pulse12',
        vol: 0.03,
        gate: 0.5,
        notes:
          '| C4 E4 G4 E4 C4 E4 G4 E4 | F4 A4 C5 A4 F4 A4 C5 A4 | C4 E4 G4 E4 C4 E4 G4 E4 | G3 B3 D4 B3 G3 B3 D4 B3 |' +
          '| C4 E4 G4 E4 C4 E4 G4 E4 | G3 B3 D4 B3 G3 B3 D4 B3 | F3 A3 C4 A3 G3 B3 D4 B3 | C4 E4 G4 E4 C4 . . . |',
      },
      {
        wave: 'triangle',
        vol: 0.16,
        gate: 0.6,
        notes:
          '| C3 . G3 . C3 . G3 . | F2 . C3 . F2 . C3 . | C3 . G3 . C3 . G3 . | G2 . D3 . G2 . D3 . |' +
          '| C3 . G3 . C3 . G3 . | G2 . D3 . G2 . D3 . | F2 . C3 . G2 . D3 . | C3 . G2 . C3 . . . |',
      },
      {
        drums: true,
        vol: 0.08,
        notes: '| k . h h s . h h | k . h h s . h o |'.repeat(4),
      },
    ],
  },

  // 第 5 关 · 夜市：A 小调五声音阶、热闹的叫卖感
  market: {
    bpm: 128,
    stepsPerBeat: 2,
    tracks: [
      {
        wave: 'pulse25',
        vol: 0.06,
        gate: 0.85,
        notes:
          '| A4 - C5 D5 E5 - G5 E5 | D5 - C5 A4 C5 - - - | E5 - G5 A5 G5 - E5 D5 | E5 - - - . . A4 C5 |' +
          '| D5 - E5 G5 A5 - C6 A5 | G5 - E5 D5 E5 - G5 - | A5 G5 E5 D5 C5 - D5 E5 | A4 - - - . . . . |',
      },
      {
        wave: 'pulse12',
        vol: 0.028,
        gate: 0.5,
        notes:
          '| A3 C4 E4 C4 A3 C4 E4 C4 | F3 A3 C4 A3 F3 A3 C4 A3 | C4 E4 G4 E4 C4 E4 G4 E4 | E3 G#3 B3 G#3 E3 G#3 B3 G#3 |' +
          '| D4 F4 A4 F4 D4 F4 A4 F4 | C4 E4 G4 E4 C4 E4 G4 E4 | F3 A3 C4 A3 G3 B3 D4 B3 | A3 C4 E4 C4 A3 . . . |',
      },
      {
        wave: 'triangle',
        vol: 0.16,
        gate: 0.65,
        notes:
          '| A2 . E3 . A2 . E3 . | F2 . C3 . F2 . C3 . | C3 . G3 . C3 . G3 . | E2 . B2 . E2 . B2 . |' +
          '| D3 . A3 . D3 . A3 . | C3 . G3 . C3 . G3 . | F2 . C3 . G2 . D3 . | A2 . E3 . A2 . . . |',
      },
      {
        drums: true,
        vol: 0.08,
        notes: '| k . h k s . h . | k k h . s . h h |'.repeat(4),
      },
    ],
  },

  // 第 6 关 · 海边：G 大调、慵懒的冲浪感
  beach: {
    bpm: 112,
    stepsPerBeat: 2,
    tracks: [
      {
        wave: 'pulse25',
        vol: 0.055,
        gate: 0.9,
        notes:
          '| B4 - D5 - G5 - F#5 E5 | D5 - - - B4 - A4 - | C5 - E5 - A5 - G5 E5 | D5 - - - . . D5 E5 |' +
          '| G5 - F#5 - E5 - D5 B4 | C5 - E5 - D5 - B4 G4 | A4 - C5 - B4 - A4 F#4 | G4 - - - . . . . |',
      },
      {
        wave: 'pulse12',
        vol: 0.026,
        gate: 0.5,
        notes:
          '| G3 B3 D4 B3 G3 B3 D4 B3 | G3 B3 D4 B3 G3 B3 D4 B3 | C4 E4 G4 E4 A3 C4 E4 C4 | D4 F#4 A4 F#4 D4 F#4 A4 F#4 |' +
          '| E4 G4 B4 G4 E4 G4 B4 G4 | C4 E4 G4 E4 G3 B3 D4 B3 | D4 F#4 A4 F#4 D4 F#4 A4 F#4 | G3 B3 D4 B3 G3 . . . |',
      },
      {
        wave: 'triangle',
        vol: 0.16,
        gate: 0.7,
        notes:
          '| G2 . D3 . G2 . D3 . | G2 . D3 . G2 . B2 . | C3 . G3 . A2 . E3 . | D3 . A3 . D3 . F#3 . |' +
          '| E3 . B3 . E3 . B3 . | C3 . G3 . G2 . D3 . | D3 . A3 . D3 . A2 . | G2 . D3 . G2 . . . |',
      },
      {
        drums: true,
        vol: 0.07,
        notes: '| k . h . s . h . | k . h k s . h h |'.repeat(4),
      },
    ],
  },

  // 第 7 关 · 家：F 大调，转抒情（如果你们有"自己的歌"，可以在 M4 换成它的旋律）
  home: {
    bpm: 92,
    stepsPerBeat: 2,
    tracks: [
      {
        wave: 'triangle',
        vol: 0.16,
        gate: 0.95,
        notes:
          '| C5 - - A4 C5 - F5 - | E5 - - - D5 - C5 - | A4 - - G4 A4 - C5 - | D5 - - - - - . . |' +
          '| C5 - - A4 C5 - F5 - | G5 - - - A5 - G5 - | F5 - - E5 D5 - C5 - | F5 - - - - - . . |',
      },
      {
        wave: 'pulse12',
        vol: 0.028,
        gate: 0.55,
        notes:
          '| F3 A3 C4 A3 F3 A3 C4 A3 | C4 E4 G4 E4 C4 E4 G4 E4 | D4 F4 A4 F4 D4 F4 A4 F4 | Bb3 D4 F4 D4 C4 E4 G4 E4 |' +
          '| F3 A3 C4 A3 F3 A3 C4 A3 | Bb3 D4 F4 D4 C4 E4 G4 E4 | Bb3 D4 F4 D4 C4 E4 G4 E4 | F3 A3 C4 A3 F3 A3 C4 F4 |',
      },
      {
        wave: 'triangle',
        vol: 0.13,
        gate: 0.95,
        notes:
          '| F2 - - - C3 - - - | C3 - - - G2 - - - | D3 - - - A2 - - - | Bb2 - - - C3 - - - |' +
          '| F2 - - - C3 - - - | Bb2 - - - C3 - - - | Bb2 - - - C3 - - - | F2 - - - - - - - |',
      },
      {
        drums: true,
        vol: 0.05,
        notes: '| k . . . h . . . | k . . . h . . h |'.repeat(4),
      },
    ],
  },

  // 回忆放映厅 / 群星之夜：八音盒一样的抒情旋律
  theater: {
    bpm: 84,
    stepsPerBeat: 2,
    tracks: [
      {
        wave: 'triangle',
        vol: 0.17,
        gate: 0.9,
        notes:
          '| E5 - G5 - C6 - B5 - | A5 - - - G5 - - - | F5 - A5 - D6 - C6 - | B5 - - - G5 - - - |' +
          '| E5 - G5 - C6 - E6 - | D6 - - - C6 - A5 - | F5 - G5 - A5 - B5 - | C6 - - - - - - - |',
      },
      {
        wave: 'sine',
        vol: 0.05,
        gate: 0.6,
        notes:
          '| C4 E4 G4 E4 C4 E4 G4 E4 | A3 C4 E4 C4 A3 C4 E4 C4 | F3 A3 C4 A3 D4 F4 A4 F4 | G3 B3 D4 B3 G3 B3 D4 B3 |' +
          '| C4 E4 G4 E4 C4 E4 G4 E4 | D4 F4 A4 F4 A3 C4 E4 C4 | F3 A3 C4 A3 G3 B3 D4 B3 | C4 E4 G4 C5 G4 E4 C4 . |',
      },
      {
        wave: 'triangle',
        vol: 0.12,
        gate: 0.95,
        notes:
          '| C3 - - - - - - - | A2 - - - - - - - | F2 - - - D3 - - - | G2 - - - - - - - |' +
          '| C3 - - - - - - - | D3 - - - A2 - - - | F2 - - - G2 - - - | C3 - - - - - - - |',
      },
    ],
  },
};
