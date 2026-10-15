import { Pool } from './pool.js';
import { SPRITES } from './sprites.js';

/**
 * 粒子系统（画在像素缓冲上，坐标单位：缓冲像素）。
 * 落地尘土、金币闪光、受击碎片、彩纸、爱心、星星、冲击环。
 */
export const PK = {
  SQUARE: 0,
  CONFETTI: 1,
  HEART: 2,
  STAR: 3,
  RING: 4,
  DUST: 5,
  HEART_LIGHT: 6,
  STAR_WHITE: 7,
};

export const CONFETTI_COLORS = ['#ff6fa5', '#ffd23f', '#4fb3ff', '#5cc77a', '#a77bff', '#ffffff', '#ff8a3c'];
export const DUST_COLORS = ['#ffffff', '#f3dce8', '#e8cfe0'];
export const GOLD_COLORS = ['#ffd23f', '#fff6c2', '#ffe066'];
export const PINK_COLORS = ['#ff6fa5', '#ffb3cf', '#ffffff'];

export class Particles {
  constructor(capacity = 360) {
    this.pool = new Pool(
      () => ({ x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, life: 0, max: 1, size: 1, color: '#fff', kind: 0, spin: 0 }),
      capacity,
    );
  }

  spawn(kind, x, y, vx, vy, life, size, color, g = 0, drag = 0) {
    const p = this.pool.obtain();
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.max = life;
    p.size = size;
    p.color = color;
    p.g = g;
    p.drag = drag;
    p.spin = Math.random() * 6.28;
    return p;
  }

  /** 向四周爆开一圈 */
  burst(kind, x, y, count, speed, life, colors, g = 0, size = 1, upBias = 0) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(
        kind,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s - upBias,
        life * (0.6 + Math.random() * 0.4),
        size,
        colors[(Math.random() * colors.length) | 0],
        g,
        1.5,
      );
    }
  }

  ring(x, y, radius, life, color) {
    this.spawn(PK.RING, x, y, 0, 0, life, radius, color);
  }

  clear() {
    this.pool.releaseAll();
  }

  update(dt) {
    const items = this.pool.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.spin += dt * 10;
    }
  }

  render(ctx) {
    const items = this.pool.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      const t = p.life / p.max;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      switch (p.kind) {
        case PK.SQUARE:
          ctx.globalAlpha = t < 0.3 ? t / 0.3 : 1;
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, p.size, p.size);
          break;
        case PK.DUST: {
          ctx.globalAlpha = t * 0.9;
          ctx.fillStyle = p.color;
          const s = Math.max(1, Math.round(p.size * (0.5 + t * 0.5)));
          ctx.fillRect(x, y, s, s);
          break;
        }
        case PK.CONFETTI: {
          ctx.globalAlpha = t < 0.25 ? t / 0.25 : 1;
          ctx.fillStyle = p.color;
          const c = Math.cos(p.spin);
          const w = Math.abs(c) > 0.5 ? 2 : 1;
          ctx.fillRect(x, y, w, 3 - w);
          break;
        }
        case PK.HEART:
        case PK.HEART_LIGHT:
          ctx.globalAlpha = t < 0.3 ? t / 0.3 : 1;
          ctx.drawImage(p.kind === PK.HEART ? SPRITES.pHeart : SPRITES.pHeartLight, x - 2, y - 2);
          break;
        case PK.STAR:
        case PK.STAR_WHITE:
          ctx.globalAlpha = t < 0.4 ? t / 0.4 : 1;
          ctx.drawImage(p.kind === PK.STAR ? SPRITES.pStar : SPRITES.pStarWhite, x - 2, y - 2);
          break;
        case PK.RING: {
          ctx.globalAlpha = t;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 - t) + 2, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}
