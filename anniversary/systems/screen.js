import { SCREEN } from '../data/constants.js';

/**
 * 画面系统：
 * - 主画布铺满窗口（按设备像素比），只在中间的"游戏区域"作画；
 * - 世界画在低分辨率像素缓冲（W×H）上，再按整数倍 scale 放大 → 像素锐利；
 * - HUD 用同样的坐标系（缓冲像素）直接画在主画布上 → 中文文字高清不糊；
 * - DOM 界面层 #ui 与游戏区域对齐，CSS 变量 --px = 1 缓冲像素对应的 CSS 像素。
 */
export class Screen {
  constructor(canvas, ui) {
    this.canvas = canvas;
    // alpha:false —— 游戏画面永远铺满整个画布，不透明合成可以绕开部分手机 GPU 的透明混合路径
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ui = ui;
    this.buffer = document.createElement('canvas');
    this.bctx = this.buffer.getContext('2d');
    this.W = SCREEN.minW;
    this.H = SCREEN.minH;
    this.scale = 1;
    this.dpr = 1;
    this.ox = 0;
    this.oy = 0;
    this.devW = 1;
    this.devH = 1;
    this.cssPx = 1;
    this.version = 0; // 每次尺寸变化 +1，供需要重建缓存的系统判断
    this.onResize = null;

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', () => setTimeout(this.handleResize, 120));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this.handleResize);
    this.handleResize();
  }

  handleResize() {
    const dpr = Math.min(window.devicePixelRatio || 1, SCREEN.maxDpr);
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const devW = Math.max(1, Math.round(cssW * dpr));
    const devH = Math.max(1, Math.round(cssH * dpr));

    // 手机地址栏收展：高度小幅来回抖，每次重设画布都会清空 → 游戏中反复闪一帧空白
    // （电脑没有地址栏、微信 webview 也没有，所以只有手机浏览器闪）。
    // 对策：高度变小一律忽略（画面保持全屏高度，顶多被地址栏盖住一条边），
    // 只有高度变大（地址栏收回 / 转屏后变宽）或宽度变化才真正重设。
    if (this.canvas.width > 0 && devW === this.devW && devH < this.devH) return;

    // 整数放大倍率：保证缓冲至少 minW × minH
    const scale = Math.max(1, Math.floor(Math.min(devW / SCREEN.minW, devH / SCREEN.minH)));
    const W = clamp(Math.floor(devW / scale), SCREEN.minW, SCREEN.maxW);
    const H = clamp(Math.floor(devH / scale), SCREEN.minH, SCREEN.maxH);

    const changed = W !== this.W || H !== this.H || scale !== this.scale || devW !== this.devW || devH !== this.devH;
    this.dpr = dpr;
    this.devW = devW;
    this.devH = devH;
    this.scale = scale;
    this.W = W;
    this.H = H;
    this.ox = Math.floor((devW - W * scale) / 2);
    this.oy = Math.floor((devH - H * scale) / 2);
    // 手机地址栏收展 / 回弹会连发 resize，但尺寸往往没变：重设 canvas 尺寸会清空画布 → 整屏闪白。
    // 只有尺寸真正变化时才碰画布 / 样式 / UI 对齐。
    if (!changed) return;

    this.canvas.width = devW;
    this.canvas.height = devH;
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    if (this.buffer.width !== W || this.buffer.height !== H) {
      this.buffer.width = W;
      this.buffer.height = H;
    }
    this.bctx.imageSmoothingEnabled = false;
    this.ctx.imageSmoothingEnabled = false;

    // DOM 界面层与游戏区域对齐
    this.cssPx = scale / dpr;
    const ui = this.ui;
    ui.style.left = this.ox / dpr + 'px';
    ui.style.top = this.oy / dpr + 'px';
    ui.style.width = (W * scale) / dpr + 'px';
    ui.style.height = (H * scale) / dpr + 'px';
    document.documentElement.style.setProperty('--px', this.cssPx + 'px');

    this.version++;
    if (this.onResize) this.onResize();
  }

  /** 把像素缓冲放大画到主画布（shakeX/shakeY 单位：缓冲像素，可为小数 → 震动更顺滑） */
  present(shakeX, shakeY) {
    const ctx = this.ctx;
    const s = this.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // 画布外露边距（桌面横屏两侧）填成页面同款底色
    ctx.fillStyle = '#3a1d3f';
    ctx.fillRect(0, 0, this.devW, this.devH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.ox, this.oy, this.W * s, this.H * s);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(s, 0, 0, s, this.ox + Math.round(shakeX * s), this.oy + Math.round(shakeY * s));
    ctx.drawImage(this.buffer, 0, 0);
    // HUD 坐标系：缓冲像素，不随镜头震动
    ctx.setTransform(s, 0, 0, s, this.ox, this.oy);
  }

  /** HUD 绘制结束后调用，恢复裁剪 */
  endFrame() {
    this.ctx.restore();
  }

  /** 把 CSS 像素坐标（如触摸点）换算成缓冲像素坐标 */
  cssToBuffer(cssX, cssY, out) {
    out.x = (cssX * this.dpr - this.ox) / this.scale;
    out.y = (cssY * this.dpr - this.oy) / this.scale;
    return out;
  }
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
