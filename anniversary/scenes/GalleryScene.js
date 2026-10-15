import { el, append, button } from '../systems/ui.js';
import { TEXTS } from '../data/texts.js';
import { CONFIG } from '../config.js';
import { LEVELS } from '../data/levels.js';
import { OBSTACLES } from '../data/obstacles.js';

/**
 * 照片碎片图鉴（7.2）：21 张照片（每关 3 张），已收集的显示照片 + 配文，
 * 没收集的显示"？"和藏法提示（岔路型 / 技巧型 / 挑战型）。点开可以看大图。
 * 照片与配文来自 config.js 的 photos。
 */
export class GalleryScene {
  constructor(game) {
    this.game = game;
  }

  enter() {
    const g = this.game;
    g.world.targetSpeed = 3;
    g.audio.playMusic('title');
    const save = g.save;
    const root = el('div', 'scene-root');
    root.appendChild(el('div', 'dim'));
    const header = el('div', 'select-header', TEXTS.gallery);
    header.style.position = 'relative';
    const stats = el('div', 'select-stats');
    stats.appendChild(el('span', 'select-coins', '照片碎片 ' + save.totalPhotos() + ' / 21'));
    if (save.totalPhotos() >= 21) stats.appendChild(button(g, '✦ 回忆放映厅', 'small glow', () => g.switchScene('theater', { from: 'gallery' })));
    const list = el('div', 'level-list gallery-list');
    list.style.position = 'relative';

    for (const lv of LEVELS) {
      const rec = save.peekLevel(lv.id);
      const sec = el('div', 'gallery-level');
      sec.style.setProperty('--lv-color', lv.palette.ui || '#ff6fa5');
      sec.appendChild(el('div', 'gallery-title', '第 ' + lv.id + ' 关 · ' + (lv.available ? lv.name : '？？？')));
      const grid = el('div', 'gallery-grid');
      const photos = CONFIG.photos.filter((p) => p.level === lv.id);
      for (let i = 0; i < 3; i++) {
        const ph = photos[i];
        const got = !!(rec.photos && rec.photos[i]);
        const cell = el('button', 'gallery-cell' + (got ? ' got' : ''));
        cell.type = 'button';
        if (got && ph) {
          const img = el('img');
          img.alt = ph.caption;
          img.loading = 'lazy';
          img.addEventListener('error', () => {
            // 照片加载失败（断网 / 路径写错）：显示配文，不留白
            if (img.parentNode) img.parentNode.replaceChild(el('div', 'noimg', ph.caption), img);
          });
          img.src = ph.src;
          cell.appendChild(img);
          cell.addEventListener('click', () => {
            g.audio.play('click');
            this.openPhoto(ph, lv, i);
          });
        } else {
          cell.appendChild(el('div', 'q', '？'));
          cell.appendChild(el('div', 'hint', this.hintText(lv, i)));
          cell.disabled = true;
        }
        grid.appendChild(cell);
      }
      sec.appendChild(grid);
      list.appendChild(sec);
    }

    const back = el('button', 'icon-btn', '←');
    back.type = 'button';
    back.style.top = 'calc(var(--px) * 4)';
    back.style.left = 'calc(var(--px) * 4)';
    back.setAttribute('aria-label', TEXTS.back);
    back.addEventListener('click', () => {
      g.audio.play('click');
      g.switchScene('select');
    });
    append(root, header, stats, list, back);
    g.ui.appendChild(root);
    this.root = root;
    this.viewer = null;
  }

  hintText(lv, i) {
    if (!lv.available || !lv.photos) return '后续开放';
    const c = lv.photos[i];
    if (!c) return '';
    if (c.type === 'branch') {
      const o = OBSTACLES[c.obstacle];
      return '岔路型：藏在' + (o ? '「' + o.name + '」' : '障碍') + '后面';
    }
    if (c.type === 'skill') return '技巧型：连续完美闪避 ' + c.streak + ' 次';
    const sec = lv.run.sections.find((s) => s.id === c.section);
    return '挑战型：' + (sec ? sec.title : '某一波') + '零失误';
  }

  openPhoto(ph, lv, i) {
    const g = this.game;
    this.closePhoto();
    const wrap = el('div', 'interactive');
    wrap.style.position = 'absolute';
    wrap.style.inset = '0';
    const panel = el('div', 'panel modal photo-view');
    const img = el('img');
    img.alt = ph.caption;
    img.src = ph.src;
    append(
      panel,
      el('div', 'memo', '第 ' + lv.id + ' 关 · ' + lv.name + ' · ' + (i + 1) + '/3'),
      img,
      el('p', 'photo-caption', ph.caption),
      button(g, TEXTS.back, 'ghost', () => this.closePhoto()),
    );
    append(wrap, el('div', 'dim'), panel);
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap.firstChild) this.closePhoto();
    });
    this.root.appendChild(wrap);
    this.viewer = wrap;
  }

  closePhoto() {
    if (this.viewer && this.viewer.parentNode) this.viewer.parentNode.removeChild(this.viewer);
    this.viewer = null;
  }

  exit() {
    this.viewer = null;
  }

  update(dt) {
    const g = this.game;
    g.world.updateDemo(dt);
    while (g.input.next() !== null) {
      /* 图鉴不处理游戏动作 */
    }
    if (g.input.consumeConfirm() && this.viewer) this.closePhoto();
  }

  render() {
    const g = this.game;
    g.world.render(g.screen);
    g.screen.present(0, 0);
    g.screen.endFrame();
  }
}
