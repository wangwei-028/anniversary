import { SFX } from '../data/sfx.js';
import { SONGS } from '../data/music.js';

/**
 * 音频系统（Web Audio API）：
 * - 音效：按 data/sfx.js 的配方实时合成
 * - BGM：按 data/music.js 的曲谱用"前瞻调度"播放 chiptune 循环
 * - 浏览器要求用户交互后才能出声：第一次点击/按键时调用 unlock()
 */
const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function noteToFreq(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return 0;
  let n = NOTE_INDEX[m[1]];
  if (m[2] === '#') n += 1;
  if (m[2] === 'b') n -= 1;
  const octave = parseInt(m[3], 10);
  const midi = (octave + 1) * 12 + n;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** 把曲谱字符串解析成 { freq[], len[] }（len = 持续步数，0 表示该步无新音） */
function parseTrack(str, isDrums) {
  const tokens = str.split(/\s+/).filter((t) => t && t !== '|' && !/^\|+$/.test(t));
  const n = tokens.length;
  const events = new Array(n).fill(null);
  if (isDrums) {
    for (let i = 0; i < n; i++) {
      const t = tokens[i];
      if (t !== '.') events[i] = t;
    }
    return { events, length: n };
  }
  for (let i = 0; i < n; i++) {
    const t = tokens[i];
    if (t === '.' || t === '-') continue;
    let len = 1;
    while (i + len < n && tokens[i + len] === '-') len++;
    events[i] = { freq: noteToFreq(t), len };
  }
  return { events, length: n };
}

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.noiseBuffer = null;
    this.pulseWaves = {};
    this.muted = false;
    this.sfxVolume = 0.9;
    this.musicVolume = 0.7;

    // 预解析曲谱
    this.songs = {};
    for (const key of Object.keys(SONGS)) {
      const s = SONGS[key];
      const tracks = s.tracks.map((t) => ({ ...t, parsed: parseTrack(t.notes, !!t.drums) }));
      let length = 0;
      for (const t of tracks) length = Math.max(length, t.parsed.length);
      this.songs[key] = { bpm: s.bpm, stepsPerBeat: s.stepsPerBeat, tracks, length };
    }
    this.currentSong = null;
    this.currentSongName = '';
    this.songStep = 0;
    this.nextStepTime = 0;
    this.musicRate = 1;
  }

  /** 第一次用户交互时调用：创建 / 恢复 AudioContext */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.master);

      // 1 秒白噪声，所有噪声音色共用
      const len = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      this.pulseWaves.pulse25 = this.makePulseWave(0.25);
      this.pulseWaves.pulse12 = this.makePulseWave(0.125);
      if (this.currentSongName) this.startSongClock();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** NES 风格的脉冲波（占空比 duty） */
  makePulseWave(duty) {
    const n = 48;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      real[k] = (2 / (k * Math.PI)) * Math.sin(2 * Math.PI * k * duty);
      imag[k] = (2 / (k * Math.PI)) * (1 - Math.cos(2 * Math.PI * k * duty));
    }
    return this.ctx.createPeriodicWave(real, imag);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** 播放音效。pitch：音高倍率；vol：音量倍率 */
  play(name, pitch = 1, vol = 1) {
    if (!this.ctx || this.muted) return;
    const recipe = SFX[name];
    if (!recipe) return;
    const t0 = this.ctx.currentTime + 0.005;
    for (let i = 0; i < recipe.length; i++) {
      this.playVoice(recipe[i], t0, pitch, vol, this.sfxGain);
    }
  }

  playVoice(v, t0, pitch, volMul, dest) {
    const ctx = this.ctx;
    const t = t0 + (v.delay || 0);
    const dur = v.dur;
    const vol = v.vol * volMul;
    const attack = v.attack !== undefined ? v.attack : 0.005;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    gain.connect(dest);

    const f0 = v.f[0] * pitch;
    const f1 = v.f[1] * pitch;
    let src;
    if (v.wave === 'noise') {
      src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = v.filter || 'lowpass';
      filter.Q.value = v.filter === 'bandpass' ? 1.4 : 0.7;
      filter.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) rampParam(filter.frequency, f1, t + dur, v.curve);
      src.connect(filter);
      filter.connect(gain);
    } else {
      src = ctx.createOscillator();
      if (this.pulseWaves[v.wave]) src.setPeriodicWave(this.pulseWaves[v.wave]);
      else src.type = v.wave;
      src.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) rampParam(src.frequency, f1, t + dur, v.curve);
      src.connect(gain);
    }
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  // ---------------- BGM ----------------

  playMusic(name) {
    if (this.currentSongName === name) return;
    this.currentSongName = name;
    this.currentSong = this.songs[name] || null;
    this.songStep = 0;
    if (this.ctx) this.startSongClock();
  }

  stopMusic() {
    this.currentSongName = '';
    this.currentSong = null;
  }

  startSongClock() {
    this.nextStepTime = this.ctx.currentTime + 0.06;
    this.songStep = 0;
  }

  /** 每帧调用：前瞻 0.15s 调度音符（标签页隐藏时 rAF 停止，音乐也自然暂停） */
  update() {
    const song = this.currentSong;
    if (!song || !this.ctx || this.ctx.state !== 'running') return;
    const stepDur = 60 / (song.bpm * song.stepsPerBeat) / this.musicRate;
    const now = this.ctx.currentTime;
    // 卡顿太久（比如切后台回来）就重新对齐，避免一口气补播一堆音符
    if (this.nextStepTime < now - 0.25) this.nextStepTime = now + 0.02;
    while (this.nextStepTime < now + 0.15) {
      this.scheduleStep(song, this.songStep, this.nextStepTime, stepDur);
      this.songStep = (this.songStep + 1) % song.length;
      this.nextStepTime += stepDur;
    }
  }

  scheduleStep(song, step, t, stepDur) {
    if (this.muted) return;
    for (let i = 0; i < song.tracks.length; i++) {
      const tr = song.tracks[i];
      const ev = tr.parsed.events[step % tr.parsed.length];
      if (!ev) continue;
      if (tr.drums) {
        this.scheduleDrum(ev, t, tr.vol);
      } else {
        const len = ev.len * stepDur * (tr.gate || 0.9);
        this.scheduleNote(tr.wave, ev.freq, t, len, tr.vol);
      }
    }
  }

  scheduleNote(wave, freq, t, len, vol) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    if (this.pulseWaves[wave]) osc.setPeriodicWave(this.pulseWaves[wave]);
    else osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.setValueAtTime(vol * 0.8, t + Math.max(0.01, len * 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + len + 0.02);
  }

  scheduleDrum(kind, t, vol) {
    const hasKick = kind === 'k' || kind === 'K';
    const hasSnare = kind === 's' || kind === 'S';
    const hasHat = kind === 'h' || kind === 'K' || kind === 'S';
    const open = kind === 'o';
    if (hasKick) {
      this.playVoice({ wave: 'sine', f: [150, 42], dur: 0.14, vol: 1.4, attack: 0.002 }, t, 1, vol, this.musicGain);
    }
    if (hasSnare) {
      this.playVoice({ wave: 'noise', f: [2600, 1200], dur: 0.12, vol: 1.0, filter: 'bandpass', attack: 0.002 }, t, 1, vol, this.musicGain);
      this.playVoice({ wave: 'triangle', f: [220, 160], dur: 0.06, vol: 0.6, attack: 0.002 }, t, 1, vol, this.musicGain);
    }
    if (hasHat) {
      this.playVoice({ wave: 'noise', f: [7000, 7000], dur: 0.035, vol: 0.45, filter: 'highpass', attack: 0.001 }, t, 1, vol, this.musicGain);
    }
    if (open) {
      this.playVoice({ wave: 'noise', f: [6500, 6500], dur: 0.16, vol: 0.4, filter: 'highpass', attack: 0.001 }, t, 1, vol, this.musicGain);
    }
  }
}

function rampParam(param, value, time, curve) {
  if (curve === 'lin') param.linearRampToValueAtTime(value, time);
  else param.exponentialRampToValueAtTime(Math.max(1, value), time);
}
