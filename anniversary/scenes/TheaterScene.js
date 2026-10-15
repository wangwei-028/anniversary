import { el, append, button, clear } from '../systems/ui.js';
import { CONFIG } from '../config.js';
import { getLevel } from '../data/levels.js';
import { drawNightSky, makeGroupPhoto } from '../systems/finale.js';
import { daysTogether } from '../systems/anniversary.js';

/**
 * 隐藏结局《回忆放映厅》（9.2）：照片墙按时间线放映 21 张照片（每张配一句话）
 * → （Boss Rush 通关后）第 22 张「群星之夜」→ "在一起的第 365 天" → 你的信（全屏滚动）→ "下一关，一起玩。"（End）
 * 点屏幕 = 下一张；右上角可以直接跳到信。照片 / 配文 / 信都在 config.js。
 */
const PHOTO_TIME = 5.5;

export class TheaterScene {
  constructor(game) {
    this.game = game;
  }

  enter(params) {
    const g = this.game;
    this.t = 0;
    this.from = (params && params.from) || 'title';
    g.audio.stopMusic();
    g.audio.playMusic('theater');
    g.save.data.theaterSeen = true;
    g.save.save();

    this.pages = [{ type: 'title' }];
    CONFIG.photos.forEach((p, i) => this.pages.push({ type: 'photo', photo: p, index: i }));
    if (g.save.data.rush.cleared) {
      const c = makeGroupPhoto(180, 240);
      this.pages.push({ type: 'photo', photo: { src: c.toDataURL(), caption: '群星之夜 · 这一年所有的"对手"，都来合影了。' }, index: 21, special: true });
    }
    this.pages.push({ type: 'days' }, { type: 'letter' }, { type: 'end' });
    this.page = -1;
    this.pageT = 0;

    const root = el('div', 'scene-root interactive theater');
    this.stage = el('div', 'theater-stage');
    this.stage.addEventListener('click', () => this.onTap());
    const skip = button(g, '跳到信 ›', 'small ghost theater-skip', () => this.gotoType('letter'));
    this.skipBtn = skip;
    append(root, this.stage, skip);
    g.ui.appendChild(root);
    this.root = root;
    this.next();
  }

  gotoType(type) {
    const i = this.pages.findIndex((p) => p.type === type);
    if (i >= 0) {
      this.page = i - 1;
      this.next();
    }
  }

  onTap() {
    const p = this.pages[this.page];
    if (!p || p.type === 'letter' || p.type === 'end') return;
    if (this.pageT < 0.4) return;
    this.game.audio.play('click');
    this.next();
  }

  next() {
    if (this.page >= this.pages.length - 1) return;
    this.page++;
    this.pageT = 0;
    this.renderPage();
  }

  renderPage() {
    const g = this.game;
    const p = this.pages[this.page];
    clear(this.stage);
    this.skipBtn.style.visibility = p.type === 'letter' || p.type === 'end' ? 'hidden' : 'visible';
    const box = el('div', 'theater-page fade-in');
    if (p.type === 'title') {
      append(box, el('div', 'theater-title', '回忆放映厅'), el('div', 'theater-sub', '这一年，我们一起去过的地方'), el('div', 'theater-hint', '点屏幕翻到下一张'));
    } else if (p.type === 'photo') {
      const pol = el('div', 'polaroid' + (p.special ? ' special' : ''));
      const img = el('img');
      img.alt = p.photo.caption;
      img.addEventListener('error', () => {
        if (img.parentNode) img.parentNode.replaceChild(el('div', 'polaroid-missing', '（照片加载失败：检查 config.js 里的路径）'), img);
      });
      img.src = p.photo.src;
      const lv = p.photo.level ? getLevel(p.photo.level) : null;
      const label = p.special ? '第 22 张 · 群星之夜' : '第 ' + (p.index + 1) + ' 张' + (lv ? ' · ' + lv.name : '');
      append(pol, img, el('div', 'polaroid-caption', p.photo.caption));
      append(box, el('div', 'theater-label', label), pol);
      if (!p.special) {
        const dots = el('div', 'theater-dots');
        for (let i = 0; i < CONFIG.photos.length; i++) dots.appendChild(el('span', i <= p.index ? 'on' : ''));
        box.appendChild(dots);
      }
    } else if (p.type === 'days') {
      const n = daysTogether();
      append(box, el('div', 'theater-days', '在一起的第 365 天'));
      if (n !== null && n !== 365) box.appendChild(el('div', 'theater-sub', '（今天是第 ' + n + ' 天）'));
    } else if (p.type === 'letter') {
      const L = CONFIG.letter;
      const letter = el('div', 'theater-letter');
      letter.appendChild(el('h2', null, L.title));
      for (const para of L.paragraphs) letter.appendChild(el('p', null, para));
      letter.appendChild(el('p', 'signature', L.signature));
      letter.appendChild(button(g, '继续', 'big', () => this.next()));
      this.letterEl = letter;
      this.scrollPause = 1.5;
      this.letterScroll = 0;
      const hold = () => {
        this.scrollPause = 2.5;
        this.letterScroll = letter.scrollTop;
      };
      letter.addEventListener('wheel', hold, { passive: true });
      letter.addEventListener('touchmove', hold, { passive: true });
      box.appendChild(letter);
    } else {
      append(
        box,
        el('div', 'theater-title', '下一关，一起玩。'),
        el('div', 'theater-sub end', 'End'),
        el('div', 'row theater-btns'),
      );
      const row = box.lastChild;
      append(
        row,
        button(g, '再看一遍', 'ghost', () => {
          this.page = -1;
          this.next();
        }),
        button(g, this.from === 'gallery' ? '回到图鉴' : '回到标题', '', () => g.switchScene(this.from === 'gallery' ? 'gallery' : 'title')),
      );
    }
    this.stage.appendChild(box);
  }

  exit() {
    this.letterEl = null;
  }

  update(dt) {
    const g = this.game;
    this.t += dt;
    this.pageT += dt;
    while (g.input.next() !== null) {
      /* 放映厅不处理游戏动作 */
    }
    if (g.input.consumeConfirm()) this.onTap();
    const p = this.pages[this.page];
    if (!p) return;
    if ((p.type === 'photo' && this.pageT > PHOTO_TIME) || ((p.type === 'title' || p.type === 'days') && this.pageT > 4)) this.next();
    // 信：慢慢自动滚动（手动滑动后暂停一会儿）
    if (p.type === 'letter' && this.letterEl) {
      if (this.scrollPause > 0) this.scrollPause -= dt;
      else {
        this.letterScroll += dt * 14;
        this.letterEl.scrollTop = this.letterScroll;
      }
    }
  }

  render() {
    const g = this.game;
    const sc = g.screen;
    drawNightSky(sc.bctx, sc.W, sc.H, this.t);
    sc.present(0, 0);
    sc.endFrame();
  }
}
